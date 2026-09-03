/**
 * Die Varianten, die JEDER neue Charakter von Anfang an bekommt — leer.
 *
 * Mark am 03.09.2026: „Ob da dann Bilder reinkommen oder nicht, sei
 * dahingestellt, aber das muss ich sonst immer manuell anstoßen." Genau das
 * fällt damit weg: Die sieben Fächer stehen bereit, sobald der Charakter
 * existiert — egal ob er über das Formular oder über die Chrome-Erweiterung
 * angelegt wurde.
 *
 * Absichtlich frei von React und Supabase: Die Namen und die Frage „was fehlt
 * noch" sind die Stellen, an denen ein Fehler teuer wäre, und nur als reine
 * Werte und Funktionen sind sie ohne Anmeldung prüfbar.
 *
 * ES WIRD NICHTS ERZEUGT. Auch „Calvanize" ist nur ein leeres Fach — eine
 * Bild-Erzeugung dafür wäre kostenpflichtig und ist ausdrücklich nicht Teil
 * dieser Automatik.
 */

import { VARIANTEN_NAME } from './referenzkette'

/**
 * Die sieben Standard-Varianten in ihrer festen Reihenfolge (sort_order 0…6).
 *
 * WARUM DIE ERSTEN DREI AUS `VARIANTEN_NAME` KOMMEN UND NICHT NEU GETIPPT SIND:
 * Die Referenzkette legt ihre Ergebnisse in Varianten mit genau diesen Namen ab
 * und findet die passende Variante über einen Namensvergleich
 * (`varianteHolen` in `use-referenzkette.ts`, Groß-/Kleinschreibung egal).
 * Stünde „Körper" hier ein zweites Mal als Zeichenkette, könnten die beiden
 * Stellen auseinanderlaufen — und die Kette legte dann eine ZWEITE Variante an,
 * statt das hier vorbereitete Fach zu füllen. Ein Name, eine Quelle.
 *
 * Die letzten vier haben in der Kette keine Entsprechung; sie sind Marks
 * eigene Fächer und stehen deshalb nur hier.
 */
export const STANDARD_VARIANTEN: string[] = [
  VARIANTEN_NAME.kopf,          // 'Kopf'
  VARIANTEN_NAME.koerper,       // 'Körper'
  VARIANTEN_NAME.referenzsheet, // 'Referenzsheet'
  'Ausdrücke',
  'Sonstige',
  'Outfit',
  'Calvanize',
]

/** Namen auf die Form bringen, in der verglichen wird. */
function schluessel(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Welche der Standard-Varianten in `vorhandene` noch fehlen — in der festen
 * Reihenfolge von `STANDARD_VARIANTEN`.
 *
 * Der Vergleich ignoriert Groß-/Kleinschreibung und umgebende Leerzeichen,
 * genau wie `varianteHolen` in `use-referenzkette.ts`. Sonst gälte ein von Hand
 * angelegtes „kopf" als etwas anderes als „Kopf" und stünde am Ende zweimal da.
 *
 * Die Reihenfolge des Ergebnisses ist die der Liste, NICHT die der Eingabe:
 * Sie bestimmt die `sort_order` der angelegten Varianten und muss deshalb
 * berechenbar sein.
 */
export function fehlendeStandardVarianten(vorhandene: readonly string[]): string[] {
  const da = new Set(vorhandene.map(schluessel))
  return STANDARD_VARIANTEN.filter(name => !da.has(schluessel(name)))
}

/**
 * Ist dieser Name einer der Standard-Varianten? (Groß-/Kleinschreibung egal.)
 *
 * Gebraucht dort, wo ein hochgeladenes Bild in ein SCHON vorbereitetes Fach
 * gehört statt in ein zweites, gleichnamiges.
 */
export function istStandardVariante(name: string): boolean {
  return STANDARD_VARIANTEN.some(n => schluessel(n) === schluessel(name))
}
