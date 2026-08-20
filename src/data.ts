import type { AppState, Meal, PlanTarget } from './types'

export const CURRENT_PLAN_VERSION = 2

export const defaultTarget: PlanTarget = {
  calories: 2600,
  protein: 140,
  carbs: 375,
  fat: 60,
}

export const defaultNotes = [
  'Los valores son aproximados y pueden variar según la marca de whey, leche, pan, hummus, pasta y crema de cacahuate.',
  'La pasta se pesa en seco y la pechuga de pollo en crudo para mantener consistencia.',
  'Las verduras pueden ser la mezcla de brócoli, coliflor y zanahoria que ya tienes.',
  'La distribución está pensada para que el desayuno sea la comida más ligera y la cena la más abundante.',
]

export const defaultMeals: Meal[] = [
  {
    id: 'breakfast',
    name: 'Desayuno',
    slot: 'ligero',
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
    slot: 'moderada',
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
    slot: '',
    ingredients: [
      { id: 'snack-bread', name: 'Pan multigrain', amount: '130 g' },
      { id: 'snack-peanut-butter', name: 'Crema de cacahuate', amount: '30 g' },
    ],
    nutrition: { calories: 501, protein: 21, carbs: 65, fat: 20 },
  },
  {
    id: 'dinner',
    name: 'Cena',
    slot: 'comida fuerte',
    ingredients: [
      { id: 'dinner-pasta', name: 'Pasta (peso en seco)', amount: '175 g' },
      { id: 'dinner-chicken', name: 'Pechuga de pollo (peso en crudo)', amount: '45 g' },
      { id: 'dinner-vegetables', name: 'Verduras congeladas', amount: '250 g' },
      { id: 'dinner-hummus', name: 'Hummus', amount: '100 g' },
    ],
    nutrition: { calories: 990, protein: 43, carbs: 155, fat: 22 },
  },
]

export const initialState: AppState = {
  planVersion: CURRENT_PLAN_VERSION,
  target: defaultTarget,
  notes: defaultNotes,
  creatineDates: [],
  meals: defaultMeals,
  sessions: [],
}
