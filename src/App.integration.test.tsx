import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('shows only the daily checklist and plan editor tabs', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Checklist de hoy' })).toBeTruthy()
    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(navigation).getAllByRole('button')).toHaveLength(2)
    expect(within(navigation).getByRole('button', { name: 'Hoy' })).toBeTruthy()
    expect(within(navigation).getByRole('button', { name: 'Plan' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Alimentos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Calendario' })).toBeNull()
    expect(screen.queryByText(/escanear/i)).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Editar Desayuno' }))
    fireEvent.change(screen.getByDisplayValue('Desayuno'), { target: { value: 'Primer comida' } })
    expect(screen.queryByText(/buscar|escanear/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    expect(await screen.findByRole('heading', { name: 'Primer comida' })).toBeTruthy()
  })
})
