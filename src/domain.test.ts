import { describe, expect, it } from 'vitest'
import { formatNumber, getLatestMealSession, getMealSessionsForDate, isMealSessionComplete, upsertMealSession } from './domain'
import type { Meal, MealSession } from './types'

const meal: Meal = {
  id: 'breakfast',
  name: 'Desayuno',
  ingredients: [
    { id: 'oats', name: 'Avena', amount: '50 g' },
    { id: 'whey', name: 'Proteína whey', amount: '1 scoop' },
  ],
  nutrition: { calories: 493, protein: 40, carbs: 67, fat: 7 },
}

const session = (patch: Partial<MealSession> = {}): MealSession => ({
  id: 'session-1',
  mealId: meal.id,
  date: '2026-08-10',
  startedAt: '2026-08-10T12:00:00.000Z',
  endedAt: '2026-08-10T12:10:00.000Z',
  checkedIngredientIds: ['oats', 'whey'],
  completed: true,
  ...patch,
})

describe('checklist domain', () => {
  it('indexes only the latest session for every meal on the selected local day', () => {
    const older = session()
    const newer = session({ id: 'newer', endedAt: '2026-08-10T13:00:00.000Z' })
    const dinner = session({ id: 'dinner', mealId: 'dinner' })
    const otherDay = session({ id: 'tomorrow', date: '2026-08-11' })
    const result = getMealSessionsForDate([newer, otherDay, older, dinner], older.date)
    expect([...result.values()].map((item) => item.id)).toEqual(['newer', 'dinner'])
  })

  it('preserves the PDF precision for decimal macros above 100 grams', () => {
    expect(formatNumber(108.2)).toBe('108.2')
    expect(formatNumber(1027)).toBe('1,027')
  })

  it('finds and replaces the latest session for a meal and date', () => {
    const oldSession = session()
    const latestSession = session({ id: 'session-2', endedAt: '2026-08-10T12:20:00.000Z' })
    const dinner = session({ id: 'dinner', mealId: 'dinner', endedAt: '2026-08-10T21:00:00.000Z' })

    expect(getLatestMealSession([oldSession, dinner, latestSession], meal.id, oldSession.date)?.id).toBe('session-2')

    const sessions = upsertMealSession([oldSession, dinner], latestSession)
    expect(sessions.map((item) => item.id)).toEqual(['dinner', 'session-2'])
  })

  it('completes a meal only when every ingredient is checked', () => {
    expect(isMealSessionComplete(session(), meal)).toBe(true)
    expect(isMealSessionComplete(session({ checkedIngredientIds: ['oats'] }), meal)).toBe(false)
    expect(isMealSessionComplete(session(), { ...meal, ingredients: [] })).toBe(false)
  })
})
