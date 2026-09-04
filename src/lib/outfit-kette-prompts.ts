/**
 * Die vier Blätter der Outfit-Referenzkette (PROJ-54).
 *
 * Mark am 03.09.2026: „Da ist es ja auch so, dass wir ein Referenzbild
 * brauchen, also nur mit der Kleidung ohne einen Menschen praktisch."
 *
 * DREI LEHREN STECKEN HIER DRIN, alle aus echten Fehlern:
 *
 * 1. „NO PERSON" allein genügt nicht. Verneinungen tragen bei Bildmodellen
 *    schlecht — was verlässlich wirkt, ist die POSITIVE Beschreibung desselben
 *    Zustands: hohl, offene Ausschnitte, Hintergrund scheint hindurch. Beides
 *    steht deshalb nebeneinander, nicht das eine statt des anderen.
 * 2. Der häufigste ungebetene Gast bei freigestellter Kleidung ist NICHT ein
 *    Mensch, sondern ein KLEIDERBÜGEL oder eine Schneiderpuppe. Beides steht
 *    ausdrücklich in der Verbotsliste.
 * 3. Es genügt nicht zu sagen, WAS auf dem Blatt sein soll — auch WIE VIELE
 *    Felder, dass sie sich nicht wiederholen, und dass das Motiv sie AUSFÜLLT.
 *    Ohne diese Zeilen kamen am 03.09.2026 zehn Gesichter in zwei Reihen.
 */

/**
 * Gilt für ALLE vier Blätter.
 *
 * Bewusst getrennt von `EINZELBILD` weiter unten: Für einen Stoff-Makro gibt
 * es keine getragene Silhouette und keinen freien Hintergrund. Stünden diese
 * Regeln auch dort, müsste das Modell zwischen zwei Anweisungen wählen — und
 * die wahrscheinlichere Auflösung wäre, im Detailfeld wieder das ganze
 * Kleidungsstück zu zeigen. Also genau der Fehler, den das Detailblatt
 * verhindern soll.
 */
const KERN = `ABSOLUTE RULES:
- NO PERSON. No human body, no face, no hands, no arms, no legs, no skin.
- NO HANGER, no clothes rail, no dress form, no mannequin, no torso stand, no visible support of any kind. Nothing holds the garment up.
- Photorealistic product photography. Colour, fabric, pattern, cut and proportions exactly as in the reference — do not restyle, recolour or redesign anything.
- Do not ADD any text, label, logo, watermark or prop that is not already part of the garment itself. Printing, embroidery or a logo that the garment carries in the reference stays exactly where it is, at the same size and colour.`

/** Gilt für die Blätter, die das ganze Kleidungsstück zeigen — NICHT für Makros. */
const EINZELBILD = `HOW THE GARMENT IS SHOWN ("ghost mannequin"):
- It keeps the three-dimensional shape and drape of a worn garment, but it is HOLLOW: the neckline, the sleeve openings and the hem are open, the background is visible through them, and the inside lining shows at the collar.
- Plain, seamless, very light neutral grey background. Nothing else in the frame.
- Even, diffuse light from the front. NO cast shadows on the background, no shadow pooling beneath the garment.
- Straight-on view, camera at the vertical centre of the garment, no perspective distortion, symmetrical.

IF THE REFERENCE SHOWS A COMPLETE LOOK of several pieces (for example top, trousers and shoes), show ALL of them together in their worn arrangement — top above bottom, shoes below — as one coherent outfit. Do not drop pieces and do not merge them into a single garment.

IF THE REFERENCE SHOWS ONLY ONE PIECE (for example only a top), show ONLY that one piece. Do not invent trousers, a skirt, shoes or accessories to complete the look. What is not in the reference is not in the image.`

export const OUTFIT_VORNE_PROMPT = `Using the reference image, create a clean product shot of THIS garment seen from the FRONT.

OUTPUT FRAME: one single VERTICAL PORTRAIT image, roughly 3:4.

${KERN}

${EINZELBILD}

FRAMING — it must FILL the frame:
- Centred, seen straight from the front
- Reaching close to the top and bottom edges; only a narrow margin of background remains
- NOT a small item floating in a large empty frame

This is ONE single image — not a sheet, not a grid, not a collage.`

export const OUTFIT_RUECKSEITE_PROMPT = `Using the reference image, create a clean product shot of THE SAME garment seen from the BACK.

OUTPUT FRAME: one single VERTICAL PORTRAIT image, roughly 3:4.

The reference shows the front of this exact piece. Keep colour, fabric, pattern, cut and proportions identical — you are turning the same garment around, not inventing a new one.

CRITICAL: front-only features must NOT appear on the back. A button placket, a front zip, chest pockets or a front print belong to the front and are absent here, unless the garment genuinely has them on the back as well. Show what the back of this piece actually looks like: the back yoke, the shoulder seams, the hem as it continues around.

${KERN}

${EINZELBILD}

FRAMING — it must FILL the frame:
- Centred, seen straight from behind, at the same scale and camera height as a front view of the same piece
- Reaching close to the top and bottom edges

This is ONE single image — not a sheet, not a grid, not a collage.`

export const OUTFIT_DETAILS_PROMPT = `Using the reference image, create a detail sheet of THE SAME garment.

OUTPUT FRAME: one single SQUARE 1:1 image.

The sheet contains exactly four panels in a 2x2 grid — nothing more, no second grid, no repetition:
- The fabric surface and its texture, close up
- A seam or edge finish, close up
- The pattern, print or embroidery, close up (if the garment has none, show the weave of the material instead)
- A fastening — buttons, zip, buckle or tie (if the garment has none, show the hem or the cuff instead)

CRITICAL RULE: each of these four close-ups appears exactly ONCE. Do not repeat a panel, do not add a fifth, and do NOT show the whole garment again in any panel.

Each close-up is a macro crop that FILLS its panel edge to edge. Colour and material exactly as in the reference.

FOR THESE CLOSE-UPS the ghost-mannequin and background rules do not apply: a macro crop shows the material filling the panel, with no silhouette and no free background around it. The thin separators of the 2x2 grid are intended and are not "props".

${KERN}`

export const OUTFIT_REFERENZSHEET_PROMPT = `Using the reference images, create ONE single combined reference sheet of THIS garment.

OUTPUT FRAME: one single WIDE 16:9 LANDSCAPE image. Do not output a square or a portrait image.

The sheet contains exactly three panels side by side, left to right:

PANEL 1 (leftmost, LARGE — roughly half the total width):
- The garment from the FRONT
- IT MUST FILL THIS PANEL: close to the upper and lower edge, only a narrow margin of background. NOT a small item in a large empty frame.

PANEL 2 (middle):
- The same garment from the BACK, at the same scale relative to its panel and the same camera height

PANEL 3 (rightmost):
- Two macro close-ups stacked vertically: the fabric texture, and one characteristic detail (seam, pattern or fastening). These two fill their areas; the ghost-mannequin and background rules do not apply to them.

CRITICAL RULE: exactly these three panels, once each. No extra views, no thumbnails, no repeated panels, no second row.

All panels show THE SAME garment, at consistent colour and lighting, as if photographed in one session.

${KERN}

${EINZELBILD}`
