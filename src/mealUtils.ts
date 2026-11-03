import { resolveMealNutrition } from './domain'
import type { Meal, Nutrition } from './types'

const addKnown = (left: number | null, right: number | null) =>
  left === null || right === null ? null : left + right

export const sumNutrition = (meals: Meal[]): Nutrition =>
  meals.reduce<Nutrition>((total, meal) => {
    const nutrition = resolveMealNutrition(meal)
    if (!nutrition) {
      return total
    }

    return {
      calories: total.calories + nutrition.calories,
      protein: addKnown(total.protein, nutrition.protein),
      carbs: addKnown(total.carbs, nutrition.carbs),
      fat: addKnown(total.fat, nutrition.fat),
    }
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 })
