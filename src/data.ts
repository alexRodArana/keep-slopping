import type { AppState, Meal, PlanTarget } from './types'

export const CURRENT_PLAN_VERSION = 7

export const defaultTarget: PlanTarget = {
  calories: 2648,
  protein: 187,
  carbs: 330,
  fat: 57,
}

// The PDF gives per-meal calories and daily macros only. These estimated per-meal
// macros are normalized to its daily total of approximately 187 P / 330 C / 57 F.
export const defaultMeals: Meal[] = [
  {
    id: 'breakfast',
    name: '1. Desayuno',
    ingredients: [
      { id: 'breakfast-oats', name: 'Avena', amount: '75 g' },
      { id: 'breakfast-milk', name: 'Leche 0.5%', amount: '200 ml' },
      { id: 'breakfast-whey', name: 'Whey', amount: '20 g' },
      { id: 'breakfast-peanut-butter', name: 'Crema de cacahuate', amount: '25 g' },
      { id: 'breakfast-blueberries', name: 'Blueberries', amount: '100 g' },
      { id: 'breakfast-yogurt', name: 'Yogurt griego 2% (frosting)', amount: '100 g' },
    ],
    nutrition: { calories: 723, protein: 48.4, carbs: 78.3, fat: 23.1 },
  },
  {
    id: 'lunch',
    name: '2. Comida / PRE-GYM',
    ingredients: [
      { id: 'lunch-oats', name: 'Avena', amount: '110 g' },
      { id: 'lunch-milk', name: 'Leche 0.5%', amount: '200 ml' },
      { id: 'lunch-whey', name: 'Whey', amount: '20 g' },
      { id: 'lunch-blueberries', name: 'Blueberries', amount: '70 g' },
      { id: 'lunch-yogurt', name: 'Yogurt griego 2% (frosting)', amount: '100 g' },
    ],
    nutrition: { calories: 692, protein: 46.2, carbs: 91.8, fat: 12.5 },
  },
  {
    id: 'post-gym',
    name: '3. POST-GYM',
    ingredients: [
      { id: 'post-gym-oats', name: 'Avena', amount: '65 g' },
      { id: 'post-gym-milk', name: 'Leche 0.5%', amount: '200 ml' },
      { id: 'post-gym-whey', name: 'Whey', amount: '20 g' },
      { id: 'post-gym-peanut-butter', name: 'Crema de cacahuate', amount: '15 g' },
      { id: 'post-gym-blueberries', name: 'Blueberries', amount: '70 g' },
      { id: 'post-gym-yogurt', name: 'Yogurt griego 2% (frosting)', amount: '100 g' },
    ],
    nutrition: { calories: 608, protein: 44.1, carbs: 66.7, fat: 17.1 },
  },
  {
    id: 'dinner',
    name: '4. Cena',
    ingredients: [
      { id: 'dinner-chicken', name: 'Pechuga de pollo', amount: '150 g' },
      { id: 'dinner-potato', name: 'Papa', amount: '450 g' },
      { id: 'dinner-frozen-vegetables', name: 'Verduras congeladas', amount: '250 g' },
    ],
    nutrition: { calories: 627, protein: 48.3, carbs: 93.2, fat: 4.3 },
  },
]

export const initialState: AppState = {
  planVersion: CURRENT_PLAN_VERSION,
  target: defaultTarget,
  creatineDates: [],
  meals: defaultMeals,
  sessions: [],
}
