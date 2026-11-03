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
  KeyRound,
  Mail,
  Palette,
  Plus,
  Settings2,
  Trash2,
  Utensils,
} from 'lucide-react'
import {
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react'
import './App.css'
import './suite.css'
import { RotatingPhrase } from './RotatingPhrase'
import { useToday } from './useToday'
import { accentOptions, useAppearance } from './useAppearance'
import { ThemeButton } from './ThemeButton'
import { createLocalCache } from './localCache'
import { useSyncedState } from './useSyncedState'
import { initialState } from './data'
import {
  formatNumber,
  getLatestMealSession,
  getMealSessionsForDate,
  isMealSessionComplete,
  resolveMealNutrition,
  resolveMealOption,
  todayIso,
  upsertMealSession,
} from './domain'
import { sumNutrition } from './mealUtils'
import { loadState, normalizeState } from './storage'
import {
  getSession,
  isSupabaseConfigured,
  loadRemoteState,
  onAuthChange,
  requestPasswordReset,
  updatePassword,
  saveRemoteState,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  type SyncSession,
} from './supabase'
import type { AppState, Ingredient, Meal, MealOption, MealSession, Nutrition, TabKey } from './types'

const brandMarkSrc = `${import.meta.env.BASE_URL}app-icon-192.png`

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

const hasPasswordRecoveryParams = () => {
  const params = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.replace(/^#/, '')}`)
  return params.get('type') === 'recovery'
}

const clearPasswordRecoveryUrl = () => {
  if (hasPasswordRecoveryParams()) {
    window.history.replaceState(null, '', window.location.pathname)
  }
}

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`

const vibrate = (duration = 8) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(duration)
  }
}

const getMeal = (meals: Meal[], mealId: string) => meals.find((meal) => meal.id === mealId)

const syncOptions = {
  initialState,
  configured: isSupabaseConfigured,
  cache: createLocalCache<AppState>('keep-slopping', normalizeState),
  loadGuest: loadState,
  getSession,
  subscribe: onAuthChange,
  load: loadRemoteState,
  save: saveRemoteState,
}

function App() {
  const sync = useSyncedState(syncOptions)
  return <Workspace key={sync.session?.user.id ?? 'guest'} sync={sync} />
}

function Workspace({ sync }: { sync: ReturnType<typeof useSyncedState<AppState>> }) {
  const {
    state, setState, session, isLoaded, syncStatus, setSyncStatus, syncMessage, setSyncMessage,
    isPasswordRecovery, setIsPasswordRecovery, hydrateSessionState, retrySync, flush,
  } = sync
  const [syncEmail, setSyncEmail] = useState('')
  const [syncPassword, setSyncPassword] = useState('')
  const [syncCooldown, setSyncCooldown] = useState(0)
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  const { themeMode, setThemeMode, accent, setAccent } = useAppearance('keep-slopping')
  const [accentOpen, setAccentOpen] = useState(false)

  const today = useToday(todayIso)
  const currentAccent = accentOptions.find((option) => option.key === accent) ?? accentOptions[0]
  const dailyNutrition = useMemo(() => sumNutrition(state.meals), [state.meals])

  useEffect(() => {
    if (syncCooldown <= 0) {
      return
    }

    const interval = window.setInterval(() => setSyncCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(interval)
  }, [syncCooldown])

  const requestSyncLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (syncCooldown > 0) {
      return
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const intent = submitter?.value ?? 'signin'

    if (intent === 'reset') {
      if (!syncEmail.trim()) {
        setSyncStatus('error')
        setSyncMessage('Escribe el correo de tu cuenta.')
        return
      }

      try {
        setSyncStatus('loading')
        await requestPasswordReset(syncEmail.trim())
        setSyncStatus('sent')
        setSyncCooldown(60)
        setSyncMessage('Si el correo existe, recibiras un link para recuperar tu contraseña.')
      } catch (error) {
        console.error('Could not request password reset', error)
        setSyncStatus('error')
        const errorMessage = error instanceof Error ? error.message : 'No se pudo enviar el correo.'
        setSyncMessage(errorMessage.toLowerCase().includes('rate limit') ? 'Espera 60 segundos antes de intentar otra vez.' : errorMessage)
        if (errorMessage.toLowerCase().includes('rate limit')) {
          setSyncCooldown(60)
        }
      }
      return
    }

    if (intent === 'password') {
      if (!syncPassword || syncPassword.length < 6) {
        setSyncStatus('error')
        setSyncMessage('La contraseña debe tener al menos 6 caracteres.')
        return
      }

      try {
        setSyncStatus('loading')
        await updatePassword(syncPassword)
        const currentSession = await getSession()
        if (currentSession) {
          await hydrateSessionState(currentSession, true)
        }
        setIsPasswordRecovery(false)
        setSyncPassword('')
        setSyncStatus('synced')
        setSyncMessage('Contraseña actualizada.')
        clearPasswordRecoveryUrl()
      } catch (error) {
        console.error('Could not update password', error)
        setSyncStatus('error')
        setSyncMessage(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.')
      }
      return
    }

    if (!syncEmail.trim() || !syncPassword) {
      setSyncStatus('error')
      setSyncMessage('Escribe correo y contraseña.')
      return
    }

    const authIntent = intent === 'signup' ? 'signup' : 'signin'

    try {
      setSyncStatus('loading')
      if (authIntent === 'signup') {
        await signUpWithEmail(syncEmail.trim(), syncPassword)
      } else {
        await signInWithEmail(syncEmail.trim(), syncPassword)
      }
      setSyncStatus('sent')
      setSyncMessage(authIntent === 'signup' ? 'Cuenta creada.' : '')
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
    if (!window.confirm('¿Cerrar sesión en este dispositivo?')) return
    try {
      await flush()
      await signOut()
      setSyncPassword('')
    } catch {
      setSyncStatus('error')
      setSyncMessage('No se pudo cerrar sesión. Inténtalo de nuevo.')
    }
  }

  const selectMealOption = (mealId: string, optionId: string) => {
    vibrate(8)
    setState((current) => {
      const meal = getMeal(current.meals, mealId)
      const option = meal ? resolveMealOption(meal, optionId) : undefined
      if (!meal || !option) {
        return current
      }

      const date = todayIso()
      const previous = getLatestMealSession(current.sessions, mealId, date)
      if (previous?.optionId === option.id) {
        return current
      }

      const timestamp = new Date().toISOString()
      const nextSession: MealSession = {
        id: previous?.id ?? createId('meal-session'),
        mealId,
        optionId: option.id,
        date,
        startedAt: previous?.startedAt ?? timestamp,
        endedAt: timestamp,
        checkedIngredientIds: [],
        completed: false,
      }
      let sessions = upsertMealSession(current.sessions, nextSession)

      current.meals
        .filter((candidate) => candidate.optionSourceMealId === mealId)
        .forEach((linkedMeal) => {
          if (!resolveMealOption(linkedMeal, option.id)) {
            return
          }

          const linkedSession = getLatestMealSession(sessions, linkedMeal.id, date)
          if (!linkedSession || linkedSession.optionId === option.id) {
            return
          }

          sessions = upsertMealSession(sessions, {
            ...linkedSession,
            optionId: option.id,
            endedAt: timestamp,
            checkedIngredientIds: [],
            completed: false,
          })
        })

      return { ...current, sessions }
    })
  }

  const updateTodaySession = (
    mealId: string,
    optionId: string | undefined,
    nextCheckedIds: (current: string[], ingredients: Ingredient[]) => string[],
  ) => {
    vibrate(8)
    setState((current) => {
      const meal = getMeal(current.meals, mealId)
      if (!meal) {
        return current
      }

      const option = meal.options?.length ? resolveMealOption(meal, optionId) : undefined
      if (meal.options?.length && !option) {
        return current
      }

      const date = todayIso()
      const previous = getLatestMealSession(current.sessions, mealId, date)
      const ingredients = option?.ingredients ?? meal.ingredients
      const canResume = !meal.options?.length || previous?.optionId === option?.id
      const validIds = new Set(ingredients.map((ingredient) => ingredient.id))
      const checkedIngredientIds = [
        ...new Set(
          nextCheckedIds(canResume ? (previous?.checkedIngredientIds ?? []) : [], ingredients)
            .filter((id) => validIds.has(id)),
        ),
      ]
      const timestamp = new Date().toISOString()
      const nextSession: MealSession = {
        id: previous?.id ?? createId('meal-session'),
        mealId,
        ...(option ? { optionId: option.id } : {}),
        date,
        startedAt: previous?.startedAt ?? timestamp,
        endedAt: timestamp,
        checkedIngredientIds,
        completed: ingredients.length > 0 && ingredients.every((ingredient) => checkedIngredientIds.includes(ingredient.id)),
      }

      return { ...current, sessions: upsertMealSession(current.sessions, nextSession) }
    })
  }

  const toggleIngredient = (mealId: string, optionId: string | undefined, ingredientId: string) => {
    updateTodaySession(mealId, optionId, (checkedIds) =>
      checkedIds.includes(ingredientId)
        ? checkedIds.filter((id) => id !== ingredientId)
        : [...checkedIds, ingredientId],
    )
  }

  const toggleMeal = (mealId: string, optionId?: string) => {
    updateTodaySession(mealId, optionId, (checkedIds, ingredients) => {
      const complete = ingredients.length > 0 && ingredients.every((ingredient) => checkedIds.includes(ingredient.id))
      return complete ? [] : ingredients.map((ingredient) => ingredient.id)
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

  const updateMealOption = (mealId: string, optionId: string, patch: Partial<MealOption>) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) =>
        meal.id === mealId && meal.options?.length
          ? {
              ...meal,
              options: meal.options.map((option) => option.id === optionId ? { ...option, ...patch } : option),
            }
          : meal,
      ),
    }))
  }

  const updateMealNutrition = (mealId: string, optionId: string | undefined, patch: Partial<Nutrition>) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) => {
        if (meal.id !== mealId) {
          return meal
        }
        if (!optionId || !meal.options?.length) {
          return { ...meal, nutrition: { ...meal.nutrition, ...patch } }
        }

        const options = meal.options.map((option) =>
          option.id === optionId ? { ...option, nutrition: { ...option.nutrition, ...patch } } : option,
        )
        const updatedOption = options.find((option) => option.id === optionId)
        return {
          ...meal,
          options,
          ...(meal.defaultOptionId === optionId && updatedOption ? { nutrition: updatedOption.nutrition } : {}),
        }
      }),
    }))
  }

  const updateIngredient = (
    mealId: string,
    optionId: string | undefined,
    ingredientId: string,
    patch: Partial<Ingredient>,
  ) => {
    setState((current) => ({
      ...current,
      meals: current.meals.map((meal) => {
        if (meal.id !== mealId) {
          return meal
        }
        if (!optionId || !meal.options?.length) {
          return {
            ...meal,
            ingredients: meal.ingredients.map((ingredient) =>
              ingredient.id === ingredientId ? { ...ingredient, ...patch } : ingredient,
            ),
          }
        }

        const options = meal.options.map((option) =>
          option.id === optionId
            ? {
                ...option,
                ingredients: option.ingredients.map((ingredient) =>
                  ingredient.id === ingredientId ? { ...ingredient, ...patch } : ingredient,
                ),
              }
            : option,
        )
        const updatedOption = options.find((option) => option.id === optionId)
        return {
          ...meal,
          options,
          ...(meal.defaultOptionId === optionId && updatedOption ? { ingredients: updatedOption.ingredients } : {}),
        }
      }),
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
          ingredients: [{ id: createId('ingredient'), name: 'Ingrediente', amount: '' }],
          nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        },
      ],
    }))
    return id
  }

  const deleteMeal = (mealId: string) => {
    const meal = state.meals.find((item) => item.id === mealId)
    if (!meal || !window.confirm(`¿Eliminar ${meal.name} y sus registros?`)) return
    vibrate(12)
    setState((current) => ({
      ...current,
      meals: current.meals.filter((meal) => meal.id !== mealId),
      sessions: current.sessions.filter((item) => item.mealId !== mealId),
    }))
  }

  const addIngredient = (mealId: string, optionId?: string) => {
    vibrate(8)
    setState((current) => {
      const ingredient = { id: createId('ingredient'), name: 'Ingrediente', amount: '' }
      return {
        ...current,
        meals: current.meals.map((meal) => {
          if (meal.id !== mealId) {
            return meal
          }
          if (!optionId || !meal.options?.length) {
            return { ...meal, ingredients: [...meal.ingredients, ingredient] }
          }

          const options = meal.options.map((option) =>
            option.id === optionId ? { ...option, ingredients: [...option.ingredients, ingredient] } : option,
          )
          const updatedOption = options.find((option) => option.id === optionId)
          return {
            ...meal,
            options,
            ...(meal.defaultOptionId === optionId && updatedOption ? { ingredients: updatedOption.ingredients } : {}),
          }
        }),
      }
    })
  }

  const deleteIngredient = (mealId: string, optionId: string | undefined, ingredientId: string) => {
    vibrate(8)
    setState((current) => {
      const meals = current.meals.map((meal) => {
        if (meal.id !== mealId) {
          return meal
        }
        if (!optionId || !meal.options?.length) {
          return meal.ingredients.length > 1
            ? { ...meal, ingredients: meal.ingredients.filter((ingredient) => ingredient.id !== ingredientId) }
            : meal
        }

        const targetOption = resolveMealOption(meal, optionId)
        if (!targetOption || targetOption.ingredients.length <= 1) {
          return meal
        }
        const options = meal.options.map((option) =>
          option.id === optionId
            ? { ...option, ingredients: option.ingredients.filter((ingredient) => ingredient.id !== ingredientId) }
            : option,
        )
        const updatedOption = options.find((option) => option.id === optionId)
        return {
          ...meal,
          options,
          ...(meal.defaultOptionId === optionId && updatedOption ? { ingredients: updatedOption.ingredients } : {}),
        }
      })
      const nextMeal = meals.find((meal) => meal.id === mealId)

      return {
        ...current,
        meals,
        sessions: current.sessions.map((item) => {
          if (item.mealId !== mealId || !nextMeal) {
            return item
          }
          const checkedIngredientIds = item.checkedIngredientIds.filter((id) => id !== ingredientId)
          const nextSession = { ...item, checkedIngredientIds }
          return {
            ...nextSession,
            completed: isMealSessionComplete(nextSession, nextMeal),
          }
        }),
      }
    })
  }

  const content =
    activeTab === 'today' ? (
      <TodayView
        creatineCompleted={state.creatineDates.includes(today)}
        meals={state.meals}
        planNotes={state.planNotes}
        sessions={state.sessions}
        target={state.target}
        today={today}
        selectMealOption={selectMealOption}
        toggleCreatine={toggleCreatine}
        toggleIngredient={toggleIngredient}
        toggleMeal={toggleMeal}
      />
    ) : (
      <PlanView
        addIngredient={addIngredient}
        addMeal={addMeal}
        dailyNutrition={dailyNutrition}
        deleteIngredient={deleteIngredient}
        deleteMeal={deleteMeal}
        meals={state.meals}
        planNotes={state.planNotes}
        target={state.target}
        updateIngredient={updateIngredient}
        updateMeal={updateMeal}
        updateMealOption={updateMealOption}
        updateMealNutrition={updateMealNutrition}
        updateTarget={updateTarget}
      />
    )

  return (
    <div className="app-shell">
      <header className="app-header">
        <button aria-label="Ir a hoy" className="brand" type="button" onClick={() => setActiveTab('today')}>
          <span className="brand-mark">
            <img alt="" src={brandMarkSrc} />
          </span>
          <span>Keep Slopping</span>
        </button>

        <div className="header-actions">
          {session && (
            <button
              aria-label={`Cuenta ${session.user.email ?? 'registrada'}. Tocar para salir`}
              className={syncStatus === 'error' ? 'account-status error' : 'account-status'}
              data-tooltip={syncStatus === 'error' ? 'Error de sync' : (session.user.email ?? 'Registrado')}
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

          <ThemeButton mode={themeMode} onChange={setThemeMode} onOpen={() => setAccentOpen(false)} />
        </div>
      </header>

      <nav className="tabs" aria-label="Navegación principal">
        <TabButton active={activeTab === 'today'} icon={<ListChecks size={17} />} label="Hoy" onClick={() => setActiveTab('today')} />
        <TabButton active={activeTab === 'plan'} icon={<Settings2 size={17} />} label="Plan" onClick={() => setActiveTab('plan')} />
      </nav>

      <main className={`main main-${activeTab}`}>
        {session && syncStatus === 'error' && (
          <button className="sync-alert" type="button" onClick={() => void retrySync()} role="status">
            <Cloud size={16} /><span>{syncMessage}</span><span>Reintentar</span>
          </button>
        )}
        <SyncPanel
          email={syncEmail}
          isConfigured={isSupabaseConfigured}
          isPasswordRecovery={isPasswordRecovery}
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
  isPasswordRecovery,
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
  isPasswordRecovery: boolean
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
        <span>En este dispositivo</span>
      </section>
    )
  }

  if (session && !isPasswordRecovery) {
    return null
  }

  if (isPasswordRecovery) {
    return (
      <form className="sync-panel login password-recovery" onSubmit={submit}>
        <KeyRound size={17} />
        <input
          aria-label="Nueva contraseña"
          autoComplete="new-password"
          minLength={6}
          placeholder="nueva contraseña"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="primary-button compact" disabled={status === 'loading'} type="submit" value="password">
          Guardar
        </button>
        {message && <small>{message}</small>}
      </form>
    )
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
      <button className="ghost-button compact" disabled={status === 'loading' || syncCooldown > 0} formNoValidate type="submit" value="reset">
        Recuperar
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
  planNotes,
  sessions,
  selectMealOption,
  target,
  today,
  toggleCreatine,
  toggleIngredient,
  toggleMeal,
}: {
  creatineCompleted: boolean
  meals: Meal[]
  planNotes?: string[]
  sessions: MealSession[]
  selectMealOption: (mealId: string, optionId: string) => void
  target: Nutrition
  today: string
  toggleCreatine: () => void
  toggleIngredient: (mealId: string, optionId: string | undefined, ingredientId: string) => void
  toggleMeal: (mealId: string, optionId?: string) => void
}) {
  const sessionsByMealId = useMemo(
    () => getMealSessionsForDate(sessions, today),
    [sessions, today],
  )
  const selectedOptionIdForMeal = (meal: Meal) => {
    if (!meal.options?.length) {
      return undefined
    }

    const sourceMealId = meal.optionSourceMealId ?? meal.id
    return sessionsByMealId.get(sourceMealId)?.optionId
  }
  const sessionMatchesSelection = (meal: Meal, session: MealSession | undefined) => {
    if (!meal.options?.length) {
      return true
    }

    return Boolean(session?.optionId && session.optionId === selectedOptionIdForMeal(meal))
  }
  const completedMeals = meals.filter((meal) => {
    const session = sessionsByMealId.get(meal.id)
    return Boolean(session && sessionMatchesSelection(meal, session) && isMealSessionComplete(session, meal))
  }).length
  const completedCalories = meals.reduce((total, meal) => {
    const session = sessionsByMealId.get(meal.id)
    if (!session || !sessionMatchesSelection(meal, session) || !isMealSessionComplete(session, meal)) {
      return total
    }

    return total + (resolveMealNutrition(meal, session.optionId)?.calories ?? 0)
  }, 0)
  const completedTasks = completedMeals + (creatineCompleted ? 1 : 0)
  const totalTasks = meals.length + 1
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <section className="today-view enter">
      <div className="today-hero-copy">
        <RotatingPhrase className="hero-phrase" phrases={foodPhrases} />
      </div>

      <section className="hero-panel" aria-label="Progreso del día">
        <div className="hero-stats">
          <MetricCard icon={<Flame size={18} />} label="Objetivo" value={`${formatNumber(target.calories)} kcal`} />
          <MetricCard icon={<CheckCircle2 size={18} />} label="Hechas" value={`${completedTasks}/${totalTasks}`} />
          <MetricCard icon={<ChefHat size={18} />} label="Registrado" value={`${formatNumber(completedCalories)} kcal`} />
        </div>
        <div className="day-progress">
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <PlanNotes notes={planNotes} />

      <button className={creatineCompleted ? 'creatine-card complete' : 'creatine-card'} type="button" onClick={toggleCreatine}>
        <span className="check-icon">{creatineCompleted ? <Check size={18} /> : <Circle size={18} />}</span>
        <span>
          <strong>Creatina</strong>
          <small>Tomar hoy</small>
        </span>
        <em>{creatineCompleted ? 'Hecho' : 'Pendiente'}</em>
      </button>

      <div className="meal-list">
        {meals.map((meal) => (
          <MealChecklistCard
            key={meal.id}
            meal={meal}
            selectMealOption={selectMealOption}
            selectedOptionId={selectedOptionIdForMeal(meal)}
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
  selectMealOption,
  selectedOptionId,
  session,
  toggleIngredient,
  toggleMeal,
}: {
  meal: Meal
  selectMealOption: (mealId: string, optionId: string) => void
  selectedOptionId?: string
  session?: MealSession
  toggleIngredient: (mealId: string, optionId: string | undefined, ingredientId: string) => void
  toggleMeal: (mealId: string, optionId?: string) => void
}) {
  const selectedOption = selectedOptionId ? resolveMealOption(meal, selectedOptionId) : undefined
  const hasSelection = !meal.options?.length || Boolean(selectedOption)
  const sessionMatchesSelection = !meal.options?.length || session?.optionId === selectedOption?.id
  const checkedIds = new Set(sessionMatchesSelection ? (session?.checkedIngredientIds ?? []) : [])
  const complete = Boolean(session && sessionMatchesSelection && isMealSessionComplete(session, meal))
  const ingredients = meal.options?.length ? (selectedOption?.ingredients ?? []) : meal.ingredients
  const nutrition = meal.options?.length ? selectedOption?.nutrition : meal.nutrition
  const optionCalories = meal.options?.map((option) => option.nutrition.calories) ?? []
  const calorieLabel = nutrition
    ? `~${formatNumber(nutrition.calories)} kcal`
    : optionCalories.length
      ? `~${formatNumber(Math.min(...optionCalories))}-${formatNumber(Math.max(...optionCalories))} kcal`
      : '~0 kcal'

  return (
    <article className={complete ? 'meal-checklist complete' : 'meal-checklist'}>
      <div className="meal-checklist-head">
        <button
          aria-label={!hasSelection
            ? `Elige una opción para ${meal.name}`
            : complete
              ? `Marcar ${meal.name} como pendiente`
              : `Completar ${meal.name}`}
          className="meal-master-check"
          disabled={!hasSelection}
          type="button"
          onClick={() => toggleMeal(meal.id, selectedOption?.id)}
        >
          {complete ? <Check size={20} /> : <Circle size={20} />}
        </button>
        <div className="meal-title-copy">
          <h2>{meal.name}</h2>
        </div>
        <div className="meal-calories">
          <strong>{calorieLabel}</strong>
        </div>
      </div>

      {meal.options?.length && !meal.optionSourceMealId && (
        <fieldset className="meal-option-picker">
          <legend>Elige una opción para registrar</legend>
          <div className="meal-option-grid">
            {meal.options.map((option) => (
              <label
                className={option.id === selectedOption?.id ? 'meal-option-choice selected' : 'meal-option-choice'}
                key={option.id}
              >
                <input
                  aria-label={option.name}
                  checked={option.id === selectedOption?.id}
                  name={`meal-option-${meal.id}`}
                  type="radio"
                  value={option.id}
                  onChange={() => selectMealOption(meal.id, option.id)}
                />
                <span>
                  <strong>{option.name.replace(/^Opción ([A-Z])\s*[-:]\s*/, '$1 · ').replace(/ sin PB2$/, '')}</strong>
                  <small>
                    ~{formatNumber(option.nutrition.calories)} kcal
                    {option.nutrition.protein !== null && ` · P ${formatNumber(option.nutrition.protein)} g`}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {meal.optionSourceMealId && (
        <div className={selectedOption ? 'linked-option-status ready' : 'linked-option-status'} role="status">
          {selectedOption
            ? `Ajustado a ${selectedOption.name}`
            : 'Elige primero una opción en la cena para fijar esta cantidad.'}
        </div>
      )}

      {nutrition && <NutritionChips nutrition={nutrition} />}

      {ingredients.length > 0 ? <div className="ingredient-checklist">
        {ingredients.map((ingredient) => {
          const checked = checkedIds.has(ingredient.id)
          return (
            <button
              aria-label={`${checked ? 'Desmarcar' : 'Marcar'} ${ingredient.name} de ${meal.name}`}
              className={checked ? 'ingredient-check checked' : 'ingredient-check'}
              key={ingredient.id}
              type="button"
              onClick={() => toggleIngredient(meal.id, selectedOption?.id, ingredient.id)}
            >
              <span className="check-icon">{checked ? <Check size={17} /> : <Circle size={17} />}</span>
              <span>
                <strong>{ingredient.name}</strong>
                <small>{ingredient.amount}</small>
              </span>
            </button>
          )
        })}
      </div> : meal.options?.length && (
        <div className="meal-option-empty">Selecciona una opción para ver y registrar sus ingredientes.</div>
      )}
    </article>
  )
}

function NutritionChips({ nutrition }: { nutrition: Nutrition }) {
  const macros = [
    { label: 'P', value: nutrition.protein },
    { label: 'C', value: nutrition.carbs },
    { label: 'G', value: nutrition.fat },
  ].filter((macro) => macro.value !== null)
  if (!macros.length) return null

  return (
    <div className="nutrition-chips" aria-label="Macronutrientes">
      {macros.map((macro) => <span key={macro.label}><strong>{macro.label}</strong> {formatNumber(macro.value!)} g</span>)}
    </div>
  )
}

function PlanNotes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null
  return (
    <aside className="plan-guidance" aria-label="Indicaciones del plan">
      {notes.map((note, index) => <p key={index}>{note}</p>)}
    </aside>
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
                placeholder="Sin dato"
                value={nutrition[field.key] ?? ''}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) => update({ [field.key]: event.target.value === '' && field.key !== 'calories'
                  ? null
                  : Math.max(0, Number(event.target.value)) })}
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
  dailyNutrition,
  deleteIngredient,
  deleteMeal,
  meals,
  planNotes,
  target,
  updateIngredient,
  updateMeal,
  updateMealOption,
  updateMealNutrition,
  updateTarget,
}: {
  addIngredient: (mealId: string, optionId?: string) => void
  addMeal: () => string
  dailyNutrition: Nutrition
  deleteIngredient: (mealId: string, optionId: string | undefined, ingredientId: string) => void
  deleteMeal: (mealId: string) => void
  meals: Meal[]
  planNotes?: string[]
  target: Nutrition
  updateIngredient: (
    mealId: string,
    optionId: string | undefined,
    ingredientId: string,
    patch: Partial<Ingredient>,
  ) => void
  updateMeal: (mealId: string, patch: Partial<Meal>) => void
  updateMealOption: (mealId: string, optionId: string, patch: Partial<MealOption>) => void
  updateMealNutrition: (mealId: string, optionId: string | undefined, patch: Partial<Nutrition>) => void
  updateTarget: (patch: Partial<Nutrition>) => void
}) {
  const [expandedMealId, setExpandedMealId] = useState('')
  const [selectedOptionId, setSelectedOptionId] = useState('')

  return (
    <section className="plan-view enter">
      <div className="plan-head">
        <div>
          <span>Tu alimentación</span>
          <h1>Editar plan</h1>
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

      <PlanNotes notes={planNotes} />

      <div className="section-heading">
        <span>Comidas</span>
        <strong>{meals.length}</strong>
      </div>

      <div className="plan-list">
        {meals.map((meal) => {
          const expanded = expandedMealId === meal.id
          const selectedOption = meal.options?.find((option) => option.id === selectedOptionId)
            ?? resolveMealOption(meal)
          const optionId = meal.options?.length ? selectedOption?.id : undefined
          const ingredients = selectedOption?.ingredients ?? meal.ingredients
          const nutrition = selectedOption?.nutrition ?? meal.nutrition
          const optionCalories = meal.options?.map((option) => option.nutrition.calories) ?? []
          const calorieSummary = optionCalories.length
            ? Math.min(...optionCalories) === Math.max(...optionCalories)
              ? `~${formatNumber(optionCalories[0])} kcal`
              : `~${formatNumber(Math.min(...optionCalories))}-${formatNumber(Math.max(...optionCalories))} kcal`
            : `~${formatNumber(meal.nutrition.calories)} kcal`
          const toggleExpanded = () => {
            if (expanded) {
              setExpandedMealId('')
              setSelectedOptionId('')
              return
            }

            setExpandedMealId(meal.id)
            setSelectedOptionId(meal.defaultOptionId ?? meal.options?.[0]?.id ?? '')
          }

          return (
            <article className={expanded ? 'surface plan-card expanded' : 'surface plan-card'} key={meal.id}>
              <div className="plan-card-head">
                <button
                  aria-expanded={expanded}
                  className="plan-card-summary"
                  type="button"
                  onClick={toggleExpanded}
                >
                  <strong>{meal.name}</strong>
                  <small>{calorieSummary}{meal.options?.length ? ` · ${meal.options.length} opciones` : ''}</small>
                </button>
                <button
                  aria-label={expanded ? `Cerrar edición de ${meal.name}` : `Editar ${meal.name}`}
                  className="icon-button flat"
                  type="button"
                  onClick={toggleExpanded}
                >
                  {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>

              {!expanded && <NutritionChips nutrition={nutrition} />}

              {expanded && (
                <div className="plan-card-editor">
                  <div className="field-stack meal-fields single-field">
                    <label>
                      <span>Comida</span>
                      <input value={meal.name} onChange={(event) => updateMeal(meal.id, { name: event.target.value })} />
                    </label>
                  </div>

                  {meal.options?.length && selectedOption && (
                    <div className="meal-option-editor-fields">
                      <label>
                        <span>{meal.optionSourceMealId ? 'Ruta vinculada a la cena' : 'Opción'}</span>
                        <select
                          aria-label={`Opción de ${meal.name}`}
                          value={selectedOption.id}
                          onChange={(event) => setSelectedOptionId(event.target.value)}
                        >
                          {meal.options.map((option) => (
                            <option key={option.id} value={option.id}>{option.name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Nombre de la opción</span>
                        <input
                          aria-label={`Nombre de opción de ${meal.name}`}
                          value={selectedOption.name}
                          onChange={(event) => updateMealOption(meal.id, selectedOption.id, { name: event.target.value })}
                        />
                      </label>
                    </div>
                  )}

                  <NutritionFields
                    legend="Nutrición aproximada"
                    nutrition={nutrition}
                    update={(patch) => updateMealNutrition(meal.id, optionId, patch)}
                  />

                  <div className="editor-label">
                    <span>Ingredientes</span>
                    <strong>{ingredients.length}</strong>
                  </div>

                  <div className="ingredient-editor-list">
                    {ingredients.map((ingredient) => (
                      <div className="ingredient-editor" key={ingredient.id}>
                        <input
                          aria-label={`Ingrediente de ${meal.name}`}
                          value={ingredient.name}
                          onChange={(event) => updateIngredient(meal.id, optionId, ingredient.id, { name: event.target.value })}
                        />
                        <input
                          aria-label={`Cantidad de ${ingredient.name}`}
                          value={ingredient.amount}
                          onChange={(event) => updateIngredient(meal.id, optionId, ingredient.id, { amount: event.target.value })}
                        />
                        <button
                          aria-label={`Eliminar ${ingredient.name}`}
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
