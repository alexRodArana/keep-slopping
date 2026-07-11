import { initialState } from './data'
import type { ActiveMealSession, AppState, Ingredient, Meal, MealSession } from './types'

const STORAGE_KEY = 'keep-slopping-state-v1'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeIngredient = (value: unknown, index: number): Ingredient => {
  if (!isRecord(value)) {
    return {
      id: `ingredient-${index + 1}`,
      name: 'Ingrediente',
      amount: '',
      calories: 0,
    }
  }

  return {
    id: String(value.id ?? `ingredient-${index + 1}`),
    name: String(value.name ?? 'Ingrediente'),
    amount: String(value.amount ?? ''),
    calories: Math.max(0, toNumber(value.calories)),
  }
}

const normalizeMeals = (value: unknown): Meal[] => {
  if (!Array.isArray(value)) {
    return initialState.meals
  }

  const meals = value
    .filter(isRecord)
    .map((meal, mealIndex) => ({
      id: String(meal.id ?? `meal-${mealIndex + 1}`),
      name: String(meal.name ?? `Comida ${mealIndex + 1}`),
      slot: String(meal.slot ?? ''),
      ingredients: Array.isArray(meal.ingredients)
        ? meal.ingredients.map(normalizeIngredient).filter((ingredient) => ingredient.name.trim())
        : [],
    }))
    .filter((meal) => meal.name.trim() && meal.ingredients.length)

  return meals.length ? meals : initialState.meals
}

const normalizeCheckedIds = (value: unknown) => (Array.isArray(value) ? value.map(String).filter(Boolean) : [])

const normalizeActiveSession = (value: unknown): ActiveMealSession | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    id: String(value.id ?? `active-${Date.now()}`),
    mealId: String(value.mealId ?? ''),
    date: String(value.date ?? new Date().toISOString().slice(0, 10)),
    startedAt: String(value.startedAt ?? new Date().toISOString()),
    checkedIngredientIds: normalizeCheckedIds(value.checkedIngredientIds),
  }
}

const normalizeSessions = (value: unknown): MealSession[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isRecord).map((session, index) => ({
    id: String(session.id ?? `session-${index + 1}`),
    mealId: String(session.mealId ?? ''),
    date: String(session.date ?? new Date().toISOString().slice(0, 10)),
    startedAt: String(session.startedAt ?? new Date().toISOString()),
    endedAt: String(session.endedAt ?? session.startedAt ?? new Date().toISOString()),
    checkedIngredientIds: normalizeCheckedIds(session.checkedIngredientIds),
    completed: Boolean(session.completed),
  }))
}

const getSessionTime = (session: Pick<MealSession, 'startedAt' | 'endedAt'>) => {
  const endedAt = new Date(session.endedAt).getTime()
  const startedAt = new Date(session.startedAt).getTime()

  return Number.isNaN(endedAt) ? (Number.isNaN(startedAt) ? 0 : startedAt) : endedAt
}

const normalizeMealSessions = (sessions: MealSession[], meals: Meal[]) => {
  const ingredientIdsByMeal = new Map(meals.map((meal) => [meal.id, new Set(meal.ingredients.map((ingredient) => ingredient.id))]))
  const latestSessions = new Map<string, MealSession>()

  sessions.forEach((session) => {
    const ingredientIds = ingredientIdsByMeal.get(session.mealId)
    if (!ingredientIds) {
      return
    }

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

  return [...latestSessions.values()].sort((a, b) => getSessionTime(b) - getSessionTime(a) || b.date.localeCompare(a.date))
}

const normalizeActiveMealSession = (activeSession: ActiveMealSession | undefined, meals: Meal[]) => {
  if (!activeSession) {
    return undefined
  }

  const meal = meals.find((item) => item.id === activeSession.mealId)
  if (!meal) {
    return undefined
  }

  const ingredientIds = new Set(meal.ingredients.map((ingredient) => ingredient.id))

  return {
    ...activeSession,
    checkedIngredientIds: activeSession.checkedIngredientIds.filter((id) => ingredientIds.has(id)),
  }
}

export const normalizeState = (value: unknown): AppState => {
  if (!isRecord(value)) {
    return initialState
  }

  const meals = normalizeMeals(value.meals)
  const activeSession = normalizeActiveSession(value.activeSession)

  return {
    meals,
    sessions: normalizeMealSessions(normalizeSessions(value.sessions), meals),
    activeSession: normalizeActiveMealSession(activeSession, meals),
  }
}

export const loadState = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? normalizeState(JSON.parse(stored)) : initialState
  } catch (error) {
    console.error('Could not load Keep Slopping state', error)
    return initialState
  }
}

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
