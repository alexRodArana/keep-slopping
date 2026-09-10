import { describe, expect, it } from 'vitest'
import { CURRENT_PLAN_VERSION, defaultMeals, defaultTarget, initialState } from './data'
import { sumNutrition } from './mealUtils'

describe('2600 kcal meal plan', () => {
  it('contains the four meals and quantities from the PDF with coherent estimated nutrition', () => {
    expect(CURRENT_PLAN_VERSION).toBe(4)
    expect(defaultTarget).toEqual({ calories: 2600, protein: 160, carbs: 337, fat: 65 })
    expect(defaultMeals).toEqual([
      {
        id: 'breakfast',
        name: 'Desayuno',
        ingredients: [
          { id: 'breakfast-oats', name: 'Avena', amount: '75 g' },
          { id: 'breakfast-milk', name: 'Leche 0.5%', amount: '200 ml' },
          { id: 'breakfast-whey', name: 'Whey', amount: '20 g' },
          { id: 'breakfast-peanut-butter', name: 'Crema de cacahuate', amount: '45 g' },
        ],
        nutrition: { calories: 715, protein: 43.8, carbs: 65.1, fat: 30.1 },
      },
      {
        id: 'lunch',
        name: 'Comida',
        ingredients: [
          { id: 'lunch-cooked-chicken', name: 'Pollo cocido', amount: '90 g' },
          { id: 'lunch-raw-potato', name: 'Papa cruda', amount: '500 g' },
          { id: 'lunch-vegetables', name: 'Verduras', amount: '200 g' },
        ],
        nutrition: { calories: 614, protein: 41.9, carbs: 99, fat: 4.8 },
      },
      {
        id: 'second-meal',
        name: 'Segunda comida',
        ingredients: [
          { id: 'second-meal-oats', name: 'Avena', amount: '55 g' },
          { id: 'second-meal-milk', name: 'Leche 0.5%', amount: '100 ml' },
          { id: 'second-meal-whey', name: 'Whey', amount: '10 g' },
          { id: 'second-meal-peanut-butter', name: 'Crema de cacahuate', amount: '40 g' },
        ],
        nutrition: { calories: 529, protein: 28.6, carbs: 46.6, fat: 25.1 },
      },
      {
        id: 'dinner',
        name: 'Cena',
        ingredients: [
          { id: 'dinner-cooked-chicken', name: 'Pollo cocido', amount: '90 g' },
          { id: 'dinner-raw-potato', name: 'Papa cruda', amount: '640 g' },
          { id: 'dinner-vegetables', name: 'Verduras', amount: '250 g' },
        ],
        nutrition: { calories: 741, protein: 45.7, carbs: 126.3, fat: 5.2 },
      },
    ])
    expect(initialState).toEqual({
      planVersion: 4,
      target: defaultTarget,
      creatineDates: [],
      meals: defaultMeals,
      sessions: [],
    })
    expect(defaultMeals.flatMap((meal) => meal.ingredients)).toHaveLength(14)
    expect(sumNutrition(defaultMeals)).toEqual({ calories: 2599, protein: 160, carbs: 337, fat: 65.2 })
  })
})
