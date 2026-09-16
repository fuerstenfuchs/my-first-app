import { describe, it, expect } from 'vitest'
import { originalInBackblaze } from './speicher-vermerk'

/**
 * Der Leser des Vermerks, den der Arbeiter schreibt.
 *
 * Die Form unten ist WÖRTLICH dieselbe wie im Arbeiter-Test
 * (`worker/src/speicher.test.ts`, „Vermerk: Form wie in src/lib/speicher-vermerk.ts").
 * Ändert eine Seite sie, muss die andere mitziehen — sonst zeigt die Kachel
 * stillschweigend nichts mehr an.
 */

const META = {
  name: 'Szene',
  abgelegt: true,
  speicher: { originale: {
    'u1/j1/0.webp': { ort: 'backblaze', masse: '1x1' },
    'u1/j1/1.webp': { ort: 'backblaze', masse: '4608x3072' },
  } },
}

describe('originalInBackblaze', () => {
  it('liest die Maße des Originals zum Pfad', () => {
    expect(originalInBackblaze(META, 'u1/j1/1.webp')).toEqual({ breite: 4608, hoehe: 3072 })
  })
  it('kein Eintrag für diesen Pfad → null', () => {
    expect(originalInBackblaze(META, 'u1/j1/2.webp')).toBeNull()
  })
  it('ohne scene_meta, ohne speicher, mit Unsinn → null', () => {
    expect(originalInBackblaze(null, 'a')).toBeNull()
    expect(originalInBackblaze({ name: 'x' }, 'a')).toBeNull()
    expect(originalInBackblaze({ speicher: [] }, 'a')).toBeNull()
    expect(originalInBackblaze({ speicher: { originale: { a: { ort: 'backblaze', masse: 'groß' } } } }, 'a')).toBeNull()
    expect(originalInBackblaze({ speicher: { originale: { a: { ort: 'anderswo', masse: '10x10' } } } }, 'a')).toBeNull()
    expect(originalInBackblaze({ speicher: { originale: { a: { ort: 'backblaze', masse: '0x10' } } } }, 'a')).toBeNull()
  })
})
