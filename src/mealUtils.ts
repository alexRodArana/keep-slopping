import type { Meal, MealOption } from './types'

export type CalorieRange = {
  min: number
  max: number
}

export const legacyMealOptionId = (mealId: string) => `${mealId}-default`

export const getMealOptions = (meal: Meal): MealOption[] => {
  if (meal.options?.length) {
    return meal.options
  }

  return [
    {
      id: legacyMealOptionId(meal.id),
      name: meal.name,
      ingredients: meal.ingredients,
    },
  ]
}

export const getMealOption = (meal: Meal, optionId?: string) => {
  const options = getMealOptions(meal)
  return options.find((option) => option.id === optionId) ?? options[0]
}

export const optionCalories = (option: MealOption) =>
  option.ingredients.reduce((total, ingredient) => total + ingredient.calories, 0)

export const mealCalorieRange = (meal: Meal): CalorieRange => {
  const values = getMealOptions(meal).map(optionCalories)
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

export const dayCalorieRange = (meals: Meal[]): CalorieRange =>
  meals.reduce(
    (range, meal) => {
      const mealRange = mealCalorieRange(meal)
      return {
        min: range.min + mealRange.min,
        max: range.max + mealRange.max,
      }
    },
    { min: 0, max: 0 },
  )
