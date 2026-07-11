import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Circle,
  Cloud,
  Clock3,
  Flame,
  Mail,
  Moon,
  Palette,
  Pencil,
  Play,
  Plus,
  Save,
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
import { initialState, recommendations } from './data'
import './App.css'
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
import type { AccentColor, ActiveMealSession, AppState, Ingredient, Meal, MealSession, TabKey, ThemeMode } from './types'

type CalendarDay = {
  date: string
  dayNumber: number | null
  isCurrentMonth: boolean
  isFulfilled: boolean
  hasProgress: boolean
}

type DaySummary = {
  completedMealIds: Set<string>
  fulfilled: boolean
  hasProgress: boolean
  sessions: MealSession[]
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

const mealCalories = (meal: Meal) => meal.ingredients.reduce((total, ingredient) => total + ingredient.calories, 0)

const plannedDayCalories = (meals: Meal[]) => meals.reduce((total, meal) => total + mealCalories(meal), 0)

const hasUserData = (value: AppState) =>
  Boolean(value.sessions.length || value.activeSession || JSON.stringify(value.meals) !== defaultMealsSignature)

const getMeal = (meals: Meal[], mealId: string) => meals.find((meal) => meal.id === mealId)

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

  return meal.ingredients
    .filter((ingredient) => session.checkedIngredientIds.includes(ingredient.id))
    .reduce((total, ingredient) => total + ingredient.calories, 0)
}

const isMealSessionComplete = (session: ActiveMealSession | MealSession, meal: Meal) =>
  meal.ingredients.length > 0 && meal.ingredients.every((ingredient) => session.checkedIngredientIds.includes(ingredient.id))

const emptyDaySummary = (): DaySummary => ({
  completedMealIds: new Set(),
  fulfilled: false,
  hasProgress: false,
  sessions: [],
})

const buildDaySummaries = (meals: Meal[], sessions: MealSession[]) => {
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

  summaries.forEach((summary) => {
    summary.fulfilled = meals.length > 0 && meals.every((meal) => summary.completedMealIds.has(meal.id))
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
  const [now, setNow] = useState(() => Date.now())

  const today = todayIso()
  const activeMeal = state.activeSession ? getMeal(state.meals, state.activeSession.mealId) : undefined
  const currentAccent = accentOptions.find((option) => option.key === accent) ?? accentOptions[0]
  const currentFoodPhrase = foodPhrases[foodPhraseIndex]
  const totalCalories = useMemo(() => plannedDayCalories(state.meals), [state.meals])

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
    updateMetaContent('meta[name="theme-color"]', theme === 'dark' ? '#101417' : '#f5f7fb')
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
    if (state.activeSession) {
      return
    }

    const interval = window.setInterval(() => {
      setFoodPhraseIndex((index) => (index + 1) % foodPhrases.length)
    }, 5200)

    return () => window.clearInterval(interval)
  }, [state.activeSession])

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

  const startMeal = (mealId: string) => {
    vibrate(10)
    setState((current) => {
      const date = todayIso()
      const previousSession = getLatestMealSession(current.sessions, mealId, date)

      return {
        ...current,
        activeSession: {
          id: previousSession?.id ?? createId('meal-session'),
          mealId,
          date,
          startedAt: new Date().toISOString(),
          checkedIngredientIds: previousSession?.checkedIngredientIds ?? [],
        },
      }
    })
    setActiveTab('today')
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

  const updateIngredient = (mealId: string, ingredientId: string, patch: Partial<Ingredient>) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              ingredients: meal.ingredients.map((ingredient) =>
                ingredient.id === ingredientId ? { ...ingredient, ...patch } : ingredient,
              ),
            }
          : meal,
      ),
    }))
  }

  const addMeal = () => {
    vibrate(10)
    setState((current) => ({
      ...current,
      meals: [
        ...current.meals,
        {
          id: createId('meal'),
          name: 'Nueva comida',
          slot: '',
          ingredients: [{ id: createId('ingredient'), name: 'Ingrediente', amount: '', calories: 0 }],
        },
      ],
    }))
    setActiveTab('plan')
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

  const addIngredient = (mealId: string) => {
    vibrate(8)
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              ingredients: [...meal.ingredients, { id: createId('ingredient'), name: 'Ingrediente', amount: '', calories: 0 }],
            }
          : meal,
      ),
    }))
  }

  const deleteIngredient = (mealId: string, ingredientId: string) => {
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
        meal.id === mealId && meal.ingredients.length > 1
          ? { ...meal, ingredients: meal.ingredients.filter((ingredient) => ingredient.id !== ingredientId) }
          : meal,
      ),
      sessions: current.sessions.map((session) =>
        session.mealId === mealId
          ? { ...session, checkedIngredientIds: session.checkedIngredientIds.filter((id) => id !== ingredientId) }
          : session,
      ),
    }))
  }

  const content = state.activeSession && activeMeal ? (
    <MealFocus
      activeSession={state.activeSession}
      elapsedSeconds={Math.floor((now - new Date(state.activeSession.startedAt).getTime()) / 1000)}
      meal={activeMeal}
      onCancel={cancelActiveMeal}
      onFinish={finishMeal}
      onToggleIngredient={toggleIngredient}
    />
  ) : activeTab === 'today' ? (
    <TodayView heroPhrase={currentFoodPhrase} meals={state.meals} sessions={state.sessions} startMeal={startMeal} today={today} />
  ) : activeTab === 'calendar' ? (
    <CalendarView state={state} />
  ) : (
    <PlanView
      addIngredient={addIngredient}
      addMeal={addMeal}
      deleteIngredient={deleteIngredient}
      deleteMeal={deleteMeal}
      meals={state.meals}
      updateIngredient={updateIngredient}
      updateMeal={updateMeal}
    />
  )

  return (
    <div className={state.activeSession ? 'app-shell meal-focus-mode' : 'app-shell'}>
      <header className="app-header">
        <button aria-label="Ir a hoy" className="brand" type="button" onClick={() => setActiveTab('today')}>
          <span className="brand-mark">
            <img src="./keep-slopping-icon.svg" alt="" />
          </span>
          <span className="brand-copy">
            <strong>Keep Slopping</strong>
            <small>{state.activeSession ? 'Cocinando' : `${formatNumber(totalCalories)} kcal plan`}</small>
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

      {!state.activeSession && (
        <nav className="tabs" aria-label="Navegacion principal">
          <TabButton active={activeTab === 'today'} icon={<Utensils size={19} />} label="Hoy" onClick={() => setActiveTab('today')} />
          <TabButton
            active={activeTab === 'calendar'}
            icon={<CalendarDays size={19} />}
            label="Calendario"
            onClick={() => setActiveTab('calendar')}
          />
          <TabButton active={activeTab === 'plan'} icon={<Settings2 size={19} />} label="Plan" onClick={() => setActiveTab('plan')} />
        </nav>
      )}

      <main className={state.activeSession ? 'main main-focus' : `main main-${activeTab}`}>
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

function TodayView({
  heroPhrase,
  meals,
  sessions,
  startMeal,
  today,
}: {
  heroPhrase: string
  meals: Meal[]
  sessions: MealSession[]
  startMeal: (mealId: string) => void
  today: string
}) {
  const daySummaries = useMemo(() => buildDaySummaries(meals, sessions), [meals, sessions])
  const todaySummary = getDaySummary(daySummaries, today)
  const completedCalories = todaySummary.sessions.reduce((total, session) => total + sessionCalories(session, getMeal(meals, session.mealId)), 0)
  const totalCalories = useMemo(() => plannedDayCalories(meals), [meals])
  const completedCount = todaySummary.completedMealIds.size
  const progress = meals.length ? Math.round((completedCount / meals.length) * 100) : 0

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
          <MetricCard icon={<Flame size={18} />} label="Objetivo" value={`${formatNumber(totalCalories)} kcal`} />
          <MetricCard icon={<CheckCircle2 size={18} />} label="Hechas" value={`${completedCount}/${meals.length}`} />
          <MetricCard icon={<ChefHat size={18} />} label="Registrado" value={`${formatNumber(completedCalories)} kcal`} />
        </div>
        <div className="day-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="meal-list">
        {meals.map((meal) => {
          const complete = todaySummary.completedMealIds.has(meal.id)
          return <MealCard complete={complete} key={meal.id} meal={meal} startMeal={startMeal} />
        })}
      </div>

      <section className="recommendations surface">
        <div>
          <strong>Base</strong>
          <small>Del plan alimenticio</small>
        </div>
        {recommendations.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>
    </section>
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
  startMeal,
}: {
  complete: boolean
  meal: Meal
  startMeal: (mealId: string) => void
}) {
  return (
    <article className={complete ? 'meal-card complete' : 'meal-card'}>
      <div className="meal-card-head">
        <div>
          <span>{meal.slot || 'Comida'}</span>
          <h2>{meal.name}</h2>
        </div>
        <strong>{formatNumber(mealCalories(meal))} kcal</strong>
      </div>

      <div className="ingredient-preview">
        {meal.ingredients.slice(0, 4).map((ingredient) => (
          <span key={ingredient.id}>{ingredient.name}</span>
        ))}
        {meal.ingredients.length > 4 && <span>+{meal.ingredients.length - 4}</span>}
      </div>

      <button className={complete ? 'primary-button done' : 'primary-button'} type="button" onClick={() => startMeal(meal.id)}>
        {complete ? <CheckCircle2 size={18} /> : <Play size={18} />}
        {complete ? 'Rehacer' : 'Iniciar'}
      </button>
    </article>
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
  const completedCount = activeSession.checkedIngredientIds.length
  const totalCount = meal.ingredients.length
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
          <span>{meal.slot || 'Comida'}</span>
          <h1>{meal.name}</h1>
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
        {meal.ingredients.map((ingredient) => {
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
  const daySummaries = useMemo(() => buildDaySummaries(state.meals, state.sessions), [state.meals, state.sessions])
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
          {state.meals.map((meal) => {
            const session = selectedSummary.sessions.find((item) => item.mealId === meal.id)
            const complete = session ? isMealSessionComplete(session, meal) : false
            return (
              <article className={complete ? 'day-meal done' : 'day-meal'} key={meal.id}>
                <div>
                  <strong>{meal.name}</strong>
                  <span>{session ? `${session.checkedIngredientIds.length}/${meal.ingredients.length} ingredientes` : 'Sin registro'}</span>
                </div>
                <small>{session ? `${formatNumber(sessionCalories(session, meal))} kcal` : `${formatNumber(mealCalories(meal))} kcal`}</small>
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
  deleteIngredient,
  deleteMeal,
  meals,
  updateIngredient,
  updateMeal,
}: {
  addIngredient: (mealId: string) => void
  addMeal: () => void
  deleteIngredient: (mealId: string, ingredientId: string) => void
  deleteMeal: (mealId: string) => void
  meals: Meal[]
  updateIngredient: (mealId: string, ingredientId: string, patch: Partial<Ingredient>) => void
  updateMeal: (mealId: string, patch: Partial<Meal>) => void
}) {
  return (
    <section className="plan-view enter">
      <div className="plan-head">
        <div>
          <span>Plan editable</span>
          <h1>{formatNumber(plannedDayCalories(meals))} kcal/dia</h1>
        </div>
        <button aria-label="Agregar comida" className="icon-button brand-button" type="button" onClick={addMeal}>
          <Plus size={19} />
        </button>
      </div>

      <div className="plan-list">
        {meals.map((meal) => (
          <article className="surface plan-card" key={meal.id}>
            <div className="plan-card-head">
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
              <button aria-label="Eliminar comida" className="icon-button danger" type="button" onClick={() => deleteMeal(meal.id)}>
                <Trash2 size={17} />
              </button>
            </div>

            <div className="ingredient-editor-list">
              {meal.ingredients.map((ingredient) => (
                <div className="ingredient-editor" key={ingredient.id}>
                  <input
                    aria-label="Ingrediente"
                    value={ingredient.name}
                    onChange={(event) => updateIngredient(meal.id, ingredient.id, { name: event.target.value })}
                  />
                  <input
                    aria-label="Cantidad"
                    value={ingredient.amount}
                    onChange={(event) => updateIngredient(meal.id, ingredient.id, { amount: event.target.value })}
                  />
                  <input
                    aria-label="Calorias"
                    inputMode="decimal"
                    min="0"
                    type="number"
                    value={ingredient.calories}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => updateIngredient(meal.id, ingredient.id, { calories: Math.max(0, Number(event.target.value)) })}
                  />
                  <button
                    aria-label="Eliminar ingrediente"
                    className="icon-button tiny"
                    disabled={meal.ingredients.length === 1}
                    type="button"
                    onClick={() => deleteIngredient(meal.id, ingredient.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className="plan-card-footer">
              <button className="secondary-button" type="button" onClick={() => addIngredient(meal.id)}>
                <Plus size={16} />
                Ingrediente
              </button>
              <strong>{formatNumber(mealCalories(meal))} kcal</strong>
            </div>
          </article>
        ))}
      </div>

      <section className="surface plan-note">
        <Pencil size={18} />
        <span>Las calorias son estimadas y editables por ingrediente.</span>
      </section>
    </section>
  )
}

export default App
