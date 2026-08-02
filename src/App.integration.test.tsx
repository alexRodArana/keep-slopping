import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FoodProduct } from './types'

const { product } = vi.hoisted(() => ({
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
  loadState: vi.fn(() => ({
    activeSession: undefined,
    creatineDates: [],
    foodLogs: [],
    meals: [],
    sessions: [],
  })),
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
  it('searches a product, adjusts the portion and logs calculated calories', async () => {
    window.localStorage.setItem('keep-slopping-theme', 'dark')
    const { default: App } = await import('./App')

    render(<App />)

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
})
