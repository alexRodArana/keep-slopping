import { describe, expect, it } from 'vitest'
import { CURRENT_PLAN_VERSION, defaultMeals, defaultTarget, initialState } from './data'
import { sumNutrition } from './mealUtils'

describe('2773 kcal meal plan', () => {
  it('contains the exact economical plan quantities and coherent per-meal estimates', () => {
    expect(CURRENT_PLAN_VERSION).toBe(6)
    expect(defaultTarget).toEqual({ calories: 2773, protein: 208, carbs: 347, fat: 62 })
    expect(defaultMeals).toEqual([
      {
        id: 'breakfast',
        name: '1 - Avena',
        ingredients: [
          { id: 'breakfast-oats', name: 'Avena', amount: '200 g' },
          { id: 'breakfast-milk', name: 'Leche 0.5%', amount: '500 ml' },
          { id: 'breakfast-whey', name: 'Whey-80 Cinnamon Bun', amount: '46 g' },
          { id: 'breakfast-peanut-butter', name: 'Crema de cacahuate', amount: '20 g' },
        ],
        nutrition: { calories: 1173.3, protein: 87.6, carbs: 140.7, fat: 28.9 },
      },
      {
        id: 'lunch',
        name: '2 - Pollo',
        ingredients: [
          { id: 'lunch-raw-chicken', name: 'Pechuga de pollo (cruda)', amount: '100 g' },
          { id: 'lunch-raw-potato', name: 'Papa (cruda)', amount: '305 g' },
          { id: 'lunch-frozen-vegetables', name: 'Verduras congeladas', amount: '200 g' },
        ],
        nutrition: { calories: 424.9, protein: 32.5, carbs: 65.4, fat: 3.7 },
      },
      {
        id: 'dinner',
        name: '3 - Avena',
        ingredients: [
          { id: 'dinner-oats', name: 'Avena', amount: '200 g' },
          { id: 'dinner-milk', name: 'Leche 0.5%', amount: '500 ml' },
          { id: 'dinner-whey', name: 'Whey-80 Cinnamon Bun', amount: '46 g' },
          { id: 'dinner-peanut-butter', name: 'Crema de cacahuate', amount: '21 g' },
        ],
        nutrition: { calories: 1179.8, protein: 87.9, carbs: 140.9, fat: 29.4 },
      },
    ])
    expect(initialState).toEqual({
      planVersion: 6,
      target: defaultTarget,
      creatineDates: [],
      meals: defaultMeals,
      sessions: [],
    })
    expect(defaultMeals.flatMap((meal) => meal.ingredients)).toHaveLength(11)
    const total = sumNutrition(defaultMeals)
    expect(total.calories).toBeCloseTo(2778)
    expect(total.protein).toBeCloseTo(208)
    expect(total.carbs).toBeCloseTo(347)
    expect(total.fat).toBeCloseTo(62)
  })
})
