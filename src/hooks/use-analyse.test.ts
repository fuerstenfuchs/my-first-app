import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analysiere } from './use-analyse'
import { PROXY_SPEICHER_SCHLUESSEL } from '@/lib/proxy-analyse'

/**
 * Gegenprobe zum Rueckfall.
 *
 * WARUM DIESE TESTS EXISTIEREN: Der Rueckfall auf die bezahlte Route ist genau
 * der Fall, den man beim Bauen NICHT sieht — beim Entwickeln laeuft der Proxy.
 * Ein Weg, der nie absichtlich zum Scheitern gebracht wurde, ist ein Weg, von
 * dem niemand weiss, ob er funktioniert. Also wird hier der Proxy mit Absicht
 * kaputtgemacht und nachgesehen, ob die Route uebernimmt — und ob es dabei
 * nicht still bleibt.
 */

const infoMeldungen: string[] = []
vi.mock('sonner', () => ({
  toast: {
    info: (text: string) => { infoMeldungen.push(text) },
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

/**
 * Das jsdom dieser Testumgebung hat KEIN localStorage — nachgemessen, nicht
 * vermutet. Also wird hier eines untergeschoben. Nebenbei ist das der Beweis,
 * dass der Code eine fehlende Ablage aushaelt: ohne die try/catch in
 * `proxy-analyse.ts` waere schon der erste Testlauf gestorben.
 */
const ablage = new Map<string, string>()
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => ablage.get(k) ?? null,
    setItem: (k: string, v: string) => { ablage.set(k, v) },
    removeItem: (k: string) => { ablage.delete(k) },
    clear: () => { ablage.clear() },
  },
})

const BILD = { imageBase64: 'AAAA', mediaType: 'image/png' }

function proxyEinrichten() {
  window.localStorage.setItem(PROXY_SPEICHER_SCHLUESSEL, JSON.stringify({
    url: 'http://127.0.0.1:8317', token: 'geheim', modell: 'claude-opus-4-6',
  }))
}

describe('analysiere', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    infoMeldungen.length = 0
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('geht ohne eingerichteten Proxy direkt und lautlos über die Route', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ name: 'Test' }) } as Response)

    const { ergebnis, weg } = await analysiere<{ name: string }>('pose', BILD, { route: '/api/analyze-pose' })

    expect(weg).toBe('route')
    expect(ergebnis.name).toBe('Test')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('/api/analyze-pose')
    // Kein Hinweis: Es ist kein Rueckfall, sondern der normale Zustand.
    expect(infoMeldungen).toHaveLength(0)
  })

  it('nimmt den Proxy, wenn er eingerichtet ist und antwortet', async () => {
    proxyEinrichten()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '{"name":"Aus dem Proxy"}' } }] }),
    } as Response)

    const { ergebnis, weg } = await analysiere<{ name: string }>('pose', BILD, { route: '/api/analyze-pose' })

    expect(weg).toBe('proxy')
    expect(ergebnis.name).toBe('Aus dem Proxy')
    // Gerufen wird `localhost`, OBWOHL in den Einstellungen die Zahlenadresse
    // steht: Chrome braucht auf `127.0.0.1` zwanzig Sekunden und auf
    // `localhost` vier Millisekunden — am 03.09.2026 im Browser nachgemessen.
    // Die Umschreibung passiert in `basis()`. Wer sie herausnimmt, weil sie
    // ueberfluessig aussieht, macht die Analyse wieder zwanzig Sekunden lang.
    expect(String(mockFetch.mock.calls[0][0])).toContain('localhost:8317')
    expect(String(mockFetch.mock.calls[0][0])).not.toContain('127.0.0.1')
  })

  // ── Die eigentliche Gegenprobe: Proxy absichtlich kaputt ──────────────────
  it('fällt bei totem Proxy auf die Route zurück UND sagt es', async () => {
    proxyEinrichten()
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ name: 'Von der Route' }) } as Response)

    const { ergebnis, weg } = await analysiere<{ name: string }>('pose', BILD, { route: '/api/analyze-pose' })

    expect(weg).toBe('route')
    expect(ergebnis.name).toBe('Von der Route')
    expect(mockFetch).toHaveBeenCalledTimes(2)
    // Der Hinweis ist der Punkt: Hier ist gerade Geld geflossen.
    expect(infoMeldungen).toHaveLength(1)
    expect(infoMeldungen[0]).toContain('Proxy')
  })

  it('lässt den Proxy aus, wenn nur eine Bild-URL vorliegt', async () => {
    proxyEinrichten()
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ name: 'Test' }) } as Response)

    const { weg } = await analysiere('location', { imageUrl: 'https://example.test/b.jpg' }, { route: '/api/analyze-location' })

    expect(weg).toBe('route')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe('/api/analyze-location')
  })

  it('schält bei Textanalysen das `prompt`-Feld der Route heraus', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ prompt: 'ein Prompt' }) } as Response)

    const { ergebnis } = await analysiere<string>('bild', BILD, { route: '/api/analyze-image' })

    expect(ergebnis).toBe('ein Prompt')
  })

  it('reicht den Fehler der Route durch, statt still ein leeres Ergebnis zu liefern', async () => {
    mockFetch.mockResolvedValue({
      ok: false, status: 503,
      json: () => Promise.resolve({ error: 'API key not configured' }),
    } as Response)

    await expect(analysiere('pose', BILD, { route: '/api/analyze-pose' }))
      .rejects.toThrow('API key not configured')
  })
})
