import type { AppState, Meal, PlanTarget } from './types'

export const CURRENT_PLAN_VERSION = 6

export const defaultTarget: PlanTarget = {
  calories: 2773,
  protein: 208,
  carbs: 347,
  fat: 62,
}

// The PDF gives daily macros only; these per-meal estimates total 208 P / 347 C / 62 F
// and the document's macro-derived energy of approximately 2,778 kcal.
export const defaultMeals: Meal[] = [
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
]

export const initialState: AppState = {
  planVersion: CURRENT_PLAN_VERSION,
  target: defaultTarget,
  creatineDates: [],
  meals: defaultMeals,
  sessions: [],
}
