/**
 * Die zwei Wege beim Vergrößern — an einer Stelle.
 *
 * WARUM DIESE DATEI EXISTIERT: Preis und Beschriftung standen zuerst zweimal
 * da — einmal im Menü auf der Ergebniskachel, einmal in der Bestätigung, die
 * 200 ms später erscheint. Das Menü nannte für 4× „ca. 2 ct", die Bestätigung
 * für jeden Faktor „rund einen halben Cent". Der Nutzer klickte auf zwei Cent
 * und las eine Sekunde später einen halben. Zwei Kopien einer Zahl driften
 * zuverlässig auseinander, und bei einer Preisangabe ist das kein Schönheits-
 * fehler.
 */

/**
 * Womit vergrößert wird.
 *
 * `lanczos` rechnet der PC selbst und kostet nichts — es verteilt vorhandene
 * Bildpunkte, erfindet aber keine Details. `seedvr2` ist ByteDances Modell
 * über fal.ai: Es rekonstruiert Haut, Haar und Stoff, und es kostet Geld.
 */
export type Upscaler = 'lanczos' | 'seedvr2'

export const VERFAHREN_NAME: Record<Upscaler, string> = {
  lanczos: 'Rechnen',
  seedvr2: 'KI (SeedVR2)',
}

/**
 * Was ein KI-Lauf ungefähr kostet, je Faktor.
 *
 * fal.ai rechnet nach Megapixeln ab ($0.001/MP). Aus 1536×864 werden bei 2×
 * 5,3 MP und bei 4× 21,2 MP — daher der Sprung. Gerundet und mit „ca.", weil
 * es von der Ausgangsgröße abhängt und der Kurs schwankt; zwei Nachkomma-
 * stellen würden eine Genauigkeit vorgeben, die es nicht gibt.
 *
 * Bei einem großen quadratischen Quellbild kann 4× auch das Doppelte kosten.
 * Deshalb steht bei der Bestätigung „bis" und nicht „genau".
 */
export const KI_PREIS: Record<2 | 3 | 4, string> = {
  2: 'ca. 0,5 ct',
  3: 'ca. 1 ct',
  4: 'ca. 2 ct',
}

/** Ein Satz für Bestätigungen — dieselbe Zahl wie im Menü. */
export function kostenSatz(verfahren: Upscaler, faktor: 2 | 3 | 4): string {
  return verfahren === 'seedvr2'
    ? `SeedVR2 über fal.ai — rekonstruiert Details, kostet ${KI_PREIS[faktor]}.`
    : 'Der Arbeiter rechnet sie auf dem PC — das kostet nichts.'
}
