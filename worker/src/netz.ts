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
/**
 * Der Satz, an dem `index.ts` den Autostart-Wettlauf erkennt.
 *
 * Arbeiter und Bild-Proxy liegen beide im Autostart, und der Arbeiter ist
 * schneller da. Ein Auftrag, der in diese Lücke fällt, wird zurückgestellt
 * statt als Fehlversuch gezählt — sonst verbrennen drei Anläufe in wenigen
 * Sekunden.
 *
 * WARUM ALS KONSTANTE: Die Erkennung ist eine Textprobe
 * (`fehler.message.includes(...)`). Solange der Satz in jeder Anbindung neu
 * getippt wird, greift der Schutz für die eine und nicht für die andere —
 * genau das war beim Gemini-Weg der Fall.
 */
export const PROXY_UNERREICHBAR = 'Der Proxy war nicht erreichbar'

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
/**
 * Die Signaturen, die wir lesen koennen.
 *
 * WARUM DAS AM 04.09.2026 UEBERARBEITET WURDE: Hier standen nur PNG, JPEG und
 * WEBP — und die WEBP-Pruefung sah nur `RIFF`, die ersten vier Bytes. Das ist
 * auch der Anfang einer WAV- und einer AVI-Datei. Ein GIF wurde gar nicht
 * erkannt, obwohl das Bildmodell es annimmt, und AVIF und HEIC blieben
 * namenlos, obwohl gerade sie den Fehler ausloesen.
 */
export type Bildart = {
  name: string
  endung: string
  typ: string
  /** Nimmt das Bildmodell dieses Format direkt an? */
  vomModell: boolean
}

/** Was `/v1/images/edits` als Vorlage annimmt. */
export const MODELL_TYPEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

/**
 * Was fuer ein Bild ist das — oder null, wenn es keins ist.
 *
 * Damit wird auch die Ablage ehrlich: Ein JPEG unter dem Namen `0.png` mit
 * `Content-Type: image/png` zeigt der Browser zwar richtig an (er raet), aber
 * ein Bildprogramm oder eine Druckerei lehnt es ab.
 */
export function bildart(daten: ArrayBuffer | Buffer): Bildart | null {
  const b = daten instanceof Buffer ? daten : new Uint8Array(daten)
  if (b.length < 12) return null

  const art = (name: string, endung: string, typ: string): Bildart =>
    ({ name, endung, typ, vomModell: (MODELL_TYPEN as readonly string[]).includes(typ) })

  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return art('PNG', 'png', 'image/png')
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return art('JPEG', 'jpg', 'image/jpeg')
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return art('GIF', 'gif', 'image/gif')
  if (b[0] === 0x42 && b[1] === 0x4d) return art('BMP', 'bmp', 'image/bmp')
  // RIFF....WEBP — die Marke dahinter entscheidet, sonst waere eine WAV-Datei
  // ein Bild.
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return art('WEBP', 'webp', 'image/webp')
  }
  // ....ftyp… — AVIF und HEIC teilen sich den Rahmen, die Marke steht dahinter
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const marke = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!)
    if (marke.startsWith('avif') || marke.startsWith('avis')) return art('AVIF', 'avif', 'image/avif')
    if (marke.startsWith('heic') || marke.startsWith('heix') || marke.startsWith('mif1')) {
      return art('HEIC', 'heic', 'image/heic')
    }
  }
  return null
}
