/**
 * Die zwei Handgriffe, die JEDE Anbindung an eine Gegenstelle braucht.
 *
 * WARUM ES DIESE DATEI GIBT: Beide Funktionen standen zuerst privat in
 * `fal.ts`, mitsamt ausführlicher Begründung. Beim Bau der Gemini-Anbindung
 * am 02.09.2026 wurde derselbe Fehler trotzdem noch einmal gemacht — die
 * Begründung stand ja in einer anderen Datei, die beim Schreiben der neuen
 * niemand aufschlägt. Critic hat ihn ein zweites Mal gefunden.
 *
 * Eine Regel, die man befolgen MUSS, gehört nicht in einen Kommentar, sondern
 * in eine Funktion, die man aufruft.
 */

/**
 * Abbruch UND Zeitgrenze, nicht das eine oder das andere.
 *
 * Der Fehler, gegen den das hilft, sieht harmlos aus:
 *
 *     signal: signal ?? AbortSignal.timeout(30_000)
 *
 * Damit fällt die Zeitgrenze genau dann weg, wenn ein Abbruchsignal übergeben
 * wird — und der Dauerbetrieb übergibt immer eines. Eine Verbindung, die nie
 * antwortet, blockiert den Arbeiter dann unbegrenzt: kein Fehler, keine
 * Meldung, nur Stille. Und Stille sieht in diesem Projekt genauso aus wie
 * „nichts zu tun".
 *
 * Die beiden Gründe bleiben unterscheidbar: Abbruch von außen wirft AbortError
 * (index.ts stellt den Auftrag zurück, ohne einen Versuch zu verbrauchen), die
 * Zeitgrenze wirft TimeoutError (zählt als Fehlversuch).
 */
export function mitFrist(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const frist = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, frist]) : frist
}

/**
 * Netzfehler in etwas übersetzen, das der Aufrufer unterscheiden kann.
 *
 * Der Grund für den vorletzten Fall: Trifft der Abbruch, WÄHREND der
 * Antwortrumpf gelesen wird, wirft undici einen TypeError („terminated")
 * statt eines AbortError. `index.ts` erkennt den nicht — der Auftrag würde als
 * fehlgeschlagen gelten statt zurückgestellt zu werden. Bei einem bezahlten
 * Auftrag heißt das einen zusätzlichen bezahlten Neuversuch, bei einem
 * kostenlosen einen verbrannten Versuch von dreien.
 *
 * `saeubern` entfernt Geheimnisse aus dem Text — jede Anbindung reicht dafür
 * ihr eigenes `ohneGeheimnis` herein.
 */
export function uebersetzeFehler(
  fehler: Error,
  signal: AbortSignal | undefined,
  ms: number,
  wer: string,
  saeubern: (text: string) => string,
): Error {
  if (fehler.name === 'TimeoutError') {
    return new Error(`${wer} hat nach ${Math.round(ms / 1000)}s nicht geantwortet.`)
  }
  if (fehler.name === 'AbortError') return fehler
  if (signal?.aborted) return new DOMException('Abgebrochen', 'AbortError')
  return new Error(saeubern(`${wer} nicht erreichbar: ${fehler.message}`))
}

/**
 * Erkennungszeichen am Dateianfang — woran man sieht, dass es ein Bild ist.
 *
 * Auch JPEG und WEBP, obwohl überall PNG angefordert wird: Google hat am
 * 02.09.2026 auf eine Anfrage, die PNG erwarten ließ, ein JPEG geliefert. Ein
 * Anbieter, der das Format wechselt, soll keinen Auftrag zum Scheitern
 * bringen — geprüft wird, dass es ein BILD ist, nicht welches.
 */
export const KENNUNGEN: Record<string, { bytes: number[]; endung: string; typ: string }> = {
  PNG:  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], endung: 'png',  typ: 'image/png' },
  JPEG: { bytes: [0xff, 0xd8, 0xff],                               endung: 'jpg',  typ: 'image/jpeg' },
  WEBP: { bytes: [0x52, 0x49, 0x46, 0x46],                         endung: 'webp', typ: 'image/webp' },
}

export type Bildart = { name: string; endung: string; typ: string }

/**
 * Was für ein Bild ist das — oder null, wenn es keins ist.
 *
 * Damit wird auch die Ablage ehrlich: Ein JPEG unter dem Namen `0.png` mit
 * `Content-Type: image/png` zeigt der Browser zwar richtig an (er rät), aber
 * ein strenger Empfänger — Druckerei, Bildprogramm, ImageMagick — lehnt es ab.
 * Der Fehler fällt dann erst außerhalb der App auf.
 */
export function bildart(daten: ArrayBuffer | Buffer): Bildart | null {
  const kopf = daten instanceof Buffer ? daten : new Uint8Array(daten)
  if (kopf.length < 12) return null
  for (const [name, k] of Object.entries(KENNUNGEN)) {
    if (k.bytes.every((b, i) => kopf[i] === b)) {
      return { name, endung: k.endung, typ: k.typ }
    }
  }
  return null
}
