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
  protein: number | null
  carbs: number | null
  fat: number | null
}

export type PlanTarget = Nutrition

export type MealOption = {
  id: string
  name: string
  ingredients: Ingredient[]
  nutrition: Nutrition
}

export type Meal = {
  id: string
  name: string
  ingredients: Ingredient[]
  nutrition: Nutrition
  options?: MealOption[]
  defaultOptionId?: string
  optionSourceMealId?: string
}

export type MealSession = {
  id: string
  mealId: string
  date: string
  startedAt: string
  endedAt: string
  checkedIngredientIds: string[]
  completed: boolean
  optionId?: string
}

export type AppState = {
  planVersion: number
  target: PlanTarget
  planNotes?: string[]
  creatineDates: string[]
  meals: Meal[]
  sessions: MealSession[]
}
