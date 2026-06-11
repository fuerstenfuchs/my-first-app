import { describe, it, expect } from 'vitest'

// Mirrors the filteredPrompts + allTags logic from page.tsx

interface Prompt {
  id: string
  title: string
  description: string | null
  content: string
  tags: string[]
  usage_count: number
  created_at: string
  updated_at: string
  user_id: string
}

function filterPrompts(prompts: Prompt[], searchQuery: string, activeTag: string | null): Prompt[] {
  const query = searchQuery.trim().toLowerCase()
  return prompts.filter(prompt => {
    const matchesSearch = !query ||
      prompt.title.toLowerCase().includes(query) ||
      (prompt.description?.toLowerCase().includes(query) ?? false) ||
      prompt.tags.some(t => t.toLowerCase().includes(query))
    const matchesTag = !activeTag || prompt.tags.includes(activeTag)
    return matchesSearch && matchesTag
  })
}

function computeAllTags(prompts: Prompt[]): string[] {
  const tagSet = new Set<string>()
  prompts.forEach(p => p.tags.forEach(t => tagSet.add(t)))
  return Array.from(tagSet).sort()
}

const BASE: Prompt = {
  id: '1', title: '', description: null, content: '', tags: [],
  usage_count: 0, created_at: '', updated_at: '', user_id: 'u1',
}

const prompts: Prompt[] = [
  { ...BASE, id: '1', title: 'Blog-Einleitung', description: 'Schreib Einleitungen', tags: ['blog', 'schreiben'] },
  { ...BASE, id: '2', title: 'Suno-Lyrics', description: null, tags: ['musik', 'kreativ'] },
  { ...BASE, id: '3', title: 'E-Mail-Vorlage', description: 'Formale Mails', tags: ['email', 'schreiben'] },
  { ...BASE, id: '4', title: 'Bild-Prompt', description: null, tags: ['bild', 'kreativ'] },
]

describe('filterPrompts — Suchfeld', () => {
  it('leere Suche gibt alle Prompts zurück', () => {
    expect(filterPrompts(prompts, '', null)).toHaveLength(4)
  })

  it('Suche nach Titel (case-insensitive)', () => {
    const result = filterPrompts(prompts, 'blog', null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('Suche nach Beschreibung', () => {
    const result = filterPrompts(prompts, 'formale', null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })

  it('Suche nach Tag', () => {
    const result = filterPrompts(prompts, 'kreativ', null)
    expect(result).toHaveLength(2)
    expect(result.map(p => p.id)).toEqual(expect.arrayContaining(['2', '4']))
  })

  it('nur Leerzeichen → alle Prompts angezeigt', () => {
    expect(filterPrompts(prompts, '   ', null)).toHaveLength(4)
  })

  it('keine Treffer → leeres Array', () => {
    expect(filterPrompts(prompts, 'gibtsnicxht', null)).toHaveLength(0)
  })

  it('Groß-/Kleinschreibung wird ignoriert', () => {
    expect(filterPrompts(prompts, 'BLOG', null)).toHaveLength(1)
    expect(filterPrompts(prompts, 'Blog', null)).toHaveLength(1)
  })
})

describe('filterPrompts — Tag-Filter', () => {
  it('kein aktiver Tag → alle Prompts', () => {
    expect(filterPrompts(prompts, '', null)).toHaveLength(4)
  })

  it('aktiver Tag filtert korrekt', () => {
    const result = filterPrompts(prompts, '', 'schreiben')
    expect(result).toHaveLength(2)
    expect(result.map(p => p.id)).toEqual(expect.arrayContaining(['1', '3']))
  })

  it('Tag mit null zurückgesetzt → alle Prompts', () => {
    expect(filterPrompts(prompts, '', null)).toHaveLength(4)
  })
})

describe('filterPrompts — Kombinierte Filterung (UND-Logik)', () => {
  it('Suche UND Tag — beide Bedingungen müssen erfüllt sein', () => {
    // "schreiben" passt auf Blog (Tags: blog, schreiben) und E-Mail (Tags: email, schreiben)
    // Zusätzlich Tag "blog" aktiv → nur Blog-Einleitung bleibt
    const result = filterPrompts(prompts, 'schreib', 'blog')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('Suche passt, aber kein Prompt hat den aktiven Tag → leeres Ergebnis', () => {
    const result = filterPrompts(prompts, 'blog', 'musik')
    expect(result).toHaveLength(0)
  })
})

describe('computeAllTags', () => {
  it('gibt sortierte einzigartige Tags zurück', () => {
    expect(computeAllTags(prompts)).toEqual(['bild', 'blog', 'email', 'kreativ', 'musik', 'schreiben'])
  })

  it('leere Prompts → leeres Tag-Array', () => {
    expect(computeAllTags([])).toEqual([])
  })

  it('Prompts ohne Tags → leeres Tag-Array', () => {
    const noTags = [{ ...BASE, id: '1', tags: [] }, { ...BASE, id: '2', tags: [] }]
    expect(computeAllTags(noTags)).toEqual([])
  })

  it('Duplikate werden entfernt', () => {
    const dup = [
      { ...BASE, id: '1', tags: ['blog', 'kreativ'] },
      { ...BASE, id: '2', tags: ['blog', 'musik'] },
    ]
    expect(computeAllTags(dup)).toEqual(['blog', 'kreativ', 'musik'])
  })
})
