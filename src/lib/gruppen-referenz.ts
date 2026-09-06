import type { Character } from '@/hooks/use-characters'
import type { Outfit } from '@/hooks/use-outfits'
import type { Referenz } from '@/lib/image-generation'

const ZEILENUMBRUCH = '\n'

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
    ...(n === 2 ? zweiSpalten() : zweiReihen(zahlwort)),
    '',
    'THIS IS A REFERENCE SHEET, NOT A SCENE',
    'Plain, evenly lit light grey studio background. Soft, even frontal light ' +
    'with no dramatic shadows and no shadows cast on the background. No set, ' +
    'no props, no location, no mood — nothing here should carry over into ' +
    'later pictures except the people themselves.',
    '',
    `Exactly ${zahlwort} people and no one else anywhere on the sheet.`,
    '',
    'FILL THE SHEET',
    'Use the whole surface. Do not leave wide empty margins at the sides or ' +
    'large empty areas between the people — every part of the sheet that is ' +
    'not a person is wasted, and the faces are the reason this sheet exists.',
    '',
    'POSE — THE SAME FOR EVERYONE',
    'In the full-body view: standing upright and relaxed, weight evenly on ' +
    'both feet, shoulders square to the camera, looking straight into the ' +
    'lens with a neutral, friendly expression. Arms hanging relaxed at the ' +
    'sides, slightly away from the body. Both hands fully visible, fingers ' +
    'relaxed and clearly separated, nothing held and nothing hidden.',
    '',
    'In the close-up: head and shoulders only, cropped just below the ' +
    'collarbone, straight on at eye level, looking into the lens, same neutral ' +
    'expression, same even light. No hands, no props, nothing in front of the ' +
    'face.',
    '',
    'PROPORTIONS',
    'In the full-body views, keep the true relative heights and builds of the ' +
    'people as shown in their reference images. Do not even them out and do ' +
    'not make them all the same size — the height differences are part of what ' +
    'this sheet records.',
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
    'Ultra-realistic photography, sharp everywhere, true skin texture and ' +
    'fabric detail.',
  ].join(ZEILENUMBRUCH)
}

/**
 * ZWEI PERSONEN — ZWEI SPALTEN, NICHT ZWEI REIHEN.
 *
 * Mark am 06.09.2026 am zweiten Blatt: „kann das Sheet bei zwei Personen noch
 * mal anders gestalten wie bei drei oder vier Personen. Da kann man wirklich
 * den Kopf größer machen. Da ist viel zu viel Platz verschenkt."
 *
 * Nachgerechnet, und er hat recht. Ein Kopf wird so groß wie das KLEINERE von
 * beidem: die Höhe seiner Reihe oder die Blattbreite geteilt durch die Zahl der
 * Personen. Auf einem Blatt von 1536 × 1024:
 *
 *   2 Personen → Reihenhöhe 410, Platzbreite 768 → Kopf 410, 358 px je Platz
 *                verschenkt
 *   3 Personen → Reihenhöhe 410, Platzbreite 512 → Kopf 410, passt
 *   4 Personen → Reihenhöhe 410, Platzbreite 384 → Kopf 384, die Breite
 *                begrenzt
 *
 * Bei zweien begrenzt also die HÖHE, und die halbe Blattbreite liegt brach.
 * Deshalb hier ein anderer Aufbau: jede Person bekommt eine Blatthälfte, und
 * INNERHALB dieser Hälfte stehen Ganzkörper und Nahaufnahme nebeneinander. Die
 * Nahaufnahme darf dann fast die volle Blatthöhe nutzen — rund 600 statt 410
 * Pixel Kopfhöhe.
 *
 * Ab drei füllt die Reihe die Breite von selbst; dort bleibt es bei zwei
 * Reihen, weil eine Spalte je Person zu schmal würde.
 */
function zweiSpalten(): string[] {
  return [
    'A plain reference sheet of exactly two people, split into TWO EQUAL ' +
    'HALVES by an invisible vertical line down the middle.',
    '',
    'THE LAYOUT',
    'LEFT HALF = PERSON 1. RIGHT HALF = PERSON 2. Nothing crosses the middle, ' +
    'and neither person appears in the other half.',
    '',
    'Inside each half, two views of that same person, side by side:',
    '• on the left of the half: the full-body standing figure, head to feet, ' +
    'nothing cropped, taking up about a third of the width of that half',
    '• on the right of the half: a head-and-shoulders close-up of the SAME ' +
    'person, as large as the half allows — it should reach close to the top ' +
    'and bottom edges of the sheet',
    '',
    'THE CLOSE-UPS ARE THE POINT OF THIS SHEET. With only two people there is ' +
    'room to make each face very large, and that is exactly what makes the ' +
    'sheet usable as an identity reference later. The full-body views carry ' +
    'the clothing and the true height difference.',
  ]
}

/** Drei bis fünf Personen — die Reihe füllt die Breite von selbst. */
function zweiReihen(zahlwort: string): string[] {
  return [
    `A plain reference sheet of exactly ${zahlwort} people, laid out in TWO ` +
    'ROWS on one sheet.',
    '',
    'THE TWO ROWS',
    `TOP ROW, about 50% of the sheet height: all ${zahlwort} people standing ` +
    'full body, side by side, facing the camera, in the order given by the ' +
    'reference images: PERSON 1 leftmost, then PERSON 2, and so on to the right.',
    `BOTTOM ROW, about 45% of the sheet height: the same ${zahlwort} faces in ` +
    'THE SAME ORDER — head-and-shoulders close-ups, each face as large as the ' +
    'row allows, evenly spaced across the full width.',
    '',
    'THE BOTTOM ROW IS THE POINT OF THIS SHEET. In a full-body row a head is ' +
    'barely a hundred pixels tall — too little to carry a face into another ' +
    'picture later. The close-ups are what makes this sheet usable as an ' +
    'identity reference; the full-body row carries the clothing and the true ' +
    'height differences.',
    '',
    'The face below position 1 is PERSON 1, the face below position 2 is ' +
    'PERSON 2, and so on. Same person, same order, in both rows.',
    '',
    'In the top row: a gap about one shoulder wide between neighbours. They ' +
    'do NOT touch, their silhouettes do NOT overlap, and no one stands in ' +
    'front of anyone else. Each person must be readable on their own — this ' +
    'sheet will be used later to tell them apart.',
  ]
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
