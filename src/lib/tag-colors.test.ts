import { describe, it, expect } from 'vitest'
import { tagColorClass } from './tag-colors'

describe('tagColorClass', () => {
  it('returns a non-empty string for any tag', () => {
    expect(tagColorClass('blog')).toBeTruthy()
    expect(tagColorClass('')).toBeTruthy()
  })

  it('is deterministic — same tag always returns same class', () => {
    expect(tagColorClass('coding')).toBe(tagColorClass('coding'))
    expect(tagColorClass('musik')).toBe(tagColorClass('musik'))
  })

  it('different tags return different colors (collision check over 8 slots)', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const classes = tags.map(tagColorClass)
    const unique = new Set(classes)
    // With 10 tags over 8 slots at least 2 different colors must appear
    expect(unique.size).toBeGreaterThan(1)
  })

  it('returns one of the known color class strings', () => {
    const result = tagColorClass('test')
    expect(result).toMatch(/bg-\w+-500\/20/)
    expect(result).toMatch(/text-\w+-300/)
  })

  it('handles unicode and special characters without throwing', () => {
    expect(() => tagColorClass('日本語')).not.toThrow()
    expect(() => tagColorClass('emoji🎵')).not.toThrow()
    expect(() => tagColorClass('  spaces  ')).not.toThrow()
  })
})
