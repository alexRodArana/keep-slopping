import { describe, expect, it } from 'vitest'
import { CURRENT_PLAN_VERSION, defaultMeals, defaultPlanNotes, defaultTarget, initialState } from './data'
import { sumNutrition } from './mealUtils'

describe('five-time meal plan without PB2', () => {
  it('uses the exact daily ceiling and reference macros in plan version 11', () => {
    expect(CURRENT_PLAN_VERSION).toBe(11)
    expect(defaultTarget).toEqual({ calories: 2822, protein: 148, carbs: 431, fat: 60 })
    expect(defaultMeals).toHaveLength(5)
    expect(initialState).toEqual({
      planVersion: 11,
      target: defaultTarget,
      planNotes: defaultPlanNotes,
      creatineDates: [],
      meals: defaultMeals,
      sessions: [],
    })
  })

  it('preserves every fixed ingredient and portion from the PDF', () => {
    expect(defaultMeals.slice(0, 4).map(({ id, name, ingredients, nutrition }) => ({
      id,
      name,
      ingredients: ingredients.map(({ name: ingredient, amount }) => [ingredient, amount]),
      nutrition,
    }))).toEqual([
      {
        id: 'breakfast',
        name: '1. Desayuno | Avena',
        ingredients: [
          ['Avena seca', '107 g'],
          ['Leche 0.5%', '300 ml'],
          ['Proteína whey', '29 g'],
          ['Fresas congeladas o moras azules', '200 g de fresas o 112 g de moras azules'],
          ['Crema de cacahuate tradicional', '25 g'],
        ],
        nutrition: { calories: 865, protein: null, carbs: null, fat: null },
      },
      {
        id: 'lunch',
        name: 'Colación preentreno | Arroz inflado y miel',
        ingredients: [
          ['Arroz inflado natural (seco)', '53 g'],
          ['Miel', '25 g'],
        ],
        nutrition: { calories: 276, protein: null, carbs: null, fat: null },
      },
      {
        id: 'post-gym-first',
        name: '2. Postentreno, primera parte',
        ingredients: [
          ['Pechuga de pollo, en crudo', '48 g'],
          ['Papa, en crudo', '450 g'],
          ['Verduras congeladas', '125 g'],
          ['Semillas de calabaza', '12 g'],
        ],
        nutrition: { calories: 510, protein: null, carbs: null, fat: null },
      },
      {
        id: 'post-gym-second',
        name: '3. Postentreno, segunda parte',
        ingredients: [
          ['Pechuga de pollo, en crudo', '47 g'],
          ['Papa, en crudo', '450 g'],
          ['Verduras congeladas', '125 g'],
          ['Semillas de calabaza', '13 g'],
        ],
        nutrition: { calories: 515, protein: null, carbs: null, fat: null },
      },
    ])
    expect(defaultMeals[1].options).toBeUndefined()
    expect(defaultMeals[1].optionSourceMealId).toBeUndefined()
  })

  it('keeps the two dinner alternatives exclusive and their exact portions', () => {
    const dinner = defaultMeals[4]
    expect(dinner.id).toBe('dinner')
    expect(dinner.name).toBe('4. Cena | Elige UNA opción')
    expect(dinner.defaultOptionId).toBe('dinner-a')
    expect(dinner.options).toHaveLength(2)
    expect(dinner.options?.map(({ id, name, ingredients, nutrition }) => ({
      id,
      name,
      ingredients: ingredients.map(({ name: ingredient, amount }) => [ingredient, amount]),
      nutrition,
    }))).toEqual([
      {
        id: 'dinner-a',
        name: 'Opción A - Avena sin PB2',
        ingredients: [
          ['Avena seca', '97 g'],
          ['Leche 0.5%', '150 ml'],
          ['Proteína whey', '6 g'],
          ['Fresas congeladas o moras azules', '150 g de fresas o 84 g de moras azules'],
          ['Crema de cacahuate tradicional', '24 g'],
        ],
        nutrition: { calories: 648, protein: null, carbs: null, fat: null },
      },
      {
        id: 'dinner-b',
        name: 'Opción B - Pollo con papa',
        ingredients: [
          ['Pechuga de pollo, en crudo', '42 g'],
          ['Papa, en crudo', '420 g'],
          ['Verduras congeladas', '200 g'],
          ['Semillas de calabaza', '38 g'],
        ],
        nutrition: { calories: 652, protein: null, carbs: null, fat: null },
      },
    ])
    expect(dinner.ingredients).toEqual(dinner.options?.[0].ingredients)
    expect(dinner.nutrition).toEqual(dinner.options?.[0].nutrition)
  })

  it('contains no PB2 ingredient and preserves the exclusive fruit replacements', () => {
    const ingredients = defaultMeals.flatMap((meal) => [
      ...meal.ingredients,
      ...(meal.options?.flatMap((option) => option.ingredients) ?? []),
    ])
    expect(ingredients.some(({ name }) => /PB2/i.test(name))).toBe(false)
    expect(ingredients.filter(({ name }) => name.includes('moras azules'))).toHaveLength(3)
    expect(defaultPlanNotes).toEqual([])
  })

  it('preserves meal-level calorie estimates without inventing missing macros', () => {
    expect(sumNutrition(defaultMeals)).toEqual({ calories: 2814, protein: null, carbs: null, fat: null })
    const routeB = defaultMeals.map((meal) => meal.id === 'dinner'
      ? { ...meal, defaultOptionId: 'dinner-b' }
      : meal)
    expect(sumNutrition(routeB)).toEqual({ calories: 2818, protein: null, carbs: null, fat: null })
  })
})
