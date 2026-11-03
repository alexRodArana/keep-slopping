import { CURRENT_PLAN_VERSION, defaultMeals, defaultPlanNotes, defaultTarget } from './data'
import { isMealSessionComplete, resolveMealOption } from './domain'
import type { AppState, Ingredient, Meal, MealOption, MealSession, Nutrition } from './types'

const STORAGE_KEY = 'keep-slopping-state-v1'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toNonNegativeNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const cloneNutrition = (nutrition: Nutrition): Nutrition => ({ ...nutrition })

const cloneIngredients = (ingredients: Ingredient[]): Ingredient[] =>
  ingredients.map((ingredient) => ({ ...ingredient }))

const cloneMealOption = (option: MealOption): MealOption => ({
  ...option,
  ingredients: cloneIngredients(option.ingredients),
  nutrition: cloneNutrition(option.nutrition),
})

const cloneMeals = (meals: Meal[]): Meal[] =>
  meals.map((meal) => {
    const clone: Meal = {
      ...meal,
      ingredients: cloneIngredients(meal.ingredients),
      nutrition: cloneNutrition(meal.nutrition),
    }

    if (meal.options) {
      clone.options = meal.options.map(cloneMealOption)
    }

    return clone
  })

const freshInitialState = (creatineDates: string[] = []): AppState => ({
  planVersion: CURRENT_PLAN_VERSION,
  target: cloneNutrition(defaultTarget),
  planNotes: [...defaultPlanNotes],
  creatineDates,
  meals: cloneMeals(defaultMeals),
  sessions: [],
})

const normalizeNutrition = (value: unknown, fallback: Nutrition): Nutrition => {
  if (!isRecord(value)) {
    return cloneNutrition(fallback)
  }

  const macro = (key: 'protein' | 'carbs' | 'fat') => {
    if (value[key] === null) return null
    const parsed = Number(value[key])
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback[key]
  }

  return {
    calories: toNonNegativeNumber(value.calories, fallback.calories),
    protein: macro('protein'),
    carbs: macro('carbs'),
    fat: macro('fat'),
  }
}

const normalizeIngredient = (value: Record<string, unknown>, index: number): Ingredient => ({
  id: String(value.id ?? `ingredient-${index + 1}`),
  name: String(value.name ?? 'Ingrediente'),
  amount: String(value.amount ?? ''),
})

const normalizeIngredients = (value: unknown): Ingredient[] =>
  Array.isArray(value) ? value.filter(isRecord).map(normalizeIngredient) : []

const normalizeMealOption = (value: Record<string, unknown>, index: number): MealOption => ({
  id: String(value.id ?? `option-${index + 1}`),
  name: String(value.name ?? `Opción ${index + 1}`),
  ingredients: normalizeIngredients(value.ingredients),
  nutrition: normalizeNutrition(value.nutrition, { calories: 0, protein: 0, carbs: 0, fat: 0 }),
})

const normalizeMeals = (value: unknown): Meal[] => {
  if (!Array.isArray(value)) {
    return cloneMeals(defaultMeals)
  }

  return value.filter(isRecord).map((meal, mealIndex) => {
    const normalizedMeal: Meal = {
      id: String(meal.id ?? `meal-${mealIndex + 1}`),
      name: String(meal.name ?? `Comida ${mealIndex + 1}`),
      ingredients: normalizeIngredients(meal.ingredients),
      nutrition: normalizeNutrition(meal.nutrition, { calories: 0, protein: 0, carbs: 0, fat: 0 }),
    }
    const options = Array.isArray(meal.options)
      ? meal.options.filter(isRecord).map(normalizeMealOption)
      : []

    if (options.length) {
      normalizedMeal.options = options
      const requestedDefault = typeof meal.defaultOptionId === 'string' ? meal.defaultOptionId : ''
      normalizedMeal.defaultOptionId = options.some((option) => option.id === requestedDefault)
        ? requestedDefault
        : options[0].id

      if (typeof meal.optionSourceMealId === 'string' && meal.optionSourceMealId.trim()) {
        normalizedMeal.optionSourceMealId = meal.optionSourceMealId
      }
    }

    return normalizedMeal
  })
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

    const normalizedSession: MealSession = {
      id: String(session.id ?? `session-${index + 1}`),
      mealId: String(session.mealId ?? ''),
      date: String(session.date ?? new Date().toISOString().slice(0, 10)),
      startedAt,
      endedAt: String(session.endedAt ?? startedAt),
      checkedIngredientIds: normalizeCheckedIds(session.checkedIngredientIds),
      completed: Boolean(session.completed),
    }

    if (typeof session.optionId === 'string' && session.optionId.trim()) {
      normalizedSession.optionId = session.optionId
    }

    return normalizedSession
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

    let cleanedSession: MealSession
    if (meal.options?.length) {
      const option = session.optionId ? resolveMealOption(meal, session.optionId) : undefined

      if (!option) {
        const { optionId: _invalidOptionId, ...sessionWithoutOption } = session
        cleanedSession = {
          ...sessionWithoutOption,
          checkedIngredientIds: [],
          completed: false,
        }
      } else {
        const ingredientIds = new Set(option.ingredients.map((ingredient) => ingredient.id))
        cleanedSession = {
          ...session,
          checkedIngredientIds: session.checkedIngredientIds.filter((id) => ingredientIds.has(id)),
        }
        cleanedSession.completed = isMealSessionComplete(cleanedSession, meal)
      }
    } else {
      const ingredientIds = new Set(meal.ingredients.map((ingredient) => ingredient.id))
      const { optionId: _flatMealOptionId, ...sessionWithoutOption } = session
      cleanedSession = {
        ...sessionWithoutOption,
        checkedIngredientIds: session.checkedIngredientIds.filter((id) => ingredientIds.has(id)),
        completed: false,
      }
      cleanedSession.completed = isMealSessionComplete(cleanedSession, meal)
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
  isRecord(value) &&
  ('foodLogs' in value ||
    'activeSession' in value ||
    'notes' in value ||
    (Array.isArray(value.meals) && value.meals.some((meal) => isRecord(meal) && 'slot' in meal)))

export const normalizeState = (value: unknown): AppState => {
  if (!isRecord(value)) {
    return freshInitialState()
  }

  const creatineDates = normalizeDateList(value.creatineDates)

  const meals = normalizeMeals(value.meals)
  const rawVersion = Math.trunc(Number(value.planVersion))

  return {
    planVersion: Number.isFinite(rawVersion) ? Math.max(CURRENT_PLAN_VERSION, rawVersion) : CURRENT_PLAN_VERSION,
    target: normalizeNutrition(value.target, defaultTarget),
    ...(Array.isArray(value.planNotes)
      ? { planNotes: value.planNotes.filter((note): note is string => typeof note === 'string' && Boolean(note.trim())) }
      : {}),
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
