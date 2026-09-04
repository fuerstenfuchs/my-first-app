import { describe, it, expect } from 'vitest'
import {
  arbeiterLage, dauerText, LANGLAEUFER_SEKUNDEN, HAENGT_SEKUNDEN, type LageEingabe,
} from './arbeiter-lage'

const leer: LageEingabe = {
  zustand: 'laeuft', sekundenHer: 5, wartend: 0, inArbeit: 0, laengsterLaufSekunden: null,
}
const lage = (f: Partial<LageEingabe> = {}) => arbeiterLage({ ...leer, ...f })

describe('dauerText', () => {
  it('nennt Sekunden, Minuten und Stunden je nach Größenordnung', () => {
    expect(dauerText(12)).toBe('12 Sek')
    expect(dauerText(90)).toBe('1 Min')
    expect(dauerText(59 * 60)).toBe('59 Min')
    expect(dauerText(2 * 3600)).toBe('2 Std')
  })

  it('nennt bei Stunden die Minuten dazu — sonst klingt es harmloser als es ist', () => {
    // „2 Std" statt „1 Std 52 Min" waere gerundet richtig, verschleiert aber,
    // wie genau die Zahl ist. Genau diese Spanne stand am 04.09.2026 an.
    expect(dauerText(3600 + 52 * 60)).toBe('1 Std 52 Min')
  })
})

describe('arbeiterLage', () => {
  it('schweigt, wenn alles in Ordnung ist', () => {
    expect(lage().art).toBe('still')
    expect(lage({ wartend: 3 }).art).toBe('still')
  })

  it('schweigt bei unbekanntem Zustand — ein Netzaussetzer ist keine Nachricht', () => {
    expect(lage({ zustand: 'unbekannt', wartend: 5, inArbeit: 1 }).art).toBe('still')
  })

  /*
   * DER FALL VOM 04.09.2026, 17:40.
   * Der Arbeiter hielt einen Auftrag fest und meldete sich fast zwei Stunden
   * nicht. Die alte Ampel sagte dazu „Starte den Arbeiter auf dem PC" — er
   * lief aber. Wer liest, dass er starten soll, was schon läuft, hält die
   * Meldung für falsch und übergeht sie.
   */
  it('erkennt den hängenden Arbeiter und sagt NICHT „starte ihn"', () => {
    const l = lage({ zustand: 'weg', sekundenHer: 6749, inArbeit: 1, wartend: 2 })
    expect(l.art).toBe('alarm')
    if (l.art === 'still') throw new Error('unerwartet still')
    expect(l.titel).toBe('Der Arbeiter hängt')
    expect(l.text).toContain('1 Std 52 Min')
    expect(l.text).toContain('kommt aber nicht weiter')
    expect(l.befehl).toBe('cd worker && npm start')
  })

  it('der hängende Fall gewinnt gegen den wartenden — er ist die genauere Auskunft', () => {
    const lang = HAENGT_SEKUNDEN + 60
    const nurWartend = lage({ zustand: 'weg', sekundenHer: lang, wartend: 3 })
    const auchInArbeit = lage({ zustand: 'weg', sekundenHer: lang, wartend: 3, inArbeit: 1 })
    if (nurWartend.art === 'still' || auchInArbeit.art === 'still') throw new Error('unerwartet still')
    expect(nurWartend.titel).toBe('Der Arbeiter ist stumm')
    expect(auchInArbeit.titel).toBe('Der Arbeiter hängt')
  })

  /*
   * DER FEHLALARM, DEN DIE PRUEFUNG AM 04.09.2026 GEFUNDEN HAT.
   *
   * Der Arbeiter schrieb sein Lebenszeichen nur ZWISCHEN zwei Auftraegen —
   * waehrend eines Bildes (ein bis drei Minuten, bei vier Durchlaeufen bis
   * zwanzig) kam keines. Mit der 60-Sekunden-Ampelschwelle meldete dieser
   * Kasten deshalb bei JEDER normalen Erzeugung „Der Arbeiter haengt, beenden
   * und neu starten" — und der empfohlene Neustart haette bei fal.ai einen
   * bezahlten Lauf abgebrochen.
   *
   * Die Ursache ist behoben (eigener Takt im Arbeiter). Diese Tests sichern
   * die zweite Haelfte: Selbst mit einer alten Arbeiter-Fassung darf der
   * Alarm bei normaler Arbeit nicht losgehen.
   */
  it('schweigt, solange ein Auftrag NORMAL lange läuft', () => {
    for (const sek of [61, 120, 300, 900, HAENGT_SEKUNDEN - 1]) {
      const l = lage({ zustand: 'weg', sekundenHer: sek, inArbeit: 1 })
      expect(l.art, `${sek}s dürfen keinen Alarm auslösen`).not.toBe('alarm')
    }
  })

  it('meldet den Hänger erst jenseits der eigenen Schwelle', () => {
    expect(lage({ zustand: 'weg', sekundenHer: HAENGT_SEKUNDEN - 1, inArbeit: 1 }).art).not.toBe('alarm')
    expect(lage({ zustand: 'weg', sekundenHer: HAENGT_SEKUNDEN, inArbeit: 1 }).art).toBe('alarm')
  })

  it('die Hänger-Schwelle liegt über dem längsten redlichen Auftrag', () => {
    // Vier Durchlaeufe à 300s Zeitgrenze = 1200s. Alles darunter ist Arbeit,
    // kein Notfall.
    expect(HAENGT_SEKUNDEN).toBeGreaterThan(4 * 300)
  })

  it('ein nie gesehener Arbeiter mit laufendem Auftrag zählt auch als Hänger', () => {
    // Vorher fiel dieser Fall durch: Der Zweig prüfte nur `weg`, und `nie`
    // landete im gelben Hinweis „Er meldet sich nicht."
    const l = lage({ zustand: 'nie', sekundenHer: HAENGT_SEKUNDEN, inArbeit: 1 })
    expect(l.art).toBe('alarm')
  })

  it('schlägt Alarm, wenn Aufträge warten und niemand sie holt', () => {
    const l = lage({ zustand: 'weg', sekundenHer: 300, wartend: 3 })
    expect(l.art).toBe('alarm')
    if (l.art === 'still') throw new Error('unerwartet still')
    expect(l.text).toContain('3 Aufträge warten')
    expect(l.text).toContain('bleiben liegen')
  })

  it('zählt im Singular, wenn es nur einer ist', () => {
    const l = lage({ zustand: 'weg', sekundenHer: 300, wartend: 1 })
    if (l.art === 'still') throw new Error('unerwartet still')
    expect(l.text).toContain('Ein Auftrag wartet')
    expect(l.text).not.toContain('1 Aufträge')
  })

  /*
   * DER UNTERSCHIED, DER DIE GANZE SACHE TRAEGT: Ein stummer Arbeiter ohne
   * Auftraege ist ein ausgeschalteter PC — belanglos. Derselbe stumme Arbeiter
   * mit wartenden Auftraegen ist Stillstand. Vorher sah beides gleich aus.
   */
  it('ist leise, wenn der Arbeiter aus ist und nichts wartet', () => {
    const l = lage({ zustand: 'weg', sekundenHer: 90_000 })
    expect(l.art).toBe('hinweis')
    if (l.art === 'still') throw new Error('unerwartet still')
    expect(l.text).toContain('Gerade wartet nichts')
  })

  it('unterscheidet „noch nie gesehen" von „ist stumm geworden"', () => {
    const nie = lage({ zustand: 'nie', wartend: 2 })
    const weg = lage({ zustand: 'weg', sekundenHer: 300, wartend: 2 })
    if (nie.art === 'still' || weg.art === 'still') throw new Error('unerwartet still')
    expect(nie.titel).toBe('Der Arbeiter läuft nicht')
    expect(nie.text).toContain('noch nie ein Arbeiter gemeldet')
    expect(weg.titel).toBe('Der Arbeiter ist stumm')
  })

  it('meldet einen Langläufer, obwohl der Arbeiter sich meldet', () => {
    const knappDrunter = lage({ inArbeit: 1, laengsterLaufSekunden: LANGLAEUFER_SEKUNDEN - 1 })
    const drueber     = lage({ inArbeit: 1, laengsterLaufSekunden: LANGLAEUFER_SEKUNDEN + 1 })
    expect(knappDrunter.art).toBe('still')
    expect(drueber.art).toBe('hinweis')
    if (drueber.art === 'still') throw new Error('unerwartet still')
    expect(drueber.titel).toContain('dauert ungewöhnlich lange')
  })

  it('ein normal langer Bildauftrag loest nichts aus', () => {
    // Die Zeitgrenze je Bild ist 300 Sekunden, plus Ablegen und bis zu drei
    // Anlaeufe. Fuenf Minuten sind voellig normal und duerfen nicht warnen.
    expect(lage({ inArbeit: 1, laengsterLaufSekunden: 300 }).art).toBe('still')
  })
})
