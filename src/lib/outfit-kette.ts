/**
 * Die Referenzkette eines Outfits (PROJ-54) — die Regeln, ohne Oberfläche.
 *
 * Das Gegenstück zu `referenzkette.ts`, für Kleidung. Mark am 03.09.2026:
 * „Da ist es ja auch so, dass wir ein Referenzbild brauchen, also nur mit der
 * Kleidung ohne einen Menschen praktisch. Das sollte auch automatisiert
 * ablaufen, genauso wie bei den Charakteren."
 *
 * Wie dort ist das hier absichtlich frei von React und Supabase: Reihenfolge,
 * Referenzzuordnung, die Variantennamen und die Frage „wo geht es weiter" sind
 * die Stellen, an denen ein Fehler teuer wäre — und nur als reine Funktionen
 * sind sie ohne Anmeldung prüfbar. Die Ausführung liegt in
 * `use-outfit-kette.ts`.
 */

import { istEigenerSpeicher } from './referenzkette'

/**
 * Dieselbe Schranke wie bei den Charakteren, hier nur weitergereicht.
 *
 * ABSICHTLICH KEINE ZWEITE FASSUNG: Es ist dieselbe Regel des Arbeiters
 * (`bildHolen` in `worker/src/supabase.ts`) — er nimmt nur Adressen aus dem
 * eigenen Speicher an. Zwei Kopien derselben Prüfung laufen früher oder später
 * auseinander, und die falsche wäre dann die, die niemand angefasst hat.
 */
export { istEigenerSpeicher }

export type OutfitSchritt = 'vorne' | 'rueckseite' | 'details' | 'referenzsheet'

/** Die vier Schritte in genau der Reihenfolge, in der sie laufen. */
export const OUTFIT_KETTEN_SCHRITTE: OutfitSchritt[] = [
  'vorne', 'rueckseite', 'details', 'referenzsheet',
]

/**
 * Die vier Slots, die das Outfit-FORMULAR beim Anlegen anbietet.
 *
 * WARUM SIE HIER STEHEN UND NICHT IM FORMULAR: Sie sind die Nachbarn, mit
 * denen die Kettennamen unten NICHT zusammenfallen dürfen (siehe
 * `OUTFIT_VARIANTEN_NAME`). Stünden sie im Formular und die Kettennamen hier,
 * gäbe es keinen Ort, an dem ein Test beide gegeneinander halten kann, ohne
 * einen von beiden abzuschreiben — und eine abgeschriebene Liste ist genau
 * die, die beim nächsten Slot nicht mitwandert.
 *
 * `outfit-form.tsx` importiert diese Liste; sie steht dort nicht mehr.
 */
export const FORMULAR_SLOTS = [
  { key: 'vorne',  label: 'Vorne' },
  { key: 'seite',  label: 'Seite' },
  { key: 'hinten', label: 'Hinten' },
  { key: 'detail', label: 'Detail' },
] as const

/**
 * Wie die Variante heißt, in die das Ergebnis eines Schrittes kommt.
 *
 * UND WARUM KEINER DAVON „VORNE", „HINTEN" ODER „DETAIL" HEISST: Das
 * Outfit-Formular legt beim Anlegen bereits Varianten mit genau diesen Namen
 * an (`FORMULAR_SLOTS`) — Marks eigene Fotos. Hieße das erste Kettenergebnis
 * ebenfalls „Vorne", würde ein dort von Hand hochgeladenes Foto die Kette
 * glauben lassen, der Schritt sei erledigt: `standErmitteln()` misst den
 * Fortschritt an dem, was in den Varianten liegt, und kann ein eigenes Foto
 * nicht von einem erzeugten Blatt unterscheiden.
 *
 * Genau dieser Fehler trat am 03.09.2026 zweimal auf — bei „Kopf" (PROJ-50)
 * und beim Ausgangsfoto (PROJ-48). Beide Male war die Folge nicht ein
 * Fehlerdialog, sondern ein Schritt, der stillschweigend übersprungen wurde.
 *
 * Der Test dazu steht in `outfit-kette.test.ts` und vergleicht getrimmt und
 * ohne Rücksicht auf Groß-/Kleinschreibung — so wie `varianteHolen` im Hook
 * eine vorhandene Variante sucht.
 */
export const OUTFIT_VARIANTEN_NAME: Record<OutfitSchritt, string> = {
  vorne:         'Vorne freigestellt',
  rueckseite:    'Rückseite',
  details:       'Detailaufnahmen',
  referenzsheet: 'Referenzsheet',
}

/**
 * Wie der Schritt in der Oberfläche HEISST.
 *
 * Heute Wort für Wort dasselbe wie `OUTFIT_VARIANTEN_NAME` — und trotzdem eine
 * eigene Tabelle: Das eine ist Anzeigetext, das andere ein Schlüssel in der
 * Datenbank. Wird die Beschriftung eines Tages schöner formuliert, darf der
 * Variantenname sich NICHT mitändern, sonst findet die Kette ihre eigenen
 * bisherigen Ergebnisse nicht mehr wieder und legt neben jedem alten Blatt ein
 * zweites Fach an. Eine gemeinsame Konstante würde genau das erlauben.
 */
export const OUTFIT_SCHRITT_LABEL: Record<OutfitSchritt, string> = {
  vorne:         'Vorne freigestellt',
  rueckseite:    'Rückseite',
  details:       'Detailaufnahmen',
  referenzsheet: 'Referenzsheet',
}

/**
 * Kollidiert ein Variantenname mit einem Slot des Formulars?
 *
 * Der Vergleich ist getrimmt und ohne Groß-/Kleinschreibung — GENAU SO sucht
 * `varianteHolen` im Hook eine vorhandene Variante. Eine schärfere Prüfung
 * hier (etwa auf Teilzeichenketten) wäre kein besserer Schutz, sondern eine
 * andere Frage als die, die im Betrieb tatsächlich gestellt wird.
 */
export function kollidiertMitFormularSlot(name: string): boolean {
  const n = name.trim().toLowerCase()
  return FORMULAR_SLOTS.some(s => s.label.trim().toLowerCase() === n)
}

/**
 * Welche ROLLE ein mitgegebenes Bild spielt.
 *
 * Dieselbe Trennung wie bei den Charakteren: Der teure Fehler ist nicht, dass
 * das Modell zwei Bilder verwechselt, sondern dass es nicht weiß, WELCHEN
 * ASPEKT eines Bildes es übernehmen soll. Beim Titelbild eines Outfits ist das
 * besonders scharf — dort ist in aller Regel ein Mensch drauf, und genau der
 * soll NICHT mitkommen.
 */
type Rolle = 'titelbild' | 'vorderansicht' | 'rueckansicht' | 'detailblatt'

const ANSAGE_TEXT: Record<Rolle, string> = {
  titelbild:
    'SOURCE PHOTO OF THE OUTFIT — take the garment from it: its cut, colour, fabric, pattern and proportions. '
    + 'If a person is wearing it in this photo, that person is NOT part of the task: do not draw them, do not draw any body, face, hands or legs.',
  vorderansicht:
    'FRONT VIEW OF THE GARMENT, already isolated — this is the authority for colour, fabric, pattern and cut. Match it exactly.',
  rueckansicht:
    'BACK VIEW OF THE SAME GARMENT — use it for everything that is visible from behind.',
  detailblatt:
    'DETAIL SHEET OF THE SAME GARMENT — use it for the close-ups: fabric texture, seams, pattern and fastenings.',
}

export type OutfitBildquelle = 'titelbild' | OutfitSchritt

/**
 * Welche Bilder ein Schritt braucht, mit ihrer jeweiligen Rolle.
 *
 * Der Aufbau der Kette in einer Funktion:
 *
 *   Titelbild ──▶ vorne ──┬──▶ rueckseite ──┐
 *                         ├──▶ details ─────┤
 *                         └─────────────────┴──▶ referenzsheet
 *
 * `rueckseite` und `details` hängen BEIDE nur am freigestellten Vorne-Blatt und
 * nicht aneinander — deshalb ist es folgenlos, wenn eines von beiden fehlt,
 * solange das Referenzsheet noch nicht dran ist. Das Referenzsheet braucht
 * alle drei; die feste Reihenfolge in `OUTFIT_KETTEN_SCHRITTE` sorgt dafür,
 * dass sie dann auch vorliegen.
 *
 * DAS TITELBILD WIRD NUR IM ERSTEN SCHRITT BENUTZT. Danach ist das
 * freigestellte Vorne-Blatt die bessere Vorlage: Es zeigt dasselbe
 * Kleidungsstück, aber ohne Person, ohne Hintergrund und ohne Schattenwurf —
 * das Titelbild noch einmal mitzugeben hieße, dem Modell die Person wieder
 * anzubieten, die man gerade mühsam losgeworden ist.
 */
export function quellenFuer(
  schritt: OutfitSchritt,
): { bild: OutfitBildquelle; rolle: Rolle }[] {
  switch (schritt) {
    case 'vorne':
      return [{ bild: 'titelbild', rolle: 'titelbild' }]
    case 'rueckseite':
      return [{ bild: 'vorne', rolle: 'vorderansicht' }]
    case 'details':
      return [{ bild: 'vorne', rolle: 'vorderansicht' }]
    case 'referenzsheet':
      return [
        { bild: 'vorne',      rolle: 'vorderansicht' },
        { bild: 'rueckseite', rolle: 'rueckansicht' },
        { bild: 'details',    rolle: 'detailblatt' },
      ]
  }
}

/**
 * Der Zuordnungsblock für einen Schritt — oder `null`, wenn er keinen braucht.
 *
 * Auch bei EINEM Bild nötig, aus demselben Grund wie bei den Charakteren: Die
 * Frage ist nicht „welches Bild", sondern „was davon".
 */
export function referenzAnsage(schritt: OutfitSchritt): string | null {
  const quellen = quellenFuer(schritt)
  if (quellen.length === 0) return null
  return [
    'REFERENCE IMAGES — they arrive in this exact order:',
    ...quellen.map((q, i) => `Image ${i + 1} = ${ANSAGE_TEXT[q.rolle]}`),
    'If the text above describes the garment differently, follow the reference images and ignore the conflicting words.',
  ].join('\n')
}

/**
 * Der fertige Prompt eines Schrittes.
 *
 * Der Blatt-Prompt selbst bleibt UNANGETASTET — angehängt wird nur die
 * Zuordnung. An jedem Wort der vier Prompts in `outfit-kette-prompts.ts` hängt
 * eine Erfahrung; es gibt genau eine Stelle, die sie anfasst, und sie ist
 * prüfbar.
 */
export function outfitKettenPrompt(schritt: OutfitSchritt, basis: string): string {
  const ansage = referenzAnsage(schritt)
  return ansage ? `${basis}\n\n${ansage}` : basis
}

/**
 * Wo geht es weiter?
 *
 * `vorhanden` sagt je Schritt, ob die zugehörige Variante schon ein Bild hat.
 * `null` heißt: alle vier liegen vor.
 *
 * WARUM DAS NICHT EINFACH EIN ZÄHLER IST: Der Ablauf lebt im Browser. Schließt
 * Mark den Tab, steht die Kette — beim nächsten Öffnen ist der einzige
 * verlässliche Zeuge des Fortschritts, was tatsächlich in der Datenbank liegt.
 * Eine Lücke in der Mitte ist dabei möglich (Vorne und Referenzsheet da,
 * Rückseite fehlt), wenn ein Blatt einzeln erzeugt wurde: Dann wird die LÜCKE
 * gefüllt, nicht das Ende.
 */
export function naechsterSchritt(
  vorhanden: Record<OutfitSchritt, boolean>,
): OutfitSchritt | null {
  return OUTFIT_KETTEN_SCHRITTE.find(s => !vorhanden[s]) ?? null
}

/**
 * Alle noch offenen Schritte, in Kettenreihenfolge.
 *
 * Der Läufer arbeitet diese Liste ab. Weil sie der festen Reihenfolge folgt,
 * ist die Vorlage eines Schrittes immer schon erzeugt, wenn er an die Reihe
 * kommt — auch beim Wiederaufnehmen mitten in der Kette.
 */
export function offeneSchritte(
  vorhanden: Record<OutfitSchritt, boolean>,
): OutfitSchritt[] {
  return OUTFIT_KETTEN_SCHRITTE.filter(s => !vorhanden[s])
}
