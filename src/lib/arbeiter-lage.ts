/**
 * Was ist mit dem Arbeiter los? (PROJ-57)
 *
 * WARUM DAS NICHT SCHON DIE AMPEL LEISTET: Die Ampel im Kopf der
 * Warteschlange gibt es seit PROJ-41, und sie hat am 04.09.2026 auch das
 * Richtige angezeigt — „Arbeiter zuletzt vor 2 Stunden", in Gelb. Trotzdem ist
 * der Stillstand fast zwei Stunden lang niemandem aufgefallen. Drei Gründe,
 * und alle drei stehen hier zur Reparatur:
 *
 * 1. **Sie ist zu leise.** Ein 10px-Abzeichen im Kopf, gelb, neben dem Titel.
 *    Wer auf die Auftragsliste schaut, sieht es nicht.
 * 2. **Sie sagt das Falsche.** Der Hinweistext lautet „Starte den Arbeiter auf
 *    dem PC" — der Arbeiter LIEF aber. Er hing. Wer liest, dass er starten
 *    soll, was schon läuft, hält die Meldung für falsch und übergeht sie.
 * 3. **Sie verknüpft nichts.** Ein stummer Arbeiter ohne Aufträge ist
 *    belanglos. Ein stummer Arbeiter, während drei Aufträge warten, ist ein
 *    Stillstand. Beides sah gleich aus.
 *
 * Diese Funktion ist deshalb keine Ampel, sondern eine Lagebeurteilung: Sie
 * bekommt Arbeiterzustand UND Warteschlange und sagt, wie laut zu sein ist.
 */

export type ArbeiterZustand = 'laeuft' | 'weg' | 'nie' | 'unbekannt'

export type Lage =
  | { art: 'still' }
  | { art: 'hinweis'; titel: string; text: string; befehl?: string }
  | { art: 'alarm';   titel: string; text: string; befehl?: string }

export interface LageEingabe {
  zustand: ArbeiterZustand
  /** Sekunden seit dem letzten Lebenszeichen. Bei 'nie'/'unbekannt' egal. */
  sekundenHer: number
  /** Aufträge mit Status `queued`. */
  wartend: number
  /** Aufträge mit Status `running`. */
  inArbeit: number
  /**
   * Wie lange der am längsten laufende Auftrag schon läuft, in Sekunden.
   * `null`, wenn keiner läuft.
   */
  laengsterLaufSekunden: number | null
}

const NEUSTART = 'cd worker && npm start'

/**
 * Ab wann ein laufender Auftrag auch bei lebendigem Arbeiter zu lange dauert.
 *
 * Die Zeitgrenze je Bild ist `REQUEST_TIMEOUT_MS` = 300 Sekunden, und danach
 * kommen noch Ablegen und bis zu drei Anläufe. 20 Minuten sind also reichlich
 * Luft — wer sie überschreitet, hängt wirklich.
 */
export const LANGLAEUFER_SEKUNDEN = 20 * 60

/**
 * Ab wann Stille bei einem laufenden Auftrag wirklich „er hängt" bedeutet.
 *
 * NICHT die 60 Sekunden der Ampel. Die beantworten „meldet er sich gerade?" —
 * eine ganz andere Frage.
 *
 * WARUM DAS EINE EIGENE ZAHL BRAUCHT (Prüfbefund 04.09.2026): Der Arbeiter
 * schrieb sein Lebenszeichen bis dahin nur zwischen zwei Aufträgen. Während
 * eines Bildes — ein bis drei Minuten, bei vier Durchläufen bis zwanzig — kam
 * keines. Mit der 60-Sekunden-Schwelle meldete dieser Kasten deshalb bei JEDER
 * normalen Erzeugung „Der Arbeiter hängt, beenden und neu starten". Ein Alarm,
 * der bei normaler Arbeit losgeht, wird weggeklickt; dann ist er schlechter
 * als keiner.
 *
 * Der Arbeiter meldet sich seit dem 04.09.2026 auf eigenem Takt, damit ist die
 * Ursache behoben. Diese Schwelle bleibt trotzdem — als Netz für den Fall,
 * dass eine ÄLTERE Fassung des Arbeiters läuft. Genau das ist wahrscheinlich:
 * Mark startet ihn von Hand, und die App wird ohne ihn ausgeliefert.
 *
 * 25 Minuten liegen über dem längsten redlichen Auftrag (vier Durchläufe à
 * 300 s Zeitgrenze) und unter `STALE_MINUTES = 30`, ab dem der Arbeiter selbst
 * aufräumt.
 */
export const HAENGT_SEKUNDEN = 25 * 60

/** „1 Std 52 Min" — genau genug, um die Tragweite zu sehen. */
export function dauerText(sekunden: number): string {
  if (sekunden < 60) return `${Math.max(0, Math.round(sekunden))} Sek`
  const min = Math.floor(sekunden / 60)
  if (min < 60) return `${min} Min`
  const std = Math.floor(min / 60)
  const rest = min % 60
  return rest === 0 ? `${std} Std` : `${std} Std ${rest} Min`
}

export function arbeiterLage(e: LageEingabe): Lage {
  // Ein Netzaussetzer beim Lesen des Status ist keine Nachricht über den
  // Arbeiter. Lieber schweigen als falsch alarmieren.
  if (e.zustand === 'unbekannt') return { art: 'still' }

  const offen = e.wartend + e.inArbeit

  /*
    Der Fall vom 04.09.2026: Er lebt laut Prozessliste, meldet sich aber nicht
    mehr, und hält dabei einen Auftrag fest. Das ist KEIN „starte ihn",
    sondern ein „er hängt".

    ERST NACH `HAENGT_SEKUNDEN`, nicht schon nach der Ampelschwelle — ein
    laufender Auftrag ist der Normalfall, kein Notfall. Siehe die Begründung
    an der Konstanten.
  */
  if ((e.zustand === 'weg' || e.zustand === 'nie')
      && e.inArbeit > 0
      && e.sekundenHer >= HAENGT_SEKUNDEN) {
    return {
      art: 'alarm',
      titel: 'Der Arbeiter hängt',
      text: `${e.inArbeit === 1 ? 'Ein Auftrag steht' : `${e.inArbeit} Aufträge stehen`} auf „in Arbeit", `
        + `aber der Arbeiter meldet sich seit ${dauerText(e.sekundenHer)} nicht. `
        + 'Er läuft vielleicht noch, kommt aber nicht weiter — beenden und neu starten.',
      befehl: NEUSTART,
    }
  }

  if ((e.zustand === 'weg' || e.zustand === 'nie') && e.wartend > 0) {
    return {
      art: 'alarm',
      titel: e.zustand === 'nie' ? 'Der Arbeiter läuft nicht' : 'Der Arbeiter ist stumm',
      text: `${e.wartend === 1 ? 'Ein Auftrag wartet' : `${e.wartend} Aufträge warten`}, `
        + (e.zustand === 'nie'
          ? 'aber es hat sich noch nie ein Arbeiter gemeldet.'
          : `aber der Arbeiter meldet sich seit ${dauerText(e.sekundenHer)} nicht.`)
        + ' Sie bleiben liegen, bis er wieder läuft.',
      befehl: NEUSTART,
    }
  }

  // Stumm, aber nichts zu tun: erwähnenswert, kein Alarm. Genau so sieht ein
  // normal ausgeschalteter PC aus.
  if (e.zustand === 'weg' || e.zustand === 'nie') {
    return {
      art: 'hinweis',
      titel: e.zustand === 'nie' ? 'Arbeiter noch nie gesehen' : 'Arbeiter ist aus',
      text: offen === 0
        ? 'Gerade wartet nichts — sobald du etwas einreihst, muss er laufen.'
        : 'Er meldet sich nicht.',
      befehl: NEUSTART,
    }
  }

  // ── Er meldet sich, aber ein Auftrag steht ungewöhnlich lange.
  if (e.laengsterLaufSekunden !== null && e.laengsterLaufSekunden > LANGLAEUFER_SEKUNDEN) {
    return {
      art: 'hinweis',
      titel: 'Ein Auftrag dauert ungewöhnlich lange',
      text: `Seit ${dauerText(e.laengsterLaufSekunden)} in Arbeit. `
        + 'Der Arbeiter meldet sich zwar, kommt bei diesem Auftrag aber offenbar nicht weiter.',
    }
  }

  return { art: 'still' }
}
