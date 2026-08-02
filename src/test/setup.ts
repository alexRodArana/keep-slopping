import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

const createMemoryStorage = (): Storage => {
  let entries = new Map<string, string>()

  return {
    get length() {
      return entries.size
    },
    clear: () => {
      entries = new Map()
    },
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: (key, value) => {
      entries.set(key, value)
    },
  }
}

const localStorageMock = createMemoryStorage()
const sessionStorageMock = createMemoryStorage()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorageMock,
})

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
})

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: sessionStorageMock,
})

Object.defineProperty(window, 'sessionStorage', {
  configurable: true,
  value: sessionStorageMock,
})

Object.defineProperty(navigator, 'vibrate', {
  configurable: true,
  value: vi.fn(),
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorageMock.clear()
  sessionStorageMock.clear()
})
