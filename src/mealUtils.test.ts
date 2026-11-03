import { describe, expect, it } from 'vitest'
import { defaultMeals } from './data'
import { sumNutrition } from './mealUtils'
import type { Meal } from './types'

describe('meal nutrition', () => {
  it('sums the default route declared for every meal', () => {
    const total = sumNutrition(defaultMeals)
    expect(total).toEqual({ calories: 2814, protein: null, carbs: null, fat: null })
  })

  it('uses only the default option rather than the flat fallback or all options', () => {
    const selectableMeal: Meal = {
      id: 'selectable',
      name: 'Seleccionable',
      ingredients: [],
      nutrition: { calories: 999, protein: 999, carbs: 999, fat: 999 },
      defaultOptionId: 'b',
      options: [
        {
          id: 'a',
          name: 'A',
          ingredients: [],
          nutrition: { calories: 100, protein: 10, carbs: 20, fat: 3 },
        },
        {
          id: 'b',
          name: 'B',
          ingredients: [],
          nutrition: { calories: 200, protein: 15, carbs: 30, fat: 4 },
        },
      ],
    }

    expect(sumNutrition([selectableMeal])).toEqual({ calories: 200, protein: 15, carbs: 30, fat: 4 })
  })

  it('returns zero nutrition for an empty plan', () => {
    expect(sumNutrition([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})
