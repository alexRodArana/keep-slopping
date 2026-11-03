import type { Ingredient, Meal, MealOption, MealSession, Nutrition } from './types'

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const numberFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 })

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const toLocalDate = (value: string) => new Date(`${value}T12:00:00`)

export const todayIso = () => toDateKey(new Date())

export const formatDate = (value: string) => dateFormatter.format(toLocalDate(value))

export const formatNumber = (value: number) => numberFormatter.format(value)

const getSessionKey = (session: Pick<MealSession, 'date' | 'mealId'>) => `${session.date}::${session.mealId}`

const getSessionTime = (session: Pick<MealSession, 'startedAt' | 'endedAt'>) => {
  const endedAt = new Date(session.endedAt).getTime()
  const startedAt = new Date(session.startedAt).getTime()

  if (!Number.isNaN(endedAt)) {
    return endedAt
  }

  return Number.isNaN(startedAt) ? 0 : startedAt
}

export const getLatestMealSession = (sessions: MealSession[], mealId: string, date: string) => {
  let latest: MealSession | undefined

  sessions.forEach((session) => {
    if (
      session.mealId === mealId &&
      session.date === date &&
      (!latest || getSessionTime(session) >= getSessionTime(latest))
    ) {
      latest = session
    }
  })

  return latest
}

export const getMealSessionsForDate = (sessions: MealSession[], date: string) => {
  const latest = new Map<string, MealSession>()
  for (const session of sessions) {
    if (session.date !== date) continue
    const previous = latest.get(session.mealId)
    if (!previous || getSessionTime(session) >= getSessionTime(previous)) latest.set(session.mealId, session)
  }
  return latest
}

export const upsertMealSession = (sessions: MealSession[], nextSession: MealSession) => {
  const nextKey = getSessionKey(nextSession)
  const remaining = sessions.filter((session) => getSessionKey(session) !== nextKey)
  const nextTime = getSessionTime(nextSession)
  const insertAt = remaining.findIndex((session) => getSessionTime(session) <= nextTime)

  if (insertAt === -1) {
    return [...remaining, nextSession]
  }

  return [...remaining.slice(0, insertAt), nextSession, ...remaining.slice(insertAt)]
}

export const resolveMealOption = (meal: Meal, optionId?: string): MealOption | undefined => {
  if (!meal.options?.length) {
    return undefined
  }

  const resolvedOptionId = optionId ?? meal.defaultOptionId
  return meal.options.find((option) => option.id === resolvedOptionId)
}

export const resolveMealIngredients = (meal: Meal, optionId?: string): Ingredient[] => {
  if (!meal.options?.length) {
    return meal.ingredients
  }

  return resolveMealOption(meal, optionId)?.ingredients ?? []
}

export const resolveMealNutrition = (meal: Meal, optionId?: string): Nutrition | undefined => {
  if (!meal.options?.length) {
    return meal.nutrition
  }

  return resolveMealOption(meal, optionId)?.nutrition
}

export const isMealSessionComplete = (
  session: Pick<MealSession, 'checkedIngredientIds' | 'optionId'>,
  meal: Meal,
) => {
  if (meal.options?.length && !session.optionId) {
    return false
  }

  const ingredients = resolveMealIngredients(meal, session.optionId)
  if (!ingredients.length) {
    return false
  }

  const checkedIds = new Set(session.checkedIngredientIds)
  return ingredients.every((ingredient) => checkedIds.has(ingredient.id))
}
