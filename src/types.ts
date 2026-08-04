export type TabKey = 'today' | 'food' | 'calendar' | 'plan'

export type ThemeMode = 'dark' | 'light'

export type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'rose'

export type Ingredient = {
  id: string
  name: string
  amount: string
  calories: number
  barcode?: string
  imageUrl?: string
  grams?: number
  caloriesPer100g?: number
  proteinPer100g?: number
  carbsPer100g?: number
  fatPer100g?: number
}

export type MealOption = {
  id: string
  name: string
  ingredients: Ingredient[]
}

export type FoodProduct = {
  barcode: string
  name: string
  brand: string
  imageUrl?: string
  servingGrams: number
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
}

export type FoodLog = FoodProduct & {
  id: string
  date: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
  createdAt: string
}

export type Meal = {
  id: string
  name: string
  slot: string
  ingredients: Ingredient[]
  options?: MealOption[]
}

export type ActiveMealSession = {
  id: string
  mealId: string
  optionId?: string
  date: string
  startedAt: string
  checkedIngredientIds: string[]
}

export type MealSession = ActiveMealSession & {
  endedAt: string
  completed: boolean
}

export type AppState = {
  creatineDates: string[]
  foodLogs: FoodLog[]
  meals: Meal[]
  sessions: MealSession[]
  activeSession?: ActiveMealSession
}
