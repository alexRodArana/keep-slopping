import type { AppState, Meal, PlanTarget } from './types'

export const CURRENT_PLAN_VERSION = 3

export const defaultTarget: PlanTarget = {
  calories: 2600,
  protein: 160,
  carbs: 343,
  fat: 65,
}

export const defaultMeals: Meal[] = [
  {
    id: 'breakfast',
    name: 'Desayuno',
    ingredients: [
      { id: 'breakfast-oats', name: 'Avena', amount: '120 g' },
      { id: 'breakfast-milk', name: 'Leche', amount: '300 ml' },
      { id: 'breakfast-protein-powder', name: 'Proteina en polvo', amount: '30 g' },
      { id: 'breakfast-peanut-butter', name: 'Crema de cacahuate', amount: '40 g' },
      { id: 'breakfast-frozen-strawberries', name: 'Fresas congeladas', amount: '150 g' },
    ],
    nutrition: { calories: 983, protein: 60.9, carbs: 108.2, fat: 32.4 },
  },
  {
    id: 'lunch',
    name: 'Comida',
    ingredients: [
      { id: 'lunch-cooked-chicken', name: 'Pechuga de pollo cocida', amount: '90 g' },
      { id: 'lunch-raw-potato', name: 'Papa cruda', amount: '480 g' },
      { id: 'lunch-frozen-vegetables', name: 'Verduras congeladas', amount: '200 g' },
    ],
    nutrition: { calories: 598, protein: 41.5, carbs: 95.6, fat: 4.8 },
  },
  {
    id: 'dinner',
    name: 'Cena',
    ingredients: [
      { id: 'dinner-cooked-chicken', name: 'Pechuga de pollo cocida', amount: '90 g' },
      { id: 'dinner-raw-potato', name: 'Papa cruda', amount: '660 g' },
      { id: 'dinner-frozen-vegetables', name: 'Verduras congeladas', amount: '250 g' },
      { id: 'dinner-peanut-butter', name: 'Crema de cacahuate', amount: '45 g' },
    ],
    nutrition: { calories: 1027, protein: 57.4, carbs: 138.7, fat: 27.8 },
  },
]

export const initialState: AppState = {
  planVersion: CURRENT_PLAN_VERSION,
  target: defaultTarget,
  creatineDates: [],
  meals: defaultMeals,
  sessions: [],
}
