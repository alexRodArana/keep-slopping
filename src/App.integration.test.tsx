import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FoodProduct } from './types'

const { loadStateMock, product } = vi.hoisted(() => ({
  loadStateMock: vi.fn(),
  product: {
    barcode: '7702001163885',
    brand: 'Alpina',
    caloriesPer100g: 116,
    carbsPer100g: 6.8,
    fatPer100g: 4.4,
    name: 'Yogurt griego',
    proteinPer100g: 12,
    servingGrams: 150,
  } satisfies FoodProduct,
}))

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

vi.mock('./foodApi', async () => {
  const actual = await vi.importActual<typeof import('./foodApi')>('./foodApi')
  return {
    ...actual,
    getFoodByBarcode: vi.fn(async () => product),
    searchFoods: vi.fn(async () => [product]),
  }
})

describe('quick food logging', () => {
  beforeEach(() => {
    loadStateMock.mockReturnValue({
      activeSession: undefined,
      creatineDates: [],
      foodLogs: [],
      meals: [],
      sessions: [],
    })
  })

  it('searches a product, adjusts the portion and logs calculated calories', async () => {
    window.localStorage.setItem('keep-slopping-theme', 'dark')
    const { default: App } = await import('./App')

    render(<App />)

    expect(screen.queryByRole('button', { name: 'Buscar' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Alimentos' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Buscar' }))
    const searchInput = screen.getByRole('searchbox', { name: 'Buscar alimento' })
    fireEvent.change(searchInput, { target: { value: 'yogurt griego' } })
    fireEvent.submit(searchInput.closest('form')!)

    fireEvent.click(await screen.findByRole('button', { name: /Yogurt griego/i }))
    const portionInput = screen.getByLabelText('Peso de la porcion')
    fireEvent.change(portionInput, { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar alimento' }))

    expect(await screen.findByText('Registrado hoy')).toBeTruthy()
    expect(screen.getAllByText('232 kcal').length).toBeGreaterThan(0)
    expect(screen.getByText(/200 g/)).toBeTruthy()
  })

  it('asks for an option and saves the selected recipe', async () => {
    loadStateMock.mockReturnValue({
      activeSession: undefined,
      creatineDates: [],
      foodLogs: [],
      meals: [
        {
          id: 'breakfast',
          name: 'Desayuno',
          slot: 'Mañana',
          ingredients: [{ id: 'shake-protein', name: 'Proteína', amount: '1 medida', calories: 120 }],
          options: [
            {
              id: 'shake',
              name: 'Licuado',
              ingredients: [{ id: 'shake-protein', name: 'Proteína', amount: '1 medida', calories: 120 }],
            },
            {
              id: 'omelette',
              name: 'Omelette',
              ingredients: [
                { id: 'omelette-egg', name: 'Huevo', amount: '1 pieza', calories: 72 },
                { id: 'omelette-whites', name: 'Claras', amount: '90 ml', calories: 47 },
              ],
            },
          ],
        },
      ],
      sessions: [],
    })
    const { default: App } = await import('./App')

    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Elegir Omelette' }))
    fireEvent.click(screen.getByRole('button', { name: /Huevo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Claras/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Terminar comida' }))

    expect(await screen.findByText('Omelette')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeTruthy()
  })
})
