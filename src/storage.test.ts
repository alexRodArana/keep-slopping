import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENT_PLAN_VERSION, defaultMeals, defaultPlanNotes, defaultTarget } from './data'
import { hasLegacyStateKeys, loadState, normalizeState, requiresPlanMigration } from './storage'

const STORAGE_KEY = 'keep-slopping-state-v1'

describe('state migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('upgrades the format without replacing a personalized plan or clearing its sessions', () => {
    const previousPlanState = {
      planVersion: 2,
      target: { calories: 2600, protein: 140, carbs: 375, fat: 60 },
      creatineDates: ['2026-08-04', '2026-08-06', '2026-08-04', ''],
      meals: [{ id: 'snack', name: 'Colación', ingredients: [] }],
      sessions: [{ id: 'old-session', mealId: 'snack' }],
    }

    expect(requiresPlanMigration(previousPlanState)).toBe(true)
    const result = normalizeState(previousPlanState)
    expect(result).toMatchObject({
      planVersion: CURRENT_PLAN_VERSION,
      target: previousPlanState.target,
      creatineDates: ['2026-08-06', '2026-08-04'],
      meals: [{ id: 'snack', name: 'Colación' }],
      sessions: [{ id: 'old-session', mealId: 'snack' }],
    })
  })

  it('treats states without a plan version as legacy', () => {
    expect(normalizeState({ creatineDates: ['2026-08-04'], meals: [] })).toMatchObject({
      planVersion: CURRENT_PLAN_VERSION,
      creatineDates: ['2026-08-04'],
      meals: [],
      sessions: [],
    })
  })

  it('preserves edits and an intentionally empty meal list from the previous plan version', () => {
    const state = normalizeState({
      planVersion: 9,
      target: { calories: 2500, protein: 150, carbs: 300, fat: 70 },
      notes: [],
      creatineDates: [],
      meals: [],
      sessions: [],
    })

    expect(requiresPlanMigration(state)).toBe(false)
    expect(state).toEqual({
      planVersion: CURRENT_PLAN_VERSION,
      target: { calories: 2500, protein: 150, carbs: 300, fat: 70 },
      creatineDates: [],
      meals: [],
      sessions: [],
    })
  })

  it('normalizes previous-version sessions against their meal ingredients', () => {
    const state = normalizeState({
      planVersion: 9,
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

  it('preserves and normalizes meal options, their source link, and a valid selection', () => {
    const state = normalizeState({
      planVersion: 10,
      target: defaultTarget,
      creatineDates: [],
      meals: [
        {
          id: 'lunch',
          name: 'Preentreno',
          ingredients: [{ id: 'a-rice', name: 'Arroz', amount: '51 g' }],
          nutrition: { calories: 269, protein: 3.6, carbs: 64.5, fat: 0.4 },
          defaultOptionId: 'removed-option',
          optionSourceMealId: 'dinner',
          options: [
            {
              id: 'dinner-a',
              name: 'Cena A',
              ingredients: [{ id: 'a-rice', name: 'Arroz', amount: '51 g' }],
              nutrition: { calories: 269, protein: 3.6, carbs: 64.5, fat: 0.4 },
            },
            {
              id: 'dinner-b',
              name: 'Cena B',
              ingredients: [
                { id: 'b-rice', name: 'Arroz', amount: '52 g' },
                { id: 'b-honey', name: 'Miel', amount: '25 g' },
              ],
              nutrition: { calories: 273, protein: 3.7, carbs: 65.4, fat: 0.4 },
            },
          ],
        },
      ],
      sessions: [
        {
          id: 'session-b',
          mealId: 'lunch',
          date: '2026-10-24',
          startedAt: '2026-10-24T10:00:00.000Z',
          endedAt: '2026-10-24T10:10:00.000Z',
          checkedIngredientIds: ['a-rice', 'b-rice', 'b-honey', 'removed'],
          completed: false,
          optionId: 'dinner-b',
        },
      ],
    })

    expect(state.meals[0]).toMatchObject({
      defaultOptionId: 'dinner-a',
      optionSourceMealId: 'dinner',
      options: [
        {
          id: 'dinner-a',
          ingredients: [{ id: 'a-rice', name: 'Arroz', amount: '51 g' }],
          nutrition: { calories: 269, protein: 3.6, carbs: 64.5, fat: 0.4 },
        },
        {
          id: 'dinner-b',
          ingredients: [
            { id: 'b-rice', name: 'Arroz', amount: '52 g' },
            { id: 'b-honey', name: 'Miel', amount: '25 g' },
          ],
          nutrition: { calories: 273, protein: 3.7, carbs: 65.4, fat: 0.4 },
        },
      ],
    })
    expect(state.sessions).toEqual([
      {
        id: 'session-b',
        mealId: 'lunch',
        date: '2026-10-24',
        startedAt: '2026-10-24T10:00:00.000Z',
        endedAt: '2026-10-24T10:10:00.000Z',
        checkedIngredientIds: ['b-rice', 'b-honey'],
        completed: true,
        optionId: 'dinner-b',
      },
    ])
  })

  it('rejects an invalid or missing option without inheriting checked ingredients', () => {
    const choiceMeal = {
      id: 'dinner',
      name: 'Cena',
      ingredients: [{ id: 'a-oats', name: 'Avena', amount: '90 g' }],
      nutrition: { calories: 656, protein: 33.3, carbs: 88.2, fat: 20.4 },
      defaultOptionId: 'dinner-a',
      options: [
        {
          id: 'dinner-a',
          name: 'A',
          ingredients: [{ id: 'a-oats', name: 'Avena', amount: '90 g' }],
          nutrition: { calories: 656, protein: 33.3, carbs: 88.2, fat: 20.4 },
        },
        {
          id: 'dinner-b',
          name: 'B',
          ingredients: [{ id: 'b-potato', name: 'Papa', amount: '420 g' }],
          nutrition: { calories: 652, protein: 33.5, carbs: 87.5, fat: 20.6 },
        },
      ],
    }
    const baseSession = {
      mealId: 'dinner',
      startedAt: '2026-10-24T20:00:00.000Z',
      endedAt: '2026-10-24T20:10:00.000Z',
      checkedIngredientIds: ['a-oats'],
      completed: true,
    }
    const state = normalizeState({
      planVersion: 10,
      target: defaultTarget,
      creatineDates: [],
      meals: [choiceMeal],
      sessions: [
        { ...baseSession, id: 'invalid', date: '2026-10-24', optionId: 'removed-option' },
        { ...baseSession, id: 'missing', date: '2026-10-25' },
        {
          ...baseSession,
          id: 'switched',
          date: '2026-10-26',
          optionId: 'dinner-b',
          checkedIngredientIds: ['a-oats'],
        },
      ],
    })

    expect(state.sessions).toEqual([
      {
        ...baseSession,
        id: 'switched',
        date: '2026-10-26',
        optionId: 'dinner-b',
        checkedIngredientIds: [],
        completed: false,
      },
      {
        ...baseSession,
        id: 'missing',
        date: '2026-10-25',
        checkedIngredientIds: [],
        completed: false,
      },
      {
        ...baseSession,
        id: 'invalid',
        date: '2026-10-24',
        checkedIngredientIds: [],
        completed: false,
      },
    ])
  })

  it('deep-clones default meal options in a fresh state', () => {
    const state = normalizeState(undefined)
    const dinner = state.meals.find((meal) => meal.id === 'dinner')!
    const defaultDinner = defaultMeals.find((meal) => meal.id === 'dinner')!

    expect(dinner.options).toEqual(defaultDinner.options)
    expect(dinner.options).not.toBe(defaultDinner.options)
    expect(dinner.options?.[0].ingredients).not.toBe(defaultDinner.options?.[0].ingredients)
    expect(dinner.options?.[0].nutrition).not.toBe(defaultDinner.options?.[0].nutrition)
    expect(state.planNotes).toEqual(defaultPlanNotes)
    expect(state.planNotes).not.toBe(defaultPlanNotes)
  })

  it('preserves absent per-meal macros and the new plan guidance across reloads', () => {
    const state = normalizeState(normalizeState(undefined))
    expect(state.meals.every((meal) => meal.nutrition.protein === null
      && meal.nutrition.carbs === null && meal.nutrition.fat === null)).toBe(true)
    expect(state.meals.find((meal) => meal.id === 'dinner')?.options?.every((option) =>
      option.nutrition.protein === null && option.nutrition.carbs === null && option.nutrition.fat === null)).toBe(true)
    expect(state.planNotes).toEqual(defaultPlanNotes)
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

    expect(state.planVersion).toBe(CURRENT_PLAN_VERSION)
    expect(persisted).toEqual(state)
    expect(persisted).not.toHaveProperty('foodLogs')
    expect(persisted).not.toHaveProperty('activeSession')
  })

  it('detects removed top-level notes and nested meal descriptions as stale keys', () => {
    expect(hasLegacyStateKeys({ planVersion: 9, notes: [] })).toBe(true)
    expect(hasLegacyStateKeys({ planVersion: 9, meals: [{ slot: 'ligero' }] })).toBe(true)
    expect(hasLegacyStateKeys({ planVersion: 9, meals: [{ name: 'Desayuno' }] })).toBe(false)
  })

  it('cleans removed fields from the previous plan version without replacing its meals or progress', () => {
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
        planVersion: 9,
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
      planVersion: CURRENT_PLAN_VERSION,
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
    expect(state.meals).toEqual([])
    expect(consoleSpy).toHaveBeenCalledOnce()
    storageSpy.mockRestore()
    consoleSpy.mockRestore()
  })
})
