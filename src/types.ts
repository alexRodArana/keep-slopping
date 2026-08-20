export type TabKey = 'today' | 'plan'

export type ThemeMode = 'dark' | 'light'

export type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'rose'

export type Ingredient = {
  id: string
  name: string
  amount: string
}

export type Nutrition = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type PlanTarget = Nutrition

export type Meal = {
  id: string
  name: string
  ingredients: Ingredient[]
  nutrition: Nutrition
}

export type MealSession = {
  id: string
  mealId: string
  date: string
  startedAt: string
  endedAt: string
  checkedIngredientIds: string[]
  completed: boolean
}

export type AppState = {
  planVersion: number
  target: PlanTarget
  creatineDates: string[]
  meals: Meal[]
  sessions: MealSession[]
}
