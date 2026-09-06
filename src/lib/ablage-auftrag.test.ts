import { describe, it, expect } from 'vitest'
import { zuAblegen, abgelegtMarke, ablageMeldung, freizugeben, type AblageJob } from './ablage-auftrag'

const ZIEL = {
  baustein: 'charaktere', parentId: 'c1', parentName: 'Günther Siegle',
  variantId: 'v1', variantName: 'Speicherstadt',
}

function job(p: Partial<AblageJob> = {}): AblageJob {
  return {
    id: 'j1', status: 'done', result_paths: ['u/j1/0.jpg'],
    scene_meta: { ablage: ZIEL, reihe_id: 'r1' },
    ...p,
  }
}

describe('zuAblegen', () => {
  it('nimmt einen fertigen Auftrag mit Ziel', () => {
    const a = zuAblegen([job()])
    expect(a).toHaveLength(1)
    expect(a[0].ziel.variantName).toBe('Speicherstadt')
    expect(a[0].pfade).toEqual(['u/j1/0.jpg'])
  })

  it('laesst Auftraege liegen, die noch nicht fertig sind', () => {
    for (const status of ['queued', 'running', 'failed']) {
      expect(zuAblegen([job({ status })])).toHaveLength(0)
    }
  })

  it('legt nichts zweimal ab', () => {
    // Der Waechter laeuft alle fuenf Sekunden. Ohne diese Marke wanderte
    // dasselbe Bild im Minutentakt erneut in den Ordner.
    expect(zuAblegen([job({ scene_meta: { ablage: ZIEL, abgelegt: true } })])).toHaveLength(0)
  })

  it('ignoriert Auftraege ohne Ziel', () => {
    expect(zuAblegen([job({ scene_meta: { reihe_id: 'r1' } })])).toHaveLength(0)
    expect(zuAblegen([job({ scene_meta: null })])).toHaveLength(0)
  })

  it('ignoriert Auftraege ohne Ergebnis', () => {
    // „Fertig" ohne Pfade waere ein Widerspruch — aber er ist schon
    // vorgekommen, und ein leerer Kopiervorgang wirft mitten im Ablauf.
    expect(zuAblegen([job({ result_paths: null })])).toHaveLength(0)
    expect(zuAblegen([job({ result_paths: [] })])).toHaveLength(0)
    expect(zuAblegen([job({ result_paths: [''] })])).toHaveLength(0)
  })

  it('weist ein unvollstaendiges Ziel ab, statt daran zu scheitern', () => {
    // Ein halbes Ziel fuehrt sonst zu einem Kopiervorgang ins Nichts.
    const kaputt = [
      { ...ZIEL, parentId: '' },
      { ...ZIEL, parentId: undefined },
      { ...ZIEL, baustein: 'outfit' },
      { ...ZIEL, variantName: undefined },
      'Speicherstadt',
      null,
    ]
    for (const ablage of kaputt) {
      expect(zuAblegen([job({ scene_meta: { ablage } })])).toHaveLength(0)
    }
  })

  it('nimmt mehrere Bilder eines Auftrags zusammen', () => {
    const a = zuAblegen([job({ result_paths: ['a.jpg', 'b.jpg', 'c.jpg'] })])
    expect(a[0].pfade).toHaveLength(3)
  })
})

describe('abgelegtMarke', () => {
  it('behaelt die uebrige Szene', () => {
    // Wer hier ersetzt statt mischt, loescht Licht, Kamera und die
    // Kettenkennung — und Lichttisch wie Warteschlange lesen daraus.
    const m = abgelegtMarke({ ablage: ZIEL, reihe_id: 'r1', shot_type: 'wide_shot' })
    expect(m.reihe_id).toBe('r1')
    expect(m.shot_type).toBe('wide_shot')
    expect(m.ablage).toEqual(ZIEL)
    expect(m.abgelegt).toBe(true)
  })

  it('kommt mit fehlender Szene zurecht', () => {
    expect(abgelegtMarke(null)).toEqual({ abgelegt: true })
  })
})

describe('ablageMeldung', () => {
  it('nennt Ordner und Zahl', () => {
    const a = zuAblegen([job(), job({ id: 'j2', result_paths: ['x.jpg', 'y.jpg'] })])
    expect(ablageMeldung(a)).toBe('3 Bilder wurden bei Günther Siegle › Speicherstadt abgelegt.')
  })

  it('zaehlt Ordner, wenn es mehrere sind', () => {
    const a = zuAblegen([
      job(),
      job({ id: 'j2', scene_meta: { ablage: { ...ZIEL, variantName: 'Reeperbahn' } } }),
    ])
    expect(ablageMeldung(a)).toContain('2 Ordner')
  })

  it('schweigt, wenn nichts abzulegen war', () => {
    expect(ablageMeldung([])).toBeNull()
  })
})

describe('freizugeben', () => {
  it('gibt einen ERFOLGREICHEN Auftrag NICHT wieder frei', () => {
    // Genau das war der Fehler: Nach dem Erfolg fiel die Sperre, und ein
    // Durchgang, der seine Zeilen vor der Marke geholt hatte, legte ein
    // zweites Mal ab. Drei Sekunden spaeter, dasselbe Bild.
    expect(freizugeben([{ jobId: 'j1', ok: true }])).toEqual([])
  })

  it('gibt einen fehlgeschlagenen frei, damit er es erneut versucht', () => {
    expect(freizugeben([{ jobId: 'j1', ok: false }])).toEqual(['j1'])
  })

  it('trennt beide sauber', () => {
    expect(freizugeben([
      { jobId: 'a', ok: true }, { jobId: 'b', ok: false },
      { jobId: 'c', ok: true }, { jobId: 'd', ok: false },
    ])).toEqual(['b', 'd'])
  })
})
