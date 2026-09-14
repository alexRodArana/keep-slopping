import { describe, expect, it } from 'vitest'
import { CURRENT_PLAN_VERSION, defaultMeals, defaultTarget, initialState } from './data'
import { sumNutrition } from './mealUtils'

describe('2773 kcal meal plan', () => {
  it('contains the exact target, meals, quantities, and nutrition from the PDF', () => {
    expect(CURRENT_PLAN_VERSION).toBe(5)
    expect(defaultTarget).toEqual({ calories: 2773, protein: 208, carbs: 347, fat: 62 })
    expect(defaultMeals).toEqual([
      {
        id: 'breakfast',
        name: 'Desayuno',
        ingredients: [
          { id: 'breakfast-oats', name: 'Avena (seca)', amount: '115 g' },
          { id: 'breakfast-milk', name: 'Leche 0.5%', amount: '250 ml' },
          { id: 'breakfast-whey', name: 'Whey Star Nutrition Whey-80', amount: '55 g' },
          { id: 'breakfast-peanut-butter', name: 'Crema de cacahuate', amount: '35 g' },
        ],
        nutrition: { calories: 939.5, protein: 73.7, carbs: 91.6, fat: 30.9 },
      },
      {
        id: 'lunch',
        name: 'Comida',
        ingredients: [
          { id: 'lunch-cooked-chicken', name: 'Pechuga de pollo (peso cocido)', amount: '120 g' },
          { id: 'lunch-raw-potato', name: 'Papa (peso crudo)', amount: '500 g' },
          { id: 'lunch-vegetables', name: 'Verduras mixtas', amount: '200 g' },
        ],
        nutrition: { calories: 641.6, protein: 51.2, carbs: 97, fat: 5.4 },
      },
      {
        id: 'dinner',
        name: 'Cena',
        ingredients: [
          { id: 'dinner-cooked-chicken', name: 'Pechuga de pollo (peso cocido)', amount: '170 g' },
          { id: 'dinner-raw-potato', name: 'Papa (peso crudo)', amount: '810 g' },
          { id: 'dinner-vegetables', name: 'Verduras mixtas', amount: '250 g' },
          { id: 'dinner-peanut-butter', name: 'Crema de cacahuate', amount: '35 g' },
        ],
        nutrition: { calories: 1191.8, protein: 82.7, carbs: 158.7, fat: 25.2 },
      },
    ])
    expect(initialState).toEqual({
      planVersion: 5,
      target: defaultTarget,
      creatineDates: [],
      meals: defaultMeals,
      sessions: [],
    })
    expect(defaultMeals.flatMap((meal) => meal.ingredients)).toHaveLength(11)
    const total = sumNutrition(defaultMeals)
    expect(total.calories).toBeCloseTo(2772.9)
    expect(total.protein).toBeCloseTo(207.6)
    expect(total.carbs).toBeCloseTo(347.3)
    expect(total.fat).toBeCloseTo(61.5)
  })
})
