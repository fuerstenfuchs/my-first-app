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

  it('FAB und Modal hängen an derselben Hook-Instanz', () => {
    // Sonst öffnet der Knopf ein anderes Modal als das gerenderte, und alle
    // Einzelprüfungen oben bestünden trotzdem.
    const prefixOf = (prop: string, value: string) => {
      const m = layoutSource.match(
        new RegExp(prop + String.raw`=\{\s*(\w+\.)?` + value + String.raw`\s*\}`),
      )
      return m?.[1] ?? ''
    }
    const prefixes = [
      prefixOf('onOpen', 'open'),
      prefixOf('isOpen', 'isOpen'),
      prefixOf('onClose', 'close'),
      prefixOf('initialValues', 'initialValues'),
    ]
    expect(new Set(prefixes).size, `uneinheitliche Herkunft: ${prefixes.join(' / ')}`).toBe(1)
  })
})

describe('Startseite — der Share-Weg feuert weiterhin an das Layout', () => {
  const pageSource = readSource('src/app/(app)/page.tsx')

  it('verschickt quick-capture:open-share', () => {
    expect(pageSource).toContain('quick-capture:open-share')
  })

  it('verzögert JEDEN Dispatch, weil Child-Effects vor Parent-Effects laufen', () => {
    // Ohne setTimeout(…, 0) wäre der Listener im Layout beim Dispatch noch nicht da.
    // Es wird ein enges Fenster direkt vor jedem Vorkommen geprüft: Eine Prüfung
    // gegen "irgendwo vorher in der Datei" würde ab dem zweiten Dispatch immer
    // bestehen, weil der setTimeout des ersten schon dasteht.
    const positions: number[] = []
    for (let i = pageSource.indexOf('quick-capture:open-share'); i !== -1;
         i = pageSource.indexOf('quick-capture:open-share', i + 1)) {
      positions.push(i)
    }
    expect(positions.length).toBeGreaterThan(0)
    for (const pos of positions) {
      const window_ = pageSource.slice(Math.max(0, pos - 200), pos)
      expect(
        window_.includes('setTimeout'),
        `Dispatch an Position ${pos} ist nicht per setTimeout verzögert`,
      ).toBe(true)
    }
  })
})

describe('Ereignisname stimmt an beiden Enden überein', () => {
  // Der Wächter soll Verdrahtungsfehler finden. Würde nur geprüft, dass beide
  // Seiten irgendein Ereignis benutzen, könnte eine Umbenennung im Hook die
  // Kette zerreißen, ohne dass ein Test rot wird.
  const EVENT = 'quick-capture:open-share'

  it('der Hook hört auf genau dieses Ereignis', () => {
    const hookSource = readSource('src/hooks/use-quick-capture.ts')
    expect(hookSource).toContain(`addEventListener('${EVENT}'`)
    expect(hookSource).toContain(`removeEventListener('${EVENT}'`)
  })

  it('das Modal meldet den gespeicherten Prompt zurück', () => {
    const modalSource = readSource('src/components/prompts/quick-capture-modal.tsx')
    expect(modalSource).toContain('quick-capture:saved')
    // cancelable, damit die Startseite quittieren kann und keine zweite
    // Erfolgsmeldung entsteht — siehe Kommentar im Modal.
    expect(modalSource).toContain('cancelable: true')
    expect(readSource('src/app/(app)/page.tsx')).toContain('quick-capture:saved')
  })
})
