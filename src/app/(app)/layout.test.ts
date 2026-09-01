import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Verdrahtungs-Wächter für Quick Capture.
 *
 * Warum als Quelltext-Prüfung und nicht als Rendering-Test:
 * FAB, Modal und Hook waren vollständig gebaut und mit 18 Unit-Tests abgedeckt —
 * nur band sie niemand ein. Alle E2E-Tests, die das gefunden hätten
 * (tests/proj-10-quick-capture.spec.ts), überspringen sich ohne TEST_PASSWORD.
 * Der Fehler lag also nicht im Verhalten der Bausteine, sondern allein in ihrer
 * Verdrahtung im Layout. Genau die prüft dieser Test — ohne Anmeldedaten,
 * ohne Supabase-Mock, in Millisekunden.
 *
 * Der Hook MUSS im Layout liegen, nicht auf einer Seite: page.tsx feuert
 * 'quick-capture:open-share' direkt nach dem Mount (Share-Target vom Handy).
 * Ohne den Listener im Layout landet alles Geteilte im Nichts.
 */

/**
 * Kommentare entfernen, bevor geprüft wird — sonst besteht auskommentierter
 * Code die Prüfung und der Wächter schläft genau dann, wenn er wecken müsste.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function readSource(relativePath: string): string {
  return stripComments(readFileSync(join(process.cwd(), relativePath), 'utf-8'))
}

const layoutSource = readSource('src/app/(app)/layout.tsx')

describe('AppLayout — Quick Capture ist eingebunden', () => {
  it('ruft useQuickCapture auf (sonst hört niemand auf das Share-Event)', () => {
    expect(layoutSource).toContain('useQuickCapture')
    expect(layoutSource).toMatch(/=\s*useQuickCapture\(\)/)
  })

  it('rendert den FAB (sonst gibt es keinen Einstieg per Klick)', () => {
    expect(layoutSource).toContain('<QuickCaptureFAB')
    // erlaubt beide Schreibweisen: onOpen={open} und onOpen={quickCapture.open}
    expect(layoutSource).toMatch(/onOpen=\{\s*(\w+\.)?open\s*\}/)
  })

  it('rendert das Modal und reicht isOpen, onClose und initialValues durch', () => {
    expect(layoutSource).toContain('<QuickCaptureModal')
    expect(layoutSource).toMatch(/isOpen=\{\s*(\w+\.)?isOpen\s*\}/)
    expect(layoutSource).toMatch(/onClose=\{\s*(\w+\.)?close\s*\}/)
    expect(layoutSource).toMatch(/initialValues=\{\s*(\w+\.)?initialValues\s*\}/)
  })
})

describe('Startseite — der Share-Weg feuert weiterhin an das Layout', () => {
  const pageSource = readSource('src/app/(app)/page.tsx')

  it('verschickt quick-capture:open-share', () => {
    expect(pageSource).toContain('quick-capture:open-share')
  })

  it('verzögert den Dispatch, weil Child-Effects vor Parent-Effects laufen', () => {
    // Ohne setTimeout(…, 0) wäre der Listener im Layout beim Dispatch noch nicht da.
    const dispatchBlocks = pageSource.split('quick-capture:open-share').slice(1)
    expect(dispatchBlocks.length).toBeGreaterThan(0)
    for (const block of dispatchBlocks) {
      const before = pageSource.slice(0, pageSource.indexOf(block))
      expect(before.includes('setTimeout')).toBe(true)
    }
  })
})
