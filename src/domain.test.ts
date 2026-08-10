import { describe, expect, it } from 'vitest'
import {
  buildCalendarDays,
  buildDaySummaries,
  getLatestMealSession,
  getSessionKey,
  upsertMealSession,
} from './domain'
import type { Meal, MealSession } from './types'

const meal: Meal = {
  id: 'breakfast',
  name: 'Desayuno',
  slot: 'Mañana',
  ingredients: [{ id: 'shake', name: 'Licuado', amount: '1', calories: 200 }],
  options: [
    {
      id: 'omelette',
      name: 'Omelette',
      ingredients: [
        { id: 'egg', name: 'Huevo', amount: '1', calories: 72 },
        { id: 'whites', name: 'Claras', amount: '90 ml', calories: 47 },
      ],
    },
  ],
}

const session = (patch: Partial<MealSession> = {}): MealSession => ({
  id: 'session-1',
  mealId: meal.id,
  optionId: 'omelette',
  date: '2026-08-10',
  startedAt: '2026-08-10T12:00:00.000Z',
  endedAt: '2026-08-10T12:10:00.000Z',
  checkedIngredientIds: ['egg', 'whites'],
  completed: true,
  ...patch,
})

describe('nutrition domain', () => {
  it('finds and replaces a daily meal session without sorting the full collection', () => {
    const oldSession = session()
    const latestSession = session({ id: 'session-2', endedAt: '2026-08-10T12:20:00.000Z' })
    const dinner = session({ id: 'dinner', mealId: 'dinner', endedAt: '2026-08-10T21:00:00.000Z' })

    expect(getLatestMealSession([oldSession, dinner, latestSession], meal.id, oldSession.date)?.id).toBe('session-2')

    const sessions = upsertMealSession([oldSession, dinner], latestSession)
    expect(sessions.map(getSessionKey)).toEqual(['2026-08-10::dinner', '2026-08-10::breakfast'])
    expect(sessions.filter((item) => getSessionKey(item) === getSessionKey(latestSession))).toHaveLength(1)
  })

  it('uses the selected option to calculate fulfilled days', () => {
    const summaries = buildDaySummaries([meal], [session()], ['2026-08-10'], [])
    expect(summaries.get('2026-08-10')).toMatchObject({ fulfilled: true, hasProgress: true })
  })

  it('keeps the calendar inside the real month', () => {
    const days = buildCalendarDays('2026-08', new Map())
    expect(days).toHaveLength(42)
    expect(days.filter((day) => day.dayNumber !== null).map((day) => day.dayNumber)).toEqual(
      Array.from({ length: 31 }, (_, index) => index + 1),
    )
  })
})
