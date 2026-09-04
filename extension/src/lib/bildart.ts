/**
 * Den Bildtyp an den ersten Bytes ABLESEN statt ihn zu glauben — und Bilder,
 * die die Analyse nicht versteht, vorher umwandeln.
 *
 * DER FEHLER, DER DAZU GEFÜHRT HAT (Mark, 04.09.2026):
 *
 *   400 invalid_request_error
 *   messages.0.content.0.image.source.base64.data:
 *   Image format image/jpeg not supported
 *
 * Die Meldung liest sich, als könne der Dienst kein JPEG. Er kann es — er sagt
 * damit: „Du hast JPEG behauptet, das hier ist keins." Der Grund stand im Code:
 *
 *   const mediaType = blob.type || 'image/jpeg'
 *
 * Der gemeldete Typ wurde geglaubt, und wo keiner gemeldet war, wurde JPEG
 * geraten. Immer mehr Seiten liefern heute AVIF, manche Server melden
 * `application/octet-stream` oder gar nichts. Beides landete als „JPEG" bei
 * der Analyse.
 *
 * DERSELBE FEHLER TRAF ZUERST DEN EIGENEN PROXY. In Marks Fehlerliste stand:
 * „The image data you provided does not represent a valid image … supported:
 * ['image/jpeg','image/png','image/gif','image/webp']". Weil dieser Weg still
 * auf den bezahlten Dienst zurückfällt, sah man nur eine Warnung — und der
 * bezahlte Dienst scheiterte dann an genau derselben Sache.
 *
 * `bildSichern.ts` hatte die Erkennung an den Signaturen schon (PROJ-49). Sie
 * stand dort nur privat und wurde von der Analyse nicht benutzt. Jetzt steht
 * sie hier, und beide holen sie sich von hier — eine zweite Kopie liefe
 * irgendwann auseinander.
 */

/** Was die Analyse-Dienste tatsächlich annehmen. Anthropic und der Proxy sind sich einig. */
export const ANALYSE_TYPEN = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

/**
 * Den Typ aus der Signatur lesen. `null`, wenn es kein erkennbares Bild ist.
 *
 * WARUM DIE SIGNATUR UND NICHT DER GEMELDETE TYP: Manche Server liefern
 * `application/octet-stream` oder gar nichts, und manche liefern eine
 * Fehlerseite in HTML mit Status 200. Die Signatur lügt nicht.
 */
export function typAusBytes(bytes: Uint8Array): string | null {
  const b = bytes
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'
  // RIFF....WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  // ....ftyp… — AVIF und HEIC teilen sich den Rahmen, die Marke steht dahinter
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const marke = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!)
    if (marke.startsWith('avif') || marke.startsWith('avis')) return 'image/avif'
    if (marke.startsWith('heic') || marke.startsWith('heix') || marke.startsWith('mif1')) return 'image/heic'
  }
  // SVG ist Text und hat keine Signatur — bewusst nicht unterstuetzt.
  return null
}

/** Nimmt die Analyse diesen Typ direkt an? */
export function fuerAnalyseGeeignet(typ: string | null): boolean {
  return !!typ && (ANALYSE_TYPEN as readonly string[]).includes(typ)
}

/**
 * Was mit diesem Bild zu tun ist, bevor es zur Analyse geht.
 *
 * Reine Entscheidung, ohne Browser — damit sie geprüft werden kann.
 */
export type Vorgehen =
  | { art: 'direkt'; typ: string }
  | { art: 'umwandeln'; von: string }
  | { art: 'kein-bild' }

export function vorgehenFuer(bytes: Uint8Array): Vorgehen {
  const typ = typAusBytes(bytes)
  if (typ === null) return { art: 'kein-bild' }
  if (fuerAnalyseGeeignet(typ)) return { art: 'direkt', typ }
  return { art: 'umwandeln', von: typ }
}

/** Base64 aus rohen Bytes, ohne `data:`-Kopf. */
export function base64Aus(bytes: Uint8Array): string {
  let s = ''
  // In Stücken, damit `String.fromCharCode` bei grossen Bildern nicht am
  // Argumentlimit scheitert — ein 8-MB-Bild sind acht Millionen Argumente.
  const stueck = 0x8000
  for (let i = 0; i < bytes.length; i += stueck) {
    s += String.fromCharCode(...bytes.subarray(i, i + stueck))
  }
  return btoa(s)
}

/**
 * Ein Bild analysefertig machen: Typ aus der Signatur, und was der Dienst
 * nicht versteht, wird nach PNG umgewandelt.
 *
 * WARUM UMWANDELN UND NICHT NUR BESSER MECKERN: Ein AVIF-Bild ist ein
 * vollwertiges Bild, Chrome kann es lesen. Mark daran scheitern zu lassen,
 * weil ein Dienst dieses Kürzel nicht mag, wäre eine Ausrede statt einer
 * Lösung — und immer mehr Seiten liefern AVIF.
 */
export async function alsAnalysebild(blob: Blob): Promise<{ base64: string; mediaType: string }> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const weg = vorgehenFuer(bytes)

  if (weg.art === 'direkt') {
    return { base64: base64Aus(bytes), mediaType: weg.typ }
  }
  if (weg.art === 'kein-bild') {
    throw new Error(
      'Die Datei ist kein erkennbares Bild (SVG und HTML-Fehlerseiten kommen hier oft an). '
      + 'Bitte ein JPEG, PNG, GIF oder WEBP verwenden.',
    )
  }

  // Umwandeln: Chrome liest AVIF, HEIC und BMP und gibt PNG zurueck.
  try {
    const bitmap = await createImageBitmap(blob)
    const leinwand = new OffscreenCanvas(bitmap.width, bitmap.height)
    const stift = leinwand.getContext('2d')
    if (!stift) throw new Error('kein 2d-Kontext')
    stift.drawImage(bitmap, 0, 0)
    bitmap.close()
    const png = await leinwand.convertToBlob({ type: 'image/png' })
    return { base64: base64Aus(new Uint8Array(await png.arrayBuffer())), mediaType: 'image/png' }
  } catch {
    throw new Error(
      `Das Bild liegt als ${weg.von} vor, und die Umwandlung nach PNG ist fehlgeschlagen. `
      + 'Bitte das Bild als JPEG oder PNG speichern und noch einmal versuchen.',
    )
  }
}
