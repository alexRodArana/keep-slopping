import {
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Circle,
  Cloud,
  Flame,
  ListChecks,
  Mail,
  Moon,
  Palette,
  Plus,
  Settings2,
  Sun,
  Trash2,
  Utensils,
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
import './App.css'
import { initialState } from './data'
import {
  formatDate,
  formatNumber,
  getLatestMealSession,
  isMealSessionComplete,
  todayIso,
  upsertMealSession,
} from './domain'
import { sumNutrition } from './mealUtils'
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
import type { AccentColor, AppState, Ingredient, Meal, MealSession, Nutrition, TabKey, ThemeMode } from './types'

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

const defaultPlanSignature = JSON.stringify({
  target: initialState.target,
  notes: initialState.notes,
  meals: initialState.meals,
})

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const updateMetaContent = (selector: string, content: string) => {
  document.querySelector(selector)?.setAttribute('content', content)
}

const vibrate = (duration = 8) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration)
  }
}

const hasUserData = (value: AppState) =>
  Boolean(
    value.creatineDates.length ||
      value.sessions.length ||
      JSON.stringify({ target: value.target, notes: value.notes, meals: value.meals }) !== defaultPlanSignature,
  )

const getMeal = (meals: Meal[], mealId: string) => meals.find((meal) => meal.id === mealId)

function App() {
  const [state, setState] = useState<AppState>(initialState)
  const stateRef = useRef(state)
  const sessionRef = useRef<SyncSession | null>(null)
  const authHydrationRef = useRef(0)
  const initialAuthHandledRef = useRef(false)
  const isHydratingRef = useRef(false)
  const remoteSaveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const remoteSaveRevisionRef = useRef(0)
  const remoteSyncedStateRef = useRef<AppState | undefined>(undefined)
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

  const today = todayIso()
  const currentAccent = accentOptions.find((option) => option.key === accent) ?? accentOptions[0]
  const dailyNutrition = useMemo(() => sumNutrition(state.meals), [state.meals])

  const applyLoadedState = useCallback((savedState: AppState) => {
    stateRef.current = savedState
    setState(savedState)
  }, [])

  const loadRemoteStateWithRetry = useCallback(async () => {
    try {
      return await loadRemoteState()
    } catch (error) {
      await wait(500)
      try {
        return await loadRemoteState()
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
        const remoteState = await loadRemoteStateWithRetry()
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
          await saveRemoteState(nextState)
        }
        remoteSyncedStateRef.current = nextState
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

    void loadInitialState()

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
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    if (!isLoaded || isHydratingRef.current) {
      return
    }

    const timeout = window.setTimeout(() => {
      try {
        saveState(state)
      } catch (error) {
        console.error('Could not save local state', error)
        setSyncStatus('error')
        setSyncMessage('No se pudo guardar localmente.')
      }
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [isLoaded, state])

  useEffect(() => {
    if (!isLoaded || isHydratingRef.current) {
      return
    }

    if (!session) {
      remoteSaveRevisionRef.current += 1
      remoteSyncedStateRef.current = undefined
      return
    }

    if (state === remoteSyncedStateRef.current) {
      return
    }

    const targetUserId = session.user.id
    const timeout = window.setTimeout(() => {
      const revision = remoteSaveRevisionRef.current + 1
      remoteSaveRevisionRef.current = revision
      const pendingSave = remoteSaveQueueRef.current.catch(() => undefined).then(async () => {
        if (sessionRef.current?.user.id !== targetUserId) {
          return
        }
        await saveRemoteState(state, remoteSyncedStateRef.current)
        if (sessionRef.current?.user.id === targetUserId) {
          remoteSyncedStateRef.current = state
        }
      })
      remoteSaveQueueRef.current = pendingSave

      void pendingSave
        .then(() => {
          if (remoteSaveRevisionRef.current === revision) {
            setSyncStatus('synced')
            setSyncMessage('')
          }
        })
        .catch((error) => {
          if (remoteSaveRevisionRef.current === revision) {
            console.error('Could not save remote state', error)
            setSyncStatus('error')
            setSyncMessage('No se pudo sincronizar.')
          }
        })
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [isLoaded, session, state])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('keep-slopping-theme', theme)
    updateMetaContent('meta[name="theme-color"]', theme === 'dark' ? '#0d0f12' : '#f5f6f8')
    updateMetaContent(
      'meta[name="apple-mobile-web-app-status-bar-style"]',
      theme === 'dark' ? 'black-translucent' : 'default',
    )
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.accent = accent
    localStorage.setItem('keep-slopping-accent', accent)
  }, [accent])

  useEffect(() => {
    if (syncCooldown <= 0) {
      return
    }

    const interval = window.setInterval(() => setSyncCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [syncCooldown])

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

  const updateTodaySession = (mealId: string, nextCheckedIds: (current: string[], meal: Meal) => string[]) => {
    vibrate(8)
    setState((current) => {
      const meal = getMeal(current.meals, mealId)
      if (!meal) {
        return current
      }

      const date = todayIso()
      const previous = getLatestMealSession(current.sessions, mealId, date)
      const validIds = new Set(meal.ingredients.map((ingredient) => ingredient.id))
      const checkedIngredientIds = [
        ...new Set(nextCheckedIds(previous?.checkedIngredientIds ?? [], meal).filter((id) => validIds.has(id))),
      ]
      const timestamp = new Date().toISOString()
      const nextSession: MealSession = {
        id: previous?.id ?? createId('meal-session'),
        mealId,
        date,
        startedAt: previous?.startedAt ?? timestamp,
        endedAt: timestamp,
        checkedIngredientIds,
        completed:
          meal.ingredients.length > 0 && meal.ingredients.every((ingredient) => checkedIngredientIds.includes(ingredient.id)),
      }

      return { ...current, sessions: upsertMealSession(current.sessions, nextSession) }
    })
  }

  const toggleIngredient = (mealId: string, ingredientId: string) => {
    updateTodaySession(mealId, (checkedIds) =>
      checkedIds.includes(ingredientId)
        ? checkedIds.filter((id) => id !== ingredientId)
        : [...checkedIds, ingredientId],
    )
  }

  const toggleMeal = (mealId: string) => {
    updateTodaySession(mealId, (checkedIds, meal) => {
      const complete = meal.ingredients.length > 0 && meal.ingredients.every((ingredient) => checkedIds.includes(ingredient.id))
      return complete ? [] : meal.ingredients.map((ingredient) => ingredient.id)
    })
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

  const updateTarget = (patch: Partial<Nutrition>) => {
    setState((current) => ({ ...current, target: { ...current.target, ...patch } }))
  }

  const updateMeal = (mealId: string, patch: Partial<Meal>) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) => (meal.id === mealId ? { ...meal, ...patch } : meal)),
    }))
  }

  const updateMealNutrition = (mealId: string, patch: Partial<Nutrition>) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId ? { ...meal, nutrition: { ...meal.nutrition, ...patch } } : meal,
      ),
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
    const id = createId('meal')
    vibrate(10)
    setState((current) => ({
      ...current,
      meals: [
        ...current.meals,
        {
          id,
          name: 'Nueva comida',
          slot: '',
          ingredients: [{ id: createId('ingredient'), name: 'Ingrediente', amount: '' }],
          nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        },
      ],
    }))
    return id
  }

  const deleteMeal = (mealId: string) => {
    vibrate(12)
    setState((current) => ({
      ...current,
      meals: current.meals.filter((meal) => meal.id !== mealId),
      sessions: current.sessions.filter((item) => item.mealId !== mealId),
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
              ingredients: [...meal.ingredients, { id: createId('ingredient'), name: 'Ingrediente', amount: '' }],
            }
          : meal,
      ),
    }))
  }

  const deleteIngredient = (mealId: string, ingredientId: string) => {
    vibrate(8)
    setState((current) => {
      const meals = current.meals.map((meal) =>
        meal.id === mealId && meal.ingredients.length > 1
          ? { ...meal, ingredients: meal.ingredients.filter((ingredient) => ingredient.id !== ingredientId) }
          : meal,
      )
      const nextMeal = meals.find((meal) => meal.id === mealId)

      return {
        ...current,
        meals,
        sessions: current.sessions.map((item) => {
          if (item.mealId !== mealId || !nextMeal) {
            return item
          }
          const checkedIngredientIds = item.checkedIngredientIds.filter((id) => id !== ingredientId)
          return {
            ...item,
            checkedIngredientIds,
            completed:
              nextMeal.ingredients.length > 0 &&
              nextMeal.ingredients.every((ingredient) => checkedIngredientIds.includes(ingredient.id)),
          }
        }),
      }
    })
  }

  const updateNote = (index: number, value: string) => {
    setState((current) => ({
      ...current,
      notes: current.notes.map((note, noteIndex) => (noteIndex === index ? value : note)),
    }))
  }

  const addNote = () => {
    setState((current) => ({ ...current, notes: [...current.notes, 'Nueva indicación'] }))
  }

  const deleteNote = (index: number) => {
    setState((current) => ({ ...current, notes: current.notes.filter((_, noteIndex) => noteIndex !== index) }))
  }

  const content =
    activeTab === 'today' ? (
      <TodayView
        creatineCompleted={state.creatineDates.includes(today)}
        meals={state.meals}
        sessions={state.sessions}
        target={state.target}
        today={today}
        toggleCreatine={toggleCreatine}
        toggleIngredient={toggleIngredient}
        toggleMeal={toggleMeal}
      />
    ) : (
      <PlanView
        addIngredient={addIngredient}
        addMeal={addMeal}
        addNote={addNote}
        dailyNutrition={dailyNutrition}
        deleteIngredient={deleteIngredient}
        deleteMeal={deleteMeal}
        deleteNote={deleteNote}
        meals={state.meals}
        notes={state.notes}
        target={state.target}
        updateIngredient={updateIngredient}
        updateMeal={updateMeal}
        updateMealNutrition={updateMealNutrition}
        updateNote={updateNote}
        updateTarget={updateTarget}
      />
    )

  return (
    <div className="app-shell">
      <header className="app-header">
        <button aria-label="Ir a hoy" className="brand" type="button" onClick={() => setActiveTab('today')}>
          <span className="brand-mark">
            <img src="./keep-slopping-icon.svg" alt="" />
          </span>
          <span className="brand-copy">
            <strong>Keep Slopping</strong>
            <small>{formatNumber(state.target.calories)} kcal · plan de Alejandro</small>
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

      <div className="tabs-wrap">
        <nav className="tabs" aria-label="Navegación principal">
          <TabButton active={activeTab === 'today'} icon={<ListChecks size={19} />} label="Hoy" onClick={() => setActiveTab('today')} />
          <TabButton active={activeTab === 'plan'} icon={<Settings2 size={19} />} label="Plan" onClick={() => setActiveTab('plan')} />
        </nav>
      </div>

      <main className={`main main-${activeTab}`}>
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

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function TodayView({
  creatineCompleted,
  meals,
  sessions,
  target,
  today,
  toggleCreatine,
  toggleIngredient,
  toggleMeal,
}: {
  creatineCompleted: boolean
  meals: Meal[]
  sessions: MealSession[]
  target: Nutrition
  today: string
  toggleCreatine: () => void
  toggleIngredient: (mealId: string, ingredientId: string) => void
  toggleMeal: (mealId: string) => void
}) {
  const sessionsByMealId = useMemo(
    () =>
      new Map(
        meals.flatMap((meal) => {
          const session = getLatestMealSession(sessions, meal.id, today)
          return session ? [[meal.id, session] as const] : []
        }),
      ),
    [meals, sessions, today],
  )
  const completedMeals = meals.filter((meal) => {
    const session = sessionsByMealId.get(meal.id)
    return Boolean(session && isMealSessionComplete(session, meal))
  }).length
  const totalIngredients = meals.reduce((total, meal) => total + meal.ingredients.length, 0)
  const checkedIngredients = meals.reduce((total, meal) => {
    const checkedIds = new Set(sessionsByMealId.get(meal.id)?.checkedIngredientIds ?? [])
    return total + meal.ingredients.filter((ingredient) => checkedIds.has(ingredient.id)).length
  }, 0)
  const completedTasks = completedMeals + (creatineCompleted ? 1 : 0)
  const totalTasks = meals.length + 1
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <section className="today-view enter">
      <div className="today-title">
        <span>{formatDate(today)}</span>
        <h1>Checklist de hoy</h1>
        <p>Marca cada ingrediente a medida que completas el plan.</p>
      </div>

      <section className="hero-panel" aria-label="Progreso del día">
        <div className="hero-stats">
          <MetricCard icon={<Flame size={18} />} label="Objetivo" value={`${formatNumber(target.calories)} kcal`} />
          <MetricCard icon={<CheckCircle2 size={18} />} label="Comidas" value={`${completedMeals}/${meals.length}`} />
          <MetricCard icon={<ListChecks size={18} />} label="Ingredientes" value={`${checkedIngredients}/${totalIngredients}`} />
        </div>
        <div className="progress-copy">
          <span>Progreso diario</span>
          <strong>{progress}%</strong>
        </div>
        <div className="day-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <button className={creatineCompleted ? 'creatine-card complete' : 'creatine-card'} type="button" onClick={toggleCreatine}>
        <span className="check-icon">{creatineCompleted ? <Check size={18} /> : <Circle size={18} />}</span>
        <span>
          <strong>Creatina</strong>
          <small>Recordatorio diario</small>
        </span>
        <em>{creatineCompleted ? 'Hecho' : 'Pendiente'}</em>
      </button>

      <div className="meal-list">
        {meals.map((meal) => (
          <MealChecklistCard
            key={meal.id}
            meal={meal}
            session={sessionsByMealId.get(meal.id)}
            toggleIngredient={toggleIngredient}
            toggleMeal={toggleMeal}
          />
        ))}
      </div>

      {!meals.length && (
        <section className="empty-plan surface">
          <Utensils size={21} />
          <div>
            <strong>Tu plan está vacío</strong>
            <span>Agrega una comida desde la pestaña Plan.</span>
          </div>
        </section>
      )}
    </section>
  )
}

function MealChecklistCard({
  meal,
  session,
  toggleIngredient,
  toggleMeal,
}: {
  meal: Meal
  session?: MealSession
  toggleIngredient: (mealId: string, ingredientId: string) => void
  toggleMeal: (mealId: string) => void
}) {
  const checkedIds = new Set(session?.checkedIngredientIds ?? [])
  const checkedCount = meal.ingredients.filter((ingredient) => checkedIds.has(ingredient.id)).length
  const complete = Boolean(session && isMealSessionComplete(session, meal))

  return (
    <article className={complete ? 'meal-checklist complete' : 'meal-checklist'}>
      <div className="meal-checklist-head">
        <button
          aria-label={complete ? `Marcar ${meal.name} como pendiente` : `Completar ${meal.name}`}
          className="meal-master-check"
          type="button"
          onClick={() => toggleMeal(meal.id)}
        >
          {complete ? <Check size={20} /> : <Circle size={20} />}
        </button>
        <div className="meal-title-copy">
          <span>{meal.slot || 'Comida'}</span>
          <h2>{meal.name}</h2>
          <small>{checkedCount}/{meal.ingredients.length} ingredientes</small>
        </div>
        <div className="meal-calories">
          <strong>~{formatNumber(meal.nutrition.calories)}</strong>
          <small>kcal</small>
        </div>
      </div>

      <NutritionChips nutrition={meal.nutrition} />

      <div className="ingredient-checklist">
        {meal.ingredients.map((ingredient) => {
          const checked = checkedIds.has(ingredient.id)
          return (
            <button
              aria-label={`${checked ? 'Desmarcar' : 'Marcar'} ${ingredient.name} de ${meal.name}`}
              className={checked ? 'ingredient-check checked' : 'ingredient-check'}
              key={ingredient.id}
              type="button"
              onClick={() => toggleIngredient(meal.id, ingredient.id)}
            >
              <span className="check-icon">{checked ? <Check size={17} /> : <Circle size={17} />}</span>
              <span>
                <strong>{ingredient.name}</strong>
                <small>{ingredient.amount}</small>
              </span>
            </button>
          )
        })}
      </div>
    </article>
  )
}

function NutritionChips({ nutrition }: { nutrition: Nutrition }) {
  return (
    <div className="nutrition-chips" aria-label="Macronutrientes">
      <span><strong>P</strong> {formatNumber(nutrition.protein)} g</span>
      <span><strong>C</strong> {formatNumber(nutrition.carbs)} g</span>
      <span><strong>G</strong> {formatNumber(nutrition.fat)} g</span>
    </div>
  )
}

function NutritionFields({
  legend,
  nutrition,
  update,
}: {
  legend: string
  nutrition: Nutrition
  update: (patch: Partial<Nutrition>) => void
}) {
  const fields: Array<{ key: keyof Nutrition; label: string; unit: string }> = [
    { key: 'calories', label: 'Calorías', unit: 'kcal' },
    { key: 'protein', label: 'Proteína', unit: 'g' },
    { key: 'carbs', label: 'Carbohidratos', unit: 'g' },
    { key: 'fat', label: 'Grasas', unit: 'g' },
  ]

  return (
    <fieldset className="nutrition-fields">
      <legend>{legend}</legend>
      <div>
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            <span className="number-field">
              <input
                aria-label={`${legend}: ${field.label}`}
                inputMode="decimal"
                min="0"
                type="number"
                value={nutrition[field.key]}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => update({ [field.key]: Math.max(0, Number(event.target.value)) })}
              />
              <small>{field.unit}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function PlanView({
  addIngredient,
  addMeal,
  addNote,
  dailyNutrition,
  deleteIngredient,
  deleteMeal,
  deleteNote,
  meals,
  notes,
  target,
  updateIngredient,
  updateMeal,
  updateMealNutrition,
  updateNote,
  updateTarget,
}: {
  addIngredient: (mealId: string) => void
  addMeal: () => string
  addNote: () => void
  dailyNutrition: Nutrition
  deleteIngredient: (mealId: string, ingredientId: string) => void
  deleteMeal: (mealId: string) => void
  deleteNote: (index: number) => void
  meals: Meal[]
  notes: string[]
  target: Nutrition
  updateIngredient: (mealId: string, ingredientId: string, patch: Partial<Ingredient>) => void
  updateMeal: (mealId: string, patch: Partial<Meal>) => void
  updateMealNutrition: (mealId: string, patch: Partial<Nutrition>) => void
  updateNote: (index: number, value: string) => void
  updateTarget: (patch: Partial<Nutrition>) => void
}) {
  const [expandedMealId, setExpandedMealId] = useState('')

  return (
    <section className="plan-view enter">
      <div className="plan-head">
        <div>
          <span>Plan de Alejandro</span>
          <h1>Editar plan</h1>
          <p>Las modificaciones se guardan automáticamente.</p>
        </div>
        <button
          aria-label="Agregar comida"
          className="icon-button brand-button"
          type="button"
          onClick={() => setExpandedMealId(addMeal())}
        >
          <Plus size={19} />
        </button>
      </div>

      <section className="surface target-card">
        <div className="target-card-head">
          <div>
            <span>Objetivo diario</span>
            <strong>{formatNumber(target.calories)} kcal</strong>
          </div>
          <div className="actual-total">
            <span>Plan actual</span>
            <strong>~{formatNumber(dailyNutrition.calories)} kcal</strong>
          </div>
        </div>
        <NutritionFields legend="Objetivo diario" nutrition={target} update={updateTarget} />
      </section>

      <div className="section-heading">
        <span>Comidas</span>
        <strong>{meals.length}</strong>
      </div>

      <div className="plan-list">
        {meals.map((meal) => {
          const expanded = expandedMealId === meal.id
          return (
            <article className={expanded ? 'surface plan-card expanded' : 'surface plan-card'} key={meal.id}>
              <div className="plan-card-head">
                <button
                  aria-expanded={expanded}
                  className="plan-card-summary"
                  type="button"
                  onClick={() => setExpandedMealId(expanded ? '' : meal.id)}
                >
                  <span>{meal.slot || 'Comida'}</span>
                  <strong>{meal.name}</strong>
                  <small>{meal.ingredients.length} ingredientes · ~{formatNumber(meal.nutrition.calories)} kcal</small>
                </button>
                <button
                  aria-label={expanded ? `Cerrar edición de ${meal.name}` : `Editar ${meal.name}`}
                  className="icon-button flat"
                  type="button"
                  onClick={() => setExpandedMealId(expanded ? '' : meal.id)}
                >
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {!expanded && <NutritionChips nutrition={meal.nutrition} />}

              {expanded && (
                <div className="plan-card-editor">
                  <div className="field-stack meal-fields">
                    <label>
                      <span>Comida</span>
                      <input value={meal.name} onChange={(event) => updateMeal(meal.id, { name: event.target.value })} />
                    </label>
                    <label>
                      <span>Descripción</span>
                      <input value={meal.slot} onChange={(event) => updateMeal(meal.id, { slot: event.target.value })} />
                    </label>
                  </div>

                  <NutritionFields
                    legend="Nutrición aproximada"
                    nutrition={meal.nutrition}
                    update={(patch) => updateMealNutrition(meal.id, patch)}
                  />

                  <div className="editor-label">
                    <span>Ingredientes</span>
                    <strong>{meal.ingredients.length}</strong>
                  </div>

                  <div className="ingredient-editor-list">
                    {meal.ingredients.map((ingredient) => (
                      <div className="ingredient-editor" key={ingredient.id}>
                        <input
                          aria-label={`Ingrediente de ${meal.name}`}
                          value={ingredient.name}
                          onChange={(event) => updateIngredient(meal.id, ingredient.id, { name: event.target.value })}
                        />
                        <input
                          aria-label={`Cantidad de ${ingredient.name}`}
                          value={ingredient.amount}
                          onChange={(event) => updateIngredient(meal.id, ingredient.id, { amount: event.target.value })}
                        />
                        <button
                          aria-label={`Eliminar ${ingredient.name}`}
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
                    <div>
                      <button
                        aria-label={`Eliminar ${meal.name}`}
                        className="icon-button danger"
                        type="button"
                        onClick={() => {
                          deleteMeal(meal.id)
                          setExpandedMealId('')
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                      <button className="primary-button compact" type="button" onClick={() => setExpandedMealId('')}>
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

      <section className="surface notes-card">
        <div className="notes-head">
          <div>
            <span>Indicaciones</span>
            <strong>Notas del plan</strong>
          </div>
          <button aria-label="Agregar indicación" className="icon-button flat" type="button" onClick={addNote}>
            <Plus size={18} />
          </button>
        </div>
        <div className="notes-list">
          {notes.map((note, index) => (
            <div className="note-editor" key={`${index}-${notes.length}`}>
              <textarea
                aria-label={`Indicación ${index + 1}`}
                rows={2}
                value={note}
                onChange={(event) => updateNote(index, event.target.value)}
              />
              <button
                aria-label={`Eliminar indicación ${index + 1}`}
                className="icon-button tiny"
                type="button"
                onClick={() => deleteNote(index)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {!notes.length && <p className="empty-copy">Sin indicaciones adicionales.</p>}
        </div>
      </section>
    </section>
  )
}

export default App
