import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialState } from './data'

const { loadStateMock } = vi.hoisted(() => ({ loadStateMock: vi.fn() }))

vi.mock('./storage', () => ({
  loadState: loadStateMock,
  saveState: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getSession: vi.fn(async () => null),
  isSupabaseConfigured: false,
  loadRemoteState: vi.fn(),
  onAuthChange: vi.fn(() => () => undefined),
  saveRemoteState: vi.fn(),
  signInWithEmail: vi.fn(),
  signOut: vi.fn(),
  signUpWithEmail: vi.fn(),
}))

const freshState = () => JSON.parse(JSON.stringify(initialState))

describe('daily checklist', () => {
  beforeEach(() => {
    loadStateMock.mockReturnValue(freshState())
    window.localStorage.setItem('keep-slopping-theme', 'dark')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows only the daily checklist and plan editor tabs', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    expect(await screen.findByText('Plan de hoy')).toBeTruthy()
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
    const intervalSpy = vi.spyOn(window, 'setInterval').mockImplementation((handler, timeout) => {
      if (timeout === 5200 && typeof handler === 'function') {
        rotatePhrase = handler as () => void
      }
      return 1
    })
    const { default: App } = await import('./App')

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Goy mode off. Meal prep Kosher.' })).toBeTruthy()
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 5200)
    expect(rotatePhrase).toBeTruthy()

    act(() => rotatePhrase?.())

    expect(screen.getByRole('heading', { name: 'Plan Judio: pesar, cocinar, cumplir.' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Goy mode off. Meal prep Kosher.' })).toBeNull()
  })

  it('shows only the meal title, ingredients, calories and macros in each checklist card', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    const breakfastHeading = await screen.findByRole('heading', { name: 'Desayuno' })
    const breakfastCard = breakfastHeading.closest('article')
    expect(breakfastCard).toBeTruthy()

    const card = within(breakfastCard!)
    expect(card.getByText('Avena')).toBeTruthy()
    expect(card.getByText('50 g')).toBeTruthy()
    expect(card.getByText('~493 kcal')).toBeTruthy()
    expect(card.getByLabelText('Macronutrientes').textContent).toContain('P 40 g')
    expect(card.getByLabelText('Macronutrientes').textContent).toContain('C 67 g')
    expect(card.getByLabelText('Macronutrientes').textContent).toContain('G 7 g')
    expect(card.queryByText('ligero')).toBeNull()
    expect(card.queryByText(/^\d+\/\d+ ingredientes$/i)).toBeNull()
  })

  it('marks creatine, meals and individual ingredients directly', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    const creatine = await screen.findByRole('button', { name: /Creatina/ })
    fireEvent.click(creatine)
    expect(within(creatine).getByText('Hecho')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Completar Desayuno' }))
    expect(screen.getByRole('button', { name: 'Marcar Desayuno como pendiente' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Desmarcar Avena de Desayuno' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar Avena de Desayuno' }))
    expect(screen.getByRole('button', { name: 'Completar Desayuno' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Marcar Avena de Desayuno' })).toBeTruthy()
  })

  it('edits the plan manually and reflects the change in the checklist', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Plan' }))
    expect(screen.queryByText('Indicaciones')).toBeNull()
    expect(screen.queryByText('Notas del plan')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agregar indicación' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Desayuno' }))
    expect(screen.queryByText('Descripción')).toBeNull()
    expect(screen.queryByLabelText('Descripción')).toBeNull()
    fireEvent.change(screen.getByDisplayValue('Desayuno'), { target: { value: 'Primer comida' } })
    expect(screen.queryByText(/buscar|escanear/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(await screen.findByRole('heading', { name: 'Primer comida' })).toBeTruthy()
  })
})
