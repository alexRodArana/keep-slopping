import { describe, expect, it } from 'vitest'
import { defaultMeals } from './data'
import { sumNutrition } from './mealUtils'

describe('meal nutrition', () => {
  it('sums the nutrition declared for every meal', () => {
    const total = sumNutrition(defaultMeals)
    expect(total.calories).toBeCloseTo(2650)
    expect(total.protein).toBeCloseTo(160)
    expect(total.carbs).toBeCloseTo(367.5)
    expect(total.fat).toBeCloseTo(60)
  })

  it('returns zero nutrition for an empty plan', () => {
    expect(sumNutrition([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  })
})
