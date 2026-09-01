import type { AspectRatioKey } from './scene-builder-options'

/**
 * Bildgenerierung — was das Modell kann und was Trésor daraus macht.
 *
 * Am 01.09.2026 am laufenden Proxy nachgemessen, nicht aus der Dokumentation
 * abgeschrieben. Zwei Befunde, die hier festgehalten sind, weil sie die
 * Oberfläche bestimmen:
 *
 * 1. gpt-image-2 kennt nur drei Größen. Trésor bietet fünf Bildformate.
 * 2. Der Parameter `size` wirkt NUR ohne Referenzbild. Mit Referenz
 *    (/v1/images/edits) richtet sich das Ergebnis nach dem Referenzbild —
 *    eine Anfrage über 1024x1024 kam als 1122x1402 zurück. Wer mit Referenz
 *    ein bestimmtes Format will, muss es in den Prompt schreiben.
 */

export const MODELLE = [
  { id: 'gpt-image-2', label: 'GPT Image 2', note: 'Standard, folgt Referenzbildern treu' },
] as const

export type ModellId = typeof MODELLE[number]['id']

/** Die drei Größen, die gpt-image-2 tatsächlich annimmt. */
export const NATIVE_GROESSEN = ['1024x1024', '1536x1024', '1024x1536'] as const
export type NativeGroesse = typeof NATIVE_GROESSEN[number]

type FormatZuordnung = {
  size: NativeGroesse
  /** true, wenn das Trésor-Format genau einer nativen Größe entspricht. */
  exakt: boolean
  hinweis?: string
}

const ZUORDNUNG: Record<AspectRatioKey, FormatZuordnung> = {
  square_1_1:      { size: '1024x1024', exakt: true },
  landscape_16_9:  { size: '1536x1024', exakt: false, hinweis: 'wird 3:2 — nächstliegende Größe' },
  story_9_16:      { size: '1024x1536', exakt: false, hinweis: 'wird 2:3 — nächstliegende Größe' },
  portrait_4_5:    { size: '1024x1536', exakt: false, hinweis: 'wird 2:3 — etwas höher als 4:5' },
  cinematic_21_9:  { size: '1536x1024', exakt: false, hinweis: 'wird 3:2 — deutlich weniger breit als 21:9' },
}

/** Ohne gewähltes Format: quadratisch, die einzige Größe ohne Richtungsannahme. */
export const GROESSE_VORGABE: NativeGroesse = '1024x1024'

export function groesseFuerFormat(format: AspectRatioKey | null): FormatZuordnung {
  if (!format) return { size: GROESSE_VORGABE, exakt: true }
  return ZUORDNUNG[format] ?? { size: GROESSE_VORGABE, exakt: true }
}

/**
 * Sobald Referenzbilder mitgehen, ignoriert das Modell `size`. Dann hilft nur
 * eine Ansage im Prompt. Diese Zeile wird an den fertigen Prompt angehängt —
 * die Prompt-Erzeugung des Scene Builders selbst bleibt unangetastet.
 */
const FORMAT_ANSAGE: Record<AspectRatioKey, string> = {
  square_1_1:     'Output a SQUARE 1:1 image frame.',
  landscape_16_9: 'Output a WIDE 16:9 CINEMATIC LANDSCAPE frame.',
  story_9_16:     'Output a TALL 9:16 VERTICAL frame.',
  portrait_4_5:   'Output a VERTICAL 4:5 PORTRAIT frame.',
  cinematic_21_9: 'Output an ULTRA-WIDE 21:9 CINEMASCOPE frame.',
}

export function formatAnsage(format: AspectRatioKey | null): string | null {
  return format ? FORMAT_ANSAGE[format] ?? null : null
}

/**
 * Den fertigen Prompt für den Auftrag zusammensetzen.
 *
 * Der Prompt des Scene Builders wird NICHT verändert — angehängt wird nur die
 * Formatansage, und auch die nur, wenn Referenzbilder mitgehen. Ohne Referenz
 * wirkt der Größenparameter, dann ist die Ansage überflüssig.
 *
 * Als eigene Funktion statt im Knopf, damit sie ohne Oberfläche prüfbar ist:
 * Es ist die einzige Stelle im ganzen Vorhaben, die den Prompt anfasst.
 */
export function promptFuerAuftrag(
  prompt: string, format: AspectRatioKey | null, rollen: ReferenzRolle[],
): string {
  const mitReferenz = rollen.length > 0
  const teile = [prompt]

  // Zuerst die Zuordnung: Sie sagt, welches Bild wofür steht. Ohne sie nimmt
  // das Modell schon mal die Person aus dem Outfit-Bild.
  const zuordnung = referenzZuordnung(rollen)
  if (zuordnung) teile.push(zuordnung)

  // Die Formatansage nur mit Referenz — ohne Referenz wirkt der Größenparameter.
  if (mitReferenz) {
    const ansage = formatAnsage(format)
    if (ansage) teile.push(ansage)
  }

  return teile.join('\n\n')
}

/**
 * Referenzbilder — wer ist was.
 *
 * Am 01.09.2026 an einem echten Ergebnis gesehen: Bei Charakter + Outfit
 * übernahm gpt-image-2 die Person aus dem OUTFIT-Bild statt aus dem
 * Charakterbild. Die Ursache war nicht der Prompt, sondern die fehlende
 * Zuordnung — die Bilder gingen unbeschriftet als image[] mit, und die Sätze
 * „Use the provided character reference." / „…outfit reference." sagen nicht,
 * welches Bild gemeint ist. Das Modell hat geraten.
 *
 * Deshalb geht jetzt eine ausdrückliche Zuordnung mit, in derselben Reihenfolge
 * wie die Bilder. Positiv formuliert (nehmen, nicht verbieten) — gpt-image-2
 * folgt Positiv-Listen zuverlässiger als Verboten.
 */
export type ReferenzRolle = 'character' | 'outfit' | 'location'

export type Referenz = { url: string; rolle: ReferenzRolle }

const ROLLEN_ANWEISUNG: Record<ReferenzRolle, string> = {
  character: 'CHARACTER — take the face, hair, skin tone and body identity of this person.',
  outfit:    'OUTFIT — take only the garments, their cut, fabric and colour. The person wearing them in this image is a mannequin for the clothes, not the subject.',
  location:  'LOCATION — take only the setting and architecture of this place. Lighting, time of day and weather are defined in the text above, not by this image.',
}

export const ROLLEN_LABEL: Record<ReferenzRolle, string> = {
  character: 'Charakter',
  outfit:    'Outfit',
  location:  'Location',
}

/**
 * Der Zuordnungsblock, der dem Modell sagt, welches Bild wofür steht.
 *
 * Auch bei EINEM Bild nötig — der ursprüngliche Fehler war nicht die
 * Verwechslung zweier Bilder, sondern die Frage, welchen Aspekt eines Bildes
 * das Modell nimmt. Ein einzelnes Outfit-Foto mit Person darin führt ohne
 * Ansage genauso zur falschen Person wie zwei Bilder.
 */
export function referenzZuordnung(rollen: ReferenzRolle[]): string | null {
  if (rollen.length === 0) return null
  const zeilen = rollen.map((rolle, i) => `Image ${i + 1} = ${ROLLEN_ANWEISUNG[rolle]}`)
  return [
    'REFERENCE IMAGES — they arrive in this exact order:',
    ...zeilen,
  ].join('\n')
}

export const DURCHLAEUFE = [1, 2, 3, 4] as const
export type Durchlaeufe = typeof DURCHLAEUFE[number]

export type JobStatus = 'queued' | 'running' | 'done' | 'failed'

export const STATUS_TEXT: Record<JobStatus, string> = {
  queued:  'Wartet',
  running: 'Läuft',
  done:    'Fertig',
  failed:  'Fehlgeschlagen',
}

export const STATUS_FARBE: Record<JobStatus, string> = {
  queued:  'bg-muted text-muted-foreground',
  running: 'bg-blue-500/15 text-blue-400',
  done:    'bg-emerald-500/15 text-emerald-400',
  failed:  'bg-destructive/15 text-destructive',
}
