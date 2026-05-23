import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest 4 + jsdom 29 do not expose window.localStorage; the app relies on it for the
// auth token, so provide an in-memory implementation for tests.
if (typeof window.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const localStorageStub: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key)
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', { value: localStorageStub, writable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, writable: true })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

class MockOscillator {
  type = 'square'
  frequency = { value: 0 }
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class MockGain {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  }
  connect = vi.fn()
}

class MockAudioContext {
  state = 'running'
  destination = {}
  resume = vi.fn().mockResolvedValue(undefined)
  createOscillator = vi.fn(() => new MockOscillator())
  createGain = vi.fn(() => new MockGain())

  // A real AudioContext's clock advances continuously; mimic that by deriving the
  // time from performance.now() while still letting tests jump the clock by
  // assigning to currentTime.
  private origin = performance.now()
  private offset = 0

  get currentTime(): number {
    return this.offset + (performance.now() - this.origin) / 1000
  }

  set currentTime(value: number) {
    this.offset = value - (performance.now() - this.origin) / 1000
  }
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: MockAudioContext,
})
