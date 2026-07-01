import type { AppState, Meal } from './types'

export const defaultMeals: Meal[] = [
  {
    id: 'breakfast',
    name: 'Desayuno',
    slot: 'Mañana',
    ingredients: [
      { id: 'breakfast-eggs', name: 'Huevos enteros', amount: '2 piezas', calories: 144 },
      { id: 'breakfast-whites', name: 'Claras de huevo', amount: '210 g', calories: 109 },
      { id: 'breakfast-almond-milk', name: 'Leche de almendras', amount: '60 g', calories: 8 },
      { id: 'breakfast-vanilla-stevia', name: 'Vainilla + stevia', amount: 'al gusto', calories: 0 },
      { id: 'breakfast-oats', name: 'Avena', amount: '40 g', calories: 156 },
      { id: 'breakfast-banana', name: 'Platano', amount: '1 pieza', calories: 105 },
      { id: 'breakfast-almonds', name: 'Almendras', amount: '12 piezas', calories: 84 },
    ],
  },
  {
    id: 'lunch',
    name: 'Almuerzo',
    slot: 'Mediodia',
    ingredients: [
      { id: 'lunch-chicken', name: 'Pechuga de pollo', amount: '200 g cocida', calories: 330 },
      { id: 'lunch-potato', name: 'Papa cocida', amount: '150 g', calories: 130 },
      { id: 'lunch-broccoli', name: 'Brocoli', amount: '250 g', calories: 85 },
    ],
  },
  {
    id: 'snack',
    name: 'Colacion',
    slot: 'Tarde',
    ingredients: [
      { id: 'snack-yogurt', name: 'Yogurt griego sin azucar', amount: '200 g', calories: 118 },
      { id: 'snack-blueberries', name: 'Blueberries', amount: '60 g', calories: 34 },
    ],
  },
  {
    id: 'dinner',
    name: 'Cena',
    slot: 'Noche',
    ingredients: [
      { id: 'dinner-chicken', name: 'Pechuga de pollo', amount: '280 g cocida', calories: 462 },
      { id: 'dinner-potato', name: 'Papa cocida', amount: '350 g', calories: 305 },
      { id: 'dinner-avocado', name: 'Aguacate', amount: '35 g', calories: 56 },
      { id: 'dinner-broccoli', name: 'Brocoli', amount: '250 g', calories: 85 },
    ],
  },
]

export const recommendations = [
  'Tomar un vaso de agua antes de cada comida.',
  'Tomar aproximadamente 3L de agua.',
  'Pesar proteinas despues de su coccion.',
  'Verduras libres en cualquier momento del dia.',
]

export const initialState: AppState = {
  meals: defaultMeals,
  sessions: [],
}
