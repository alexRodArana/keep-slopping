import type { AppState, Meal, Nutrition, PlanTarget } from './types'

export const CURRENT_PLAN_VERSION = 11

// The PDF gives daily reference macros, but no individual-meal macro breakdown.
export const defaultTarget: PlanTarget = {
  calories: 2822,
  protein: 148,
  carbs: 431,
  fat: 60,
}

export const defaultPlanNotes: string[] = []

const estimatedNutrition = (calories: number): Nutrition => ({
  calories,
  protein: null,
  carbs: null,
  fat: null,
})

// Preserve the PDF's per-meal estimates. These sum to 2,814 kcal with dinner A
// and 2,818 kcal with dinner B; its daily footer instead reports 2,820/2,819.
export const defaultMeals: Meal[] = [
  {
    id: 'breakfast',
    name: '1. Desayuno | Avena',
    ingredients: [
      { id: 'breakfast-oats', name: 'Avena seca', amount: '107 g' },
      { id: 'breakfast-milk', name: 'Leche 0.5%', amount: '300 ml' },
      { id: 'breakfast-whey', name: 'Proteína whey', amount: '29 g' },
      {
        id: 'breakfast-fruit',
        name: 'Fresas congeladas o moras azules',
        amount: '200 g de fresas o 112 g de moras azules',
      },
      {
        id: 'breakfast-traditional-peanut-butter',
        name: 'Crema de cacahuate tradicional',
        amount: '25 g',
      },
    ],
    nutrition: estimatedNutrition(865),
  },
  {
    id: 'lunch',
    name: 'Colación preentreno | Arroz inflado y miel',
    ingredients: [
      { id: 'lunch-puffed-rice', name: 'Arroz inflado natural (seco)', amount: '53 g' },
      { id: 'lunch-honey', name: 'Miel', amount: '25 g' },
    ],
    nutrition: estimatedNutrition(276),
  },
  {
    id: 'post-gym-first',
    name: '2. Postentreno, primera parte',
    ingredients: [
      { id: 'post-gym-first-chicken-breast', name: 'Pechuga de pollo, en crudo', amount: '48 g' },
      { id: 'post-gym-first-potato', name: 'Papa, en crudo', amount: '450 g' },
      { id: 'post-gym-first-frozen-vegetables', name: 'Verduras congeladas', amount: '125 g' },
      { id: 'post-gym-first-pumpkin-seeds', name: 'Semillas de calabaza', amount: '12 g' },
    ],
    nutrition: estimatedNutrition(510),
  },
  {
    id: 'post-gym-second',
    name: '3. Postentreno, segunda parte',
    ingredients: [
      { id: 'post-gym-second-chicken-breast', name: 'Pechuga de pollo, en crudo', amount: '47 g' },
      { id: 'post-gym-second-potato', name: 'Papa, en crudo', amount: '450 g' },
      { id: 'post-gym-second-frozen-vegetables', name: 'Verduras congeladas', amount: '125 g' },
      { id: 'post-gym-second-pumpkin-seeds', name: 'Semillas de calabaza', amount: '13 g' },
    ],
    nutrition: estimatedNutrition(515),
  },
  {
    id: 'dinner',
    name: '4. Cena | Elige UNA opción',
    ingredients: [
      { id: 'dinner-a-oats', name: 'Avena seca', amount: '97 g' },
      { id: 'dinner-a-milk', name: 'Leche 0.5%', amount: '150 ml' },
      { id: 'dinner-a-whey', name: 'Proteína whey', amount: '6 g' },
      {
        id: 'dinner-a-fruit',
        name: 'Fresas congeladas o moras azules',
        amount: '150 g de fresas o 84 g de moras azules',
      },
      {
        id: 'dinner-a-traditional-peanut-butter',
        name: 'Crema de cacahuate tradicional',
        amount: '24 g',
      },
    ],
    nutrition: estimatedNutrition(648),
    defaultOptionId: 'dinner-a',
    options: [
      {
        id: 'dinner-a',
        name: 'Opción A - Avena sin PB2',
        ingredients: [
          { id: 'dinner-a-oats', name: 'Avena seca', amount: '97 g' },
          { id: 'dinner-a-milk', name: 'Leche 0.5%', amount: '150 ml' },
          { id: 'dinner-a-whey', name: 'Proteína whey', amount: '6 g' },
          {
            id: 'dinner-a-fruit',
            name: 'Fresas congeladas o moras azules',
            amount: '150 g de fresas o 84 g de moras azules',
          },
          {
            id: 'dinner-a-traditional-peanut-butter',
            name: 'Crema de cacahuate tradicional',
            amount: '24 g',
          },
        ],
        nutrition: estimatedNutrition(648),
      },
      {
        id: 'dinner-b',
        name: 'Opción B - Pollo con papa',
        ingredients: [
          { id: 'dinner-b-chicken-breast', name: 'Pechuga de pollo, en crudo', amount: '42 g' },
          { id: 'dinner-b-potato', name: 'Papa, en crudo', amount: '420 g' },
          { id: 'dinner-b-frozen-vegetables', name: 'Verduras congeladas', amount: '200 g' },
          { id: 'dinner-b-pumpkin-seeds', name: 'Semillas de calabaza', amount: '38 g' },
        ],
        nutrition: estimatedNutrition(652),
      },
    ],
  },
]

export const initialState: AppState = {
  planVersion: CURRENT_PLAN_VERSION,
  target: defaultTarget,
  planNotes: defaultPlanNotes,
  creatineDates: [],
  meals: defaultMeals,
  sessions: [],
}
