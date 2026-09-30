/**
 * Merkmale, die an der PERSON hängen — nicht am einzelnen Lauf.
 *
 * Mark am 30.09.2026: „Jemand hat ein Tattoo, aber auf den Originalbildern
 * nicht zu sehen ist … Originalbild eine lange Hose an, aber auf dem
 * Oberschenkel ein Tattoo. Auf unserem Referenzbild, wo er ja eine kurze Hose
 * anhat, sieht man das Tattoo aber dann nicht."
 *
 * Das Modell kann nur zeigen, was ein Referenzbild zeigt. Was dort verdeckt
 * ist, muss deshalb als Text mitgehen — sonst fehlt es genau dann, wenn die
 * Kleidung wechselt. Gespeichert wird es in `characters.metadata` (jsonb),
 * damit dafür keine Migration nötig ist und es für jedes Bild dieser Person
 * gilt.
 */

export type Geschlecht = 'mann' | 'frau'

export const GESCHLECHTER: { wert: Geschlecht; text: string }[] = [
  { wert: 'mann', text: 'Mann' },
  { wert: 'frau', text: 'Frau' },
]

/** Körperstellen, an denen ein Hautzeichen sitzen kann (deutsch für die Anzeige, englisch für den Prompt). */
export const STELLEN = [
  { id: 'gesicht',        de: 'Gesicht',           en: 'face' },
  { id: 'hals',           de: 'Hals',              en: 'front of the neck' },
  { id: 'nacken',         de: 'Nacken',            en: 'nape of the neck' },
  { id: 'schulter_l',     de: 'Schulter links',    en: "the person's left shoulder" },
  { id: 'schulter_r',     de: 'Schulter rechts',   en: "the person's right shoulder" },
  { id: 'oberarm_l',      de: 'Oberarm links',     en: "the person's left upper arm" },
  { id: 'oberarm_r',      de: 'Oberarm rechts',    en: "the person's right upper arm" },
  { id: 'unterarm_l',     de: 'Unterarm links',    en: "the person's left forearm" },
  { id: 'unterarm_r',     de: 'Unterarm rechts',   en: "the person's right forearm" },
  { id: 'hand_l',         de: 'Hand links',        en: "the person's left hand" },
  { id: 'hand_r',         de: 'Hand rechts',       en: "the person's right hand" },
  { id: 'brust',          de: 'Brust',             en: 'chest' },
  { id: 'rippen',         de: 'Rippen / Flanke',   en: 'ribs and flank' },
  { id: 'bauch',          de: 'Bauch',             en: 'stomach' },
  { id: 'ruecken',        de: 'Rücken',            en: 'upper back' },
  { id: 'unterer_ruecken', de: 'Unterer Rücken',   en: 'lower back' },
  { id: 'gesaess',        de: 'Gesäß',             en: 'buttocks' },
  { id: 'huefte',         de: 'Hüfte / Becken',    en: 'hip' },
  { id: 'oberschenkel_l', de: 'Oberschenkel links',  en: "the person's left thigh" },
  { id: 'oberschenkel_r', de: 'Oberschenkel rechts', en: "the person's right thigh" },
  { id: 'knie_l',         de: 'Knie links',        en: "the person's left knee" },
  { id: 'knie_r',         de: 'Knie rechts',       en: "the person's right knee" },
  { id: 'wade_l',         de: 'Wade links',        en: "the person's left calf" },
  { id: 'wade_r',         de: 'Wade rechts',       en: "the person's right calf" },
  { id: 'fuss_l',         de: 'Fuß links',         en: "the person's left foot" },
  { id: 'fuss_r',         de: 'Fuß rechts',        en: "the person's right foot" },
] as const

export type StelleId = typeof STELLEN[number]['id']

export type Hautzeichen = { stelle: StelleId; text: string }

const MAX_ZEICHEN = 12
const MAX_TEXT = 200

export function stelleDe(id: string): string {
  return STELLEN.find(s => s.id === id)?.de ?? id
}

/** Nur bekannte Stellen mit nicht-leerem Text, getrimmt und begrenzt. */
export function bereinigeHautzeichen(roh: unknown): Hautzeichen[] {
  if (!Array.isArray(roh)) return []
  const raus: Hautzeichen[] = []
  for (const e of roh) {
    if (!e || typeof e !== 'object') continue
    const { stelle, text } = e as Record<string, unknown>
    if (typeof stelle !== 'string' || typeof text !== 'string') continue
    if (!STELLEN.some(s => s.id === stelle)) continue
    const t = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
    if (!t) continue
    raus.push({ stelle: stelle as StelleId, text: t })
    if (raus.length >= MAX_ZEICHEN) break
  }
  return raus
}

export function bereinigeGeschlecht(roh: unknown): Geschlecht | null {
  return roh === 'mann' || roh === 'frau' ? roh : null
}

export type PersonMerkmale = { hautzeichen: Hautzeichen[]; geschlecht: Geschlecht | null }

export function lesePersonMerkmale(metadata: unknown): PersonMerkmale {
  const m = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {}
  return { hautzeichen: bereinigeHautzeichen(m.hautzeichen), geschlecht: bereinigeGeschlecht(m.geschlecht) }
}

/**
 * Der Prompt-Block — oder null ohne Einträge.
 *
 * „Nur wenn die Stelle im Bild zu sehen ist" steht im Text, weil derselbe Block
 * an ein Kopfblatt und an ein Ganzkörperbild geht: Ein Oberschenkel-Tattoo
 * gehört nicht auf ein Gesicht, und bei langer Hose bleibt es verdeckt.
 * „Auch wenn das Referenzfoto die Stelle bedeckt zeigt" ist der Kern.
 */
export function hautzeichenText(zeichen: readonly Hautzeichen[]): string | null {
  const liste = bereinigeHautzeichen(zeichen)
  if (liste.length === 0) return null
  return [
    "SKIN MARKS OF THIS PERSON — permanent features of the body. These OVERRIDE the reference images: show each mark exactly as described whenever its body area is uncovered and visible in this image, even if a reference image shows that area covered by clothing or bare without the mark. 'Left' and 'right' are the person's own left and right (in a front view, the person's left is on the viewer's right). Where clothing covers the area, leave it hidden; never move a mark to another place:",
    ...liste.map(z => `- ${STELLEN.find(s => s.id === z.stelle)!.en}: ${z.text}`),
  ].join('\n')
}
