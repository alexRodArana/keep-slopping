import { CURRENT_PLAN_VERSION, defaultMeals, defaultNotes, defaultTarget } from './data'
import type { AppState, Ingredient, Meal, MealSession, Nutrition } from './types'

const STORAGE_KEY = 'keep-slopping-state-v1'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toNonNegativeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const cloneNutrition = (nutrition: Nutrition): Nutrition => ({ ...nutrition })

const cloneMeals = (meals: Meal[]): Meal[] =>
  meals.map((meal) => ({
    ...meal,
    ingredients: meal.ingredients.map((ingredient) => ({ ...ingredient })),
    nutrition: cloneNutrition(meal.nutrition),
  }))

const freshInitialState = (creatineDates: string[] = []): AppState => ({
  planVersion: CURRENT_PLAN_VERSION,
  target: cloneNutrition(defaultTarget),
  notes: [...defaultNotes],
  creatineDates,
  meals: cloneMeals(defaultMeals),
  sessions: [],
})

const normalizeNutrition = (value: unknown, fallback: Nutrition): Nutrition => {
  if (!isRecord(value)) {
    return cloneNutrition(fallback)
  }

  return {
    calories: toNonNegativeNumber(value.calories, fallback.calories),
    protein: toNonNegativeNumber(value.protein, fallback.protein),
    carbs: toNonNegativeNumber(value.carbs, fallback.carbs),
    fat: toNonNegativeNumber(value.fat, fallback.fat),
  }
}

const normalizeIngredient = (value: Record<string, unknown>, index: number): Ingredient => ({
  id: String(value.id ?? `ingredient-${index + 1}`),
  name: String(value.name ?? 'Ingrediente'),
  amount: String(value.amount ?? ''),
})

const normalizeMeals = (value: unknown): Meal[] => {
  if (!Array.isArray(value)) {
    return cloneMeals(defaultMeals)
  }

  return value.filter(isRecord).map((meal, mealIndex) => ({
    id: String(meal.id ?? `meal-${mealIndex + 1}`),
    name: String(meal.name ?? `Comida ${mealIndex + 1}`),
    slot: String(meal.slot ?? ''),
    ingredients: Array.isArray(meal.ingredients)
      ? meal.ingredients.filter(isRecord).map(normalizeIngredient)
      : [],
    nutrition: normalizeNutrition(meal.nutrition, { calories: 0, protein: 0, carbs: 0, fat: 0 }),
  }))
}

const normalizeDateList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.filter((date): date is string => typeof date === 'string').map((date) => date.trim()).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
}

const normalizeCheckedIds = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))] : []

const normalizeSessions = (value: unknown): MealSession[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((session, index) => {
    const startedAt = String(session.startedAt ?? new Date().toISOString())

    return {
      id: String(session.id ?? `session-${index + 1}`),
      mealId: String(session.mealId ?? ''),
      date: String(session.date ?? new Date().toISOString().slice(0, 10)),
      startedAt,
      endedAt: String(session.endedAt ?? startedAt),
      checkedIngredientIds: normalizeCheckedIds(session.checkedIngredientIds),
      completed: Boolean(session.completed),
    }
  })
}

const getSessionTime = (session: MealSession) => {
  const endedAt = new Date(session.endedAt).getTime()
  const startedAt = new Date(session.startedAt).getTime()
  return Number.isNaN(endedAt) ? (Number.isNaN(startedAt) ? 0 : startedAt) : endedAt
}

const normalizeMealSessions = (sessions: MealSession[], meals: Meal[]) => {
  const mealsById = new Map(meals.map((meal) => [meal.id, meal]))
  const latestSessions = new Map<string, MealSession>()

  sessions.forEach((session) => {
    const meal = mealsById.get(session.mealId)
    if (!meal) {
      return
    }

    const ingredientIds = new Set(meal.ingredients.map((ingredient) => ingredient.id))
    const cleanedSession = {
      ...session,
      checkedIngredientIds: session.checkedIngredientIds.filter((id) => ingredientIds.has(id)),
    }
    const key = `${cleanedSession.date}::${cleanedSession.mealId}`
    const current = latestSessions.get(key)

    if (!current || getSessionTime(cleanedSession) >= getSessionTime(current)) {
      latestSessions.set(key, cleanedSession)
    }
  })

  return [...latestSessions.values()].sort(
    (a, b) => getSessionTime(b) - getSessionTime(a) || b.date.localeCompare(a.date),
  )
}

export const requiresPlanMigration = (value: unknown) => {
  if (!isRecord(value)) {
    return true
  }

  const version = Number(value.planVersion)
  return !Number.isFinite(version) || version < CURRENT_PLAN_VERSION
}

export const hasLegacyStateKeys = (value: unknown) =>
  isRecord(value) && ('foodLogs' in value || 'activeSession' in value)

export const normalizeState = (value: unknown): AppState => {
  if (!isRecord(value)) {
    return freshInitialState()
  }

  const creatineDates = normalizeDateList(value.creatineDates)

  if (requiresPlanMigration(value)) {
    return freshInitialState(creatineDates)
  }

  const meals = normalizeMeals(value.meals)
  const rawVersion = Math.trunc(Number(value.planVersion))

  return {
    planVersion: Math.max(CURRENT_PLAN_VERSION, rawVersion),
    target: normalizeNutrition(value.target, defaultTarget),
    notes: Array.isArray(value.notes)
      ? value.notes.filter((note): note is string => typeof note === 'string')
      : [...defaultNotes],
    creatineDates,
    meals,
    sessions: normalizeMealSessions(normalizeSessions(value.sessions), meals),
  }
}

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const loadState = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return freshInitialState()
    }

    const value: unknown = JSON.parse(stored)
    const state = normalizeState(value)

    if (requiresPlanMigration(value) || hasLegacyStateKeys(value)) {
      try {
        saveState(state)
      } catch (error) {
        console.error('Could not persist migrated Keep Slopping state', error)
      }
    }

    return state
  } catch (error) {
    console.error('Could not load Keep Slopping state', error)
    return freshInitialState()
  }
}
