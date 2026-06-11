import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useStats } from '@/hooks/use-stats'
import type { Prompt } from '@/hooks/use-prompts'

const BASE: Prompt = {
  id: '1', user_id: 'u1', title: 'Prompt A', content: 'content',
  description: null, tags: [], usage_count: 0,
  created_at: '2026-01-01', updated_at: '2026-01-01',
}

const prompts: Prompt[] = [
  { ...BASE, id: '1', title: 'Blog-Einleitung', tags: ['blog', 'schreiben'], usage_count: 10 },
  { ...BASE, id: '2', title: 'Suno-Lyrics',     tags: ['musik'],            usage_count: 5  },
  { ...BASE, id: '3', title: 'E-Mail-Vorlage',  tags: ['schreiben'],        usage_count: 3  },
  { ...BASE, id: '4', title: 'Bild-Prompt',     tags: ['bild'],             usage_count: 0  },
  { ...BASE, id: '5', title: 'Code-Review',     tags: [],                   usage_count: 7  },
]

describe('useStats — KPI-Berechnungen', () => {
  it('totalCopies summiert alle usage_count-Werte', () => {
    const { result } = renderHook(() => useStats(prompts))
    expect(result.current.totalCopies).toBe(25) // 10+5+3+0+7
  })

  it('totalPrompts gibt die Gesamtanzahl der Prompts zurück', () => {
    const { result } = renderHook(() => useStats(prompts))
    expect(result.current.totalPrompts).toBe(5)
  })

  it('leere Prompts → totalCopies = 0, totalPrompts = 0', () => {
    const { result } = renderHook(() => useStats([]))
    expect(result.current.totalCopies).toBe(0)
    expect(result.current.totalPrompts).toBe(0)
    expect(result.current.topTag).toBeNull()
    expect(result.current.topTen).toHaveLength(0)
  })
})

describe('useStats — Meistgenutzter Tag', () => {
  it('gibt den Tag mit der höchsten kumulierten usage_count zurück', () => {
    // blog: 10, schreiben: 10+3=13, musik: 5, bild: 0
    const { result } = renderHook(() => useStats(prompts))
    expect(result.current.topTag).toBe('schreiben')
  })

  it('gibt null zurück wenn keine Prompts Tags haben', () => {
    const noTags = prompts.map(p => ({ ...p, tags: [] }))
    const { result } = renderHook(() => useStats(noTags))
    expect(result.current.topTag).toBeNull()
  })

  it('gibt null zurück wenn prompts leer ist', () => {
    const { result } = renderHook(() => useStats([]))
    expect(result.current.topTag).toBeNull()
  })
})

describe('useStats — Top-10-Rangliste', () => {
  it('schließt Prompts mit usage_count = 0 aus', () => {
    const { result } = renderHook(() => useStats(prompts))
    expect(result.current.topTen.map(p => p.id)).not.toContain('4')
  })

  it('sortiert absteigend nach usage_count', () => {
    const { result } = renderHook(() => useStats(prompts))
    const counts = result.current.topTen.map(p => p.usage_count)
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })

  it('alphabetischer Tiebreaker bei gleichem usage_count', () => {
    const tied: Prompt[] = [
      { ...BASE, id: '1', title: 'Zebra',  usage_count: 5 },
      { ...BASE, id: '2', title: 'Alpha',  usage_count: 5 },
      { ...BASE, id: '3', title: 'Mitte',  usage_count: 5 },
    ]
    const { result } = renderHook(() => useStats(tied))
    expect(result.current.topTen.map(p => p.title)).toEqual(['Alpha', 'Mitte', 'Zebra'])
  })

  it('gibt maximal 10 Einträge zurück', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      ...BASE, id: String(i), title: `Prompt ${i}`, usage_count: 15 - i,
    }))
    const { result } = renderHook(() => useStats(many))
    expect(result.current.topTen).toHaveLength(10)
  })

  it('gibt weniger als 10 zurück wenn nicht genug kopiert wurden', () => {
    const few = prompts.filter(p => p.usage_count > 0) // 4 Prompts
    const { result } = renderHook(() => useStats(few))
    expect(result.current.topTen).toHaveLength(4)
  })
})
