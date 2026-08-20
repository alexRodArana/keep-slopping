import { describe, expect, it } from 'vitest'
import { CURRENT_PLAN_VERSION, defaultMeals, defaultTarget, initialState } from './data'

describe('2600 kcal meal plan', () => {
  it('contains the exact target, meals, ingredients, and nutrition from the PDF', () => {
    expect(CURRENT_PLAN_VERSION).toBe(2)
    expect(defaultTarget).toEqual({ calories: 2600, protein: 140, carbs: 375, fat: 60 })
    expect(defaultMeals).toEqual([
      {
        id: 'breakfast',
        name: 'Desayuno',
        ingredients: [
          { id: 'breakfast-oats', name: 'Avena', amount: '50 g' },
          { id: 'breakfast-whey', name: 'Proteína whey', amount: '1 scoop' },
          { id: 'breakfast-milk', name: 'Leche', amount: '250 ml' },
          { id: 'breakfast-blueberries', name: 'Blueberries', amount: '100 g' },
          { id: 'breakfast-lys-syrup', name: 'Lys syrup', amount: '10 g' },
          { id: 'breakfast-sweetener', name: 'Edulcorante', amount: 'al gusto' },
        ],
        nutrition: { calories: 493, protein: 40, carbs: 67, fat: 7 },
      },
      {
        id: 'lunch',
        name: 'Comida',
        ingredients: [
          { id: 'lunch-pasta', name: 'Pasta (peso en seco)', amount: '100 g' },
          { id: 'lunch-chicken', name: 'Pechuga de pollo (peso en crudo)', amount: '80 g' },
          { id: 'lunch-vegetables', name: 'Verduras congeladas', amount: '200 g' },
          { id: 'lunch-hummus', name: 'Hummus', amount: '40 g' },
        ],
        nutrition: { calories: 604, protein: 37, carbs: 90, fat: 11 },
      },
      {
        id: 'snack',
        name: 'Colación',
        ingredients: [
          { id: 'snack-bread', name: 'Pan multigrain', amount: '130 g' },
          { id: 'snack-peanut-butter', name: 'Crema de cacahuate', amount: '30 g' },
        ],
        nutrition: { calories: 501, protein: 21, carbs: 65, fat: 20 },
      },
      {
        id: 'dinner',
        name: 'Cena',
        ingredients: [
          { id: 'dinner-pasta', name: 'Pasta (peso en seco)', amount: '175 g' },
          { id: 'dinner-chicken', name: 'Pechuga de pollo (peso en crudo)', amount: '45 g' },
          { id: 'dinner-vegetables', name: 'Verduras congeladas', amount: '250 g' },
          { id: 'dinner-hummus', name: 'Hummus', amount: '100 g' },
        ],
        nutrition: { calories: 990, protein: 43, carbs: 155, fat: 22 },
      },
    ])
    expect(initialState).toEqual({
      planVersion: 2,
      target: defaultTarget,
      creatineDates: [],
      meals: defaultMeals,
      sessions: [],
    })
  })
})
