'use client'

import { typAusBytes, istAnalyseTyp } from '@/lib/bildtyp'

/**
 * Ein Bild aus dem Browser analysefertig machen. (04.09.2026)
 *
 * WARUM UMWANDELN UND NICHT NUR EHRLICH ABLEHNEN: Die Route sagt seit heute
 * die Wahrheit statt „image/jpeg" zu behaupten — aber „Das Bild liegt als
 * image/avif vor" hilft Mark nicht weiter, wenn die Seite, von der es kommt,
 * nun einmal AVIF ausliefert. Und das tun immer mehr. Chrome kann AVIF und
 * HEIC lesen; die Umwandlung nach PNG kostet nichts und lässt ihn arbeiten,
 * statt ihn vor ein Format-Problem zu stellen, das ihn nicht interessiert.
 *
 * Die ehrliche Ablehnung in der Route bleibt trotzdem: Sie ist das Netz für
 * alles, was hier nicht vorbeikommt — die Erweiterung, ein Bild von einer
 * fremden Adresse, ein späterer Weg.
 */
export async function bildFuerAnalyse(blob: Blob): Promise<{ imageBase64: string; mediaType: string }> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const echt = typAusBytes(bytes)

  if (istAnalyseTyp(echt)) {
    return { imageBase64: base64Aus(bytes), mediaType: echt }
  }

  if (echt === null) {
    throw new Error(
      'Die Datei ist kein erkennbares Bild. Häufigste Ursachen: eine SVG-Datei, '
      + 'oder der Server hat statt des Bildes eine Fehlerseite geliefert.',
    )
  }

  // AVIF, HEIC, BMP — Chrome liest sie, die Analyse nicht.
  try {
    const bitmap = await createImageBitmap(blob)
    const leinwand = document.createElement('canvas')
    leinwand.width = bitmap.width
    leinwand.height = bitmap.height
    const stift = leinwand.getContext('2d')
    if (!stift) throw new Error('kein 2d-Kontext')
    stift.drawImage(bitmap, 0, 0)
    bitmap.close()
    const png = await new Promise<Blob | null>(f => leinwand.toBlob(f, 'image/png'))
    if (!png) throw new Error('toBlob leer')
    return {
      imageBase64: base64Aus(new Uint8Array(await png.arrayBuffer())),
      mediaType: 'image/png',
    }
  } catch {
    throw new Error(
      `Das Bild liegt als ${echt} vor, und die Umwandlung nach PNG ist fehlgeschlagen. `
      + 'Bitte das Bild als JPEG oder PNG speichern und noch einmal versuchen.',
    )
  }
}

/** Base64 aus rohen Bytes, in Stücken — sonst scheitert es bei grossen Bildern. */
function base64Aus(bytes: Uint8Array): string {
  let s = ''
  const stueck = 0x8000
  for (let i = 0; i < bytes.length; i += stueck) {
    s += String.fromCharCode(...bytes.subarray(i, i + stueck))
  }
  return btoa(s)
}
