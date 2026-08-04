import { describe, expect, it } from 'vitest'
import { normalizeState } from './storage'

describe('state migration', () => {
  it('loads legacy states without food logs and preserves an intentionally empty plan', () => {
    const state = normalizeState({
      creatineDates: [],
      meals: [],
      sessions: [],
    })

    expect(state.foodLogs).toEqual([])
    expect(state.meals).toEqual([])
  })

  it('assigns a stable default option to legacy sessions', () => {
    const state = normalizeState({
      creatineDates: [],
      meals: [
        {
          id: 'breakfast',
          name: 'Desayuno',
          slot: 'Mañana',
          ingredients: [{ id: 'egg', name: 'Huevo', amount: '1', calories: 72 }],
        },
      ],
      sessions: [
        {
          id: 'session-1',
          mealId: 'breakfast',
          date: '2026-08-04',
          startedAt: '2026-08-04T08:00:00.000Z',
          endedAt: '2026-08-04T08:10:00.000Z',
          checkedIngredientIds: ['egg'],
          completed: true,
        },
      ],
    })

    expect(state.meals[0].options).toBeUndefined()
    expect(state.sessions[0]).toMatchObject({ optionId: 'breakfast-default', checkedIngredientIds: ['egg'] })
  })

  it('keeps only ingredients from the selected meal option', () => {
    const state = normalizeState({
      creatineDates: [],
      meals: [
        {
          id: 'breakfast',
          name: 'Desayuno',
          slot: 'Mañana',
          ingredients: [{ id: 'shake-protein', name: 'Proteína', amount: '1 medida', calories: 120 }],
          options: [
            {
              id: 'shake',
              name: 'Licuado',
              ingredients: [{ id: 'shake-protein', name: 'Proteína', amount: '1 medida', calories: 120 }],
            },
            {
              id: 'omelette',
              name: 'Omelette',
              ingredients: [{ id: 'omelette-egg', name: 'Huevo', amount: '1', calories: 72 }],
            },
          ],
        },
      ],
      sessions: [
        {
          id: 'session-1',
          mealId: 'breakfast',
          optionId: 'omelette',
          date: '2026-08-04',
          startedAt: '2026-08-04T08:00:00.000Z',
          endedAt: '2026-08-04T08:10:00.000Z',
          checkedIngredientIds: ['shake-protein', 'omelette-egg'],
          completed: true,
        },
      ],
    })

    expect(state.meals[0].options).toHaveLength(2)
    expect(state.sessions[0]).toMatchObject({ optionId: 'omelette', checkedIngredientIds: ['omelette-egg'] })
  })
})
