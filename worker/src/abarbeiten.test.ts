/**
 * Wächter über die Anzahl erzeugter Bilder.
 *
 * WARUM ES DIESEN TEST GIBT: Mark am 03.09.2026 — „wenn ich im Scenebuilder
 * zwei Bilder möchte, dann generiert er mir nur eins".
 *
 * Die Rechnung stand in der Schleifenbedingung:
 *
 *     for (let i = start; i < start + (anzahl - pfade.length); i++)
 *
 * und der Schleifenrumpf schob jedes fertige Bild in genau die Liste, aus der
 * die Bedingung ihre Grenze zog. Sie schrumpfte also, während die Liste wuchs:
 *
 *     i=0:  0 < 0 + (2-0) = 2  ✓   Bild erzeugt, pfade.length wird 1
 *     i=1:  1 < 0 + (2-1) = 1  ✗   Schleife endet
 *
 * Ein Bild statt zwei — und der Auftrag meldete sich trotzdem als „fertig".
 *
 * Bei `variants: 1` fällt so etwas nicht auf, und genau so ist es durchgerutscht.
 * Deshalb steht hier jede Anzahl von 1 bis 4 einzeln: Ein Test, der nur den
 * Regelfall prüft, hätte denselben Fehler noch einmal durchgelassen.
 *
 * Läuft mit: npm test
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.PROXY_URL ??= 'http://127.0.0.1:8317'
process.env.PROXY_TOKEN ??= 'test'
process.env.SUPABASE_URL ??= 'https://beispiel.supabase.co'
process.env.SUPABASE_SERVICE_KEY ??= 'test'

const { nochZuErzeugen } = await import('./abarbeiten.ts')

// ── Frischer Auftrag: Bestellung und Lieferung müssen übereinstimmen ────────

for (const anzahl of [1, 2, 3, 4]) {
  test(`frischer Auftrag über ${anzahl} Bild(er) ergibt ${anzahl} Nummern`, () => {
    const indizes = nochZuErzeugen([], anzahl)
    assert.equal(indizes.length, anzahl, `es müssen ${anzahl} sein, nicht ${indizes.length}`)
    assert.deepEqual(indizes, Array.from({ length: anzahl }, (_, i) => i))
  })
}

// ── Fortsetzung nach einem Abbruch ─────────────────────────────────────────

test('zählt hinter dem letzten vorhandenen Bild weiter', () => {
  assert.deepEqual(nochZuErzeugen(['u/j/0.png'], 4), [1, 2, 3])
  assert.deepEqual(nochZuErzeugen(['u/j/0.png', 'u/j/1.png'], 4), [2, 3])
})

test('überschreibt kein vorhandenes Bild, wenn eines gelöscht wurde', () => {
  // Bild 0 wurde im Lichttisch gelöscht, 1 und 2 stehen noch, vier waren
  // bestellt. Würde aus der ANZAHL gezählt, begänne es bei 2 — und
  // überschriebe das vorhandene 2.png, weil mit `upsert` geschrieben wird.
  assert.deepEqual(nochZuErzeugen(['u/j/1.png', 'u/j/2.png'], 4), [3, 4])
})

test('kommt mit einer Lücke mittendrin zurecht', () => {
  assert.deepEqual(nochZuErzeugen(['u/j/0.png', 'u/j/3.png'], 4), [4, 5])
})

test('nimmt die Endung, wie sie kommt', () => {
  assert.deepEqual(nochZuErzeugen(['u/j/0.jpg', 'u/j/1.webp'], 3), [2])
})

// ── Nichts mehr zu tun ─────────────────────────────────────────────────────

test('gibt nichts zurück, wenn schon alles da ist', () => {
  assert.deepEqual(nochZuErzeugen(['u/j/0.png', 'u/j/1.png'], 2), [])
})

test('gibt nichts zurück, wenn mehr da ist als bestellt', () => {
  assert.deepEqual(nochZuErzeugen(['u/j/0.png', 'u/j/1.png', 'u/j/2.png'], 2), [])
})

// ── Unerwartete Pfade ──────────────────────────────────────────────────────

test('zählt bei undeutbarer Nummer aus der Anzahl weiter, statt zu werfen', () => {
  // Lieber eine Nummer zu hoch als ein Absturz mitten im Auftrag.
  assert.deepEqual(nochZuErzeugen(['u/j/abc.png'], 2), [1])
})
