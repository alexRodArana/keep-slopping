import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialState } from './data'

const { getSessionMock, loadRemoteStateMock, loadStateMock, saveRemoteStateMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  loadRemoteStateMock: vi.fn(),
  loadStateMock: vi.fn(),
  saveRemoteStateMock: vi.fn(),
}))

vi.mock('./storage', async (importOriginal) => ({
  ...await importOriginal<typeof import('./storage')>(),
  loadState: loadStateMock,
  saveState: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getSession: getSessionMock,
  isSupabaseConfigured: true,
  loadRemoteState: loadRemoteStateMock,
  onAuthChange: vi.fn(() => () => undefined),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  saveRemoteState: saveRemoteStateMock,
  signInWithEmail: vi.fn(),
  signOut: vi.fn(),
  signUpWithEmail: vi.fn(),
}))

const freshState = () => JSON.parse(JSON.stringify(initialState))

describe('daily checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionMock.mockResolvedValue(null)
    loadStateMock.mockReturnValue(freshState())
    window.localStorage.setItem('keep-slopping-theme', 'dark')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows the saved plan instead of hanging when remote hydration times out', async () => {
    vi.useFakeTimers()
    getSessionMock.mockResolvedValue({
      user: { id: 'alejandro', email: 'alex.rodarana@gmail.com' },
    })
    loadRemoteStateMock.mockReturnValue(new Promise(() => undefined))
    const { default: App } = await import('./App')

    render(<App />)
    expect(screen.getByText('Cargando plan')).toBeTruthy()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000)
    })

    expect(screen.queryByText('Plan de hoy')).toBeNull()
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '1. Desayuno | Avena' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /alex\.rodarana@gmail\.com/ })).toBeTruthy()
    expect(loadRemoteStateMock).toHaveBeenCalledOnce()
    expect(saveRemoteStateMock).not.toHaveBeenCalled()
    expect(screen.getByText(/Sin conexión/)).toBeTruthy()
  })

  it('shows only the daily checklist and plan editor tabs', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy()
    expect(screen.queryByText('Plan de hoy')).toBeNull()
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(navigation).getAllByRole('button')).toHaveLength(2)
    expect(within(navigation).getByRole('button', { name: 'Hoy' })).toBeTruthy()
    expect(within(navigation).getByRole('button', { name: 'Plan' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Alimentos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Calendario' })).toBeNull()
    expect(screen.queryByText(/escanear/i)).toBeNull()
  })

  it('starts with the first phrase and rotates to the next one after 5200 ms', async () => {
    let rotatePhrase: (() => void) | undefined
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const realInterval = window.setInterval.bind(window)
    const intervalSpy = vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout) => {
      if (timeout === 5200 && typeof handler === 'function') {
        rotatePhrase = handler as () => void
      }
      return realInterval(handler, timeout)
    })
    const { default: App } = await import('./App')

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Goy mode off. Meal prep Kosher.' })).toBeTruthy()
    await waitFor(() => expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 5200))
    expect(rotatePhrase).toBeTruthy()

    act(() => rotatePhrase?.())

    expect(screen.getByRole('heading', { name: 'Plan Judio: pesar, cocinar, cumplir.' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Goy mode off. Meal prep Kosher.' })).toBeNull()
  })

  it('shows five meal times with the PDF portions and leaves unavailable meal macros unspecified', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    const breakfastHeading = await screen.findByRole('heading', { name: '1. Desayuno | Avena' })
    const breakfastCard = breakfastHeading.closest('article')
    expect(breakfastCard).toBeTruthy()

    const card = within(breakfastCard!)
    expect(card.getByText('Avena seca')).toBeTruthy()
    expect(card.getByText('107 g')).toBeTruthy()
    expect(card.getByText('~865 kcal')).toBeTruthy()
    expect(card.queryByLabelText('Macronutrientes')).toBeNull()
    expect(card.getAllByRole('button', { name: /Fresas congeladas o moras azules/ })).toHaveLength(1)
    expect(card.getByText('200 g de fresas o 112 g de moras azules')).toBeTruthy()
    expect(card.queryByText('PB2', { exact: true })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5)
    expect(screen.getByRole('heading', { name: 'Colación preentreno | Arroz inflado y miel' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '2. Postentreno, primera parte' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '3. Postentreno, segunda parte' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '4. Cena | Elige UNA opción' })).toBeTruthy()
    expect(card.queryByText('ligero')).toBeNull()
    expect(card.queryByText(/^\d+\/\d+ ingredientes$/i)).toBeNull()
  })

  it('marks creatine, meals and individual ingredients directly', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    const creatine = await screen.findByRole('button', { name: /Creatina/ })
    fireEvent.click(creatine)
    expect(within(creatine).getByText('Hecho')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Completar 1. Desayuno | Avena' }))
    expect(screen.getByRole('button', { name: 'Marcar 1. Desayuno | Avena como pendiente' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Desmarcar Avena seca de 1. Desayuno | Avena' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar Avena seca de 1. Desayuno | Avena' }))
    expect(screen.getByRole('button', { name: 'Completar 1. Desayuno | Avena' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Marcar Avena seca de 1. Desayuno | Avena' })).toBeTruthy()
  })

  it('registers exactly one dinner option and resets only dinner checks when switching', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    const preWorkoutHeading = await screen.findByRole('heading', { name: 'Colación preentreno | Arroz inflado y miel' })
    const dinnerHeading = screen.getByRole('heading', { name: '4. Cena | Elige UNA opción' })
    const preWorkoutCard = preWorkoutHeading.closest('article')
    const dinnerCard = dinnerHeading.closest('article')
    expect(preWorkoutCard).toBeTruthy()
    expect(dinnerCard).toBeTruthy()

    const preWorkout = within(preWorkoutCard!)
    const dinner = within(dinnerCard!)
    const dinnerA = dinner.getByRole('radio', { name: /Opción A - Avena sin PB2/ }) as HTMLInputElement
    const dinnerB = dinner.getByRole('radio', { name: /Opción B - Pollo con papa/ }) as HTMLInputElement
    const registeredMetric = screen.getByText('Registrado').closest<HTMLElement>('.metric-card')
    expect(registeredMetric).toBeTruthy()

    expect(dinnerA.checked).toBe(false)
    expect(dinnerB.checked).toBe(false)
    expect(preWorkout.getByText('53 g')).toBeTruthy()
    expect(preWorkout.queryByRole('status')).toBeNull()
    expect(dinner.queryByText('Avena seca')).toBeNull()
    expect(dinner.queryByText('Pechuga de pollo, en crudo')).toBeNull()
    expect((dinner.getByRole('button', { name: 'Elige una opción para 4. Cena | Elige UNA opción' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(preWorkout.getByRole('button', { name: 'Completar Colación preentreno | Arroz inflado y miel' }))
    expect(within(registeredMetric!).getByText('276 kcal')).toBeTruthy()

    fireEvent.click(dinnerA)

    expect(dinnerA.checked).toBe(true)
    expect(dinnerB.checked).toBe(false)
    expect(preWorkout.getByText('53 g')).toBeTruthy()
    expect(dinner.getByText('Avena seca')).toBeTruthy()
    expect(dinner.getByText('97 g')).toBeTruthy()
    expect(dinner.getByText('6 g')).toBeTruthy()
    expect(dinner.getAllByRole('button', { name: /Fresas congeladas o moras azules/ })).toHaveLength(1)
    expect(dinner.getByText('150 g de fresas o 84 g de moras azules')).toBeTruthy()
    expect(dinner.queryByText('PB2', { exact: true })).toBeNull()
    expect(dinner.queryByText('Pechuga de pollo, en crudo')).toBeNull()
    expect(dinner.queryByText('420 g')).toBeNull()

    fireEvent.click(dinner.getByRole('button', { name: 'Completar 4. Cena | Elige UNA opción' }))
    expect(dinner.getByRole('button', { name: 'Marcar 4. Cena | Elige UNA opción como pendiente' })).toBeTruthy()
    expect(within(registeredMetric!).getByText('924 kcal')).toBeTruthy()

    fireEvent.click(dinnerB)

    expect(dinnerA.checked).toBe(false)
    expect(dinnerB.checked).toBe(true)
    expect(preWorkout.getByText('53 g')).toBeTruthy()
    expect(preWorkout.getByRole('button', { name: 'Marcar Colación preentreno | Arroz inflado y miel como pendiente' })).toBeTruthy()
    expect(dinner.getByText('Pechuga de pollo, en crudo')).toBeTruthy()
    expect(dinner.getByText('42 g')).toBeTruthy()
    expect(dinner.getByText('Papa, en crudo')).toBeTruthy()
    expect(dinner.getByText('420 g')).toBeTruthy()
    expect(dinner.queryByText('Avena seca')).toBeNull()
    expect(dinner.queryByText('PB2')).toBeNull()
    expect(dinner.getByRole('button', { name: 'Completar 4. Cena | Elige UNA opción' })).toBeTruthy()
    expect(dinner.getByRole('button', { name: 'Marcar Pechuga de pollo, en crudo de 4. Cena | Elige UNA opción' })).toBeTruthy()
    expect(dinner.getByRole('button', { name: 'Marcar Papa, en crudo de 4. Cena | Elige UNA opción' })).toBeTruthy()
    expect(within(registeredMetric!).getByText('276 kcal')).toBeTruthy()

    fireEvent.click(dinner.getByRole('button', { name: 'Completar 4. Cena | Elige UNA opción' }))
    expect(within(registeredMetric!).getByText('928 kcal')).toBeTruthy()
  })

  it('edits the plan manually and reflects the change in the checklist', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Plan' }))
    expect(screen.queryByText('Indicaciones')).toBeNull()
    expect(screen.queryByText('Notas del plan')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar indicación' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Editar 1. Desayuno | Avena' }))
    expect(screen.queryByText('Descripción')).toBeNull()
    expect(screen.queryByLabelText('Descripción')).toBeNull()
    fireEvent.change(screen.getByDisplayValue('1. Desayuno | Avena'), { target: { value: 'Primer comida' } })
    expect(screen.queryByText(/buscar|escanear/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(await screen.findByRole('heading', { name: 'Primer comida' })).toBeTruthy()
  })
})
