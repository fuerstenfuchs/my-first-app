/**
 * Die Körperkarte (PROJ-92) — wo auf der Blender-Grundfigur welche Region sitzt.
 *
 * Die Punkte sind in Bildpunkten des 1024-Renders angegeben, in dem sie beim
 * Entwurf gesetzt wurden, und werden erst hier in Anteile (0…1) des
 * zugeschnittenen Bildes umgerechnet. So bleibt die Lage der Punkte
 * nachvollziehbar, wenn jemand die Figur neu rendert: dieselbe Kamera, dieselbe
 * Zahl.
 *
 * Das Bild `public/koerper/grundfigur-vorne.webp` ist der Ausschnitt
 * x 270…754, y 210…890 dieses Renders, in doppelter Auflösung (2048).
 */
import { MERKMAL_FELDER } from './koerper-felder'
import { KOERPER_PRESETS } from './koerper-presets'
import type { KoerperAuswahl } from './referenzkette'

export type Schluessel = keyof KoerperAuswahl

export const KARTE_BILD = '/koerper/grundfigur-vorne.webp'
export const KARTE_BREITE = 968
export const KARTE_HOEHE = 1360

const AUSSCHNITT = { x: 270, y: 210, breite: 484, hoehe: 680 }

/** Lage jedes Punkts im 1024-Raum. Reihenfolge = Nummer auf der Karte. */
const LAGE: Record<Schluessel, [number, number]> = {
  bau:          [300, 300],
  groesse:      [725, 300],
  schultern:    [455, 350],
  arme:         [395, 415],
  oberweite:    [512, 402],
  taille:       [455, 452],
  bauch:        [570, 492],
  becken:       [450, 540],
  gesaess:      [575, 562],
  beinlaenge:   [640, 690],
  oberschenkel: [452, 612],
  wade:         [568, 745],
}

/** Die Reihenfolge der Nummern 1…12 auf der Karte. */
export const KARTEN_REIHE: Schluessel[] = [
  'bau', 'groesse', 'schultern', 'arme', 'oberweite', 'taille',
  'bauch', 'becken', 'gesaess', 'beinlaenge', 'oberschenkel', 'wade',
]

const anteilX = (x: number) => (x - AUSSCHNITT.x) / AUSSCHNITT.breite
const anteilY = (y: number) => (y - AUSSCHNITT.y) / AUSSCHNITT.hoehe

/** Position eines Punkts als Anteile des zugeschnittenen Bildes (0…1). */
export function punktLage(k: Schluessel): { x: number; y: number } {
  const [x, y] = LAGE[k]
  return { x: anteilX(x), y: anteilY(y) }
}

/** Die beiden gestrichelten Maßlinien (Größe, Beinlänge) als Anteile. */
export const MASSLINIEN: { x: number; von: number; bis: number }[] = [
  { x: anteilX(725), von: anteilY(237), bis: anteilY(858) },
  { x: anteilX(640), von: anteilY(520), bis: anteilY(858) },
]

/** Nummer (1…12) eines Punkts. */
export function kartenNummer(k: Schluessel): number {
  return KARTEN_REIHE.indexOf(k) + 1
}

/** Das Feld samt Beschriftungen aus der gemeinsamen Liste. */
export function feld(k: Schluessel) {
  const f = MERKMAL_FELDER.find(x => x.schluessel === k)
  if (!f) throw new Error(`Unbekannte Region: ${k}`)
  return f
}

/** Anzeigename einer gesetzten Stufe, z. B. „Sehr ausladend". */
export function stufenText(k: Schluessel, wert: string | undefined): string | null {
  if (!wert) return null
  return feld(k).optionen.find(o => o.wert === wert)?.text ?? null
}

/** Die Blender-Bilder der Extremstufen dieser Region (höchstens zwei). */
export function extremeVon(k: Schluessel): { wert: string; text: string; bildUrl: string }[] {
  const raus: { wert: string; text: string; bildUrl: string }[] = []
  for (const o of feld(k).optionen) {
    const p = KOERPER_PRESETS.find(pr => (pr.merkmale as Record<string, string | undefined>)[k] === o.wert)
    if (p) raus.push({ wert: o.wert, text: o.text, bildUrl: p.bildUrl })
  }
  return raus
}

/** Für Chips und Zusammenfassungen: nur die gesetzten Regionen, in Kartenreihenfolge. */
export function gesetzteRegionen(a: KoerperAuswahl): { schluessel: Schluessel; label: string; stufe: string }[] {
  const raus: { schluessel: Schluessel; label: string; stufe: string }[] = []
  for (const k of KARTEN_REIHE) {
    const t = stufenText(k, a[k])
    if (t) raus.push({ schluessel: k, label: feld(k).label, stufe: t })
  }
  return raus
}
