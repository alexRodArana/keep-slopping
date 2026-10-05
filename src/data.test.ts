import { describe, expect, it } from 'vitest'
import { CURRENT_PLAN_VERSION, defaultMeals, defaultTarget, initialState } from './data'
import { sumNutrition } from './mealUtils'

describe('2650 kcal meal plan', () => {
  it('contains the exact four meals and quantities with coherent per-meal estimates', () => {
    expect(CURRENT_PLAN_VERSION).toBe(9)
    expect(defaultTarget).toEqual({ calories: 2650, protein: 161, carbs: 365, fat: 59.5 })
    expect(defaultMeals).toEqual([
      {
        id: 'breakfast',
        name: '1. Desayuno - cereal con fresas',
        ingredients: [
          { id: 'breakfast-axa-4-korn', name: 'AXA 4 Korn', amount: '65 g' },
          { id: 'breakfast-milk', name: 'Leche 0.5%', amount: '250 ml' },
          { id: 'breakfast-whey', name: 'Whey', amount: '20 g' },
          { id: 'breakfast-frozen-strawberries', name: 'Fresas congeladas', amount: '200 g' },
          { id: 'breakfast-peanut-butter', name: 'Crema de cacahuate', amount: '30 g' },
          { id: 'breakfast-cinnamon-sweetener', name: 'Canela y edulcorante', amount: 'Al gusto' },
        ],
        nutrition: { calories: 642, protein: 42.1, carbs: 69.2, fat: 20.5 },
      },
      {
        id: 'lunch',
        name: '2. Colación pre-entreno',
        ingredients: [
          { id: 'lunch-rice-cakes', name: 'Rice cakes', amount: '50 g' },
          { id: 'lunch-honey', name: 'Miel', amount: '24 g' },
        ],
        nutrition: { calories: 274, protein: 3.8, carbs: 59, fat: 1.6 },
      },
      {
        id: 'post-gym',
        name: '3. Comida post-entreno',
        ingredients: [
          { id: 'post-gym-raw-potato', name: 'Papa, peso crudo', amount: '610 g' },
          {
            id: 'post-gym-raw-chicken-thigh',
            name: 'Kylling lårfilet (muslo de pollo sin piel), crudo',
            amount: '175 g',
          },
          { id: 'post-gym-vegetables', name: 'Verduras', amount: '200 g' },
          { id: 'post-gym-pumpkin-seeds', name: 'Semillas de calabaza', amount: '16 g' },
        ],
        nutrition: { calories: 862, protein: 53.5, carbs: 118.2, fat: 20 },
      },
      {
        id: 'dinner',
        name: '4. Cena',
        ingredients: [
          { id: 'dinner-raw-potato', name: 'Papa, peso crudo', amount: '610 g' },
          { id: 'dinner-raw-ground-beef', name: 'Carne molida 5%, cruda', amount: '180 g' },
          { id: 'dinner-vegetables', name: 'Verduras', amount: '200 g' },
          { id: 'dinner-pumpkin-seeds', name: 'Semillas de calabaza', amount: '16 g' },
        ],
        nutrition: { calories: 872, protein: 61.6, carbs: 118.2, fat: 17.4 },
      },
    ])
    expect(initialState).toEqual({
      planVersion: 9,
      target: defaultTarget,
      creatineDates: [],
      meals: defaultMeals,
      sessions: [],
    })
    expect(defaultMeals.flatMap((meal) => meal.ingredients)).toHaveLength(16)
    expect(defaultMeals.some((meal) => meal.id === 'gym')).toBe(false)
    expect(
      defaultMeals
        .flatMap((meal) => meal.ingredients)
        .filter((ingredient) => ingredient.name === 'Semillas de calabaza')
        .map((ingredient) => ingredient.amount),
    ).toEqual(['16 g', '16 g'])
    expect(
      defaultMeals
        .flatMap((meal) => meal.ingredients)
        .filter((ingredient) => ingredient.name === 'Crema de cacahuate')
        .map((ingredient) => ingredient.amount),
    ).toEqual(['30 g'])
    const total = sumNutrition(defaultMeals)
    expect(total.calories).toBeCloseTo(2650)
    expect(total.protein).toBeCloseTo(161)
    expect(total.carbs).toBeCloseTo(364.6)
    expect(total.fat).toBeCloseTo(59.5)
  })
})
