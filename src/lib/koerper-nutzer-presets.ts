/**
 * Eigene Körperform-Presets (PROJ-92) — die Regeln, ohne Oberfläche.
 *
 * Mark am 29.09.2026: „Ich nenne ein Preset Model und setze dann die
 * verschiedenen Körperkriterien und kann das abspeichern. Und wenn ich
 * draufklicke, ist alles schon so wie im Preset vorgespeichert."
 *
 * Ein Preset ist ein Name, eine Auswahl der zwölf Regionen und optional ein
 * Blender-Körperbild als Referenz.
 *
 * WARUM DIE AUSWAHL BEIM LESEN GEPRÜFT WIRD: Sie liegt als `jsonb` in der
 * Datenbank. Kommt später eine Stufe dazu oder fällt eine weg, stünde in alten
 * Zeilen ein Wert, den `MERKMAL_TEXT` nicht kennt — und daraus würde im Prompt
 * eine Zeile „- undefined" (siehe Kommentar in `koerperMerkmaleText`). Hier
 * fliegt so ein Wert lautlos raus, statt zum bezahlten Bild zu werden.
 */
import { MERKMAL_FELDER } from './koerper-felder'
import { istEigenerSpeicher, type KoerperAuswahl } from './referenzkette'

export type NutzerPreset = {
  id: string
  name: string
  merkmale: KoerperAuswahl
  /** Blender-Körperbild als Referenz — oder null: dann entscheidet das Referenzsheet. */
  koerperBild: string | null
}

/** Nur bekannte Regionen mit bekannten Stufen bleiben übrig. */
export function bereinigeMerkmale(roh: unknown): KoerperAuswahl {
  const raus: Record<string, string> = {}
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return raus as KoerperAuswahl
  const quelle = roh as Record<string, unknown>
  for (const f of MERKMAL_FELDER) {
    const w = quelle[f.schluessel]
    if (typeof w === 'string' && f.optionen.some(o => o.wert === w)) raus[f.schluessel] = w
  }
  return raus as KoerperAuswahl
}

/** Ein Name, der sich anzeigen lässt: getrimmt, ohne Zeilenumbruch, höchstens 60 Zeichen. */
export function bereinigeName(roh: string): string {
  return roh.replace(/\s+/g, ' ').trim().slice(0, 60)
}

/** Eine Datenbankzeile in ein Preset verwandeln — oder null, wenn sie unbrauchbar ist. */
export function zeileZuPreset(z: Record<string, unknown>): NutzerPreset | null {
  const id = typeof z.id === 'string' ? z.id : null
  const name = typeof z.name === 'string' ? bereinigeName(z.name) : ''
  if (!id || !name) return null
  const bild = typeof z.koerper_bild === 'string' && z.koerper_bild ? z.koerper_bild : null
  return {
    id, name,
    merkmale: bereinigeMerkmale(z.merkmale),
    // Ein Bild außerhalb des eigenen Speichers würde der Arbeiter ablehnen.
    koerperBild: bild && istEigenerSpeicher(bild) ? bild : null,
  }
}

/** Weicht die aktuelle Einstellung vom gewählten Preset ab? Dann bietet die Seite "Überschreiben" an. */
export function unterscheidetSich(p: NutzerPreset, aktuell: KoerperAuswahl, aktuellBild: string | null): boolean {
  const a = bereinigeMerkmale(aktuell) as Record<string, string | undefined>
  const b = p.merkmale as Record<string, string | undefined>
  const schluessel = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of schluessel) if (a[k] !== b[k]) return true
  return (aktuellBild ?? null) !== (p.koerperBild ?? null)
}

/** Ist überhaupt etwas eingestellt, das sich zu speichern lohnt? */
export function hatInhalt(a: KoerperAuswahl, bild: string | null): boolean {
  return Object.keys(bereinigeMerkmale(a)).length > 0 || !!bild
}
