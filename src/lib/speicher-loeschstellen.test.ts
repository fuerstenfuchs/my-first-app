import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, sep } from 'path'

/**
 * QUELLTEXT-WÄCHTER: Wer löscht Dateien im Speicher?
 *
 * WARUM ALS TEST UND NICHT ALS REGEL IM KOPF: Am 15.09.2026 lagen neun
 * Löschstellen verstreut, jede mit eigenem Eimer und ohne Nachfrage. Sie wurden
 * auf `dateiFreigeben` umgestellt, damit eine geteilte Datei nicht still für
 * andere Zeilen verschwindet. Die nächste neue Löschstelle, die direkt
 * `storage.from(…).remove(…)` schreibt, brächte genau diesen Fehler zurück —
 * und kein anderer Test fiele darüber.
 *
 * ERLAUBT sind nur die bekannten Stellen, je mit GENAUER Anzahl:
 *  · `src/lib/datei-freigeben.ts` — die eine Stelle, die vorher zählt;
 *  · die zwei RÜCKBAU-Stellen, die ihre eigene, Sekunden alte Datei wieder
 *    wegräumen, bevor je ein Verweis darauf entstand.
 * Kommt in einer dieser Dateien ein weiterer Aufruf dazu, wird der Wächter
 * ebenfalls rot — dann ist bewusst zu entscheiden, ob die Zahl steigen darf.
 *
 * GROB MIT ABSICHT: Gezählt wird JEDES Vorkommen von `.remove(`, `?.remove(`
 * und `['remove']` in jeder Datei, die `storage` überhaupt erwähnt — egal, was
 * davor steht (verschachtelter Eimer, destrukturiertes `storage`, Ausdruck als
 * Argument). Bis 15.09.2026 suchte der Wächter nach bestimmten Formen und ließ
 * genau diese Schreibweisen durch; eine `Math.max`-Verrechnung zählte zudem
 * zwei Löschungen als eine. Auch eine Löschung im Kommentar und ein DOM-
 * `element.remove()` in einer Speicher-Datei machen rot. Lieber einmal zu
 * streng als eine übersehene Stelle.
 */

const WURZEL = join(__dirname, '..')
const PROJEKT = join(WURZEL, '..')

const ERLAUBTE_ANZAHL = new Map<string, number>([
  // Hauptdatei und Vorschau, jede eigens gezählt: ein `remove` in `entfernen`.
  ['src/lib/datei-freigeben.ts', 1],
  ['src/hooks/use-bild-uebernehmen.ts', 1],
  ['src/hooks/use-bild-bearbeiten.ts', 1],
])

const LOESCHAUFRUF = /\??\.\s*remove\s*\(|\??\.?\s*\[\s*(['"`])remove\1\s*\]/g

/** Zählt die Löschaufrufe in einem Quelltext — nur in Dateien, die `storage` erwähnen. */
function speicherLoeschungen(text: string): number {
  if (!/storage/i.test(text)) return 0
  return text.match(LOESCHAUFRUF)?.length ?? 0
}

function quelldateien(ordner: string): string[] {
  const raus: string[] = []
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    if (statSync(pfad).isDirectory()) { raus.push(...quelldateien(pfad)); continue }
    if (!/\.(ts|tsx|mts)$/.test(name)) continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(name)) continue
    raus.push(pfad)
  }
  return raus
}

describe('Wächter-Muster (prüft sich selbst)', () => {
  it('erkennt die einfachen Formen', () => {
    expect(speicherLoeschungen(`await supabase.storage.from('x').remove([p])`)).toBe(1)
    expect(speicherLoeschungen(`await supabase.storage.from(B).remove(pfade)`)).toBe(1)
    expect(speicherLoeschungen(`const e = supabase.storage.from(B)\nawait e.remove(pfade)`)).toBe(1)
    expect(speicherLoeschungen(`supabase.storage\n  .from(B)\n  .remove([a, b])`)).toBe(1)
  })
  it('erkennt verschachtelten Eimer, Ausdruck als Argument und destrukturiertes storage', () => {
    expect(speicherLoeschungen(`supabase.storage.from(eimerFuer(x)).remove(pfade)`)).toBe(1)
    expect(speicherLoeschungen(`supabase.storage.from(b).remove(a ? [x] : liste.map(f))`)).toBe(1)
    expect(speicherLoeschungen(`const { storage } = supabase\nawait storage.from(b).remove(p)`)).toBe(1)
  })
  it('erkennt ?.- und Klammerschreibweise', () => {
    expect(speicherLoeschungen(`supabase.storage?.from(b)?.remove(p)`)).toBe(1)
    expect(speicherLoeschungen(`supabase.storage.from(b)['remove'](p)`)).toBe(1)
    expect(speicherLoeschungen(`supabase.storage.from(b)?.["remove"](p)`)).toBe(1)
  })
  it('zählt zwei Löschungen als zwei', () => {
    expect(speicherLoeschungen(`storage.from(a).remove([x])\nstorage.from(b).remove(y)`)).toBe(2)
  })
  it('Dateien ohne storage bleiben außen vor (DOM-Aufräumen)', () => {
    expect(speicherLoeschungen(`a.remove()`)).toBe(0)
    expect(speicherLoeschungen(`const x = 1; link.remove()`)).toBe(0)
  })
})

describe('Löschstellen im Speicher', () => {
  const dateien = quelldateien(WURZEL).map(p => ({
    name: relative(PROJEKT, p).split(sep).join('/'),
    anzahl: speicherLoeschungen(readFileSync(p, 'utf8')),
  }))

  it('findet überhaupt Quelldateien (sonst prüfte der Wächter nichts)', () => {
    expect(dateien.length).toBeGreaterThan(50)
    expect(dateien.some(d => d.name === 'src/lib/datei-freigeben.ts')).toBe(true)
  })

  it('nirgends sonst wird direkt gelöscht', () => {
    const verboten = dateien
      .filter(d => d.anzahl > 0 && !ERLAUBTE_ANZAHL.has(d.name))
      .map(d => `${d.name} (${d.anzahl}×) — bitte über dateiFreigeben aus src/lib/datei-freigeben.ts`)
    expect(verboten).toEqual([])
  })

  it('die erlaubten Stellen löschen genau so oft wie festgehalten', () => {
    const ist = [...ERLAUBTE_ANZAHL.keys()].map(name => ({
      name, anzahl: dateien.find(x => x.name === name)?.anzahl ?? 'Datei fehlt',
    }))
    expect(ist).toEqual([...ERLAUBTE_ANZAHL].map(([name, anzahl]) => ({ name, anzahl })))
  })
})
