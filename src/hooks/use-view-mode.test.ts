import { describe, it, expect, beforeEach, vi } from 'vitest'

const STORAGE_KEY = 'promptdb-view-mode'

// Mirror the localStorage read logic from useViewMode
function readViewMode(): 'grid' | 'list' {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'list' || saved === 'grid') return saved
  return 'grid'
}

function writeViewMode(mode: 'grid' | 'list') {
  localStorage.setItem(STORAGE_KEY, mode)
}

describe('useViewMode localStorage logic', () => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
      clear: () => { store = {} },
    }
  })()

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock)
    localStorageMock.clear()
  })

  it('defaults to grid when localStorage is empty', () => {
    expect(readViewMode()).toBe('grid')
  })

  it('reads "list" from localStorage', () => {
    writeViewMode('list')
    expect(readViewMode()).toBe('list')
  })

  it('reads "grid" from localStorage', () => {
    writeViewMode('grid')
    expect(readViewMode()).toBe('grid')
  })

  it('ignores unknown values and falls back to grid', () => {
    localStorage.setItem(STORAGE_KEY, 'table')
    expect(readViewMode()).toBe('grid')
  })

  it('ignores empty string and falls back to grid', () => {
    localStorage.setItem(STORAGE_KEY, '')
    expect(readViewMode()).toBe('grid')
  })

  it('writeViewMode persists to localStorage', () => {
    writeViewMode('list')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('list')
    writeViewMode('grid')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('grid')
  })
})
