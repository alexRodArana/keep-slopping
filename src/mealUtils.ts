import type { Meal, Nutrition } from './types'

export const sumNutrition = (meals: Meal[]): Nutrition =>
  meals.reduce<Nutrition>(
    (total, meal) => ({
      calories: total.calories + meal.nutrition.calories,
      protein: total.protein + meal.nutrition.protein,
      carbs: total.carbs + meal.nutrition.carbs,
      fat: total.fat + meal.nutrition.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
