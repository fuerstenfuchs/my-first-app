import { describe, it, expect } from 'vitest'
import {
  neuFertige, standMerken, fertigTitel, meldung, istFertig,
  type WachJob, type JobStand,
} from './fertig-melden'

const job = (id: string, status: JobStand, bilder: string[] = []): WachJob =>
  ({ id, status, result_paths: bilder })

describe('istFertig', () => {
  it('kennt genau zwei Endzustände', () => {
    expect(istFertig('done')).toBe(true)
    expect(istFertig('failed')).toBe(true)
    expect(istFertig('queued')).toBe(false)
    expect(istFertig('running')).toBe(false)
  })
})

describe('neuFertige', () => {
  it('meldet den Übergang von „in Arbeit" auf „fertig"', () => {
    const vorher = standMerken([job('a', 'running')])
    expect(neuFertige(vorher, [job('a', 'done')]).map(j => j.id)).toEqual(['a'])
  })

  it('meldet auch von „wartet" direkt auf „fertig"', () => {
    // Zwischen zwei Abfragen liegen fünf Sekunden — ein kurzer Auftrag kann
    // „running" ueberspringen, ohne dass wir ihn je dabei gesehen haben.
    const vorher = standMerken([job('a', 'queued')])
    expect(neuFertige(vorher, [job('a', 'done')])).toHaveLength(1)
  })

  /*
   * DAS IST DIE WICHTIGSTE ZEILE DER GANZEN DATEI.
   * Wer beim Seitenaufruf einfach alle fertigen Auftraege meldet, ueberschuettet
   * Mark bei JEDEM Laden mit Meldungen ueber Bilder von gestern. Nach zwei
   * Malen schaut er nicht mehr hin — und dann ist das Feature schlechter als
   * keines.
   */
  it('meldet beim ersten Blick GAR NICHTS, auch wenn alles fertig ist', () => {
    const nochNichtsGesehen = new Map<string, JobStand>()
    const alles = [job('a', 'done'), job('b', 'done'), job('c', 'failed')]
    expect(neuFertige(nochNichtsGesehen, alles)).toEqual([])
  })

  it('meldet einen bereits fertigen Auftrag nicht ein zweites Mal', () => {
    const vorher = standMerken([job('a', 'done')])
    expect(neuFertige(vorher, [job('a', 'done')])).toEqual([])
  })

  it('meldet Fehlschläge mit — gerade dort wartet man am längsten vergeblich', () => {
    const vorher = standMerken([job('a', 'running')])
    expect(neuFertige(vorher, [job('a', 'failed')]).map(j => j.id)).toEqual(['a'])
  })

  it('schweigt, solange nichts fertig ist', () => {
    const vorher = standMerken([job('a', 'queued')])
    expect(neuFertige(vorher, [job('a', 'running')])).toEqual([])
  })

  it('erkennt mehrere auf einmal — eine Einstellungsreihe wird zusammen fertig', () => {
    const vorher = standMerken([job('a', 'running'), job('b', 'running'), job('c', 'queued')])
    const jetzt  = [job('a', 'done'), job('b', 'done'), job('c', 'running')]
    expect(neuFertige(vorher, jetzt).map(j => j.id)).toEqual(['a', 'b'])
  })

  it('ein wieder eingereihter Auftrag kann erneut melden', () => {
    // „Erneut einreihen" setzt done/failed zurueck auf queued. Wird er dann
    // fertig, ist das eine echte Neuigkeit.
    const vorher = standMerken([job('a', 'queued')])
    expect(neuFertige(vorher, [job('a', 'done')])).toHaveLength(1)
  })
})

describe('fertigTitel', () => {
  it('lässt den Titel in Ruhe, wenn nichts ansteht', () => {
    expect(fertigTitel(0)).toBe('Prompt Trésor')
    expect(fertigTitel(-1)).toBe('Prompt Trésor')
  })

  it('stellt die Zahl VORAN — in der Reiterleiste ist nur der Anfang zu sehen', () => {
    expect(fertigTitel(1)).toBe('(1) Bild fertig · Prompt Trésor')
    expect(fertigTitel(5)).toBe('(5) Bilder fertig · Prompt Trésor')
    expect(fertigTitel(1).startsWith('(1)')).toBe(true)
  })
})

describe('meldung', () => {
  it('sagt nichts, wenn nichts fertig wurde', () => {
    expect(meldung([])).toBeNull()
  })

  it('nennt bei Erfolg die Zahl und nimmt das erste Bild als Vorschau', () => {
    const m = meldung([job('a', 'done', ['x/1.png']), job('b', 'done', ['x/2.png'])])!
    expect(m.titel).toBe('2 Bilder fertig')
    expect(m.bild).toBe('x/1.png')
    expect(m.fehler).toBe(false)
  })

  it('nimmt das Bild des ERSTEN Auftrags, der wirklich eines hat', () => {
    const m = meldung([job('a', 'done', []), job('b', 'done', ['x/2.png'])])!
    expect(m.bild).toBe('x/2.png')
  })

  it('meldet einen reinen Fehlschlag als Fehler, ohne Vorschaubild', () => {
    const m = meldung([job('a', 'failed')])!
    expect(m.titel).toBe('Ein Auftrag ist gescheitert')
    expect(m.fehler).toBe(true)
    expect(m.bild).toBeNull()
  })

  it('nennt beide Zahlen, wenn Erfolg und Fehlschlag zusammenfallen', () => {
    const m = meldung([job('a', 'done', ['x/1.png']), job('b', 'failed')])!
    expect(m.titel).toBe('1 fertig, 1 gescheitert')
    expect(m.fehler).toBe(true)
    // Trotz des Fehlers das Vorschaubild des gelungenen zeigen.
    expect(m.bild).toBe('x/1.png')
  })

  it('unterscheidet Einzahl und Mehrzahl', () => {
    expect(meldung([job('a', 'done')])!.titel).toBe('Bild fertig')
    expect(meldung([job('a', 'failed'), job('b', 'failed')])!.titel)
      .toBe('2 Aufträge sind gescheitert')
  })
})
