/**
 * Liegt das volle Bild zu einem Ergebnis in Backblaze? Und wie groß ist es?
 *
 * WARUM: Mark am 16.09.2026 — „B: Sie werden auf 2048 px verkleinert." Seitdem
 * liegt von Ergebnissen und Vergrößerungen in Supabase nur eine WebP-Fassung
 * bis 2048 px; das Original legt der Arbeiter vorher nach Backblaze. Ohne diesen
 * Vermerk sähe eine 4×-Vergrößerung in der App aus wie ein 2048er-Bild, und
 * nichts sagte, dass es das volle Bild noch gibt.
 *
 * DIE FORM SCHREIBT DER ARBEITER (`speicherVermerk` in worker/src/speicher.ts):
 *
 *   scene_meta.speicher.originale["<pfad>"] = { ort: "backblaze", masse: "4608x3072" }
 *
 * Beide Tests prüfen genau diese Form. Alles, was nicht so aussieht, gilt als
 * „kein Vermerk" — ein kaputter Eintrag soll keine falsche Größe anzeigen.
 */

export type OriginalVermerk = { breite: number; hoehe: number }

export function originalInBackblaze(sceneMeta: unknown, pfad: string): OriginalVermerk | null {
  const objekt = (x: unknown): Record<string, unknown> | null =>
    x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null
  const eintrag = objekt(objekt(objekt(objekt(sceneMeta)?.speicher)?.originale)?.[pfad])
  if (!eintrag || eintrag.ort !== 'backblaze' || typeof eintrag.masse !== 'string') return null
  const m = /^(\d{1,5})x(\d{1,5})$/.exec(eintrag.masse)
  if (!m) return null
  const breite = Number(m[1])
  const hoehe = Number(m[2])
  return breite > 0 && hoehe > 0 ? { breite, hoehe } : null
}
