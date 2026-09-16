/**
 * Ergebnisse für den Speicher vorbereiten — WebP ≤ 2048 px, wie alles andere.
 *
 * WARUM: Seit dem 15.09.2026 liegen in Supabase nur noch WebP-Fassungen. Neue
 * Ergebnisse des Arbeiters sollen den Speicher nicht wieder füllen. Das
 * Original geht vorher nach Backblaze (`b2.ts`, `ergebnisAblegen`).
 *
 * DIE REGELN SIND EINE KOPIE von `src/lib/speicher-regeln.ts`. Warum keine
 * Einbindung: Am 15.09.2026 gemessen — Node lädt die Datei zwar, meldet dabei
 * aber `MODULE_TYPELESS_PACKAGE_JSON`, weil das Hauptprojekt kein
 * `"type": "module"` hat. Diese Warnung stünde bei JEDEM Start des Arbeiters
 * auf dem Bildschirm, und eine Warnung, die immer dasteht, liest niemand mehr.
 * Damit die Kopie nicht auseinanderläuft, prüft `speicher.test.ts` sie gegen
 * dieselben Beispiele (`src/lib/speicher-regeln-beispiele.json`) UND gegen die
 * Werte der Vorlage.
 *
 * Die Umwandlung selbst folgt dem Umzugsskript (`tresor-schritt3.mjs`): EXIF-
 * Drehung einrechnen, zurücklesen, Format/Maße/Transparenz prüfen.
 */

import sharp from 'sharp'
import { bildart } from './netz.ts'

/**
 * SCHALTER: Vergrößerungen in voller Größe ablegen, ohne Backblaze.
 *
 * ENTSCHIEDEN VON MARK AM 16.09.2026: „B: Sie werden auf 2048 px verkleinert."
 * Vergrößerungen laufen damit wie jede Erzeugung: Das Original — die bezahlte
 * 4×- oder 4K-Fassung — geht nach Backblaze, und erst wenn der Upload bestätigt
 * ist, kommt die WebP ≤ 2048 in Supabase. Ohne Backblaze-Schlüssel wird weiter
 * in voller Größe abgelegt. Eine Vergrößerung einer Vergrößerung holt ihre
 * Quelle aus Backblaze (`quelleHolen`, Zuordnung über `webp_sha256`).
 *
 * Vorher (15.09.2026, Critic S3) stand hier `true`, bis Mark entschieden hatte:
 * Eine bezahlte Vergrößerung auf 2048 px zu verkleinern, nähme ihr in Supabase
 * genau das, wofür sie bezahlt wurde — deshalb war es seine Entscheidung.
 */
export const VERGROESSERUNGEN_VOLLE_GROESSE = false

// ─── Regeln (Kopie von src/lib/speicher-regeln.ts) ───────────────────────────

export const SPEICHER_REGELN = {
  laengsteSeite: 2048,
  streifenAb: 3,
  streifenKurzeSeite: 1440,
  streifenLangeSeite: 16383,
  qualitaet: 82,
  qualitaetKlein: 90,
  kleinBis: 1200,
  mindestErsparnis: 0.3,
  mindestGroesse: 300 * 1024,
  umwandelbar: ['image/png', 'image/jpeg'] as readonly string[],
  webpAlphaQualitaet: 100,
  webpAufwand: 5,
} as const

export type Zielmasse = { breite: number; hoehe: number; qualitaet: number; verkleinert: boolean }

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
  return { breite: b, hoehe: h, qualitaet: Math.max(b, h) <= R.kleinBis ? R.qualitaetKlein : R.qualitaet, verkleinert: faktor < 1 }
}

export function kandidat(typ: string | null, groesse: number): { ja: true } | { ja: false; grund: string } {
  if (!typ) return { ja: false, grund: 'kein erkennbares Bild' }
  if (!SPEICHER_REGELN.umwandelbar.includes(typ)) return { ja: false, grund: `${typ} bleibt, wie es ist` }
  if (groesse < SPEICHER_REGELN.mindestGroesse) return { ja: false, grund: 'kleiner als 300 KB' }
  return { ja: true }
}

export function lohntSich(altBytes: number, neuBytes: number): boolean {
  return altBytes > 0 && neuBytes > 0 && neuBytes <= altBytes * (1 - SPEICHER_REGELN.mindestErsparnis)
}

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

// ─── Umwandlung ──────────────────────────────────────────────────────────────

export type Masse = { breite: number; hoehe: number }

export type Speicherfassung =
  | { webp: Buffer; breite: number; hoehe: number; qualitaet: number; grund: string; quelle: Masse }
  | { webp: null; grund: string }

/** Maße eines Bildes nach EXIF-Drehung — `null`, wenn `sharp` sie nicht lesen kann. */
export async function masseLesen(daten: Buffer | Uint8Array): Promise<Masse | null> {
  try {
    const m = await sharp(daten).metadata()
    if (!m.width || !m.height) return null
    const gedreht = [5, 6, 7, 8].includes(m.orientation ?? 1)
    return gedreht ? { breite: m.height, hoehe: m.width } : { breite: m.width, hoehe: m.height }
  } catch {
    return null
  }
}

/** Ein abgelegtes Ergebnis, soweit der Vermerk es braucht. */
export type Vermerk = { pfad: string; originalMasse: Masse | null; masse: Masse | null }

/**
 * Ist das Original GRÖSSER als das, was in Supabase liegt?
 *
 * WARUM (Critic S1, 16.09.2026): Ein 1024er-PNG wird zwar als WebP abgelegt und
 * sein Original geht nach Backblaze — aber die Fassung hat dieselben Maße. Die
 * Plakette „Original 1024×1024" stünde dann an fast jedem neuen Bild und sagte
 * nichts. Sie soll nur da stehen, wo es wirklich ein größeres Bild gibt.
 * Fehlen die abgelegten Maße, wird nichts behauptet.
 */
function groesserAlsAbgelegt(v: Vermerk): v is { pfad: string; originalMasse: Masse; masse: Masse } {
  return !!v.originalMasse && !!v.masse &&
    (v.originalMasse.breite > v.masse.breite || v.originalMasse.hoehe > v.masse.hoehe)
}

/**
 * Der Vermerk „Original in Backblaze" für `scene_meta` des Auftrags.
 *
 * WARUM (Mark, 16.09.2026: Vergrößerungen werden auf 2048 px verkleinert): Die
 * App sieht in Supabase nur noch die WebP-Fassung. Ohne Vermerk verspräche die
 * Kachel Maße, die dort nicht liegen, und nichts sagte, dass es das volle Bild
 * noch gibt. Die App liest ihn mit `originalInBackblaze`
 * (`src/lib/speicher-vermerk.ts`) — DIESELBE Form auf beiden Seiten:
 *
 *   scene_meta.speicher.originale["<pfad>"] = { ort: "backblaze", masse: "4608x3072" }
 *
 * Vermerkt wird nur, wo das Original GRÖSSER ist als die abgelegte Fassung
 * (`groesserAlsAbgelegt`). Vorhandene Einträge (frühere Versuche, andere Bilder
 * des Auftrags) und alle übrigen Felder in `scene_meta` bleiben erhalten.
 * `null`, wenn es nichts zu vermerken gibt — dann wird `scene_meta` gar nicht
 * angefasst.
 */
export function speicherVermerk(sceneMeta: unknown, ablagen: Vermerk[]): Record<string, unknown> | null {
  const neu = ablagen.filter(groesserAlsAbgelegt)
  if (neu.length === 0) return null
  const objekt = (x: unknown): Record<string, unknown> =>
    x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {}
  const alt = objekt(sceneMeta)
  const altSpeicher = objekt(alt.speicher)
  const originale: Record<string, unknown> = { ...objekt(altSpeicher.originale) }
  for (const a of neu) {
    originale[a.pfad] = { ort: 'backblaze', masse: `${a.originalMasse.breite}x${a.originalMasse.hoehe}` }
  }
  return { ...alt, speicher: { ...altSpeicher, originale } }
}

/**
 * Die WebP-Fassung für Supabase — oder `webp: null` mit dem Grund, warum das
 * Ergebnis so bleibt, wie es ist. Wirft nur bei einem unerwarteten Fehler von
 * `sharp`; der Aufrufer legt dann wie bisher ab.
 */
export async function fuerSpeicher(daten: Buffer): Promise<Speicherfassung> {
  const art = bildart(daten)
  const pruefung = kandidat(art?.typ ?? null, daten.length)
  if (!pruefung.ja) return { webp: null, grund: pruefung.grund }
  if (istBewegt(daten)) return { webp: null, grund: 'bewegtes PNG (APNG)' }

  const meta = await sharp(daten).metadata()
  if ((meta.pages ?? 1) > 1) return { webp: null, grund: 'bewegtes Bild' }
  if (!meta.width || !meta.height) return { webp: null, grund: 'Maße nicht lesbar' }
  const gedreht = [5, 6, 7, 8].includes(meta.orientation ?? 1)
  const breite = gedreht ? meta.height : meta.width
  const hoehe = gedreht ? meta.width : meta.height

  const ziel = zielMasse(breite, hoehe)
  // Echte Transparenz nur, wenn ein Pixel nicht deckend ist — KI-PNGs haben oft
  // einen Alphakanal, der überall deckend ist; libwebp lässt ihn dann weg.
  const durchsichtig = meta.hasAlpha ? !(await sharp(daten).stats()).isOpaque : false
  const webp = await sharp(daten)
    .rotate()
    .resize({ width: ziel.breite, height: ziel.hoehe, fit: 'fill' })
    .webp({ quality: ziel.qualitaet, alphaQuality: SPEICHER_REGELN.webpAlphaQualitaet, effort: SPEICHER_REGELN.webpAufwand })
    .toBuffer()

  const zurueck = await sharp(webp).metadata()
  if (zurueck.format !== 'webp' || zurueck.width !== ziel.breite || zurueck.height !== ziel.hoehe) {
    return { webp: null, grund: 'Rückprüfung: falsches Format oder falsche Maße' }
  }
  if (durchsichtig && !zurueck.hasAlpha) return { webp: null, grund: 'Rückprüfung: Transparenz wäre verloren' }
  if (!lohntSich(daten.length, webp.length)) return { webp: null, grund: 'WebP spart keine 30 %' }

  return {
    webp, breite: ziel.breite, hoehe: ziel.hoehe, qualitaet: ziel.qualitaet,
    grund: `WebP ${ziel.qualitaet} · ${breite}×${hoehe} → ${ziel.breite}×${ziel.hoehe}`,
    quelle: { breite, hoehe },
  }
}
