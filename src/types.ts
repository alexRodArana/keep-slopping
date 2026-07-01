export type TabKey = 'today' | 'calendar' | 'plan'

export type ThemeMode = 'dark' | 'light'

export type AccentColor = 'green' | 'blue' | 'violet' | 'amber'

export type Ingredient = {
  id: string
  name: string
  amount: string
  calories: number
}

export type Meal = {
  id: string
  name: string
  slot: string
  ingredients: Ingredient[]
}

export type ActiveMealSession = {
  id: string
  mealId: string
  date: string
  startedAt: string
  checkedIngredientIds: string[]
}

export type MealSession = ActiveMealSession & {
  endedAt: string
  completed: boolean
}

export type AppState = {
  meals: Meal[]
  sessions: MealSession[]
  activeSession?: ActiveMealSession
}
