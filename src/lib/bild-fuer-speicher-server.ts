import { typAusBytes, endungFuerTyp } from './bildtyp'
import { SPEICHER_REGELN, zielMasse, lohntSich, istBewegt, kandidat } from './speicher-regeln'

/**
 * Ein Bild für den Speicher vorbereiten — auf dem SERVER, mit `sharp`.
 *
 * Dieselben Regeln wie im Browser (`speicher-regeln.ts`), für die Wege, die
 * nicht im Browser laufen: `api/share` (Teilen vom Handy).
 *
 * WIE BEIM UMZUG (`tresor-schritt3.mjs`): Nach dem Umwandeln wird das Ergebnis
 * zurückgelesen — Format, Maße und Transparenz müssen stimmen, sonst bleibt das
 * Original. Echte Transparenz heißt: mindestens ein Pixel ist nicht deckend.
 * KI-PNGs haben oft einen Alphakanal, der überall deckend ist; libwebp lässt ihn
 * dann weg, und das ist kein Verlust.
 *
 * WARUM `sharp` DYNAMISCH GELADEN WIRD: Seit dem 15.09.2026 steht es in
 * `package.json` (0.34.5, dieselbe Version wie im Lock; vorher kam es nur als
 * optionale Abhängigkeit von Next mit). sharp bringt aber native Teile je
 * Plattform mit, und eine fehlende passende Datei zeigte sich erst beim Laden.
 * Fehlt es dort, soll das Teilen nicht scheitern — dann geht das Original hoch,
 * wie vorher, und das Serverprotokoll sagt es (`api/share`).
 */

export type ServerBild = {
  daten: Uint8Array
  typ: string
  endung: string
  umgewandelt: boolean
  grund: string
}

type Sharp = typeof import('sharp')

let sharpLaden: Promise<Sharp | null> | null = null
function sharpHolen(): Promise<Sharp | null> {
  sharpLaden ??= import('sharp')
    .then(m => ((m as unknown as { default?: Sharp }).default ?? (m as unknown as Sharp)))
    .catch(() => null)
  return sharpLaden
}

export async function bildFuerSpeicherServer(
  daten: Uint8Array, nameEndung?: string | null,
): Promise<ServerBild> {
  const echt = typAusBytes(daten)
  const unveraendert = (grund: string): ServerBild => ({
    daten,
    typ: echt ?? 'application/octet-stream',
    endung: endungFuerTyp(echt) ?? ((nameEndung ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'),
    umgewandelt: false,
    grund,
  })

  const pruefung = kandidat(echt, daten.length)
  if (!pruefung.ja) return unveraendert(`${pruefung.grund} — unverändert`)
  if (istBewegt(daten)) return unveraendert('bewegtes PNG (APNG) — unverändert')

  const sharp = await sharpHolen()
  if (!sharp) return unveraendert('sharp nicht verfügbar — unverändert')

  try {
    const meta = await sharp(daten, { failOn: 'none' }).metadata()
    if ((meta.pages ?? 1) > 1) return unveraendert('bewegtes Bild — unverändert')
    if (!meta.width || !meta.height) return unveraendert('Maße nicht lesbar — unverändert')
    // EXIF-Drehung 5–8 vertauscht Breite und Höhe; `rotate()` wendet sie an.
    const gedreht = [5, 6, 7, 8].includes(meta.orientation ?? 1)
    const breite = gedreht ? meta.height : meta.width
    const hoehe = gedreht ? meta.width : meta.height

    const ziel = zielMasse(breite, hoehe)
    const durchsichtig = meta.hasAlpha ? !(await sharp(daten, { failOn: 'none' }).stats()).isOpaque : false
    const webp = await sharp(daten, { failOn: 'none' })
      .rotate()
      .resize({ width: ziel.breite, height: ziel.hoehe, fit: 'fill' })
      .webp({
        quality: ziel.qualitaet,
        alphaQuality: SPEICHER_REGELN.webpAlphaQualitaet,
        effort: SPEICHER_REGELN.webpAufwand,
      })
      .toBuffer()

    const zurueck = await sharp(webp).metadata()
    if (zurueck.format !== 'webp' || zurueck.width !== ziel.breite || zurueck.height !== ziel.hoehe) {
      return unveraendert('Rückprüfung: falsches Format oder falsche Maße — unverändert')
    }
    if (durchsichtig && !zurueck.hasAlpha) {
      return unveraendert('Rückprüfung: Transparenz wäre verloren — unverändert')
    }
    if (!lohntSich(daten.length, webp.length)) {
      return unveraendert(`WebP spart keine 30 % (${daten.length} → ${webp.length} Bytes) — unverändert`)
    }
    return {
      daten: new Uint8Array(webp),
      typ: 'image/webp',
      endung: 'webp',
      umgewandelt: true,
      grund: `WebP ${ziel.qualitaet} · ${breite}×${hoehe} → ${ziel.breite}×${ziel.hoehe}`,
    }
  } catch (e) {
    return unveraendert(`Umwandlung fehlgeschlagen (${(e as Error)?.message ?? e}) — unverändert`)
  }
}
