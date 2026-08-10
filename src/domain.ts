import { getMealOption } from './mealUtils'
import type { ActiveMealSession, FoodLog, Meal, MealSession } from './types'

export type CalendarDay = {
  date: string
  dayNumber: number | null
  isCurrentMonth: boolean
  isFulfilled: boolean
  hasProgress: boolean
}

export type DaySummary = {
  completedMealIds: Set<string>
  creatineCompleted: boolean
  foodLogs: FoodLog[]
  fulfilled: boolean
  hasProgress: boolean
  sessions: MealSession[]
}

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const monthFormatter = new Intl.DateTimeFormat('es-MX', {
  month: 'long',
  year: 'numeric',
})

const compactNumberFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 })
const decimalNumberFormatter = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 })

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const toLocalDate = (value: string) => new Date(`${value}T12:00:00`)

export const todayIso = () => toDateKey(new Date())

export const addMonths = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split('-').map(Number)
  return toMonthKey(new Date(year, month - 1 + offset, 1))
}

export const formatDate = (value: string) => dateFormatter.format(toLocalDate(value))

export const formatMonth = (value: string) => {
  const label = monthFormatter.format(toLocalDate(`${value}-01`))
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

export const formatNumber = (value: number) =>
  (value >= 100 ? compactNumberFormatter : decimalNumberFormatter).format(value)

export const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export const getSessionKey = (session: Pick<MealSession, 'date' | 'mealId'>) => `${session.date}::${session.mealId}`

export const getSessionTime = (session: Pick<MealSession, 'startedAt'> & { endedAt?: string }) => {
  const endedAt = session.endedAt ? new Date(session.endedAt).getTime() : Number.NaN
  const startedAt = new Date(session.startedAt).getTime()
  return Number.isNaN(endedAt) ? (Number.isNaN(startedAt) ? 0 : startedAt) : endedAt
}

export const sortSessionsByRecency = (sessions: MealSession[]) =>
  [...sessions].sort((a, b) => getSessionTime(b) - getSessionTime(a) || b.date.localeCompare(a.date))

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

export const sessionCalories = (session: ActiveMealSession | MealSession, meal?: Meal) => {
  if (!meal) {
    return 0
  }

  const checkedIds = new Set(session.checkedIngredientIds)
  return getMealOption(meal, session.optionId).ingredients.reduce(
    (total, ingredient) => total + (checkedIds.has(ingredient.id) ? ingredient.calories : 0),
    0,
  )
}

export const isMealSessionComplete = (session: ActiveMealSession | MealSession, meal: Meal) => {
  const ingredients = getMealOption(meal, session.optionId).ingredients
  if (!ingredients.length) {
    return false
  }

  const checkedIds = new Set(session.checkedIngredientIds)
  return ingredients.every((ingredient) => checkedIds.has(ingredient.id))
}

const emptyDaySummary = (): DaySummary => ({
  completedMealIds: new Set(),
  creatineCompleted: false,
  foodLogs: [],
  fulfilled: false,
  hasProgress: false,
  sessions: [],
})

export const buildDaySummaries = (
  meals: Meal[],
  sessions: MealSession[],
  creatineDates: string[],
  foodLogs: FoodLog[],
) => {
  const mealsById = new Map(meals.map((meal) => [meal.id, meal]))
  const summaries = new Map<string, DaySummary>()
  const latestSessions = new Map<string, MealSession>()

  sessions.forEach((session) => {
    if (!mealsById.has(session.mealId)) {
      return
    }

    const key = getSessionKey(session)
    const current = latestSessions.get(key)
    if (!current || getSessionTime(session) >= getSessionTime(current)) {
      latestSessions.set(key, session)
    }
  })

  latestSessions.forEach((session) => {
    const summary = summaries.get(session.date) ?? emptyDaySummary()
    summary.sessions.push(session)
    summary.hasProgress = true

    const meal = mealsById.get(session.mealId)
    if (meal && isMealSessionComplete(session, meal)) {
      summary.completedMealIds.add(session.mealId)
    }

    summaries.set(session.date, summary)
  })

  creatineDates.forEach((date) => {
    const summary = summaries.get(date) ?? emptyDaySummary()
    summary.creatineCompleted = true
    summary.hasProgress = true
    summaries.set(date, summary)
  })

  foodLogs.forEach((foodLog) => {
    const summary = summaries.get(foodLog.date) ?? emptyDaySummary()
    summary.foodLogs.push(foodLog)
    summary.hasProgress = true
    summaries.set(foodLog.date, summary)
  })

  summaries.forEach((summary) => {
    summary.fulfilled =
      meals.length > 0 && summary.creatineCompleted && meals.every((meal) => summary.completedMealIds.has(meal.id))
  })

  return summaries
}

export const getDaySummary = (summaries: Map<string, DaySummary>, date: string) =>
  summaries.get(date) ?? emptyDaySummary()

export const buildCalendarDays = (monthKey: string, daySummaries: Map<string, DaySummary>): CalendarDay[] => {
  const [year, month] = monthKey.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return {
        date: `${monthKey}-empty-${index}`,
        dayNumber: null,
        isCurrentMonth: false,
        isFulfilled: false,
        hasProgress: false,
      }
    }

    const date = `${monthKey}-${String(dayNumber).padStart(2, '0')}`
    const summary = getDaySummary(daySummaries, date)
    return {
      date,
      dayNumber,
      isCurrentMonth: true,
      isFulfilled: summary.fulfilled,
      hasProgress: summary.hasProgress,
    }
  })
}
