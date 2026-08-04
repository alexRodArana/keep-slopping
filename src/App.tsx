import {
  Apple,
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Cloud,
  Clock3,
  Flame,
  LoaderCircle,
  Mail,
  Moon,
  Palette,
  Play,
  Plus,
  Save,
  ScanBarcode,
  Search,
  Settings2,
  Sun,
  Trash2,
  Utensils,
  X,
} from 'lucide-react'
import {
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { initialState } from './data'
import './App.css'
import { calculateNutrition, getFoodByBarcode, normalizeBarcode, searchFoods } from './foodApi'
import { dayCalorieRange, getMealOption, getMealOptions, mealCalorieRange, optionCalories } from './mealUtils'
import { loadState, saveState } from './storage'
import {
  getSession,
  isSupabaseConfigured,
  loadRemoteState,
  onAuthChange,
  saveRemoteState,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  type SyncSession,
} from './supabase'
import type {
  AccentColor,
  ActiveMealSession,
  AppState,
  FoodLog,
  FoodProduct,
  Ingredient,
  Meal,
  MealOption,
  MealSession,
  TabKey,
  ThemeMode,
} from './types'

type CalendarDay = {
  date: string
  dayNumber: number | null
  isCurrentMonth: boolean
  isFulfilled: boolean
  hasProgress: boolean
}

type DaySummary = {
  completedMealIds: Set<string>
  creatineCompleted: boolean
  foodLogs: FoodLog[]
  fulfilled: boolean
  hasProgress: boolean
  sessions: MealSession[]
}

type FoodFinderMode = 'search' | 'scan'

type FoodFinderRequest = {
  target: 'log' | 'meal'
  initialMode: FoodFinderMode
  mealId?: string
  optionId?: string
  editingLogId?: string
  initialProduct?: FoodProduct
  initialGrams?: number
}

type AccentOption = {
  key: AccentColor
  label: string
  color: string
}

const accentOptions: AccentOption[] = [
  { key: 'green', label: 'Verde', color: '#39b980' },
  { key: 'blue', label: 'Azul', color: '#2563eb' },
  { key: 'purple', label: 'Morado', color: '#7c3aed' },
  { key: 'orange', label: 'Naranja', color: '#d97706' },
  { key: 'rose', label: 'Rosa', color: '#be185d' },
]

const foodPhrases = [
  'Goy mode off. Meal prep Kosher.',
  'Plan Judio: pesar, cocinar, cumplir.',
  'Slopping Kosher, calorias bajo control.',
  'Del antojo Goy al plato medido.',
  'Cocina Kosher. Progreso limpio.',
  'Que el Goy interior respete el plan.',
  'Hoy toca precision Kosher en la cocina.',
  'Comida medida, disciplina Judia.',
]

const defaultMealsSignature = JSON.stringify(initialState.meals)

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const todayIso = () => toDateKey(new Date())

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const toMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const toLocalDate = (value: string) => new Date(`${value}T12:00:00`)

const addMonths = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return toMonthKey(date)
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const updateMetaContent = (selector: string, content: string) => {
  document.querySelector(selector)?.setAttribute('content', content)
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(toLocalDate(value))

const formatMonth = (value: string) => {
  const label = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(toLocalDate(`${value}-01`))
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)

const formatCalorieRange = ({ min, max }: { min: number; max: number }) =>
  min === max ? `${formatNumber(min)} kcal` : `${formatNumber(min)}-${formatNumber(max)} kcal`

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

const vibrate = (duration = 8) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration)
  }
}

const hasUserData = (value: AppState) =>
  Boolean(
    value.creatineDates.length ||
      value.foodLogs.length ||
      value.sessions.length ||
      value.activeSession ||
      JSON.stringify(value.meals) !== defaultMealsSignature,
  )

const getMeal = (meals: Meal[], mealId: string) => meals.find((meal) => meal.id === mealId)

const updateOptionIngredients = (
  meal: Meal,
  optionId: string | undefined,
  update: (ingredients: Ingredient[]) => Ingredient[],
): Meal => {
  if (!meal.options?.length) {
    return { ...meal, ingredients: update(meal.ingredients) }
  }

  const targetOption = getMealOption(meal, optionId)
  const nextIngredients = update(targetOption.ingredients)
  return {
    ...meal,
    ingredients: meal.options[0].id === targetOption.id ? nextIngredients : meal.ingredients,
    options: meal.options.map((option) =>
      option.id === targetOption.id ? { ...option, ingredients: nextIngredients } : option,
    ),
  }
}

const getSessionKey = (session: Pick<MealSession, 'date' | 'mealId'>) => `${session.date}::${session.mealId}`

const getSessionTime = (session: Pick<MealSession, 'startedAt'> & { endedAt?: string }) => {
  const endedAt = session.endedAt ? new Date(session.endedAt).getTime() : Number.NaN
  const startedAt = new Date(session.startedAt).getTime()

  return Number.isNaN(endedAt) ? (Number.isNaN(startedAt) ? 0 : startedAt) : endedAt
}

const sortSessionsByRecency = (sessions: MealSession[]) =>
  [...sessions].sort((a, b) => getSessionTime(b) - getSessionTime(a) || b.date.localeCompare(a.date))

const getLatestMealSession = (sessions: MealSession[], mealId: string, date: string) =>
  sortSessionsByRecency(sessions.filter((session) => session.mealId === mealId && session.date === date))[0]

const upsertMealSession = (sessions: MealSession[], nextSession: MealSession) => {
  const nextKey = getSessionKey(nextSession)
  return sortSessionsByRecency([nextSession, ...sessions.filter((session) => getSessionKey(session) !== nextKey)])
}

const sessionCalories = (session: ActiveMealSession | MealSession, meal?: Meal) => {
  if (!meal) {
    return 0
  }

  return getMealOption(meal, session.optionId).ingredients
    .filter((ingredient) => session.checkedIngredientIds.includes(ingredient.id))
    .reduce((total, ingredient) => total + ingredient.calories, 0)
}

const foodLogToProduct = (log: FoodLog): FoodProduct => ({
  barcode: log.barcode,
  name: log.name,
  brand: log.brand,
  imageUrl: log.imageUrl,
  servingGrams: log.servingGrams,
  caloriesPer100g: log.caloriesPer100g,
  proteinPer100g: log.proteinPer100g,
  carbsPer100g: log.carbsPer100g,
  fatPer100g: log.fatPer100g,
})

const isMealSessionComplete = (session: ActiveMealSession | MealSession, meal: Meal) => {
  const ingredients = getMealOption(meal, session.optionId).ingredients
  return ingredients.length > 0 && ingredients.every((ingredient) => session.checkedIngredientIds.includes(ingredient.id))
}

const emptyDaySummary = (): DaySummary => ({
  completedMealIds: new Set(),
  creatineCompleted: false,
  foodLogs: [],
  fulfilled: false,
  hasProgress: false,
  sessions: [],
})

const buildDaySummaries = (meals: Meal[], sessions: MealSession[], creatineDates: string[], foodLogs: FoodLog[]) => {
  const mealsById = new Map(meals.map((meal) => [meal.id, meal]))
  const summaries = new Map<string, DaySummary>()

  const latestSessions = new Map<string, MealSession>()

  sessions.forEach((session) => {
    if (!mealsById.has(session.mealId)) {
      return
    }

    const key = getSessionKey(session)
    const current = latestSessions.get(key)
    if (!current || getSessionTime(session) >= getSessionTime(current)) {
      latestSessions.set(key, session)
    }
  })

  latestSessions.forEach((session) => {
    const summary = summaries.get(session.date) ?? emptyDaySummary()
    summary.sessions.push(session)
    summary.hasProgress = true

    const meal = mealsById.get(session.mealId)
    if (meal && isMealSessionComplete(session, meal)) {
      summary.completedMealIds.add(session.mealId)
    }

    summaries.set(session.date, summary)
  })

  creatineDates.forEach((date) => {
    const summary = summaries.get(date) ?? emptyDaySummary()
    summary.creatineCompleted = true
    summary.hasProgress = true
    summaries.set(date, summary)
  })

  foodLogs.forEach((foodLog) => {
    const summary = summaries.get(foodLog.date) ?? emptyDaySummary()
    summary.foodLogs.push(foodLog)
    summary.hasProgress = true
    summaries.set(foodLog.date, summary)
  })

  summaries.forEach((summary) => {
    summary.fulfilled = meals.length > 0 && summary.creatineCompleted && meals.every((meal) => summary.completedMealIds.has(meal.id))
  })

  return summaries
}

const getDaySummary = (summaries: Map<string, DaySummary>, date: string) => summaries.get(date) ?? emptyDaySummary()

const buildCalendarDays = (monthKey: string, daySummaries: Map<string, DaySummary>): CalendarDay[] => {
  const [year, month] = monthKey.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1

    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return {
        date: `${monthKey}-empty-${index}`,
        dayNumber: null,
        isCurrentMonth: false,
        isFulfilled: false,
        hasProgress: false,
      }
    }

    const dateKey = `${monthKey}-${String(dayNumber).padStart(2, '0')}`
    const summary = getDaySummary(daySummaries, dateKey)

    return {
      date: dateKey,
      dayNumber,
      isCurrentMonth: true,
      isFulfilled: summary.fulfilled,
      hasProgress: summary.hasProgress,
    }
  })
}

function App() {
  const [state, setState] = useState<AppState>(initialState)
  const stateRef = useRef(state)
  const authHydrationRef = useRef(0)
  const initialAuthHandledRef = useRef(false)
  const isHydratingRef = useRef(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [session, setSession] = useState<SyncSession | null>(null)
  const [syncEmail, setSyncEmail] = useState('')
  const [syncPassword, setSyncPassword] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [syncStatus, setSyncStatus] = useState<'local' | 'loading' | 'synced' | 'sent' | 'error'>('local')
  const [syncCooldown, setSyncCooldown] = useState(0)
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const storedTheme = localStorage.getItem('keep-slopping-theme')
    return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark'
  })
  const [accent, setAccent] = useState<AccentColor>(() => {
    const storedAccent = localStorage.getItem('keep-slopping-accent')
    return accentOptions.some((option) => option.key === storedAccent) ? (storedAccent as AccentColor) : 'green'
  })
  const [accentOpen, setAccentOpen] = useState(false)
  const [foodPhraseIndex, setFoodPhraseIndex] = useState(() => Math.floor(Math.random() * foodPhrases.length))
  const [foodFinderRequest, setFoodFinderRequest] = useState<FoodFinderRequest | null>(null)
  const [optionPickerMealId, setOptionPickerMealId] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const today = todayIso()
  const activeMeal = state.activeSession ? getMeal(state.meals, state.activeSession.mealId) : undefined
  const optionPickerMeal = optionPickerMealId ? getMeal(state.meals, optionPickerMealId) : undefined
  const currentAccent = accentOptions.find((option) => option.key === accent) ?? accentOptions[0]
  const currentFoodPhrase = foodPhrases[foodPhraseIndex]
  const totalCalories = useMemo(() => dayCalorieRange(state.meals), [state.meals])

  const applyLoadedState = useCallback((savedState: AppState) => {
    stateRef.current = savedState
    setState(savedState)
  }, [])

  const loadRemoteStateWithRetry = useCallback(async (userId: string) => {
    try {
      return await loadRemoteState(userId)
    } catch (error) {
      await wait(500)
      try {
        return await loadRemoteState(userId)
      } catch {
        throw error
      }
    }
  }, [])

  const hydrateSessionState = useCallback(
    async (nextSession: SyncSession, localState: AppState) => {
      const token = authHydrationRef.current + 1
      authHydrationRef.current = token
      isHydratingRef.current = true
      setSyncStatus('loading')

      try {
        const remoteState = await loadRemoteStateWithRetry(nextSession.user.id)
        if (authHydrationRef.current !== token) {
          return
        }

        const shouldBootstrapRemote = !hasUserData(remoteState) && hasUserData(localState)
        const nextState = shouldBootstrapRemote ? localState : remoteState

        applyLoadedState(nextState)
        setSession(nextSession)
        setSyncStatus('synced')
        setSyncMessage('')

        try {
          saveState(nextState)
        } catch (error) {
          console.error('Could not cache remote state locally', error)
        }

        if (shouldBootstrapRemote) {
          await saveRemoteState(nextSession.user.id, nextState)
        }
      } finally {
        if (authHydrationRef.current === token) {
          isHydratingRef.current = false
        }
      }
    },
    [applyLoadedState, loadRemoteStateWithRetry],
  )

  useEffect(() => {
    let mounted = true

    const loadInitialState = async () => {
      try {
        const localState = loadState()

        if (isSupabaseConfigured) {
          const currentSession = await getSession()
          if (!mounted) {
            return
          }

          if (currentSession) {
            await hydrateSessionState(currentSession, localState)
          } else {
            setSession(null)
            applyLoadedState(localState)
            setSyncStatus('local')
          }
        } else {
          applyLoadedState(localState)
          setSyncStatus('local')
        }
      } catch (error) {
        console.error('Could not load persisted state', error)
        if (mounted) {
          applyLoadedState(loadState())
          setSyncStatus('error')
          setSyncMessage('No se pudo cargar Supabase.')
        }
      } finally {
        if (mounted) {
          initialAuthHandledRef.current = true
          setIsLoaded(true)
        }
      }
    }

    loadInitialState()

    const unsubscribe = onAuthChange(async (nextSession) => {
      if (!initialAuthHandledRef.current) {
        return
      }

      if (!nextSession) {
        authHydrationRef.current += 1
        isHydratingRef.current = false
        setSession(null)
        setSyncStatus('local')
        return
      }

      try {
        const localState = stateRef.current
        if (!mounted) {
          return
        }
        await hydrateSessionState(nextSession, localState)
        setSyncPassword('')
      } catch (error) {
        console.error('Could not load remote state', error)
        setSession(nextSession)
        setSyncStatus('error')
        setSyncMessage('No se pudo sincronizar.')
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [applyLoadedState, hydrateSessionState])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!isLoaded || isHydratingRef.current) {
      return
    }

    const timeout = window.setTimeout(() => {
      const persist = async () => {
        try {
          saveState(state)
          if (session) {
            await saveRemoteState(session.user.id, state)
            setSyncStatus('synced')
          } else {
            setSyncStatus('local')
          }
        } catch (error) {
          console.error('Could not save state', error)
          setSyncStatus('error')
          setSyncMessage('No se pudo guardar.')
        }
      }

      persist()
    }, 220)

    return () => window.clearTimeout(timeout)
  }, [isLoaded, session, state])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('keep-slopping-theme', theme)
    updateMetaContent('meta[name="theme-color"]', theme === 'dark' ? '#0d0f12' : '#f5f6f8')
    updateMetaContent('meta[name="apple-mobile-web-app-status-bar-style"]', theme === 'dark' ? 'black-translucent' : 'default')
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.accent = accent
    localStorage.setItem('keep-slopping-accent', accent)
  }, [accent])

  useEffect(() => {
    if (!state.activeSession) {
      return
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [state.activeSession])

  useEffect(() => {
    if (syncCooldown <= 0) {
      return
    }

    const interval = window.setInterval(() => setSyncCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [syncCooldown])

  useEffect(() => {
    if (state.activeSession || foodFinderRequest || optionPickerMeal) {
      return
    }

    const interval = window.setInterval(() => {
      setFoodPhraseIndex((index) => (index + 1) % foodPhrases.length)
    }, 5200)

    return () => window.clearInterval(interval)
  }, [foodFinderRequest, optionPickerMeal, state.activeSession])

  const requestSyncLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!syncEmail.trim() || !syncPassword || syncCooldown > 0) {
      return
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const intent = submitter?.value === 'signup' ? 'signup' : 'signin'

    try {
      setSyncStatus('loading')
      if (intent === 'signup') {
        await signUpWithEmail(syncEmail.trim(), syncPassword)
      } else {
        await signInWithEmail(syncEmail.trim(), syncPassword)
      }
      setSyncStatus('sent')
      setSyncMessage(intent === 'signup' ? 'Cuenta creada.' : '')
    } catch (error) {
      console.error('Could not authenticate with Supabase', error)
      setSyncStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'No se pudo sincronizar.'

      if (errorMessage.toLowerCase().includes('rate limit')) {
        setSyncCooldown(60)
        setSyncMessage('Espera 60 segundos antes de intentar otra vez.')
        return
      }

      if (errorMessage.toLowerCase().includes('invalid login credentials')) {
        setSyncMessage('Correo o contraseña incorrectos.')
        return
      }

      if (errorMessage.toLowerCase().includes('already registered')) {
        setSyncMessage('Ese correo ya tiene cuenta. Usa Entrar.')
        return
      }

      setSyncMessage(errorMessage.replace('Signup', 'Registro'))
    }
  }

  const disconnectSync = async () => {
    authHydrationRef.current += 1
    isHydratingRef.current = false
    await signOut()
    setSession(null)
    setSyncStatus('local')
    setSyncPassword('')
  }

  const beginMeal = (mealId: string, optionId: string) => {
    vibrate(10)
    setState((current) => {
      const meal = getMeal(current.meals, mealId)
      if (!meal) {
        return current
      }

      const option = getMealOption(meal, optionId)
      const date = todayIso()
      const previousSession = getLatestMealSession(current.sessions, mealId, date)
      const canResume = previousSession && getMealOption(meal, previousSession.optionId).id === option.id

      return {
        ...current,
        activeSession: {
          id: previousSession?.id ?? createId('meal-session'),
          mealId,
          optionId: option.id,
          date,
          startedAt: new Date().toISOString(),
          checkedIngredientIds: canResume ? previousSession.checkedIngredientIds : [],
        },
      }
    })
    setOptionPickerMealId(null)
    setActiveTab('today')
  }

  const startMeal = (mealId: string) => {
    const meal = getMeal(state.meals, mealId)
    if (!meal) {
      return
    }

    const options = getMealOptions(meal)
    if (options.length > 1) {
      vibrate(8)
      setAccentOpen(false)
      setOptionPickerMealId(mealId)
      return
    }

    beginMeal(mealId, options[0].id)
  }

  const toggleIngredient = (ingredientId: string) => {
    vibrate(6)
    setState((current) => {
      if (!current.activeSession) {
        return current
      }

      const checked = current.activeSession.checkedIngredientIds.includes(ingredientId)

      return {
        ...current,
        activeSession: {
          ...current.activeSession,
          checkedIngredientIds: checked
            ? current.activeSession.checkedIngredientIds.filter((id) => id !== ingredientId)
            : [...current.activeSession.checkedIngredientIds, ingredientId],
        },
      }
    })
  }

  const cancelActiveMeal = () => {
    vibrate(12)
    setState((current) => ({ ...current, activeSession: undefined }))
  }

  const finishMeal = () => {
    if (!state.activeSession || !activeMeal) {
      return
    }

    vibrate(18)
    setState((current) => {
      if (!current.activeSession) {
        return current
      }

      const meal = getMeal(current.meals, current.activeSession.mealId)
      if (!meal) {
        return {
          ...current,
          activeSession: undefined,
        }
      }

      const completed = isMealSessionComplete(current.activeSession, meal)
      const session: MealSession = {
        ...current.activeSession,
        endedAt: new Date().toISOString(),
        completed,
      }

      return {
        ...current,
        activeSession: undefined,
        sessions: upsertMealSession(current.sessions, session),
      }
    })
  }

  const updateMeal = (mealId: string, patch: Partial<Meal>) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) => (meal.id === mealId ? { ...meal, ...patch } : meal)),
    }))
  }

  const updateIngredient = (mealId: string, optionId: string | undefined, ingredientId: string, patch: Partial<Ingredient>) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? updateOptionIngredients(meal, optionId, (ingredients) =>
              ingredients.map((ingredient) =>
                ingredient.id === ingredientId ? { ...ingredient, ...patch } : ingredient,
              ),
            )
          : meal,
      ),
    }))
  }

  const updateMealOption = (mealId: string, optionId: string, patch: Partial<MealOption>) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId && meal.options?.length
          ? { ...meal, options: meal.options.map((option) => (option.id === optionId ? { ...option, ...patch } : option)) }
          : meal,
      ),
    }))
  }

  const addMeal = () => {
    vibrate(10)
    const mealId = createId('meal')
    setState((current) => ({
      ...current,
      meals: [
        ...current.meals,
        {
          id: mealId,
          name: 'Nueva comida',
          slot: '',
          ingredients: [{ id: createId('ingredient'), name: 'Ingrediente', amount: '', calories: 0 }],
        },
      ],
    }))
    setActiveTab('plan')
    return mealId
  }

  const deleteMeal = (mealId: string) => {
    vibrate(14)
    setState((current) => ({
      ...current,
      activeSession: current.activeSession?.mealId === mealId ? undefined : current.activeSession,
      meals: current.meals.filter((meal) => meal.id !== mealId),
      sessions: current.sessions.filter((session) => session.mealId !== mealId),
    }))
  }

  const addMealOption = (mealId: string) => {
    const optionId = createId('meal-option')
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) => {
        if (meal.id !== mealId) {
          return meal
        }

        const existingOptions = meal.options?.length
          ? meal.options
          : [{ id: `${meal.id}-option-1`, name: meal.name, ingredients: meal.ingredients }]

        return {
          ...meal,
          ingredients: existingOptions[0].ingredients,
          options: [
            ...existingOptions,
            {
              id: optionId,
              name: 'Nueva opción',
              ingredients: [{ id: createId('ingredient'), name: 'Ingrediente', amount: '', calories: 0 }],
            },
          ],
        }
      }),
    }))
    vibrate(8)
    return optionId
  }

  const deleteMealOption = (mealId: string, optionId: string) => {
    vibrate(10)
    setState((current) => ({
      ...current,
      activeSession:
        current.activeSession?.mealId === mealId && current.activeSession.optionId === optionId
          ? undefined
          : current.activeSession,
      meals: current.meals.map((meal) => {
        if (meal.id !== mealId || !meal.options || meal.options.length <= 1) {
          return meal
        }

        const options = meal.options.filter((option) => option.id !== optionId)
        return { ...meal, ingredients: options[0].ingredients, options }
      }),
      sessions: current.sessions.filter((session) => !(session.mealId === mealId && session.optionId === optionId)),
    }))
  }

  const addIngredient = (mealId: string, optionId?: string) => {
    vibrate(8)
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? updateOptionIngredients(meal, optionId, (ingredients) => [
              ...ingredients,
              { id: createId('ingredient'), name: 'Ingrediente', amount: '', calories: 0 },
            ])
          : meal,
      ),
    }))
  }

  const deleteIngredient = (mealId: string, optionId: string | undefined, ingredientId: string) => {
    vibrate(10)
    setState((current) => ({
      ...current,
      activeSession:
        current.activeSession?.mealId === mealId
          ? {
              ...current.activeSession,
              checkedIngredientIds: current.activeSession.checkedIngredientIds.filter((id) => id !== ingredientId),
            }
          : current.activeSession,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? updateOptionIngredients(meal, optionId, (ingredients) =>
              ingredients.length > 1 ? ingredients.filter((ingredient) => ingredient.id !== ingredientId) : ingredients,
            )
          : meal,
      ),
      sessions: current.sessions.map((session) =>
        session.mealId === mealId
          ? { ...session, checkedIngredientIds: session.checkedIngredientIds.filter((id) => id !== ingredientId) }
          : session,
      ),
    }))
  }

  const toggleCreatine = () => {
    const date = todayIso()
    vibrate(10)
    setState((current) => {
      const completed = current.creatineDates.includes(date)

      return {
        ...current,
        creatineDates: completed ? current.creatineDates.filter((item) => item !== date) : [date, ...current.creatineDates],
      }
    })
  }

  const openFoodFinder = (request: FoodFinderRequest) => {
    vibrate(8)
    setAccentOpen(false)
    setFoodFinderRequest(request)
  }

  const editFoodLog = (foodLog: FoodLog) => {
    openFoodFinder({
      target: 'log',
      initialMode: 'search',
      editingLogId: foodLog.id,
      initialProduct: foodLogToProduct(foodLog),
      initialGrams: foodLog.grams,
    })
  }

  const deleteFoodLog = (foodLogId: string) => {
    vibrate(12)
    setState((current) => ({
      ...current,
      foodLogs: current.foodLogs.filter((foodLog) => foodLog.id !== foodLogId),
    }))
  }

  const saveFoodSelection = (product: FoodProduct, grams: number) => {
    if (!foodFinderRequest) {
      return
    }

    const nutrition = calculateNutrition(product, grams)
    const request = foodFinderRequest

    setState((current) => {
      if (request.target === 'meal' && request.mealId) {
        const ingredient: Ingredient = {
          id: createId('ingredient'),
          name: product.brand ? `${product.name} · ${product.brand}` : product.name,
          amount: `${formatNumber(grams)} g`,
          calories: nutrition.calories,
          barcode: product.barcode,
          imageUrl: product.imageUrl,
          grams,
          caloriesPer100g: product.caloriesPer100g,
          proteinPer100g: product.proteinPer100g,
          carbsPer100g: product.carbsPer100g,
          fatPer100g: product.fatPer100g,
        }

        return {
          ...current,
          meals: current.meals.map((meal) =>
            meal.id === request.mealId
              ? updateOptionIngredients(meal, request.optionId, (ingredients) =>
                  ingredients.length === 1 && ingredients[0].name === 'Ingrediente' && ingredients[0].calories === 0
                    ? [ingredient]
                    : [...ingredients, ingredient],
                )
              : meal,
          ),
        }
      }

      const existingLog = request.editingLogId
        ? current.foodLogs.find((foodLog) => foodLog.id === request.editingLogId)
        : undefined
      const nextLog: FoodLog = {
        ...product,
        id: existingLog?.id ?? createId('food-log'),
        date: existingLog?.date ?? todayIso(),
        grams,
        ...nutrition,
        createdAt: existingLog?.createdAt ?? new Date().toISOString(),
      }

      return {
        ...current,
        foodLogs: [nextLog, ...current.foodLogs.filter((foodLog) => foodLog.id !== nextLog.id)],
      }
    })

    vibrate(16)
    setFoodFinderRequest(null)
    if (request.target === 'log') {
      setActiveTab('food')
    }
  }

  const content = foodFinderRequest ? (
    <FoodFinder
      request={foodFinderRequest}
      onClose={() => setFoodFinderRequest(null)}
      onSave={saveFoodSelection}
    />
  ) : state.activeSession && activeMeal ? (
    <MealFocus
      activeSession={state.activeSession}
      elapsedSeconds={Math.floor((now - new Date(state.activeSession.startedAt).getTime()) / 1000)}
      meal={activeMeal}
      onCancel={cancelActiveMeal}
      onFinish={finishMeal}
      onToggleIngredient={toggleIngredient}
    />
  ) : optionPickerMeal ? (
    <MealOptionPicker
      meal={optionPickerMeal}
      onCancel={() => setOptionPickerMealId(null)}
      onSelect={(optionId) => beginMeal(optionPickerMeal.id, optionId)}
    />
  ) : activeTab === 'today' ? (
    <TodayView
      creatineCompleted={state.creatineDates.includes(today)}
      foodLogs={state.foodLogs.filter((foodLog) => foodLog.date === today)}
      heroPhrase={currentFoodPhrase}
      meals={state.meals}
      sessions={state.sessions}
      startMeal={startMeal}
      today={today}
      toggleCreatine={toggleCreatine}
    />
  ) : activeTab === 'food' ? (
    <FoodLogView
      foodLogs={state.foodLogs.filter((foodLog) => foodLog.date === today)}
      onDeleteFoodLog={deleteFoodLog}
      onEditFoodLog={editFoodLog}
      openFoodFinder={openFoodFinder}
      today={today}
    />
  ) : activeTab === 'calendar' ? (
    <CalendarView state={state} />
  ) : (
    <PlanView
      addIngredient={addIngredient}
      addMeal={addMeal}
      addMealOption={addMealOption}
      deleteIngredient={deleteIngredient}
      deleteMeal={deleteMeal}
      deleteMealOption={deleteMealOption}
      meals={state.meals}
      openFoodFinder={openFoodFinder}
      updateIngredient={updateIngredient}
      updateMeal={updateMeal}
      updateMealOption={updateMealOption}
    />
  )

  const isFocusMode = Boolean(state.activeSession || foodFinderRequest || optionPickerMeal)

  return (
    <div className={isFocusMode ? 'app-shell focus-mode' : 'app-shell'}>
      <header className="app-header">
        <button aria-label="Ir a hoy" className="brand" type="button" onClick={() => setActiveTab('today')}>
          <span className="brand-mark">
            <img src="./keep-slopping-icon.svg" alt="" />
          </span>
          <span className="brand-copy">
            <strong>Keep Slopping</strong>
            <small>{optionPickerMeal ? 'Elige una opción' : isFocusMode ? 'En progreso' : `${formatCalorieRange(totalCalories)} plan`}</small>
          </span>
        </button>

        <div className="header-actions">
          {session && (
            <button
              aria-label="Cuenta registrada. Tocar para salir"
              className={syncStatus === 'error' ? 'account-status error' : 'account-status'}
              data-tooltip={syncStatus === 'error' ? 'Error de sync' : 'Registrado'}
              type="button"
              onClick={() => {
                vibrate(10)
                void disconnectSync()
              }}
            >
              {syncStatus === 'error' ? <Cloud size={17} /> : <CheckCircle2 size={17} />}
            </button>
          )}
          <div className="accent-picker">
            <button
              aria-expanded={accentOpen}
              aria-label="Cambiar acento"
              className="icon-button accent-button"
              data-tooltip={currentAccent.label}
              type="button"
              onClick={() => {
                vibrate(6)
                setAccentOpen((open) => !open)
              }}
            >
              <Palette size={17} />
              <span className="accent-dot" style={{ '--accent-dot': currentAccent.color } as CSSProperties} />
            </button>
            {accentOpen && (
              <div className="accent-menu" role="menu">
                {accentOptions.map((option) => (
                  <button
                    aria-checked={option.key === accent}
                    aria-label={`Color ${option.label}`}
                    className={option.key === accent ? 'accent-swatch active' : 'accent-swatch'}
                    key={option.key}
                    role="menuitemradio"
                    style={{ '--accent-dot': option.color } as CSSProperties}
                    type="button"
                    onClick={() => {
                      setAccent(option.key)
                      setAccentOpen(false)
                      vibrate(8)
                    }}
                  >
                    <span />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            aria-label="Cambiar tema"
            className="icon-button"
            data-tooltip={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            type="button"
            onClick={() => {
              setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
              vibrate(8)
            }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {!isFocusMode && (
        <div className="tabs-wrap">
          <nav className="tabs" aria-label="Navegacion principal">
            <TabButton active={activeTab === 'today'} icon={<Utensils size={19} />} label="Hoy" onClick={() => setActiveTab('today')} />
            <TabButton
              active={activeTab === 'food'}
              icon={<Apple size={19} />}
              label="Alimentos"
              onClick={() => setActiveTab('food')}
            />
            <TabButton
              active={activeTab === 'calendar'}
              icon={<CalendarDays size={19} />}
              label="Calendario"
              onClick={() => setActiveTab('calendar')}
            />
            <TabButton active={activeTab === 'plan'} icon={<Settings2 size={19} />} label="Plan" onClick={() => setActiveTab('plan')} />
          </nav>
        </div>
      )}

      <main className={isFocusMode ? 'main main-focus' : `main main-${activeTab}`}>
        {!isFocusMode && (
          <SyncPanel
            email={syncEmail}
            isConfigured={isSupabaseConfigured}
            message={syncMessage}
            password={syncPassword}
            session={session}
            setEmail={setSyncEmail}
            setPassword={setSyncPassword}
            status={syncStatus}
            submit={requestSyncLink}
            syncCooldown={syncCooldown}
          />
        )}
        {isLoaded ? content : <LoadingView />}
      </main>
    </div>
  )
}

function SyncPanel({
  email,
  isConfigured,
  message,
  password,
  session,
  setEmail,
  setPassword,
  status,
  submit,
  syncCooldown,
}: {
  email: string
  isConfigured: boolean
  message: string
  password: string
  session: SyncSession | null
  setEmail: Dispatch<SetStateAction<string>>
  setPassword: Dispatch<SetStateAction<string>>
  status: 'local' | 'loading' | 'synced' | 'sent' | 'error'
  submit: (event: FormEvent<HTMLFormElement>) => void
  syncCooldown: number
}) {
  if (!isConfigured) {
    return (
      <section className="sync-panel muted">
        <Cloud size={17} />
        <span>Supabase pendiente</span>
      </section>
    )
  }

  if (session) {
    return null
  }

  return (
    <form className="sync-panel login" onSubmit={submit}>
      <Mail size={17} />
      <input
        aria-label="Email"
        autoComplete="email"
        placeholder="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        aria-label="Contraseña"
        autoComplete="current-password"
        minLength={6}
        placeholder="contraseña"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button className="primary-button compact" disabled={status === 'loading' || syncCooldown > 0} type="submit" value="signin">
        {syncCooldown > 0 ? `${syncCooldown}s` : 'Entrar'}
      </button>
      <button className="secondary-button compact" disabled={status === 'loading' || syncCooldown > 0} type="submit" value="signup">
        Crear
      </button>
      {message && <small>{message}</small>}
    </form>
  )
}

function LoadingView() {
  return (
    <section className="loading-view surface">
      <ChefHat size={18} />
      <span>Cargando plan</span>
    </section>
  )
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={active ? 'tab active' : 'tab'}
      type="button"
      onClick={() => {
        vibrate(6)
        onClick()
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function FoodFinder({
  onClose,
  onSave,
  request,
}: {
  onClose: () => void
  onSave: (product: FoodProduct, grams: number) => void
  request: FoodFinderRequest
}) {
  const [mode, setMode] = useState<FoodFinderMode>(request.initialMode)
  const [query, setQuery] = useState('')
  const [manualBarcode, setManualBarcode] = useState('')
  const [results, setResults] = useState<FoodProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(request.initialProduct ?? null)
  const [grams, setGrams] = useState(request.initialGrams ?? request.initialProduct?.servingGrams ?? 100)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [hasSearched, setHasSearched] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scanHandledRef = useRef(false)

  const selectProduct = useCallback((product: FoodProduct) => {
    setSelectedProduct(product)
    setGrams(product.servingGrams)
    setStatus('idle')
    setMessage('')
  }, [])

  const lookupBarcode = useCallback(
    async (rawBarcode: string) => {
      const barcode = normalizeBarcode(rawBarcode)
      if (barcode.length < 6) {
        setStatus('error')
        setMessage('Ingresa un codigo de barras valido.')
        return
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStatus('loading')
      setMessage('Buscando producto...')

      try {
        const product = await getFoodByBarcode(barcode, controller.signal)
        if (!product) {
          setStatus('error')
          setMessage('Ese producto no tiene informacion nutricional disponible.')
          scanHandledRef.current = false
          return
        }

        vibrate(14)
        selectProduct(product)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'No se pudo buscar el producto.')
        scanHandledRef.current = false
      }
    },
    [selectProduct],
  )

  useEffect(() => {
    if (mode !== 'scan' || selectedProduct) {
      return
    }

    let cancelled = false
    let stopScanner: (() => void) | undefined
    scanHandledRef.current = false

    const startScanner = async () => {
      if (!videoRef.current) {
        return
      }

      try {
        setStatus('loading')
        setMessage('Iniciando camara...')
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const codeReader = new BrowserMultiFormatReader()
        const controls = await codeReader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, _error, scannerControls) => {
            if (!result || scanHandledRef.current) {
              return
            }

            scanHandledRef.current = true
            scannerControls.stop()
            void lookupBarcode(result.getText())
          },
        )

        if (cancelled) {
          controls.stop()
          return
        }

        stopScanner = () => controls.stop()
        setStatus('idle')
        setMessage('Centra el codigo dentro del marco.')
      } catch (error) {
        if (cancelled) {
          return
        }

        console.error('Could not start barcode scanner', error)
        setStatus('error')
        setMessage('No se pudo abrir la camara. Revisa el permiso o escribe el codigo.')
      }
    }

    void startScanner()

    return () => {
      cancelled = true
      stopScanner?.()
    }
  }, [lookupBarcode, mode, selectedProduct])

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (query.trim().length < 2) {
      setStatus('error')
      setMessage('Escribe al menos dos caracteres.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')
    setMessage('')
    setHasSearched(true)

    try {
      const nextResults = await searchFoods(query, controller.signal)
      setResults(nextResults)
      setStatus('idle')
      setMessage(nextResults.length ? '' : 'No encontramos alimentos con calorias disponibles.')
    } catch (error) {
      if (controller.signal.aborted) {
        return
      }
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'No se pudo buscar.')
    }
  }

  if (selectedProduct) {
    const nutrition = calculateNutrition(selectedProduct, grams)
    const saveLabel =
      request.target === 'meal' ? 'Agregar al plan' : request.editingLogId ? 'Guardar cambios' : 'Registrar alimento'

    return (
      <section className="food-finder enter">
        <div className="finder-head">
          <button
            aria-label="Volver"
            className="icon-button flat"
            type="button"
            onClick={() => {
              if (request.initialProduct) {
                onClose()
                return
              }
              setSelectedProduct(null)
              scanHandledRef.current = false
            }}
          >
            <ArrowLeft size={19} />
          </button>
          <div>
            <span>Porcion</span>
            <h1>Ajustar alimento</h1>
          </div>
          <button aria-label="Cerrar" className="icon-button flat" type="button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>

        <article className="portion-card surface">
          <div className="portion-product">
            <FoodImage name={selectedProduct.name} src={selectedProduct.imageUrl} />
            <div>
              <span>{selectedProduct.brand || 'Open Food Facts'}</span>
              <h2>{selectedProduct.name}</h2>
              <small>{formatNumber(selectedProduct.caloriesPer100g)} kcal por 100 g</small>
            </div>
          </div>

          <div className="portion-input">
            <label htmlFor="food-portion-grams">Peso de la porcion</label>
            <div>
              <input
                autoFocus
                id="food-portion-grams"
                inputMode="decimal"
                min="1"
                step="1"
                type="number"
                value={grams}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => setGrams(Math.max(0, Number(event.target.value)))}
              />
              <strong>g</strong>
            </div>
          </div>

          <div className="nutrition-total">
            <span>Calorias</span>
            <strong>{formatNumber(nutrition.calories)} kcal</strong>
          </div>

          <div className="macro-grid">
            <div>
              <span>Proteina</span>
              <strong>{formatNumber(nutrition.protein)} g</strong>
            </div>
            <div>
              <span>Carbos</span>
              <strong>{formatNumber(nutrition.carbs)} g</strong>
            </div>
            <div>
              <span>Grasa</span>
              <strong>{formatNumber(nutrition.fat)} g</strong>
            </div>
          </div>

          <button
            className="primary-button save-food-button"
            disabled={!Number.isFinite(grams) || grams <= 0}
            type="button"
            onClick={() => onSave(selectedProduct, grams)}
          >
            <CheckCircle2 size={18} />
            {saveLabel}
          </button>
        </article>

        <FoodDataCredit />
      </section>
    )
  }

  return (
    <section className="food-finder enter">
      <div className="finder-head">
        <button aria-label="Cerrar" className="icon-button flat" type="button" onClick={onClose}>
          <X size={19} />
        </button>
        <div>
          <span>Registro rapido</span>
          <h1>Agregar alimento</h1>
        </div>
        <span aria-hidden="true" className="finder-head-spacer" />
      </div>

      <div className="finder-modes" role="tablist" aria-label="Metodo para agregar alimento">
        <button
          aria-selected={mode === 'search'}
          className={mode === 'search' ? 'active' : ''}
          role="tab"
          type="button"
          onClick={() => {
            setMode('search')
            setMessage('')
            setStatus('idle')
          }}
        >
          <Search size={17} />
          Buscar
        </button>
        <button
          aria-selected={mode === 'scan'}
          className={mode === 'scan' ? 'active' : ''}
          role="tab"
          type="button"
          onClick={() => {
            setMode('scan')
            setMessage('')
            setStatus('idle')
          }}
        >
          <ScanBarcode size={18} />
          Escanear
        </button>
      </div>

      {mode === 'search' ? (
        <>
          <form className="food-search" onSubmit={submitSearch}>
            <Search size={18} />
            <input
              aria-label="Buscar alimento"
              autoFocus
              enterKeyHint="search"
              placeholder="Yogurt griego, avena..."
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button aria-label="Buscar" className="icon-button brand-button" disabled={status === 'loading'} type="submit">
              {status === 'loading' ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
            </button>
          </form>

          <div className="food-results" aria-live="polite">
            {results.map((product) => (
              <button className="food-result" key={product.barcode} type="button" onClick={() => selectProduct(product)}>
                <FoodImage name={product.name} src={product.imageUrl} />
                <span>
                  <strong>{product.name}</strong>
                  <small>{product.brand || 'Sin marca'}</small>
                </span>
                <em>{formatNumber(product.caloriesPer100g)} kcal</em>
              </button>
            ))}
            {hasSearched && !results.length && status !== 'loading' && !message && (
              <div className="finder-empty">Sin resultados</div>
            )}
          </div>
        </>
      ) : (
        <div className="scanner-shell">
          <div className="scanner-preview">
            <video ref={videoRef} autoPlay muted playsInline />
            <span className="scanner-frame" aria-hidden="true" />
            {status === 'loading' && (
              <span className="scanner-loading">
                <LoaderCircle className="spin" size={22} />
              </span>
            )}
          </div>

          <form
            className="barcode-manual"
            onSubmit={(event) => {
              event.preventDefault()
              void lookupBarcode(manualBarcode)
            }}
          >
            <input
              aria-label="Codigo de barras"
              inputMode="numeric"
              placeholder="Escribir codigo"
              value={manualBarcode}
              onChange={(event) => setManualBarcode(normalizeBarcode(event.target.value))}
            />
            <button className="secondary-button" disabled={status === 'loading'} type="submit">
              Buscar
            </button>
          </form>
        </div>
      )}

      {message && (
        <div className={status === 'error' ? 'finder-message error' : 'finder-message'} role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </div>
      )}
      <FoodDataCredit />
    </section>
  )
}

function FoodImage({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  return (
    <span className="food-image">
      {src && !failed ? (
        <img alt="" loading="lazy" src={src} onError={() => setFailed(true)} />
      ) : (
        <Utensils aria-label={name} size={19} />
      )}
    </span>
  )
}

function FoodDataCredit() {
  return (
    <small className="food-credit">
      Datos de{' '}
      <a href="https://world.openfoodfacts.org/" rel="noreferrer" target="_blank">
        Open Food Facts
      </a>
      . Verifica la etiqueta del producto.
    </small>
  )
}

function TodayView({
  creatineCompleted,
  foodLogs,
  heroPhrase,
  meals,
  sessions,
  startMeal,
  today,
  toggleCreatine,
}: {
  creatineCompleted: boolean
  foodLogs: FoodLog[]
  heroPhrase: string
  meals: Meal[]
  sessions: MealSession[]
  startMeal: (mealId: string) => void
  today: string
  toggleCreatine: () => void
}) {
  const daySummaries = useMemo(
    () => buildDaySummaries(meals, sessions, creatineCompleted ? [today] : [], foodLogs),
    [creatineCompleted, foodLogs, meals, sessions, today],
  )
  const todaySummary = getDaySummary(daySummaries, today)
  const completedCalories =
    todaySummary.sessions.reduce((total, session) => total + sessionCalories(session, getMeal(meals, session.mealId)), 0) +
    foodLogs.reduce((total, foodLog) => total + foodLog.calories, 0)
  const totalCalories = useMemo(() => dayCalorieRange(meals), [meals])
  const completedCount = todaySummary.completedMealIds.size
  const totalTasks = meals.length + 1
  const completedTasks = completedCount + (creatineCompleted ? 1 : 0)
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <section className="today-view enter">
      <div className="today-hero-copy">
        <span>Plan de hoy</span>
        <h1 className="hero-phrase" key={heroPhrase}>
          {heroPhrase}
        </h1>
      </div>

      <div className="hero-panel">
        <div className="hero-stats">
          <MetricCard icon={<Flame size={18} />} label="Objetivo" value={formatCalorieRange(totalCalories)} />
          <MetricCard icon={<CheckCircle2 size={18} />} label="Hechas" value={`${completedTasks}/${totalTasks}`} />
          <MetricCard icon={<ChefHat size={18} />} label="Registrado" value={`${formatNumber(completedCalories)} kcal`} />
        </div>
        <div className="day-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <button className={creatineCompleted ? 'creatine-card complete' : 'creatine-card'} type="button" onClick={toggleCreatine}>
        <span className="check-icon">{creatineCompleted ? <Check size={18} /> : <Circle size={18} />}</span>
        <span>
          <strong>Creatina</strong>
          <small>Tomar hoy</small>
        </span>
        <em>{creatineCompleted ? 'Hecho' : 'Pendiente'}</em>
      </button>

      <div className="meal-list">
        {meals.map((meal) => {
          const mealSession = todaySummary.sessions.find((session) => session.mealId === meal.id)
          const complete = todaySummary.completedMealIds.has(meal.id)
          return <MealCard complete={complete} key={meal.id} meal={meal} session={mealSession} startMeal={startMeal} />
        })}
      </div>

    </section>
  )
}

function FoodLogView({
  foodLogs,
  onDeleteFoodLog,
  onEditFoodLog,
  openFoodFinder,
  today,
}: {
  foodLogs: FoodLog[]
  onDeleteFoodLog: (foodLogId: string) => void
  onEditFoodLog: (foodLog: FoodLog) => void
  openFoodFinder: (request: FoodFinderRequest) => void
  today: string
}) {
  const loggedCalories = foodLogs.reduce((total, foodLog) => total + foodLog.calories, 0)

  return (
    <section className="food-view enter">
      <div className="plan-head food-log-head">
        <div>
          <span>{formatDate(today)}</span>
          <h1>Alimentos</h1>
        </div>
        <strong>{formatNumber(loggedCalories)} kcal</strong>
      </div>

      <section className="quick-log surface">
        <div>
          <span>Registro diario</span>
          <strong>Busca o escanea un alimento</strong>
        </div>
        <div className="quick-log-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => openFoodFinder({ target: 'log', initialMode: 'search' })}
          >
            <Search size={17} />
            Buscar
          </button>
          <button
            className="primary-button compact"
            type="button"
            onClick={() => openFoodFinder({ target: 'log', initialMode: 'scan' })}
          >
            <ScanBarcode size={18} />
            Escanear
          </button>
        </div>
      </section>

      <section className="food-log-section" aria-label="Alimentos registrados hoy">
        <div className="section-head">
          <span>Registrado hoy</span>
          <strong>
            {foodLogs.length} {foodLogs.length === 1 ? 'alimento' : 'alimentos'}
          </strong>
        </div>
        {foodLogs.length > 0 ? (
          <div className="food-log-list">
            {foodLogs.map((foodLog) => (
              <FoodLogRow foodLog={foodLog} key={foodLog.id} onDelete={onDeleteFoodLog} onEdit={onEditFoodLog} />
            ))}
          </div>
        ) : (
          <div className="food-log-empty surface">
            <Apple size={20} />
            <div>
              <strong>Sin alimentos registrados</strong>
              <span>Tu registro de hoy aparecera aqui.</span>
            </div>
          </div>
        )}
      </section>

      <FoodDataCredit />
    </section>
  )
}

function FoodLogRow({
  foodLog,
  onDelete,
  onEdit,
}: {
  foodLog: FoodLog
  onDelete: (foodLogId: string) => void
  onEdit: (foodLog: FoodLog) => void
}) {
  return (
    <article className="food-log-row">
      <FoodImage name={foodLog.name} src={foodLog.imageUrl} />
      <button className="food-log-main" type="button" onClick={() => onEdit(foodLog)}>
        <strong>{foodLog.name}</strong>
        <span>{formatNumber(foodLog.grams)} g · {foodLog.brand || 'Open Food Facts'}</span>
      </button>
      <strong>{formatNumber(foodLog.calories)} kcal</strong>
      <button
        aria-label={`Eliminar ${foodLog.name}`}
        className="icon-button flat danger-text"
        type="button"
        onClick={() => onDelete(foodLog.id)}
      >
        <Trash2 size={16} />
      </button>
    </article>
  )
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MealCard({
  complete,
  meal,
  session,
  startMeal,
}: {
  complete: boolean
  meal: Meal
  session?: MealSession
  startMeal: (mealId: string) => void
}) {
  const options = getMealOptions(meal)
  const selectedOption = session ? getMealOption(meal, session.optionId) : undefined
  const detail =
    selectedOption && meal.options?.length
      ? selectedOption.name
      : options.length > 1
        ? `${options.length} opciones`
        : `${options[0].ingredients.length} ingredientes`

  return (
    <article className={complete ? 'meal-card complete' : 'meal-card'}>
      <div className="meal-card-head">
        <div>
          <span>{meal.slot || 'Comida'}</span>
          <h2>{meal.name}</h2>
          <small>{detail}</small>
        </div>
        <strong>{formatCalorieRange(mealCalorieRange(meal))}</strong>
      </div>

      <button className={complete ? 'primary-button done' : 'primary-button'} type="button" onClick={() => startMeal(meal.id)}>
        {complete ? <CheckCircle2 size={18} /> : <Play size={18} />}
        {complete ? 'Rehacer' : 'Iniciar'}
      </button>
    </article>
  )
}

function MealOptionPicker({
  meal,
  onCancel,
  onSelect,
}: {
  meal: Meal
  onCancel: () => void
  onSelect: (optionId: string) => void
}) {
  const options = getMealOptions(meal)

  return (
    <section className="meal-option-picker enter">
      <div className="focus-head option-picker-head">
        <button aria-label="Volver al plan" className="icon-button flat" type="button" onClick={onCancel}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <span>{meal.slot || 'Comida'}</span>
          <h1>{meal.name}</h1>
        </div>
        <span className="option-count">{options.length}</span>
      </div>

      <div className="option-picker-title">
        <span>Elige una opción</span>
        <strong>¿Qué vas a preparar?</strong>
      </div>

      <div className="meal-option-list">
        {options.map((option) => (
          <button
            aria-label={`Elegir ${option.name}`}
            className="meal-option-card"
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
          >
            <span className="option-card-main">
              <strong>{option.name}</strong>
              <small>{option.ingredients.map((ingredient) => ingredient.name).join(' · ')}</small>
            </span>
            <span className="option-card-meta">
              <strong>{formatNumber(optionCalories(option))} kcal</strong>
              <small>{option.ingredients.length} ingredientes</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </section>
  )
}

function MealFocus({
  activeSession,
  elapsedSeconds,
  meal,
  onCancel,
  onFinish,
  onToggleIngredient,
}: {
  activeSession: ActiveMealSession
  elapsedSeconds: number
  meal: Meal
  onCancel: () => void
  onFinish: () => void
  onToggleIngredient: (ingredientId: string) => void
}) {
  const option = getMealOption(meal, activeSession.optionId)
  const ingredients = option.ingredients
  const completedCount = ingredients.filter((ingredient) => activeSession.checkedIngredientIds.includes(ingredient.id)).length
  const totalCount = ingredients.length
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0
  const calories = sessionCalories(activeSession, meal)
  const complete = isMealSessionComplete(activeSession, meal)

  return (
    <section className="meal-focus enter">
      <div className="focus-head">
        <button aria-label="Cancelar comida" className="icon-button flat" type="button" onClick={onCancel}>
          <X size={18} />
        </button>
        <div>
          <span>{meal.options?.length ? meal.name : meal.slot || 'Comida'}</span>
          <h1>{meal.options?.length ? option.name : meal.name}</h1>
        </div>
        <div className="timer-chip">
          <Clock3 size={15} />
          {formatDuration(elapsedSeconds)}
        </div>
      </div>

      <div className="focus-progress">
        <div>
          <span>{completedCount}/{totalCount} ingredientes</span>
          <strong>{formatNumber(calories)} kcal</strong>
        </div>
        <div className="day-progress large">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="checklist">
        {ingredients.map((ingredient) => {
          const checked = activeSession.checkedIngredientIds.includes(ingredient.id)
          return (
            <button
              className={checked ? 'check-row checked' : 'check-row'}
              key={ingredient.id}
              type="button"
              onClick={() => onToggleIngredient(ingredient.id)}
            >
              <span className="check-icon">{checked ? <Check size={18} /> : <Circle size={18} />}</span>
              <span>
                <strong>{ingredient.name}</strong>
                <small>{ingredient.amount}</small>
              </span>
              <em>{formatNumber(ingredient.calories)} kcal</em>
            </button>
          )
        })}
      </div>

      <button className={complete ? 'finish-button complete' : 'finish-button'} type="button" onClick={onFinish}>
        <Save size={19} />
        {complete ? 'Terminar comida' : 'Guardar avance'}
      </button>
    </section>
  )
}

function CalendarView({ state }: { state: AppState }) {
  const latestSessionDate = state.sessions[0]?.date ?? todayIso()
  const [visibleMonth, setVisibleMonth] = useState(latestSessionDate.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(latestSessionDate)
  const daySummaries = useMemo(
    () => buildDaySummaries(state.meals, state.sessions, state.creatineDates, state.foodLogs),
    [state.creatineDates, state.foodLogs, state.meals, state.sessions],
  )
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth, daySummaries), [daySummaries, visibleMonth])
  const selectedSummary = getDaySummary(daySummaries, selectedDate)

  const changeMonth = (offset: number) => {
    vibrate(6)
    const nextMonth = addMonths(visibleMonth, offset)
    setVisibleMonth(nextMonth)
    setSelectedDate(`${nextMonth}-01`)
  }

  return (
    <section className="calendar-view enter">
      <section className="surface calendar-panel">
        <div className="calendar-head">
          <button aria-label="Mes anterior" className="icon-button flat" type="button" onClick={() => changeMonth(-1)}>
            <ChevronLeft size={18} />
          </button>
          <strong>{formatMonth(visibleMonth)}</strong>
          <button aria-label="Mes siguiente" className="icon-button flat" type="button" onClick={() => changeMonth(1)}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const isEmpty = day.dayNumber === null
            const className = [
              'calendar-day',
              isEmpty ? 'empty' : '',
              day.isCurrentMonth ? '' : 'muted',
              day.hasProgress ? 'partial' : '',
              day.isFulfilled ? 'fulfilled' : '',
              !isEmpty && day.date === selectedDate ? 'selected' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <button
                aria-label={isEmpty ? 'Dia vacio' : `${formatDate(day.date)}${day.isFulfilled ? ', plan cumplido' : ', pendiente'}`}
                className={className}
                disabled={isEmpty}
                key={day.date}
                type="button"
                onClick={() => {
                  if (isEmpty) {
                    return
                  }
                  vibrate(day.hasProgress ? 8 : 4)
                  setSelectedDate(day.date)
                }}
              >
                {day.dayNumber ?? ''}
              </button>
            )
          })}
        </div>
      </section>

      <section className="surface selected-day">
        <div className="selected-day-head">
          <div>
            <span>{formatDate(selectedDate)}</span>
            <strong>{selectedSummary.fulfilled ? 'Plan cumplido' : `${selectedSummary.completedMealIds.size}/${state.meals.length} comidas`}</strong>
          </div>
          {selectedSummary.fulfilled ? <CheckCircle2 size={22} /> : <CalendarDays size={22} />}
        </div>

        <div className="day-meals">
          <article className={selectedSummary.creatineCompleted ? 'day-meal done' : 'day-meal'}>
            <div>
              <strong>Creatina</strong>
              <span>Tomar hoy</span>
            </div>
            <small>{selectedSummary.creatineCompleted ? 'Hecho' : 'Pendiente'}</small>
          </article>

          {selectedSummary.foodLogs.map((foodLog) => (
            <article className="day-meal quick-food" key={foodLog.id}>
              <div>
                <strong>{foodLog.name}</strong>
                <span>{formatNumber(foodLog.grams)} g · Registro rapido</span>
              </div>
              <small>{formatNumber(foodLog.calories)} kcal</small>
            </article>
          ))}

          {state.meals.map((meal) => {
            const session = selectedSummary.sessions.find((item) => item.mealId === meal.id)
            const option = session ? getMealOption(meal, session.optionId) : undefined
            const complete = session ? isMealSessionComplete(session, meal) : false
            const checkedCount = session
              ? option?.ingredients.filter((ingredient) => session.checkedIngredientIds.includes(ingredient.id)).length ?? 0
              : 0
            return (
              <article className={complete ? 'day-meal done' : 'day-meal'} key={meal.id}>
                <div>
                  <strong>{meal.name}</strong>
                  <span>
                    {session && option ? `${option.name} · ${checkedCount}/${option.ingredients.length} ingredientes` : 'Sin registro'}
                  </span>
                </div>
                <small>{session ? `${formatNumber(sessionCalories(session, meal))} kcal` : formatCalorieRange(mealCalorieRange(meal))}</small>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}

function PlanView({
  addIngredient,
  addMeal,
  addMealOption,
  deleteIngredient,
  deleteMeal,
  deleteMealOption,
  meals,
  openFoodFinder,
  updateIngredient,
  updateMeal,
  updateMealOption,
}: {
  addIngredient: (mealId: string, optionId?: string) => void
  addMeal: () => string
  addMealOption: (mealId: string) => string
  deleteIngredient: (mealId: string, optionId: string | undefined, ingredientId: string) => void
  deleteMeal: (mealId: string) => void
  deleteMealOption: (mealId: string, optionId: string) => void
  meals: Meal[]
  openFoodFinder: (request: FoodFinderRequest) => void
  updateIngredient: (mealId: string, optionId: string | undefined, ingredientId: string, patch: Partial<Ingredient>) => void
  updateMeal: (mealId: string, patch: Partial<Meal>) => void
  updateMealOption: (mealId: string, optionId: string, patch: Partial<MealOption>) => void
}) {
  const [expandedMealId, setExpandedMealId] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState('')

  return (
    <section className="plan-view enter">
      <div className="plan-head">
        <div>
          <span>Plan diario</span>
          <h1>{formatCalorieRange(dayCalorieRange(meals))}/día</h1>
        </div>
        <button
          aria-label="Agregar comida"
          className="icon-button brand-button"
          type="button"
          onClick={() => {
            setSelectedOptionId('')
            setExpandedMealId(addMeal())
          }}
        >
          <Plus size={19} />
        </button>
      </div>

      <div className="plan-list">
        {meals.map((meal) => {
          const expanded = expandedMealId === meal.id
          const options = getMealOptions(meal)
          const selectedOption = options.find((option) => option.id === selectedOptionId) ?? options[0]
          const optionId = meal.options?.length ? selectedOption.id : undefined
          const ingredients = selectedOption.ingredients
          const summary = meal.options?.length
            ? `${options.length} ${options.length === 1 ? 'opción' : 'opciones'} · ${formatCalorieRange(mealCalorieRange(meal))}`
            : `${ingredients.length} ingredientes · ${formatNumber(optionCalories(selectedOption))} kcal`

          const toggleExpanded = () => {
            if (expanded) {
              setExpandedMealId('')
              setSelectedOptionId('')
              return
            }

            setExpandedMealId(meal.id)
            setSelectedOptionId(options[0].id)
          }

          return (
            <article className={expanded ? 'surface plan-card expanded' : 'surface plan-card'} key={meal.id}>
              <div className="plan-card-head">
                <button className="plan-card-summary" type="button" onClick={toggleExpanded}>
                  <span>{meal.slot || 'Comida'}</span>
                  <strong>{meal.name}</strong>
                  <small>{summary}</small>
                </button>
                <button
                  aria-label={expanded ? 'Comprimir comida' : 'Editar comida'}
                  className="icon-button flat"
                  type="button"
                  onClick={toggleExpanded}
                >
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {expanded && (
                <div className="plan-card-editor">
                  <div className="field-stack">
                    <label>
                      <span>Comida</span>
                      <input value={meal.name} onChange={(event) => updateMeal(meal.id, { name: event.target.value })} />
                    </label>
                    <label>
                      <span>Horario</span>
                      <input value={meal.slot} onChange={(event) => updateMeal(meal.id, { slot: event.target.value })} />
                    </label>
                  </div>

                  {meal.options?.length ? (
                    <>
                      <div className="meal-option-editor-head">
                        <label className="meal-option-select">
                          <span>Opción</span>
                          <select value={selectedOption.id} onChange={(event) => setSelectedOptionId(event.target.value)}>
                            {options.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div>
                          <button
                            aria-label="Agregar opción"
                            className="icon-button flat"
                            type="button"
                            onClick={() => setSelectedOptionId(addMealOption(meal.id))}
                          >
                            <Plus size={17} />
                          </button>
                          <button
                            aria-label="Eliminar opción"
                            className="icon-button flat danger-text"
                            disabled={options.length === 1}
                            type="button"
                            onClick={() => {
                              const currentIndex = options.findIndex((option) => option.id === selectedOption.id)
                              const fallback = options[currentIndex === 0 ? 1 : currentIndex - 1]
                              deleteMealOption(meal.id, selectedOption.id)
                              setSelectedOptionId(fallback?.id ?? '')
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <label className="meal-option-name">
                        <span>Nombre de la opción</span>
                        <input
                          value={selectedOption.name}
                          onChange={(event) => updateMealOption(meal.id, selectedOption.id, { name: event.target.value })}
                        />
                      </label>
                    </>
                  ) : (
                    <button
                      className="secondary-button add-option-button"
                      type="button"
                      onClick={() => {
                        setSelectedOptionId(addMealOption(meal.id))
                      }}
                    >
                      <Plus size={16} />
                      Agregar otra opción
                    </button>
                  )}

                  <button
                    className="food-lookup-button"
                    type="button"
                    onClick={() => openFoodFinder({ target: 'meal', initialMode: 'search', mealId: meal.id, optionId })}
                  >
                    <Search size={18} />
                    <span>
                      <strong>Buscar o escanear alimento</strong>
                      <small>Calorias calculadas por porcion</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>

                  <div className="ingredient-editor-list">
                    {ingredients.map((ingredient) => (
                      <div className="ingredient-editor" key={ingredient.id}>
                        <input
                          aria-label="Ingrediente"
                          value={ingredient.name}
                          onChange={(event) => updateIngredient(meal.id, optionId, ingredient.id, { name: event.target.value })}
                        />
                        <input
                          aria-label="Cantidad"
                          value={ingredient.amount}
                          onChange={(event) => updateIngredient(meal.id, optionId, ingredient.id, { amount: event.target.value })}
                        />
                        <input
                          aria-label="Calorias"
                          inputMode="decimal"
                          min="0"
                          type="number"
                          value={ingredient.calories}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) =>
                            updateIngredient(meal.id, optionId, ingredient.id, {
                              calories: Math.max(0, Number(event.target.value)),
                            })
                          }
                        />
                        <button
                          aria-label="Eliminar ingrediente"
                          className="icon-button tiny"
                          disabled={ingredients.length === 1}
                          type="button"
                          onClick={() => deleteIngredient(meal.id, optionId, ingredient.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="plan-card-footer">
                    <button className="secondary-button" type="button" onClick={() => addIngredient(meal.id, optionId)}>
                      <Plus size={16} />
                      Manual
                    </button>
                    <div>
                      <button
                        aria-label="Eliminar comida"
                        className="icon-button danger"
                        type="button"
                        onClick={() => {
                          deleteMeal(meal.id)
                          setExpandedMealId('')
                          setSelectedOptionId('')
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                      <button
                        className="primary-button compact"
                        type="button"
                        onClick={() => {
                          setExpandedMealId('')
                          setSelectedOptionId('')
                        }}
                      >
                        Listo
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default App
