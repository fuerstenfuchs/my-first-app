/**
 * Personenbilder (PROJ-92) — die Regeln, ohne Oberfläche.
 *
 * Mark am 29.09.2026: Person, Körperbau und Outfit miteinander kombinieren und
 * daraus Referenzbilder erzeugen, die in Bild-Prompts und im Scene Builder
 * benutzt werden. Und: „alles auf einmal" — Ganzkörper vorn, vier Ansichten und
 * Referenzsheet in einem Klick.
 *
 * ABSICHTLICH FREI VON REACT UND SUPABASE. Jede Erzeugung ist bezahlt; der
 * Prompt, die Reihenfolge der Bilder und ihre Beschriftung sind die Stellen,
 * an denen ein Fehler teuer wäre. Nur als reine Funktionen sind sie ohne
 * Anmeldung prüfbar.
 *
 * WARUM EIGENE ZUORDNUNGSZEILEN UND EIN EIGENER VORRANGSATZ (Critic, 29.09.2026,
 * an `image-generation.ts` nachgemessen): Die Charakterrolle sagt „take the
 * face, hair, skin tone and BODY IDENTITY of this person", und der Standard-
 * Vorrangsatz am Ende des Prompts sagt „follow the reference image, ignore the
 * conflicting words". Zeigte das Referenzsheet einen anderen Körper als der
 * gewählte, überstimmte der Satz die Körperzeilen — und das bezahlte Bild
 * ignorierte die Körperform, um die es auf dieser Seite geht.
 */
import {
  GROESSE_VORGABE, ROLLEN_ANWEISUNG, promptFuerAuftrag,
  type ReferenzRolle,
} from './image-generation'
import { koerperMerkmaleText, type KoerperAuswahl } from './referenzkette'
import { hautzeichenText, type Geschlecht, type Hautzeichen } from './person-merkmale'
import { nachNutzen, rangVon } from './referenz-auswahl'
import type { RefImage } from './reference-images'
import type { AspectRatioKey } from './scene-builder-options'

// ── Formate ────────────────────────────────────────────────────────────────

export type FormatId = 'vorn' | 'vier' | 'sheet'

export const FORMATE: { id: FormatId; label: string; beschreibung: string }[] = [
  { id: 'vorn',  label: 'Ganzkörper vorn', beschreibung: 'Ein Bild, stehend, neutraler Grund' },
  { id: 'vier',  label: 'Vier Ansichten',  beschreibung: 'Vorn, Dreiviertel, Seite, Rücken' },
  { id: 'sheet', label: 'Referenzsheet',   beschreibung: 'Kopf groß, Körper vorn und hinten' },
]

/** Die feste Reihenfolge, in der beauftragt wird — unabhängig von der Klickreihenfolge. */
export const FORMAT_REIHE: FormatId[] = FORMATE.map(f => f.id)

/** Auswahl in feste Reihenfolge bringen, Doppelte und Unbekannte raus. */
export function sortiereFormate(ids: readonly string[]): FormatId[] {
  return FORMAT_REIHE.filter(f => ids.includes(f))
}

/** Der Name der Variante beim Charakter, in die die Ergebnisse wandern. */
export const VARIANTE_NAME = 'Personenbild'

/** „1 Bild" / „3 Bilder" — die Zahl steht auf dem Knopf, VOR dem Klick. */
export function bilderText(n: number): string {
  if (n === 0) return 'Kein Format gewählt'
  return n === 1 ? '1 Bild' : `${n} Bilder`
}

// ── Die Bilder der Person ──────────────────────────────────────────────────

export type PersonQuelle = { url: string; art: 'sheet' | 'kopf' | 'koerper' | 'titel' }

const schluessel = (s: string) => s.trim().toLowerCase()

/**
 * Welche Bilder der Person gehen ans Modell?
 *
 * 1. Ein Referenzsheet (oder Kombi-Blatt) — ein Bild, das Gesicht und Körper
 *    zeigt. Dieselbe Rangfolge wie der Scene Builder.
 * 2. Sonst das Kopf-Blatt und das Körper-Blatt, soweit vorhanden.
 * 3. Sonst das Titelbild.
 */
export function personQuellen(bilder: readonly RefImage[], titelbild: string | null): PersonQuelle[] {
  const sortiert = nachNutzen([...bilder])
  const sheet = sortiert.find(b => rangVon(b.label) <= 1)
  if (sheet) return [{ url: sheet.url, art: 'sheet' }]

  const raus: PersonQuelle[] = []
  const kopf = sortiert.find(b => schluessel(b.label) === 'kopf')
  const koerper = sortiert.find(b => ['körper', 'koerper'].includes(schluessel(b.label)))
  if (kopf) raus.push({ url: kopf.url, art: 'kopf' })
  if (koerper) raus.push({ url: koerper.url, art: 'koerper' })
  if (raus.length) return raus

  return titelbild ? [{ url: titelbild, art: 'titel' }] : []
}

/**
 * Das Outfit-Bild: das beste Blatt der Varianten, sonst das Titelbild.
 * „Vorne freigestellt" reicht (Rang 3); alles Unbenannte lieber nicht.
 */
export function outfitQuelle(bilder: readonly RefImage[], titelbild: string | null): string | null {
  const bestes = nachNutzen([...bilder])[0]
  if (bestes && rangVon(bestes.label) <= 3) return bestes.url
  return titelbild ?? bestes?.url ?? null
}

// ── Zuordnungszeilen ───────────────────────────────────────────────────────

const OHNE_KLEIDUNG = 'Ignore the clothing shown on it.'

/**
 * Woher der Körper kommt.
 *  - keine:  weder Textzeilen noch Körperbild → der Körper der Person gilt.
 *  - zeilen: Textzeilen (mit oder ohne Körperbild) → der Körper der Person gilt,
 *            AUSSER dort, wo die Zeilen etwas anderes sagen.
 *  - bild:   nur ein Körperbild, keine Zeilen → das Bild bestimmt den Körper.
 *
 * WARUM „AUSSER DORT" UND NICHT „NIMM NICHTS" (Critic, 29.09.2026): Die erste
 * Fassung sagte bei jeder gesetzten Region „Do NOT take its body proportions".
 * Setzte Mark nur „Beinlänge sehr lang", hatte das Modell für Größe, Becken,
 * Oberweite usw. keine Quelle mehr und erfand sie — dasselbe Muster wie zuvor
 * („der Körper sieht immer gleich aus"). `koerperMerkmaleText` macht es richtig:
 * „Where a reference image shows the body differently, follow these lines."
 */
export type KoerperModus = 'keine' | 'zeilen' | 'bild'

export function koerperModus(hatZeilen: boolean, hatBild: boolean): KoerperModus {
  if (hatZeilen) return 'zeilen'
  return hatBild ? 'bild' : 'keine'
}

const KOERPER_TEIL: Record<KoerperModus, string> = {
  keine: 'Take the body proportions from it as well.',
  zeilen: 'Take the body proportions from it as well, EXCEPT where the ADDITIONAL BODY CHARACTERISTICS lines below say otherwise.',
  bild: 'Do NOT take its body proportions: the body-shape image below decides those.',
}

const PERSON_ZEILE: Record<PersonQuelle['art'], (m: KoerperModus) => string> = {
  sheet: m =>
    'REFERENCE SHEET OF THE PERSON — take the face, hair, skin tone and identity from it. ' +
    OHNE_KLEIDUNG + ' ' + KOERPER_TEIL[m],
  kopf: () =>
    'HEAD REFERENCE SHEET — take the face, hair, skin tone and identity from it. ' +
    'It shows the same person from several angles.',
  koerper: m =>
    'BODY REFERENCE SHEET — ' +
    KOERPER_TEIL[m].replace('from it as well', 'from it') + ' ' +
    OHNE_KLEIDUNG + ' The face in it is secondary; the head reference decides the face.',
  titel: m =>
    'PHOTO OF THE PERSON — take the face, hair, skin tone and identity from it. ' +
    OHNE_KLEIDUNG + ' ' + KOERPER_TEIL[m],
}

const KOERPERFIGUR_ZEILE: Record<Exclude<KoerperModus, 'keine'>, string> = {
  zeilen:
    'BODY SHAPE REFERENCE — a grey 3D mannequin that shows one extreme body region. ' +
    'Use it only as a visual example for the body regions named in the ADDITIONAL BODY CHARACTERISTICS lines below; ' +
    'those lines decide. Ignore its grey colour and its missing face, hair and clothing; every other body part follows the person reference.',
  bild:
    'BODY SHAPE REFERENCE — a grey 3D mannequin. Take its body proportions ' +
    '(build, height, leg length, hips, bust, waist, shoulders, limbs) from it. ' +
    'Ignore its grey colour and its missing face, hair and clothing; the person and outfit references decide those.',
}

function vorrangText(m: KoerperModus): string {
  const koerper =
    m === 'keine'
      ? 'the body proportions come from the person reference. '
      : m === 'bild'
        ? 'the body proportions come from the body-shape image. '
        : 'the body proportions come from the person reference, except that the ADDITIONAL BODY CHARACTERISTICS lines override it (the body-shape image, if present, only illustrates the regions they name). '
  return (
    'Priority: the face, hair and skin tone come from the person reference (the SKIN MARKS lines below, if any, are added on top of it); the garments come from the outfit reference; ' +
    koerper +
    'Everything else — pose, framing, lighting, background — comes from the text.'
  )
}

// ── Die drei Prompts ───────────────────────────────────────────────────────

const STIL_GEMEINSAM = `Style requirements:
- Photorealistic
- Studio-quality reference photograph
- Clean plain light-grey background, no background elements
- Even, soft, diffuse light from the front, no cast shadows
- Sharp focus, high detail
- No props, no text, no labels, no watermark`

const KLEIDUNG = `CLOTHING: the person wears exactly the outfit of the outfit reference — the same garments, cut, fabric, colour, pattern and details. Nothing added, nothing left out. Shoes and accessories only if the outfit reference shows them; otherwise plain neutral shoes.`

const PRUEFUNG_KOERPER = `The clothing must NOT hide the body proportions: shoulder width, waist, hip width, limb length and build must stay clearly recognisable.`

export const PERSONENBILD_PROMPT: Record<FormatId, string> = {
  vorn: `Using the reference images, create a professional full-body reference photograph of this person wearing the outfit.

OUTPUT FRAME: one single PORTRAIT image, 2:3 — the whole person from the top of the head to the soles of the feet fully visible, with a small margin above the head and below the feet. Do not output a square or a landscape image.

The person stands naturally and straight, facing the camera, arms relaxed slightly away from the body, neutral expression, eyes to camera.

Preserve exactly: facial features, skin tone, hairstyle and hair colour, apparent age. Do not redesign, beautify, age or reinterpret the person.

${KLEIDUNG}
${PRUEFUNG_KOERPER}

${STIL_GEMEINSAM}`,

  vier: `Using the reference images, create a professional full-body character reference sheet of this person wearing the outfit.

OUTPUT FRAME: one single WIDE LANDSCAPE image, roughly 2:1 — twice as wide as it is tall — so that all four standing figures fit side by side in ONE single row at full height. Do not output a square or a portrait image.

Preserve exactly: facial features, skin tone, hairstyle and hair colour. Do not redesign or reinterpret the person.

The sheet contains exactly four panels, arranged in a single horizontal row — nothing above or below, no second row, no grid:
- Full-body front view
- Full-body 3/4 left view
- Full-body left side profile
- Full-body back view

CRITICAL RULE: each of these four views appears exactly ONCE. Do not repeat the sequence, do not duplicate the row.

Use the exact same outfit, hairstyle and styling in every view. The person stands naturally with arms relaxed at the sides and a neutral expression. Head angle follows the body angle in each panel.

${KLEIDUNG}
${PRUEFUNG_KOERPER}

${STIL_GEMEINSAM}
- Panels of equal width, evenly spaced, all figures on the same baseline and at the same scale
- The panels sit directly next to each other on one continuous background — no frames, no borders, no drop shadows`,

  sheet: `Using the reference images, create ONE single combined reference sheet of this person wearing the outfit.

OUTPUT FRAME: one single WIDE 16:9 LANDSCAPE image. Do not output a square or a portrait image.

The sheet contains exactly three panels side by side, left to right:

PANEL 1 (leftmost, LARGE — roughly half the total width):
- Head and shoulders only, in a three-quarter front view turned slightly to one side so that one cheek and the side of the face are partly visible; the neckline or collar of the outfit is visible
- THE HEAD MUST FILL THIS PANEL. Top of the hair almost touching the upper edge, chin roughly two thirds of the way down, shoulders cut off by the lower edge. A tight portrait crop — NOT a small figure in a large empty frame.
- The face here is the LARGEST element on the entire sheet, sharp and detailed; this is the only place where the face appears
- Neutral expression, eyes to camera

PANEL 2 (middle):
- Full body from the front, standing straight, arms relaxed at the sides, wearing the outfit
- CROPPED AT THE NECK — the head must NOT be visible in this panel at all

PANEL 3 (rightmost):
- Full body from behind, standing straight, arms relaxed at the sides, wearing the outfit
- The back of the head may be visible, but no face

CRITICAL RULE: the face appears exactly ONCE, in panel 1. Do not add extra head shots, insets or thumbnails anywhere.

Preserve exactly: facial features, skin tone, hairstyle and hair colour. Do not redesign or reinterpret the person.

${KLEIDUNG}
${PRUEFUNG_KOERPER}

${STIL_GEMEINSAM}
- Consistent scale and identical lighting across all three panels`,
}

/** Format, dessen Größenangabe mitgeht — nur beim Hochformat sinnvoll. */
const AUFTRAGS_FORMAT: Record<FormatId, AspectRatioKey | null> = {
  vorn: null,
  vier: null,
  sheet: null,
}

/** Das Hochformat steht im Prompt (2:3) UND in der Größe; eine zusätzliche
 *  Formatansage („4:5") widerspräche beiden (Critic, 29.09.2026). */
const AUFTRAGS_GROESSE: Record<FormatId, string> = {
  vorn: '1024x1536',
  vier: GROESSE_VORGABE,
  sheet: GROESSE_VORGABE,
}

// ── Aufträge ───────────────────────────────────────────────────────────────

export type PersonenbildEingabe = {
  personId: string
  personName: string
  personQuellen: PersonQuelle[]
  outfitId: string
  outfitName: string
  outfitBild: string | null
  /** Blender-Körperbild als Referenz — oder null. */
  koerperBild: string | null
  koerperAuswahl: KoerperAuswahl
  /** Wortwahl für Bauch und Brustkorb; null = allgemein. */
  geschlecht?: Geschlecht | null
  /** Tattoos, Narben usw. der Person — auch wenn das Originalfoto sie verdeckt zeigt. */
  hautzeichen?: readonly Hautzeichen[]
  formate: readonly string[]
  modell: string
  /** Eine Kennung für den ganzen Durchlauf; gemeinsam für alle Formate. */
  durchlaufId: string
}

export type Auftrag = {
  format: FormatId
  titel: string
  prompt: string
  size: string
  aspect_ratio: AspectRatioKey | null
  model: string
  referenzUrls: string[]
  rollen: ReferenzRolle[]
  scene_meta: Record<string, unknown>
}

/** Was fehlt, damit überhaupt erzeugt werden kann — leer heißt: alles da. */
export function fehlendes(e: Pick<PersonenbildEingabe, 'personQuellen' | 'outfitBild' | 'formate'>): string[] {
  const raus: string[] = []
  if (e.personQuellen.length === 0) raus.push('Bild der Person')
  if (!e.outfitBild) raus.push('Bild des Outfits')
  if (sortiereFormate(e.formate).length === 0) raus.push('Format')
  return raus
}

export function baueAuftraege(e: PersonenbildEingabe): Auftrag[] {
  const koerperZeilen = koerperMerkmaleText(e.koerperAuswahl, e.geschlecht)
  const zeichenZeilen = hautzeichenText(e.hautzeichen ?? [])
  const modus = koerperModus(!!koerperZeilen, !!e.koerperBild)

  // Reihenfolge = Reihenfolge der Bilder: Person(en), Outfit, Körperfigur.
  const zeilen: string[] = e.personQuellen.map(q => PERSON_ZEILE[q.art](modus))
  const urls: string[] = e.personQuellen.map(q => q.url)
  const rollen: ReferenzRolle[] = e.personQuellen.map(() => 'character')

  if (e.outfitBild) {
    zeilen.push(ROLLEN_ANWEISUNG.outfit)
    urls.push(e.outfitBild)
    rollen.push('outfit')
  }
  if (e.koerperBild && modus !== 'keine') {
    zeilen.push(KOERPERFIGUR_ZEILE[modus])
    urls.push(e.koerperBild)
    rollen.push('character')
  }

  return sortiereFormate(e.formate).map(format => {
    const teile = [PERSONENBILD_PROMPT[format]]
    if (koerperZeilen) teile.push(koerperZeilen)
    if (zeichenZeilen) teile.push(zeichenZeilen)
    const ratio = AUFTRAGS_FORMAT[format]
    const label = FORMATE.find(f => f.id === format)!.label
    return {
      format,
      titel: `${e.personName} — ${e.outfitName} — ${label}`,
      prompt: promptFuerAuftrag(teile.join('\n\n'), ratio, rollen, zeilen, vorrangText(modus)),
      size: AUFTRAGS_GROESSE[format],
      aspect_ratio: ratio,
      model: e.modell,
      referenzUrls: urls,
      rollen,
      scene_meta: {
        name: `${e.personName} — ${e.outfitName} — ${label}`,
        herkunft: 'personenbild',
        personenbild_id: e.durchlaufId,
        format,
        person_id: e.personId,
        outfit_id: e.outfitId,
        koerper: e.koerperAuswahl,
        geschlecht: e.geschlecht ?? null,
        hautzeichen: e.hautzeichen ?? [],
        koerper_bild: e.koerperBild,
      },
    }
  })
}
