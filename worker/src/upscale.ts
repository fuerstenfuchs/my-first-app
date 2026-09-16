/**
 * Rechnerisches Vergrößern eines vorhandenen Ergebnisbildes.
 *
 * Bewusst kein KI-Upscaler: Lanczos verteilt die vorhandenen Bildpunkte klüger,
 * es erfindet keine Details dazu. Am 01.09.2026 an einem echten Ergebnis
 * verglichen — gegenüber dem einfachen Vergrößern, das ein Betrachter beim
 * Zoomen macht, ist der Unterschied deutlich sichtbar (Kanten, Hautstruktur,
 * Falten). Gegenüber einem KI-Upscaler fehlen erfundene Feinheiten; dafür
 * verändert sich auch nichts am Bild.
 *
 * Läuft lokal, kostet nichts und braucht keine Gegenstelle.
 */

import sharp from 'sharp'

/** Was das Bildmodell liefert, mal vier ist immer noch handhabbar. */
export const MAX_KANTE = 8192

export type UpscaleErgebnis = {
  daten: ArrayBuffer
  vorher: { breite: number; hoehe: number }
  nachher: { breite: number; hoehe: number }
}

export async function bildVergroessern(
  quelle: ArrayBuffer, faktor: number,
): Promise<UpscaleErgebnis> {
  if (!Number.isInteger(faktor) || faktor < 2 || faktor > 4) {
    throw new Error(`Vergrößerungsfaktor ${faktor} ist nicht vorgesehen (erlaubt: 2 bis 4).`)
  }

  const eingang = Buffer.from(quelle)
  const info = await sharp(eingang).metadata()
  if (!info.width || !info.height) {
    throw new Error('Das Ausgangsbild hat keine lesbaren Maße.')
  }

  /*
    EXIF-DREHUNG ANWENDEN (Critic, 15.09.2026). Seit Vergrößerungen ihr Original
    aus Backblaze holen, kann die Quelle ein Foto mit EXIF-Drehung sein — nicht
    mehr nur ein Modellergebnis ohne. `sharp` meldet die Maße UNGEDREHT; ohne
    `rotate()` läge ein hochkant fotografiertes Bild nach der Vergrößerung quer,
    und bei 5–8 wären Breite und Höhe vertauscht gerechnet.
  */
  const gedreht = [5, 6, 7, 8].includes(info.orientation ?? 1)
  const quelleBreite = gedreht ? info.height : info.width
  const quelleHoehe = gedreht ? info.width : info.height

  let breite = quelleBreite * faktor
  let hoehe = quelleHoehe * faktor

  // Notbremse: Ein Bild jenseits von 8192 Pixeln Kantenlänge frisst Speicher,
  // ohne dass ein einziger echter Bildpunkt dazukäme. Dann wird der Faktor
  // stillschweigend gedeckelt — aber der Aufrufer erfährt die echten Maße.
  const groesste = Math.max(breite, hoehe)
  if (groesste > MAX_KANTE) {
    const daempfung = MAX_KANTE / groesste
    breite = Math.round(breite * daempfung)
    hoehe = Math.round(hoehe * daempfung)
  }

  const ausgang = await sharp(eingang)
    .rotate()
    .resize(breite, hoehe, { kernel: 'lanczos3', fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer()

  return {
    daten: ausgang.buffer.slice(
      ausgang.byteOffset, ausgang.byteOffset + ausgang.byteLength,
    ) as ArrayBuffer,
    vorher:  { breite: quelleBreite, hoehe: quelleHoehe },
    nachher: { breite, hoehe },
  }
}
