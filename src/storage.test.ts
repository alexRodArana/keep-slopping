import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultMeals, defaultTarget } from './data'
import { hasLegacyStateKeys, loadState, normalizeState, requiresPlanMigration } from './storage'

const STORAGE_KEY = 'keep-slopping-state-v1'

describe('state migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('replaces a legacy plan, clears its sessions, and preserves normalized creatine dates', () => {
    const legacyState = {
      planVersion: 1,
      target: { calories: 1, protein: 1, carbs: 1, fat: 1 },
      notes: ['Nota anterior'],
      creatineDates: ['2026-08-04', '2026-08-06', '2026-08-04', ''],
      meals: [{ id: 'old', name: 'Plan anterior', slot: '', ingredients: [] }],
      sessions: [{ id: 'old-session', mealId: 'old' }],
      foodLogs: [{ id: 'old-food-log' }],
      activeSession: { id: 'old-active-session' },
    }

    expect(requiresPlanMigration(legacyState)).toBe(true)
    expect(normalizeState(legacyState)).toEqual({
      planVersion: 2,
      target: defaultTarget,
      creatineDates: ['2026-08-06', '2026-08-04'],
      meals: defaultMeals,
      sessions: [],
    })
  })

  it('treats states without a plan version as legacy', () => {
    expect(normalizeState({ creatineDates: ['2026-08-04'], meals: [] })).toMatchObject({
      planVersion: 2,
      creatineDates: ['2026-08-04'],
      meals: defaultMeals,
      sessions: [],
    })
  })

  it('preserves edits and an intentionally empty meal list in version 2', () => {
    const state = normalizeState({
      planVersion: 2,
      target: { calories: 2500, protein: 150, carbs: 300, fat: 70 },
      notes: [],
      creatineDates: [],
      meals: [],
      sessions: [],
    })

    expect(requiresPlanMigration(state)).toBe(false)
    expect(state).toEqual({
      planVersion: 2,
      target: { calories: 2500, protein: 150, carbs: 300, fat: 70 },
      creatineDates: [],
      meals: [],
      sessions: [],
    })
  })

  it('normalizes version 2 sessions against their meal ingredients', () => {
    const state = normalizeState({
      planVersion: 2,
      target: defaultTarget,
      notes: ['Indicación retirada'],
      creatineDates: [],
      meals: [
        {
          id: 'breakfast',
          name: 'Desayuno',
          slot: 'ligero',
          ingredients: [{ id: 'oats', name: 'Avena', amount: '50 g', calories: 999 }],
          nutrition: { calories: 493, protein: 40, carbs: 67, fat: 7 },
        },
      ],
      sessions: [
        {
          id: 'session-1',
          mealId: 'breakfast',
          date: '2026-08-04',
          startedAt: '2026-08-04T08:00:00.000Z',
          endedAt: '2026-08-04T08:10:00.000Z',
          checkedIngredientIds: ['oats', 'removed-product'],
          completed: true,
          optionId: 'removed-option',
        },
      ],
    })

    expect(state).not.toHaveProperty('notes')
    expect(state.meals[0]).not.toHaveProperty('slot')
    expect(state.meals[0].ingredients[0]).toEqual({ id: 'oats', name: 'Avena', amount: '50 g' })
    expect(state.sessions[0]).toEqual({
      id: 'session-1',
      mealId: 'breakfast',
      date: '2026-08-04',
      startedAt: '2026-08-04T08:00:00.000Z',
      endedAt: '2026-08-04T08:10:00.000Z',
      checkedIngredientIds: ['oats'],
      completed: true,
    })
  })

  it('writes a migrated local state back immediately', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        creatineDates: ['2026-08-04'],
        foodLogs: [{ id: 'legacy-log' }],
        meals: [],
        sessions: [{ id: 'legacy-session' }],
        activeSession: { id: 'legacy-active' },
      }),
    )

    const state = loadState()
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')

    expect(state.planVersion).toBe(2)
    expect(persisted).toEqual(state)
    expect(persisted).not.toHaveProperty('foodLogs')
    expect(persisted).not.toHaveProperty('activeSession')
  })

  it('detects removed top-level notes and nested meal descriptions as stale keys', () => {
    expect(hasLegacyStateKeys({ planVersion: 2, notes: [] })).toBe(true)
    expect(hasLegacyStateKeys({ planVersion: 2, meals: [{ slot: 'ligero' }] })).toBe(true)
    expect(hasLegacyStateKeys({ planVersion: 2, meals: [{ name: 'Desayuno' }] })).toBe(false)
  })

  it('cleans removed fields from a version 2 state without replacing its meals or progress', () => {
    const savedSession = {
      id: 'custom-session',
      mealId: 'custom-meal',
      date: '2026-08-19',
      startedAt: '2026-08-19T12:00:00.000Z',
      endedAt: '2026-08-19T12:10:00.000Z',
      checkedIngredientIds: ['custom-ingredient'],
      completed: true,
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        planVersion: 2,
        target: { calories: 2500, protein: 150, carbs: 300, fat: 70 },
        notes: ['Indicación retirada'],
        creatineDates: ['2026-08-18'],
        meals: [
          {
            id: 'custom-meal',
            name: 'Comida editada',
            slot: 'descripción retirada',
            ingredients: [{ id: 'custom-ingredient', name: 'Ingrediente editado', amount: '123 g' }],
            nutrition: { calories: 625, protein: 40, carbs: 80, fat: 15 },
          },
        ],
        sessions: [savedSession],
      }),
    )

    const state = loadState()
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')

    expect(state).toEqual({
      planVersion: 2,
      target: { calories: 2500, protein: 150, carbs: 300, fat: 70 },
      creatineDates: ['2026-08-18'],
      meals: [
        {
          id: 'custom-meal',
          name: 'Comida editada',
          ingredients: [{ id: 'custom-ingredient', name: 'Ingrediente editado', amount: '123 g' }],
          nutrition: { calories: 625, protein: 40, carbs: 80, fat: 15 },
        },
      ],
      sessions: [savedSession],
    })
    expect(persisted).toEqual(state)
    expect(persisted).not.toHaveProperty('notes')
    expect(persisted.meals[0]).not.toHaveProperty('slot')
  })

  it('keeps the migrated state in memory when local writeback fails', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ creatineDates: ['2026-08-04'], meals: [], sessions: [] }),
    )
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const storageSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    const state = loadState()

    expect(state.creatineDates).toEqual(['2026-08-04'])
    expect(state.meals).toEqual(defaultMeals)
    expect(consoleSpy).toHaveBeenCalledOnce()
    storageSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})
