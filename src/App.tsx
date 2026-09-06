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
import type { AppState, Ingredient, Meal, MealSession, Nutrition, TabKey } from './types'

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
        dailyNutrition={dailyNutrition}
        deleteIngredient={deleteIngredient}
        deleteMeal={deleteMeal}
        meals={state.meals}
        target={state.target}
        updateIngredient={updateIngredient}
        updateMeal={updateMeal}
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

          <ThemeButton mode={themeMode} onChange={setThemeMode} />
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
    () => getMealSessionsForDate(sessions, today),
    [sessions, today],
  )
  const completedMeals = meals.filter((meal) => {
    const session = sessionsByMealId.get(meal.id)
    return Boolean(session && isMealSessionComplete(session, meal))
  }).length
  const completedCalories = meals.reduce((total, meal) => {
    const session = sessionsByMealId.get(meal.id)
    return total + (session && isMealSessionComplete(session, meal) ? meal.nutrition.calories : 0)
  }, 0)
  const completedTasks = completedMeals + (creatineCompleted ? 1 : 0)
  const totalTasks = meals.length + 1
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <section className="today-view enter">
      <div className="today-hero-copy">
        <span>Plan de hoy</span>
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
          <h2>{meal.name}</h2>
        </div>
        <div className="meal-calories">
          <strong>~{formatNumber(meal.nutrition.calories)} kcal</strong>
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
  dailyNutrition,
  deleteIngredient,
  deleteMeal,
  meals,
  target,
  updateIngredient,
  updateMeal,
  updateMealNutrition,
  updateTarget,
}: {
  addIngredient: (mealId: string) => void
  addMeal: () => string
  dailyNutrition: Nutrition
  deleteIngredient: (mealId: string, ingredientId: string) => void
  deleteMeal: (mealId: string) => void
  meals: Meal[]
  target: Nutrition
  updateIngredient: (mealId: string, ingredientId: string, patch: Partial<Ingredient>) => void
  updateMeal: (mealId: string, patch: Partial<Meal>) => void
  updateMealNutrition: (mealId: string, patch: Partial<Nutrition>) => void
  updateTarget: (patch: Partial<Nutrition>) => void
}) {
  const [expandedMealId, setExpandedMealId] = useState('')

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
                  <strong>{meal.name}</strong>
                  <small>~{formatNumber(meal.nutrition.calories)} kcal</small>
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
                  <div className="field-stack meal-fields single-field">
                    <label>
                      <span>Comida</span>
                      <input value={meal.name} onChange={(event) => updateMeal(meal.id, { name: event.target.value })} />
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
    </section>
  )
}

export default App
