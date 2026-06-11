import { describe, it, expect } from 'vitest'

// Mirrors isValidPrompt from einstellungen/page.tsx
function isValidPrompt(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const p = item as Record<string, unknown>
  return typeof p.title === 'string' && p.title.trim() !== '' &&
    typeof p.content === 'string' && p.content.trim() !== ''
}

// Mirrors normalizeImportItem — defaults for optional fields
function normalizeImportItem(item: Record<string, unknown>) {
  return {
    title: item.title as string,
    content: item.content as string,
    description: (item.description as string | null | undefined) ?? null,
    tags: Array.isArray(item.tags) ? item.tags as string[] : [],
    usage_count: typeof item.usage_count === 'number' ? item.usage_count : 0,
  }
}

// Mirrors export transformation
interface Prompt {
  id: string; user_id: string; title: string; content: string
  description: string | null; tags: string[]; usage_count: number
  created_at: string; updated_at: string
}
function toExportFormat(prompts: Prompt[]) {
  return prompts.map(p => ({
    title: p.title,
    content: p.content,
    description: p.description,
    tags: p.tags,
    usage_count: p.usage_count,
  }))
}

// ── isValidPrompt ──────────────────────────────────────────────────────────

describe('isValidPrompt — Validierung', () => {
  it('gibt true zurück wenn title und content vorhanden', () => {
    expect(isValidPrompt({ title: 'Test', content: 'Inhalt' })).toBe(true)
  })

  it('gibt false zurück wenn title fehlt', () => {
    expect(isValidPrompt({ content: 'Inhalt' })).toBe(false)
  })

  it('gibt false zurück wenn content fehlt', () => {
    expect(isValidPrompt({ title: 'Test' })).toBe(false)
  })

  it('gibt false zurück wenn title leer ist', () => {
    expect(isValidPrompt({ title: '', content: 'Inhalt' })).toBe(false)
  })

  it('gibt false zurück wenn title nur Leerzeichen', () => {
    expect(isValidPrompt({ title: '   ', content: 'Inhalt' })).toBe(false)
  })

  it('gibt false zurück wenn content leer ist', () => {
    expect(isValidPrompt({ title: 'Test', content: '' })).toBe(false)
  })

  it('gibt false zurück bei null', () => {
    expect(isValidPrompt(null)).toBe(false)
  })

  it('gibt false zurück bei String', () => {
    expect(isValidPrompt('string')).toBe(false)
  })

  it('gibt false zurück bei Zahl', () => {
    expect(isValidPrompt(42)).toBe(false)
  })

  it('gibt true zurück auch wenn optionale Felder fehlen', () => {
    expect(isValidPrompt({ title: 'T', content: 'C' })).toBe(true)
  })
})

// ── normalizeImportItem ────────────────────────────────────────────────────

describe('normalizeImportItem — Standardwerte für optionale Felder', () => {
  it('behält vorhandene Werte bei', () => {
    const result = normalizeImportItem({
      title: 'T', content: 'C', description: 'Desc', tags: ['a', 'b'], usage_count: 5,
    })
    expect(result.description).toBe('Desc')
    expect(result.tags).toEqual(['a', 'b'])
    expect(result.usage_count).toBe(5)
  })

  it('setzt description auf null wenn fehlend', () => {
    expect(normalizeImportItem({ title: 'T', content: 'C' }).description).toBeNull()
  })

  it('setzt tags auf [] wenn fehlend', () => {
    expect(normalizeImportItem({ title: 'T', content: 'C' }).tags).toEqual([])
  })

  it('setzt usage_count auf 0 wenn fehlend', () => {
    expect(normalizeImportItem({ title: 'T', content: 'C' }).usage_count).toBe(0)
  })

  it('setzt tags auf [] wenn kein Array', () => {
    expect(normalizeImportItem({ title: 'T', content: 'C', tags: 'blog' }).tags).toEqual([])
  })
})

// ── toExportFormat ─────────────────────────────────────────────────────────

describe('toExportFormat — Export-Transformation', () => {
  const prompts: Prompt[] = [
    {
      id: 'uuid-1', user_id: 'u1', title: 'Blog', content: 'Text',
      description: 'Desc', tags: ['blog'], usage_count: 3,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    },
  ]

  it('enthält title, content, description, tags, usage_count', () => {
    const result = toExportFormat(prompts)[0]
    expect(result).toEqual({
      title: 'Blog', content: 'Text', description: 'Desc',
      tags: ['blog'], usage_count: 3,
    })
  })

  it('enthält KEINE id, user_id, created_at, updated_at', () => {
    const result = toExportFormat(prompts)[0] as Record<string, unknown>
    expect(result.id).toBeUndefined()
    expect(result.user_id).toBeUndefined()
    expect(result.created_at).toBeUndefined()
    expect(result.updated_at).toBeUndefined()
  })

  it('leeres Array → leeres Ergebnis', () => {
    expect(toExportFormat([])).toEqual([])
  })
})
