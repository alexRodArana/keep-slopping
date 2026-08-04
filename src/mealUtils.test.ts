import { describe, expect, it } from 'vitest'
import { dayCalorieRange, getMealOption, getMealOptions, mealCalorieRange } from './mealUtils'
import type { Meal } from './types'

const meal: Meal = {
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
      ingredients: [
        { id: 'omelette-egg', name: 'Huevo', amount: '1', calories: 72 },
        { id: 'omelette-whites', name: 'Claras', amount: '90 ml', calories: 47 },
      ],
    },
  ],
}

describe('meal options', () => {
  it('resolves the selected option and calorie range', () => {
    expect(getMealOption(meal, 'omelette').name).toBe('Omelette')
    expect(mealCalorieRange(meal)).toEqual({ min: 119, max: 120 })
    expect(dayCalorieRange([meal, meal])).toEqual({ min: 238, max: 240 })
  })

  it('exposes a legacy meal as one default option', () => {
    const legacyMeal = { ...meal, options: undefined }
    expect(getMealOptions(legacyMeal)).toEqual([
      {
        id: 'breakfast-default',
        name: 'Desayuno',
        ingredients: legacyMeal.ingredients,
      },
    ])
  })
})
