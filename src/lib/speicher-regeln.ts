/**
 * Die Regeln, nach denen ein Bild in den Speicher kommt — EINE Datei für alle.
 *
 * WARUM: Mark hat am 15.09.2026 entschieden, dass Supabase wieder in den freien
 * Tarif (1 GB) passt. Alle großen Bilder wurden dafür durch WebP ersetzt, die
 * Originale liegen in Backblaze. Stand danach: 329 MB. Damit neue Bilder den
 * Speicher nicht wieder füllen, verkleinern jetzt alle Wege VOR dem Hochladen —
 * nach denselben Regeln wie der Umzug.
 *
 * ÜBERNOMMEN AUS DEM UMZUGSSKRIPT (`tresor-schritt3.mjs`, 15.09.2026), Zahl für
 * Zahl: Kante 2048, Streifen über 3:1 mit kurzer Seite 1440 und langer bis
 * 16383, Qualität 82 bzw. 90 bis 1200 px (gemessen am ERGEBNIS), mindestens
 * 30 % Ersparnis, nur PNG und JPEG, nur ab 300 KB, WebP mit alphaQuality 100
 * und effort 5, APNG erkannt am `acTL` vor `IDAT`/`IEND`.
 *
 * NICHT übernommen: Die Sonderregel „großes Sheet über 4096 px auslassen". Sie
 * schützte beim Umzug bezahlte Vergrößerungen, deren Original sonst nirgends
 * lag. Für neue Uploads gilt laut Auftrag vom 15.09.2026: verkleinern.
 *
 * WARUM OHNE EINEN EINZIGEN IMPORT: Diese Datei benutzen der Browser
 * (`bild-fuer-speicher.ts`), der Server (`bild-fuer-speicher-server.ts`), die
 * Chrome-Erweiterung und der Arbeiter. Vier Kopien liefen auseinander — das ist
 * bei der Bildtyp-Erkennung schon einmal passiert (bildart-beispiele.json).
 * Eine Datei ohne Abhängigkeiten lässt sich von allen direkt einbinden. Die
 * Beispiele in `speicher-regeln-beispiele.json` prüfen, dass jede Seite sie
 * gleich anwendet.
 */

export const SPEICHER_REGELN = {
  /** Längste Seite höchstens. */
  laengsteSeite: 2048,
  /** Ab diesem Seitenverhältnis (echt größer) gilt ein Bild als Streifen. */
  streifenAb: 3,
  /** Bei Streifen: kurze Seite höchstens. */
  streifenKurzeSeite: 1440,
  /** Bei Streifen: lange Seite höchstens — das Höchstmaß von WebP. */
  streifenLangeSeite: 16383,
  /** WebP-Qualität. */
  qualitaet: 82,
  /** WebP-Qualität für kleine Bilder — dort fallen Artefakte stärker auf. */
  qualitaetKlein: 90,
  /** Bis zu dieser längsten Seite (des Ergebnisses) gilt `qualitaetKlein`. */
  kleinBis: 1200,
  /** Ersetzt wird nur, wenn die neue Datei mindestens so viel kleiner ist. */
  mindestErsparnis: 0.3,
  /** Kleinere Dateien bleiben, wie sie sind — sie bringen kaum etwas. */
  mindestGroesse: 300 * 1024,
  /** Nur diese Typen werden umgewandelt. GIF, WebP, AVIF, HEIC bleiben. */
  umwandelbar: ['image/png', 'image/jpeg'] as readonly string[],
  /** Für `sharp`: Transparenz verlustfrei, gründlicher kodieren. */
  webpAlphaQualitaet: 100,
  webpAufwand: 5,
} as const

export type Zielmasse = {
  breite: number
  hoehe: number
  qualitaet: number
  /** Ob die Maße kleiner werden. Umgewandelt wird trotzdem, wenn es spart. */
  verkleinert: boolean
}

/** Auf welche Maße und mit welcher Qualität ein Bild abgelegt wird. */
export function zielMasse(breite: number, hoehe: number): Zielmasse {
  if (!(breite > 0 && hoehe > 0) || !Number.isFinite(breite) || !Number.isFinite(hoehe)) {
    throw new Error(`Ungültige Bildmaße: ${breite}×${hoehe}`)
  }
  const R = SPEICHER_REGELN
  const lang = Math.max(breite, hoehe)
  const kurz = Math.min(breite, hoehe)
  const streifen = lang / kurz > R.streifenAb
  const faktor = streifen
    ? Math.min(1, R.streifenKurzeSeite / kurz, R.streifenLangeSeite / lang)
    : Math.min(1, R.laengsteSeite / lang)
  const b = Math.max(1, Math.round(breite * faktor))
  const h = Math.max(1, Math.round(hoehe * faktor))
  return {
    breite: b,
    hoehe: h,
    qualitaet: Math.max(b, h) <= R.kleinBis ? R.qualitaetKlein : R.qualitaet,
    verkleinert: faktor < 1,
  }
}

/**
 * Kommt diese Datei überhaupt für eine Umwandlung in Frage?
 *
 * `typ` ist der Typ aus den BYTES (`typAusBytes`), nie der aus dem Namen.
 */
export function kandidat(
  typ: string | null, groesse: number,
): { ja: true } | { ja: false; grund: string } {
  if (!typ) return { ja: false, grund: 'kein erkennbares Bild' }
  if (!SPEICHER_REGELN.umwandelbar.includes(typ)) return { ja: false, grund: `${typ} bleibt, wie es ist` }
  if (groesse < SPEICHER_REGELN.mindestGroesse) return { ja: false, grund: 'kleiner als 300 KB' }
  return { ja: true }
}

/**
 * Lohnt sich das Ersetzen? Nur bei mindestens 30 % Ersparnis.
 *
 * WARUM EINE SCHWELLE: Jede Umwandlung ist verlustbehaftet. Ein Bild, das
 * dabei nur ein paar Prozent kleiner wird, verliert Qualität für fast nichts.
 */
export function lohntSich(altBytes: number, neuBytes: number): boolean {
  return altBytes > 0 && neuBytes > 0 && neuBytes <= altBytes * (1 - SPEICHER_REGELN.mindestErsparnis)
}

/**
 * Ist das ein bewegtes Bild? Dann wird es NICHT angefasst.
 *
 * Eine Umwandlung über Canvas oder `sharp` ohne Sonderbehandlung behielte nur
 * das erste Einzelbild — lautlos, die Datei wäre gültig und kleiner.
 *
 *  · GIF: immer (fällt über `kandidat` ohnehin heraus).
 *  · WebP: Kopf `VP8X` mit gesetztem Animations-Bit (0x02) (ebenso).
 *  · APNG: ein `acTL`-Block VOR dem ersten `IDAT` oder `IEND`. Das ist der Fall,
 *    der zählt: libvips sieht ein APNG als Einzelbild (`pages = 1`), und für
 *    `kandidat` ist es ein gewöhnliches PNG. Die übergebenen Bytes müssen bis
 *    zum ersten `IDAT` reichen.
 */
export function istBewegt(b: Uint8Array): boolean {
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true

  const text = (i: number) => String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!)

  if (b.length >= 21 && text(0) === 'RIFF' && text(8) === 'WEBP' && text(12) === 'VP8X') {
    return (b[20]! & 0x02) !== 0
  }

  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    let i = 8
    while (i + 8 <= b.length) {
      const laenge = ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0
      const typ = text(i + 4)
      if (typ === 'acTL') return true
      if (typ === 'IDAT' || typ === 'IEND') return false
      i += 12 + laenge
    }
  }
  return false
}
