import type { RefImage } from '@/lib/reference-images'

/**
 * Welches Referenzbild soll der Scene Builder von sich aus nehmen — und in
 * welcher Reihenfolge stehen sie? (04.09.2026)
 *
 * Mark: „Kannst Du machen, dass beim Scene Builder immer das Referenzsheet als
 * Bild genommen wird als Erstes? Ich muss da immer ewig suchen und scrollen
 * auf dem Miniscreen, was das Referenzbild ist. Das ist kaum zu sehen. So
 * klein ist das Bild."
 *
 * ZWEI PROBLEME, UND „GRÖSSER" LÖST NUR EINES. Die Bildchen waren 32×32 Pixel,
 * das ist zu klein — aber selbst gross genug wüsste man nicht, WELCHES das
 * Referenzsheet ist, solange man es am Bildinhalt erraten muss. Jedes Bild
 * gehört zu einer benannten Variante („Kopf", „Körper", „Referenzsheet",
 * „Ausdrücke", „Outfit", „Calvanize" — PROJ-50). Der Name steht bereits im
 * `label`; er wurde nur nie angezeigt.
 *
 * Deshalb drei Dinge zusammen: **vorausgewählt**, **vorne einsortiert** und
 * **beschriftet**. Danach muss man nicht mehr suchen, weder mit den Augen noch
 * mit der Bildlaufleiste.
 */

/**
 * Die Rangfolge. Kleiner ist besser.
 *
 * WARUM DAS REFERENZSHEET GEWINNT: Es ist das eine Blatt, das Kopf, Körper und
 * Ausdruck zusammen zeigt — genau das, was eine Szene braucht. Ein reines
 * Kopfblatt als Vorlage für eine Ganzfigur zwingt das Modell, den Rest zu
 * erfinden.
 *
 * Verglichen wird ohne Rücksicht auf Gross-/Kleinschreibung und als Teilwort:
 * Eine Variante darf „Referenzsheet 16:9" heissen.
 */
const RANGFOLGE: { teil: string; rang: number }[] = [
  { teil: 'referenzsheet', rang: 0 },
  { teil: 'kombi',         rang: 1 },   // die Outfit-Kette nennt es so
  { teil: 'körper',        rang: 2 },
  { teil: 'koerper',       rang: 2 },
  { teil: 'vorne',         rang: 3 },   // Outfit von vorne
  { teil: 'kopf',          rang: 4 },
]

/** Der schlechteste Rang — alles Unbenannte landet hier. */
const REST = 9

export function rangVon(label: string): number {
  const l = label.toLowerCase()
  for (const { teil, rang } of RANGFOLGE) {
    if (l.includes(teil)) return rang
  }
  return REST
}

/**
 * Nach Nutzen sortieren, ohne die ursprüngliche Reihenfolge innerhalb eines
 * Rangs zu zerwürfeln.
 *
 * `sort` ist in modernen Browsern stabil, aber darauf allein soll sich das
 * hier nicht verlassen — der Index geht als zweites Merkmal mit ein.
 */
export function nachNutzen(images: RefImage[]): RefImage[] {
  return images
    .map((img, i) => ({ img, i, rang: rangVon(img.label) }))
    .sort((a, b) => a.rang - b.rang || a.i - b.i)
    .map(x => x.img)
}

/**
 * Welches Bild wird von selbst gewählt?
 *
 * NUR EIN ECHTES REFERENZSHEET ODER KOMBI-BLATT — sonst `null`.
 *
 * Das ist Absicht und die wichtigste Zeile hier: Ohne Auswahl nimmt der Scene
 * Builder das TITELBILD des Bausteins (`ref?.url ?? asset.cover_image_url`).
 * Das ist ein bewusst gewähltes Bild. Stattdessen irgendein erstes Bild aus
 * der Liste vorzuwählen — womöglich ein Ausschnitt aus „Sonstige" — wäre
 * schlechter als das, was heute passiert, und es ginge in eine bezahlte
 * Erzeugung.
 */
export function standardReferenz(images: RefImage[]): RefImage | null {
  const bestes = nachNutzen(images)[0]
  if (!bestes) return null
  return rangVon(bestes.label) <= 1 ? bestes : null
}
