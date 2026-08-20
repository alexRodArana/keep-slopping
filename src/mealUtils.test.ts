import { describe, expect, it } from 'vitest'
import { defaultMeals } from './data'
import { sumNutrition } from './mealUtils'

describe('meal nutrition', () => {
  it('sums the nutrition declared for every meal', () => {
    expect(sumNutrition(defaultMeals)).toEqual({
      calories: 2588,
      protein: 141,
      carbs: 377,
      fat: 60,
    })
  })

  it('returns zero nutrition for an empty plan', () => {
    expect(sumNutrition([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})
