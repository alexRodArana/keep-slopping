import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import { initialState } from './data'
import { hasLegacyStateKeys, normalizeState, requiresPlanMigration } from './storage'
import type { AppState } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isValidUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

const canInitializeSupabase = isValidUrl(supabaseUrl) && Boolean(supabaseAnonKey)
const KEEP_SLOPPING_KEY = 'keepSlopping'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const getAuthRedirectUrl = () => {
  const redirectUrl = new URL(window.location.pathname || '/', window.location.origin)
  redirectUrl.hash = ''
  redirectUrl.search = ''

  if (!redirectUrl.pathname.endsWith('/')) {
    redirectUrl.pathname = `${redirectUrl.pathname}/`
  }

  return redirectUrl.toString()
}

const getSupabaseErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Error desconocido de Supabase'
}

const supabase = (() => {
  if (!canInitializeSupabase) {
    return null
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  } catch (error) {
    console.error('Supabase client could not be initialized', error)
    return null
  }
})()

export const isSupabaseConfigured = Boolean(supabase)

export type SyncSession = Session

export const getSession = async () => {
  if (!supabase) {
    return null
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw error
  }

  return data.session
}

export const onAuthChange = (callback: (session: Session | null) => void) => {
  if (!supabase) {
    return () => undefined
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session))

  return () => subscription.unsubscribe()
}

export const signInWithEmail = async (email: string, password: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw new Error(getSupabaseErrorMessage(error))
  }
}

export const signUpWithEmail = async (email: string, password: string) => {
  if (!supabase) {
    throw new Error('Supabase is not configured')
  }

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  })

  if (signUpError) {
    throw new Error(getSupabaseErrorMessage(signUpError))
  }
}

export const signOut = async () => {
  if (!supabase) {
    return
  }

  const { error } = await supabase.auth.signOut()
  if (error) {
    throw error
  }
}

export const loadRemoteState = async (): Promise<AppState> => {
  if (!supabase) {
    return initialState
  }

  const { data, error } = await supabase.rpc('get_goy_app_state_sections', {
    p_keys: [KEEP_SLOPPING_KEY],
  })

  if (error) {
    throw error
  }

  if (isRecord(data) && KEEP_SLOPPING_KEY in data) {
    const value = data[KEEP_SLOPPING_KEY]
    const state = normalizeState(value)

    if (requiresPlanMigration(value) || hasLegacyStateKeys(value)) {
      await saveRemoteState(state)
    }

    return state
  }

  return normalizeState(initialState)
}

export const saveRemoteState = async (state: AppState, previousState?: AppState) => {
  if (!supabase) {
    return
  }

  const patch: Record<string, unknown> = {}
  if (!previousState || state.planVersion !== previousState.planVersion) {
    patch.planVersion = state.planVersion
  }
  if (!previousState || state.target !== previousState.target) {
    patch.target = state.target
  }
  if (!previousState || state.creatineDates !== previousState.creatineDates) {
    patch.creatineDates = state.creatineDates
  }
  if (!previousState || state.meals !== previousState.meals) {
    patch.meals = state.meals
  }
  if (!previousState || state.sessions !== previousState.sessions) {
    patch.sessions = state.sessions
  }

  if (!Object.keys(patch).length) {
    return
  }

  const { error } = await supabase.rpc('merge_goy_app_state_section', {
    p_section_key: KEEP_SLOPPING_KEY,
    p_patch: patch,
    p_remove_keys: ['foodLogs', 'activeSession', 'notes'],
  })

  if (error) {
    throw error
  }
}
