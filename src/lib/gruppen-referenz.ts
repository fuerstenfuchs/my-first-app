import type { Character } from '@/hooks/use-characters'
import type { Outfit } from '@/hooks/use-outfits'
import type { Referenz } from '@/lib/image-generation'

/**
 * Das Gruppen-Referenzbild (PROJ-78) — ein Blatt, auf dem alle Beteiligten
 * nebeneinander stehen.
 *
 * WARUM ES DAS GIBT. Mark will Paar- und Gruppenshootings. Der naheliegende
 * Weg wäre, einfach mehrere Personenfotos anzuhängen — und der scheitert an
 * der ZUORDNUNG, nicht an der Anzahl. Die Standardzeilen sagen dem Modell:
 *
 *     Image 1 = CHARACTER … Image 2 = CHARACTER … Image 3 = OUTFIT …
 *
 * Nichts darin verbindet Bild 3 mit Person 1. Das Modell rät, und die Jacke
 * landet bei der Falschen.
 *
 * Der Ausweg: EINMAL ein sauberes Blatt bauen, auf dem jede Person schon ihre
 * eigene Kleidung trägt. Danach ist die Zuordnung im BILD gelöst statt im
 * Text — und alle folgenden Aufnahmen brauchen nur noch dieses eine
 * Referenzbild. Dieselbe Idee wie bei der Referenzkette und den
 * Shooting-Platten: erst eine saubere Vorlage, dann daraus arbeiten.
 *
 * Mark am 06.09.2026: „Ja, auch mal den Weg b. Und dann schauen wir, was dabei
 * rauskommt."
 */

export type Beteiligt = {
  charakter: Character
  /** null heißt: die Kleidung aus dem Charakterbild bleibt. */
  outfit: Outfit | null
}

/** Was fotografisch noch trägt — siehe die Begründung in `warnung`. */
export const GRUPPE_MAX = 5
export const GRUPPE_MIN = 2

/**
 * Die Referenzbilder in der Reihenfolge, in der sie ans Modell gehen.
 *
 * PERSON UND KLEIDUNG DIREKT HINTEREINANDER. Stünden erst alle Personen und
 * dann alle Outfits, müsste das Modell über vier Bilder hinweg zählen, um
 * Bild 5 mit Bild 1 zu verbinden. Nebeneinander ist die Verbindung kurz genug,
 * dass sie hält.
 */
export function gruppenReferenzen(leute: Beteiligt[]): Referenz[] {
  const raus: Referenz[] = []
  for (const p of leute) {
    if (p.charakter.cover_image_url) {
      raus.push({ url: p.charakter.cover_image_url, rolle: 'character' })
    }
    if (p.outfit?.cover_image_url) {
      raus.push({ url: p.outfit.cover_image_url, rolle: 'outfit' })
    }
  }
  return raus
}

/**
 * Die Zuordnungszeilen — je Bild eine, in derselben Reihenfolge.
 *
 * KEINE NAMEN. „PERSON 1", nicht „Günther". Ein Name im Bildprompt zieht
 * Annahmen über Geschlecht, Alter und Herkunft nach sich, die dem
 * Referenzfoto widersprechen können — genau der Fehler, den die ganze
 * Prompt-Datenbank heute losgeworden ist. Die Reihenfolge ist der Anker,
 * nicht der Name.
 */
export function gruppenZuordnung(leute: Beteiligt[]): string[] {
  const raus: string[] = []
  leute.forEach((p, i) => {
    const nr = i + 1
    const platz = i === 0 ? 'leftmost' : i === leute.length - 1 ? 'rightmost' : `${nr}${nr === 2 ? 'nd' : nr === 3 ? 'rd' : 'th'} from the left`
    if (p.charakter.cover_image_url) {
      raus.push(
        `PERSON ${nr} — the face, hair, skin tone and body identity of the ` +
        `person standing ${platz} in the row. Take the identity only.`,
      )
    }
    if (p.outfit?.cover_image_url) {
      raus.push(
        `THE CLOTHES OF PERSON ${nr} — take only the garments, their cut, ` +
        `fabric and colour, and put them on PERSON ${nr}. Whoever wears them ` +
        `in this image is a mannequin for the clothes, not a person in the row.`,
      )
    }
  })
  return raus
}

/**
 * Der Prompt für das Blatt selbst.
 *
 * DAS BLATT IST EIN WERKZEUG, KEIN BILD. Es soll später als Vorlage dienen,
 * und daraus folgt jede einzelne Entscheidung hier:
 *
 *  - NEUTRALER GRUND und gleichmäßiges Licht, damit nichts von diesem Blatt
 *    in die späteren Bilder durchschlägt.
 *  - GANZKÖRPER, nichts angeschnitten — was hier fehlt, muss später erfunden
 *    werden.
 *  - ABSTAND zwischen den Personen. Bei einem Shooting-Bild sollen sich die
 *    Silhouetten überlappen; hier ist das Gegenteil richtig, weil das Modell
 *    später jede Person einzeln herauslesen muss. Wer sich hier berührt,
 *    verschmilzt dort.
 *  - ECHTE GRÖSSENVERHÄLTNISSE. Der häufigste Fehler bei Erwachsenem und Kind
 *    ist die falsche Höhe; steht sie hier richtig, stimmt sie später auch.
 *  - HÄNDE SICHTBAR UND GETRENNT. Freie Hände sind bei Bildmodellen die
 *    zuverlässigste Fehlerquelle. Hier bekommen sie eine feste Aufgabe.
 */
export function gruppenPrompt(leute: Beteiligt[]): string {
  const n = leute.length
  const zahlwort = ['', 'one', 'two', 'three', 'four', 'five'][n] ?? String(n)

  return [
    `A plain reference sheet showing exactly ${zahlwort} people standing side ` +
    `by side in a single row, facing the camera.`,
    '',
    'THIS IS A REFERENCE SHEET, NOT A SCENE',
    'Plain, evenly lit light grey studio background. Soft, even frontal light ' +
    'with no dramatic shadows and no shadows cast on the background. No set, ' +
    'no props, no location, no mood — nothing here should carry over into ' +
    'later pictures except the people themselves.',
    '',
    'THE ROW',
    `Exactly ${zahlwort} people, ${zahlwort} faces visible, and no one else ` +
    'anywhere in the frame. They stand in one straight row, in the order given ' +
    'by the reference images: PERSON 1 leftmost, then PERSON 2, and so on to ' +
    'the right.',
    '',
    'A hand\'s width of empty space between neighbours. They do NOT touch, ' +
    'their silhouettes do NOT overlap, and no one stands in front of anyone ' +
    'else. Each person must be readable on their own — this sheet will be used ' +
    'later to tell them apart.',
    '',
    'POSE — THE SAME FOR EVERYONE',
    'Standing upright and relaxed, weight evenly on both feet, shoulders ' +
    'square to the camera, looking straight into the lens with a neutral, ' +
    'friendly expression. Arms hanging relaxed at the sides, slightly away ' +
    'from the body. Both hands fully visible, fingers relaxed and clearly ' +
    'separated, nothing held and nothing hidden.',
    '',
    'FRAMING',
    'Full body, head to feet, with room above the heads and below the feet. ' +
    'Nothing cropped. Eye-level camera, a normal field of view so that ' +
    'proportions stay true — nothing wide-angle, nothing compressed.',
    '',
    'PROPORTIONS',
    'Keep the true relative heights and builds of the people as shown in their ' +
    'reference images. Do not even them out and do not make them all the same ' +
    'size — the height differences are part of what this sheet records.',
    '',
    'CLOTHING',
    'Each person wears their own garments exactly as given by their own ' +
    'clothing reference. Do not swap, mix or blend clothing between people. ' +
    'If two people wear similar colours, keep both, but make sure each garment ' +
    'stays on the person it belongs to.',
    '',
    'NO TEXT',
    'No names, no labels, no numbers, no captions, no watermarks anywhere in ' +
    'the image.',
    '',
    'Ultra-realistic photography, sharp across the whole row, true skin ' +
    'texture and fabric detail.',
  ].join('\n')
}

/**
 * Ein Satz für Mark, wenn die Gruppe groß wird.
 *
 * Nicht verbieten, sondern sagen, was passiert: Ab vier kippt es fotografisch
 * von Pose zu Formation, und die Gesichtstreue je Person sinkt, weil jedes
 * Gesicht weniger Bildfläche bekommt.
 */
export function warnung(anzahl: number): string | null {
  if (anzahl <= 3) return null
  if (anzahl === 4) {
    return 'Bei vier Personen wird aus Haltung eine Aufstellung — und jedes ' +
           'Gesicht bekommt weniger Bildfläche, die Ähnlichkeit sinkt. Noch machbar.'
  }
  return 'Fünf ist die Grenze. Jedes Gesicht bekommt hier so wenig Fläche, ' +
         'dass die Ähnlichkeit spürbar nachlässt — im Zweifel lieber zwei ' +
         'Blätter mit je zwei bis drei Personen.'
}
