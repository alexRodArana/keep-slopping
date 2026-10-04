import type { AppState, Meal, PlanTarget } from './types'

export const CURRENT_PLAN_VERSION = 8

export const defaultTarget: PlanTarget = {
  calories: 2650,
  protein: 160,
  carbs: 367.5,
  fat: 60,
}

// The PDF gives only daily approximate protein and fat, with carbohydrates as the
// remaining calories. These ingredient-weighted per-meal estimates are normalized
// to 2,650 kcal / 160 P / 367.5 C / 60 F.
export const defaultMeals: Meal[] = [
  {
    id: 'breakfast',
    name: '1. Desayuno - Avena con fresas',
    ingredients: [
      { id: 'breakfast-oats', name: 'Avena seca', amount: '65 g' },
      { id: 'breakfast-milk', name: 'Leche 0.5%', amount: '250 ml' },
      { id: 'breakfast-whey', name: 'Whey', amount: '15 g' },
      { id: 'breakfast-frozen-strawberries', name: 'Fresas congeladas', amount: '200 g' },
      { id: 'breakfast-peanut-butter', name: 'Crema de cacahuate', amount: '35 g' },
      { id: 'breakfast-cinnamon-sweetener', name: 'Canela y edulcorante', amount: 'al gusto' },
    ],
    nutrition: { calories: 673.5, protein: 38.8, carbs: 74.9, fat: 24.3 },
  },
  {
    id: 'lunch',
    name: '2. Colacion pre-entreno',
    ingredients: [
      { id: 'lunch-rice-cakes', name: 'Rice cakes', amount: '50 g' },
      { id: 'lunch-honey', name: 'Miel', amount: '25 g' },
    ],
    nutrition: { calories: 282.3, protein: 3.9, carbs: 63.3, fat: 1.5 },
  },
  {
    id: 'post-gym',
    name: '3. Comida post-entreno - Pollo, papa y crema de cacahuate',
    ingredients: [
      { id: 'post-gym-raw-potato', name: 'Papa cruda', amount: '560 g' },
      { id: 'post-gym-raw-chicken', name: 'Pechuga de pollo cruda', amount: '175 g' },
      { id: 'post-gym-vegetables', name: 'Verduras', amount: '200 g' },
      { id: 'post-gym-peanut-butter', name: 'Crema de cacahuate', amount: '20 g' },
    ],
    nutrition: { calories: 826.4, protein: 59.5, carbs: 114.7, fat: 14.4 },
  },
  {
    id: 'dinner',
    name: '4. Cena - Carne, papa y crema de cacahuate',
    ingredients: [
      { id: 'dinner-raw-potato', name: 'Papa cruda', amount: '560 g' },
      { id: 'dinner-raw-ground-beef', name: 'Carne molida 95/5 cruda', amount: '180 g' },
      { id: 'dinner-vegetables', name: 'Verduras', amount: '200 g' },
      { id: 'dinner-peanut-butter', name: 'Crema de cacahuate', amount: '20 g' },
    ],
    nutrition: { calories: 867.8, protein: 57.8, carbs: 114.6, fat: 19.8 },
  },
]

export const initialState: AppState = {
  planVersion: CURRENT_PLAN_VERSION,
  target: defaultTarget,
  creatineDates: [],
  meals: defaultMeals,
  sessions: [],
}
