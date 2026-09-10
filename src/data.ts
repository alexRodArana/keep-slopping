import type { AppState, Meal, PlanTarget } from './types'

export const CURRENT_PLAN_VERSION = 4

export const defaultTarget: PlanTarget = {
  calories: 2600,
  protein: 160,
  carbs: 337,
  fat: 65,
}

// The source plan gives daily targets only; per-meal nutrition remains an estimate.
export const defaultMeals: Meal[] = [
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
]

export const initialState: AppState = {
  planVersion: CURRENT_PLAN_VERSION,
  target: defaultTarget,
  creatineDates: [],
  meals: defaultMeals,
  sessions: [],
}
