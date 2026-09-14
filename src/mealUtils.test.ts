import { describe, expect, it } from 'vitest'
import { defaultMeals } from './data'
import { sumNutrition } from './mealUtils'

describe('meal nutrition', () => {
  it('sums the nutrition declared for every meal', () => {
    const total = sumNutrition(defaultMeals)
    expect(total.calories).toBeCloseTo(2772.9)
    expect(total.protein).toBeCloseTo(207.6)
    expect(total.carbs).toBeCloseTo(347.3)
    expect(total.fat).toBeCloseTo(61.5)
  })

  it('returns zero nutrition for an empty plan', () => {
    expect(sumNutrition([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})
