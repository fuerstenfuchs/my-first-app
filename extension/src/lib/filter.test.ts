import { describe, it, expect } from 'vitest'
import { filterPrompts } from './filter'
import type { Prompt } from '../types'

function makePrompt(overrides: Partial<Prompt> & { id: string }): Prompt {
  return {
    title: 'Test Prompt',
    description: null,
    content: 'Test content',
    tags: [],
    is_favorite: false,
    last_used_at: null,
    usage_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const BASE = [
  makePrompt({ id: 'a', title: 'Festival Portrait', last_used_at: '2026-06-12T10:00:00Z' }),
  makePrompt({ id: 'b', title: 'Cinematic Crowd', last_used_at: '2026-06-11T10:00:00Z' }),
  makePrompt({ id: 'c', title: 'Magazine Layout', last_used_at: null }),
  makePrompt({ id: 'd', title: 'Sony Photography', is_favorite: true, last_used_at: null }),
  makePrompt({ id: 'e', title: 'Children Book Style', is_favorite: true, last_used_at: '2026-06-10T10:00:00Z' }),
]

describe('filterPrompts — search', () => {
  it('filters by title match (case-insensitive)', () => {
    const result = filterPrompts(BASE, 'festival', 'recent')
    expect(result.map(p => p.id)).toEqual(['a'])
  })

  it('filters by description match', () => {
    const prompts = [
      makePrompt({ id: 'x', title: 'Unrelated', description: 'festival vibes' }),
    ]
    const result = filterPrompts(prompts, 'festival', 'recent')
    expect(result.map(p => p.id)).toEqual(['x'])
  })

  it('returns all matches, not just first', () => {
    const result = filterPrompts(BASE, 'c', 'recent')
    expect(result.length).toBeGreaterThan(1)
  })

  it('returns empty array when no matches', () => {
    const result = filterPrompts(BASE, 'xyz_no_match', 'recent')
    expect(result).toHaveLength(0)
  })

  it('ignores tab when query is set', () => {
    const fromRecent = filterPrompts(BASE, 'festival', 'recent')
    const fromFavorites = filterPrompts(BASE, 'festival', 'favorites')
    expect(fromRecent).toEqual(fromFavorites)
  })

  it('trims whitespace from query', () => {
    const result = filterPrompts(BASE, '  festival  ', 'recent')
    expect(result.map(p => p.id)).toEqual(['a'])
  })

  it('empty query falls through to tab logic', () => {
    const result = filterPrompts(BASE, '', 'favorites')
    expect(result.every(p => p.is_favorite)).toBe(true)
  })
})

describe('filterPrompts — recent tab', () => {
  it('shows prompts with last_used_at, sorted as provided', () => {
    const result = filterPrompts(BASE, '', 'recent')
    expect(result.every(p => p.last_used_at != null)).toBe(true)
  })

  it('caps results at 10', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makePrompt({ id: `p${i}`, title: `Prompt ${i}`, last_used_at: `2026-06-${String(i + 1).padStart(2, '0')}T00:00:00Z` })
    )
    expect(filterPrompts(many, '', 'recent')).toHaveLength(10)
  })

  it('falls back to all prompts when none have last_used_at', () => {
    const noHistory = BASE.map(p => ({ ...p, last_used_at: null }))
    const result = filterPrompts(noHistory, '', 'recent')
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThanOrEqual(10)
  })

  it('fallback also caps at 10', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      makePrompt({ id: `p${i}`, title: `Prompt ${i}`, last_used_at: null })
    )
    expect(filterPrompts(many, '', 'recent')).toHaveLength(10)
  })
})

describe('filterPrompts — favorites tab', () => {
  it('returns only favorite prompts', () => {
    const result = filterPrompts(BASE, '', 'favorites')
    expect(result.every(p => p.is_favorite)).toBe(true)
  })

  it('returns all favorites (no 10-item cap)', () => {
    const manyFavs = Array.from({ length: 12 }, (_, i) =>
      makePrompt({ id: `f${i}`, title: `Fav ${i}`, is_favorite: true })
    )
    expect(filterPrompts(manyFavs, '', 'favorites')).toHaveLength(12)
  })

  it('returns empty when no favorites', () => {
    const noFavs = BASE.map(p => ({ ...p, is_favorite: false }))
    expect(filterPrompts(noFavs, '', 'favorites')).toHaveLength(0)
  })
})
