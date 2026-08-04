import { initialState } from './data'
import { getMealOption } from './mealUtils'
import type { ActiveMealSession, AppState, FoodLog, Ingredient, Meal, MealOption, MealSession } from './types'

const STORAGE_KEY = 'keep-slopping-state-v1'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toOptionalNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

const toImageUrl = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
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
    barcode: value.barcode ? String(value.barcode) : undefined,
    imageUrl: toImageUrl(value.imageUrl),
    grams: toOptionalNumber(value.grams),
    caloriesPer100g: toOptionalNumber(value.caloriesPer100g),
    proteinPer100g: toOptionalNumber(value.proteinPer100g),
    carbsPer100g: toOptionalNumber(value.carbsPer100g),
    fatPer100g: toOptionalNumber(value.fatPer100g),
  }
}

const normalizeMealOptions = (value: unknown, mealId: string): MealOption[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((option, optionIndex) => ({
      id: String(option.id ?? `${mealId}-option-${optionIndex + 1}`),
      name: String(option.name ?? `Opción ${optionIndex + 1}`),
      ingredients: Array.isArray(option.ingredients)
        ? option.ingredients.map(normalizeIngredient).filter((ingredient) => ingredient.name.trim())
        : [],
    }))
    .filter((option) => option.name.trim() && option.ingredients.length)
}

const normalizeMeals = (value: unknown): Meal[] => {
  if (!Array.isArray(value)) {
    return initialState.meals
  }

  const meals = value
    .filter(isRecord)
    .map((meal, mealIndex) => {
      const id = String(meal.id ?? `meal-${mealIndex + 1}`)
      const ingredients = Array.isArray(meal.ingredients)
        ? meal.ingredients.map(normalizeIngredient).filter((ingredient) => ingredient.name.trim())
        : []
      const options = normalizeMealOptions(meal.options, id)

      return {
        id,
        name: String(meal.name ?? `Comida ${mealIndex + 1}`),
        slot: String(meal.slot ?? ''),
        ingredients,
        options: options.length ? options : undefined,
      }
    })
    .filter((meal) => meal.name.trim() && (meal.ingredients.length || meal.options?.length))

  return meals
}

const normalizeCheckedIds = (value: unknown) => (Array.isArray(value) ? value.map(String).filter(Boolean) : [])

const normalizeDateList = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.map(String).filter(Boolean))].sort((a, b) => b.localeCompare(a)) : []

const normalizeFoodLogs = (value: unknown): FoodLog[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(isRecord)
    .map((log, index) => ({
      id: String(log.id ?? `food-log-${index + 1}`),
      date: String(log.date ?? new Date().toISOString().slice(0, 10)),
      createdAt: String(log.createdAt ?? new Date().toISOString()),
      barcode: String(log.barcode ?? ''),
      name: String(log.name ?? 'Alimento'),
      brand: String(log.brand ?? ''),
      imageUrl: toImageUrl(log.imageUrl),
      servingGrams: Math.max(1, toNumber(log.servingGrams, 100)),
      grams: Math.max(1, toNumber(log.grams, 100)),
      caloriesPer100g: Math.max(0, toNumber(log.caloriesPer100g)),
      proteinPer100g: Math.max(0, toNumber(log.proteinPer100g)),
      carbsPer100g: Math.max(0, toNumber(log.carbsPer100g)),
      fatPer100g: Math.max(0, toNumber(log.fatPer100g)),
      calories: Math.max(0, toNumber(log.calories)),
      protein: Math.max(0, toNumber(log.protein)),
      carbs: Math.max(0, toNumber(log.carbs)),
      fat: Math.max(0, toNumber(log.fat)),
    }))
    .filter((log) => log.name.trim() && log.grams > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const normalizeActiveSession = (value: unknown): ActiveMealSession | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    id: String(value.id ?? `active-${Date.now()}`),
    mealId: String(value.mealId ?? ''),
    optionId: value.optionId ? String(value.optionId) : undefined,
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
    optionId: session.optionId ? String(session.optionId) : undefined,
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
  const mealsById = new Map(meals.map((meal) => [meal.id, meal]))
  const latestSessions = new Map<string, MealSession>()

  sessions.forEach((session) => {
    const meal = mealsById.get(session.mealId)
    if (!meal) {
      return
    }

    const option = getMealOption(meal, session.optionId)
    const ingredientIds = new Set(option.ingredients.map((ingredient) => ingredient.id))

    const cleanedSession = {
      ...session,
      optionId: option.id,
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

  const option = getMealOption(meal, activeSession.optionId)
  const ingredientIds = new Set(option.ingredients.map((ingredient) => ingredient.id))

  return {
    ...activeSession,
    optionId: option.id,
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
    creatineDates: normalizeDateList(value.creatineDates),
    foodLogs: normalizeFoodLogs(value.foodLogs),
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
