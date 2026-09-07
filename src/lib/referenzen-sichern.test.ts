import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { referenzenSichern, sicherungsMeldung } from './referenzen-sichern'

/**
 * Mark am 07.09.2026: „Das sollte finalisiert werden, dass die Bilder auf jeden
 * Fall genommen werden, egal wo sie herkommen und welche Endung sie haben."
 *
 * Die teure Stelle ist die REIHENFOLGE: Die Zuordnungszeilen im Prompt sagen
 * „Image 1 = …, Image 2 = …". Käme die Liste umsortiert zurück, trüge jedes
 * Bild das falsche Etikett — und das sähe man dem Ergebnis nicht als Fehler an.
 */

const EIGEN = 'https://gsfrbxdesarlhfijmguu.supabase.co'
const eigen = (n: string) => `${EIGEN}/storage/v1/object/public/bilder/${n}`
const GEHOLT = eigen('geholt.jpg')

let holen: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', EIGEN)
  holen = vi.fn(async () => ({ ok: true, json: async () => ({ url: GEHOLT }) }))
  vi.stubGlobal('fetch', holen)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('referenzenSichern', () => {
  it('laesst eigene Adressen unangetastet und fragt gar nicht erst nach', () => {
    return referenzenSichern([eigen('a.jpg'), eigen('b.png')]).then(s => {
      expect(s.urls).toEqual([eigen('a.jpg'), eigen('b.png')])
      expect(s.geholt).toBe(0)
      expect(holen).not.toHaveBeenCalled()
    })
  })

  it('holt eine fremde Adresse und setzt die neue an dieselbe Stelle', async () => {
    const s = await referenzenSichern([eigen('a.jpg'), 'https://fremd.example/x', eigen('c.jpg')])
    expect(s.urls).toEqual([eigen('a.jpg'), GEHOLT, eigen('c.jpg')])
    expect(s.geholt).toBe(1)
    expect(s.gescheitert).toEqual([])
  })

  it('behaelt die Reihenfolge auch bei mehreren fremden', async () => {
    // Die Zuordnungszeilen im Prompt sind stellungsgebunden. Eine umsortierte
    // Liste haenge jedem Bild das falsche Etikett an.
    holen.mockImplementation(async (_u: string, o: { body: string }) => {
      const { url } = JSON.parse(o.body) as { url: string }
      return { ok: true, json: async () => ({ url: eigen(`${url.slice(-1)}.jpg`) }) }
    })
    const s = await referenzenSichern(['https://f/1', eigen('mitte.jpg'), 'https://f/2'])
    expect(s.urls).toEqual([eigen('1.jpg'), eigen('mitte.jpg'), eigen('2.jpg')])
  })

  it('LAESST STEHEN, was sich nicht holen laesst', async () => {
    /*
      Es hier stillschweigend zu entfernen hiesse, einen Auftrag mit weniger
      Referenzen abzuschicken, als der Prompt beschreibt — und der Prompt sagt
      „Image 2 = …" fuer ein Bild, das dann gar nicht mitgeht.
    */
    holen.mockResolvedValue({ ok: false, json: async () => ({ fehler: 'weg' }) })
    const s = await referenzenSichern(['https://tot.example/x'])
    expect(s.urls).toEqual(['https://tot.example/x'])
    expect(s.geholt).toBe(0)
    expect(s.gescheitert).toEqual(['https://tot.example/x'])
  })

  it('faengt einen Netzfehler ab, statt den Auftrag zu verlieren', async () => {
    holen.mockRejectedValue(new Error('offline'))
    const s = await referenzenSichern(['https://fremd.example/x'])
    expect(s.gescheitert).toHaveLength(1)
    expect(s.urls).toHaveLength(1)
  })

  it('weist eine Antwort ohne Adresse ab', async () => {
    holen.mockResolvedValue({ ok: true, json: async () => ({}) })
    const s = await referenzenSichern(['https://fremd.example/x'])
    expect(s.geholt).toBe(0)
    expect(s.gescheitert).toHaveLength(1)
  })
})

describe('sicherungsMeldung', () => {
  it('schweigt, wenn alles schon im eigenen Speicher lag', () => {
    expect(sicherungsMeldung({ urls: [], geholt: 0, gescheitert: [] })).toBeNull()
  })

  it('sagt, wie viele geholt wurden', () => {
    expect(sicherungsMeldung({ urls: [], geholt: 1, gescheitert: [] }))
      .toContain('Ein Referenzbild')
    expect(sicherungsMeldung({ urls: [], geholt: 3, gescheitert: [] }))
      .toContain('3 Referenzbilder')
  })

  it('sagt auch, was NICHT ging — das entscheidet ueber das Ergebnis', () => {
    const m = sicherungsMeldung({ urls: [], geholt: 1, gescheitert: ['a'] })!
    expect(m).toContain('geholt')
    expect(m).toContain('wird es ablehnen')
  })
})
