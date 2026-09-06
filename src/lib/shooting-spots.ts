import type { Location } from '@/hooks/use-locations'

/**
 * Die vier Shooting-Plätze, die aus einer Location als EINZELBILDER entstehen
 * (PROJ-74).
 *
 * WARUM EINZELBILDER UND NICHT NUR EIN BLATT: Mark am 06.09.2026 hat den
 * Konstruktionsfehler des Shooting-Sheets benannt — „woher soll die KI dann
 * wissen, welches von diesen Bildern genommen wird? wird dann nur das ganze
 * Bild als Referenz hinzugefügt."
 *
 * Er hat recht. Ein Blatt mit sechs Feldern geht später als EIN Bild in den
 * Auftrag; das Modell sieht sechs Hintergründe und weiß nicht, welcher gemeint
 * ist. Beim Charakter-Sheet ist das harmlos — dort zeigen alle Felder dieselbe
 * Person und verstärken sich. Hier sind die Felder ALTERNATIVEN, und gewollt
 * ist genau eine.
 *
 * Das Blatt bleibt als Übersicht („Menü der Plätze"). Diese vier Bilder sind
 * das, was danach wirklich als Referenz taugt: je ein vollformatiger, leerer
 * Hintergrund in voller Auflösung statt als Sechstel.
 *
 * WARUM VIER UND NICHT SECHS: Marks Zahl — „dann bräuchte ich zusätzlich noch,
 * sagen wir, vier weitere Bilder". Vier reichen auch sachlich: Es sind die vier
 * Arten von Hintergrund, die sich fotografisch wirklich unterscheiden. Ein
 * fünfter wäre eine Variante, keine neue Möglichkeit.
 */
export type SpotKey = 'weit' | 'tiefe' | 'flaeche' | 'gegenlicht'

export type ShootingSpot = {
  key: SpotKey
  /** Steht auf dem Knopf und später am Bild. */
  label: string
  /** Ein Satz für Mark, nicht für das Modell. */
  hinweis: string
  /** Der Textbaustein, der diesen Platz vom nächsten unterscheidet. */
  baustein: string
}

export const SHOOTING_SPOTS: ShootingSpot[] = [
  {
    key: 'weit',
    label: 'Weit',
    hinweis: 'Der Ort selbst trägt das Bild — die Person steht darin.',
    baustein:
      'A wide view in which the location itself is the subject. The standing ' +
      'position is in the lower centre, small in the frame, with the place ' +
      'opening up around and behind it.',
  },
  {
    key: 'tiefe',
    label: 'Mit Tiefe',
    hinweis: 'Ein Gang, Weg oder eine Reihe, die ins Bild hineinführt.',
    baustein:
      'A view with strong depth — a corridor, path, arcade, colonnade, jetty ' +
      'or row that leads the eye from the standing position back into the ' +
      'distance. The standing position sits at the near end of that line.',
  },
  {
    key: 'flaeche',
    label: 'Fläche',
    hinweis: 'Wand oder Material für eine nahe Aufnahme.',
    baustein:
      'A plain, evenly textured surface of this location — a wall, a door, ' +
      'foliage, water or stone — filling the frame behind the standing ' +
      'position, close enough that the material reads clearly.',
  },
  {
    key: 'gegenlicht',
    label: 'Gegenlicht',
    hinweis: 'Das Licht kommt von hinten — Kontur statt Fläche.',
    baustein:
      'A spot where the main light comes from behind the standing position: ' +
      'an opening, a window, a gap between buildings or the open sky beyond. ' +
      'The background is brighter than the foreground.',
  },
]

/**
 * Baut den Prompt für EIN Einzelbild.
 *
 * DREI DINGE MÜSSEN HIER ZUSAMMENKOMMEN, sonst ist die Platte unbrauchbar:
 *
 * 1. LEER. Kein Mensch, keine Silhouette, kein Schatten einer Person. Mark
 *    setzt die Person später über sein eigenes Referenzfoto hinein — eine
 *    erfundene Figur müsste er erst wieder wegräumen.
 * 2. NEUTRALES LICHT. Mark: „Brennweite wird ja sowieso von mir vorgegeben,
 *    auch die Tageszeit und dementsprechend auch das Licht." Eine Platte, die
 *    schon Golden Hour mitbringt, ist für nichts anderes mehr zu gebrauchen.
 * 3. KEIN BLATT. Das ist der Unterschied zum Sheet: ein einziges Foto, randlos,
 *    ohne Rahmen, ohne Beschriftung. Wer hier ein Raster bekommt, hat wieder
 *    das Problem, das diese Bilder gerade lösen sollen.
 */
export function spotPrompt(spot: ShootingSpot, location: Location): string {
  const ort = [location.name, location.description?.trim()]
    .filter(Boolean).join(' — ')

  return [
    `THE DEPICTED LOCATION IS: ${ort}.`,
    'Treat this as established fact, not as a guess.',
    '',
    'Using the uploaded image as the reference for this place, produce ONE ' +
    'single photograph of a shooting background at this location.',
    '',
    'THIS IS A BACKGROUND PLATE, AND IT IS EMPTY.',
    'No person, no model, no silhouette, no mannequin, no bystander and no ' +
    'shadow of a person anywhere in the frame. The spot where someone would ' +
    'stand is left completely clear. Do not mark it with a circle, a cross or ' +
    'an outline — a marker becomes a figure.',
    '',
    `THE SPOT: ${spot.baustein}`,
    '',
    'LIGHT',
    'Soft, even daylight. No dramatic directional sun, no golden hour, no ' +
    'night. The time of day is chosen later, when the actual picture is made.',
    '',
    'FRAMING',
    'Eye level, a normal field of view — nothing wide-angle and nothing ' +
    'compressed, so the plate stays usable whatever lens is chosen later. ' +
    'Vertical space above and below the standing position, so the plate can be ' +
    'cropped to full body or half body.',
    '',
    'ONE PHOTOGRAPH, NOT A SHEET',
    'A single full-frame photograph. No grid, no panels, no collage, no ' +
    'border, no caption, no label, no text of any kind anywhere in the image.',
    '',
    'Ultra-realistic photography, true to the materials, colours and ' +
    'architecture of the reference image. Reconstruct unseen parts of the ' +
    'place logically and stay consistent with what is visible.',
  ].join('\n')
}
