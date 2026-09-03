/**
 * Die vier Blätter der Outfit-Referenzkette (PROJ-54).
 *
 * Mark am 03.09.2026: „Da ist es ja auch so, dass wir ein Referenzbild
 * brauchen, also nur mit der Kleidung ohne einen Menschen praktisch."
 *
 * DESHALB STEHT „NO PERSON" IN JEDEM DER VIER PROMPTS, und zwar mehrfach und
 * ausdrücklich. Ein Bildmodell, dem man Kleidung zeigt, malt von sich aus
 * jemanden hinein — das ist der Normalfall, nicht die Ausnahme.
 *
 * ZWEITE LEHRE, aus dem Kopf-Sheet vom selben Tag: Es genügt nicht zu sagen,
 * WAS auf dem Blatt sein soll. Man muss auch sagen, WIE VIELE Felder es gibt,
 * dass sie sich nicht wiederholen, und dass das Motiv das Feld AUSFÜLLT.
 * Mark bekam sonst zehn Gesichter in zwei Reihen, und einen Kopf, der klein in
 * einem großen leeren Feld saß.
 */

/** Gilt für alle vier Blätter — einmal geschrieben, viermal benutzt. */
const GRUNDREGELN = `ABSOLUTE RULES:
- NO PERSON. No human body, no face, no hands, no legs, no mannequin head. The garment alone.
- The garment is shown as if worn by an invisible body ("ghost mannequin"): it keeps its natural three-dimensional shape and drape, but nobody is inside it.
- Plain, seamless, very light neutral grey background. Nothing else in the frame.
- Even, diffuse lighting from the front. NO cast shadows on the background, no shadow pooling beneath the garment.
- Photorealistic product photography. Colours, fabric, pattern and proportions exactly as in the reference — do not restyle, recolour or redesign anything.
- No text, no labels, no logos added, no watermarks, no props.`

export const OUTFIT_VORNE_PROMPT = `Using the reference image, create a clean product shot of THIS garment seen from the FRONT.

${GRUNDREGELN}

FRAMING — the garment must FILL the frame:
- One single garment, centred, seen straight from the front
- It reaches close to the top and bottom edges; only a narrow margin of background remains
- NOT a small item floating in a large empty frame

This is ONE single image, not a sheet, not a grid, not a collage. Exactly one view of the garment.`

export const OUTFIT_RUECKSEITE_PROMPT = `Using the reference images, create a clean product shot of THE SAME garment seen from the BACK.

The reference shows the front of this exact garment. Keep its colour, fabric, pattern, cut and proportions identical — you are turning the same piece around, not inventing a new one. Fastenings, seams and details that logically continue to the back must match what the front implies.

${GRUNDREGELN}

FRAMING — the garment must FILL the frame:
- One single garment, centred, seen straight from behind
- It reaches close to the top and bottom edges; only a narrow margin of background remains

This is ONE single image, not a sheet, not a grid, not a collage. Exactly one view of the garment.`

export const OUTFIT_DETAILS_PROMPT = `Using the reference images, create a detail sheet of THE SAME garment.

The sheet contains exactly four panels in a 2x2 grid — nothing more, no second grid, no repetition:
- Fabric surface and texture, close up
- A seam or edge finish, close up
- The pattern, print or embroidery, close up (if the garment has none, show the weave of the material instead)
- A fastening — buttons, zip, buckle or tie (if the garment has none, show the hem or cuff instead)

CRITICAL RULE: each of these four close-ups appears exactly ONCE. Do not repeat a panel, do not add a fifth, do not show the whole garment again.

Each close-up FILLS its panel edge to edge. Colours and material exactly as in the reference.

${GRUNDREGELN}`

export const OUTFIT_REFERENZSHEET_PROMPT = `Using the reference images, create ONE single combined reference sheet of THIS garment.

The sheet contains exactly three panels side by side, left to right:

PANEL 1 (leftmost, LARGE — roughly half the total width):
- The garment from the FRONT
- IT MUST FILL THIS PANEL: close to the upper and lower edge, only a narrow margin of background. NOT a small item in a large empty frame.

PANEL 2 (middle):
- The same garment from the BACK, at the same scale relative to its panel

PANEL 3 (rightmost):
- Two close-ups stacked vertically: the fabric texture, and one characteristic detail (seam, pattern or fastening)

CRITICAL RULE: exactly these three panels, once each. No extra views, no thumbnails, no repeated panels, no second row.

All panels show THE SAME garment, at consistent colour and lighting, as if photographed in one session.

${GRUNDREGELN}`
