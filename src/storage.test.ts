import { describe, expect, it } from 'vitest'
import { normalizeState } from './storage'

describe('state migration', () => {
  it('loads legacy states without food logs and preserves an intentionally empty plan', () => {
    const state = normalizeState({
      creatineDates: [],
      meals: [],
      sessions: [],
    })

    expect(state.foodLogs).toEqual([])
    expect(state.meals).toEqual([])
  })
})
