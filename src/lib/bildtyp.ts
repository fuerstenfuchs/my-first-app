/**
 * Den Bildtyp an der Signatur ABLESEN statt ihn zu glauben — in der App.
 *
 * DER FEHLER (Mark, 04.09.2026, beim Prompt aus einem Outfit-Foto):
 *
 *   400 invalid_request_error
 *   messages.0.content.0.image.source.base64.data:
 *   Image format image/jpeg not supported
 *
 * Anthropic sagt damit nicht „ich kann kein JPEG", sondern „du hast JPEG
 * behauptet, das hier ist keins".
 *
 * ES GAB ZWEI URSACHEN, UND DIE ZWEITE IST DIE SCHLIMMERE:
 *
 * 1. Vier Seiten setzten `const mediaType = blob.type || 'image/jpeg'` — der
 *    gemeldete Typ wurde geglaubt, und wo keiner kam, wurde JPEG geraten.
 *
 * 2. In SIEBEN API-Routen stand wörtlich dieselbe kopierte Funktion:
 *
 *      return (ALLOWED_MIME.has(base) ? base : 'image/jpeg')
 *
 *    Ein unbekannter Typ wurde also nicht abgelehnt, sondern in „image/jpeg"
 *    UMBENANNT. Die Route hat die Lüge selbst erzeugt und weitergereicht. Und
 *    weil sie siebenmal kopiert war, hätte man sie siebenmal reparieren müssen.
 *
 * Deshalb steht sie jetzt einmal hier.
 */

/** Was Anthropic annimmt. Marks Proxy nennt dieselben vier. */
export const ANALYSE_TYPEN = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
export type AnalyseTyp = typeof ANALYSE_TYPEN[number]

/**
 * Den Typ aus der Signatur lesen. `null`, wenn es kein erkennbares Bild ist.
 *
 * Dieselbe Erkennung wie in `extension/src/lib/bildart.ts`. Getrennte Dateien,
 * weil App und Erweiterung getrennt gebaut werden und kein gemeinsames Paket
 * haben — die Doppelung ist bewusst und steht in beiden Köpfen.
 */
export function typAusBytes(bytes: Uint8Array): string | null {
  const b = bytes
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const marke = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!)
    if (marke.startsWith('avif') || marke.startsWith('avis')) return 'image/avif'
    if (marke.startsWith('heic') || marke.startsWith('heix') || marke.startsWith('mif1')) return 'image/heic'
  }
  return null
}

export function istAnalyseTyp(typ: string | null): typ is AnalyseTyp {
  return !!typ && (ANALYSE_TYPEN as readonly string[]).includes(typ)
}

/** Die ersten Bytes aus Base64 holen — mehr braucht die Signatur nicht. */
export function ersteBytesAusBase64(base64: string, anzahl = 16): Uint8Array {
  // 4 Base64-Zeichen ergeben 3 Bytes. Etwas Reserve, falls Zeilenumbrüche
  // drinstehen — manche Werkzeuge brechen Base64 auf 76 Zeichen um.
  const roh = base64.replace(/\s/g, '').slice(0, Math.ceil(anzahl / 3) * 4 + 8)
  try {
    const s = atob(roh)
    const a = new Uint8Array(Math.min(s.length, anzahl))
    for (let i = 0; i < a.length; i++) a[i] = s.charCodeAt(i)
    return a
  } catch {
    return new Uint8Array(0)
  }
}

export type TypBefund =
  | { ok: true; typ: AnalyseTyp }
  | { ok: false; grund: string; erkannt: string | null }

/**
 * Welchen Typ darf die Anfrage wirklich behaupten?
 *
 * DER GEMELDETE TYP WIRD NUR NOCH ALS RÜCKFALL BENUTZT, und auch dann nur,
 * wenn er zu den vier erlaubten gehört. Umbenennen in „image/jpeg" gibt es
 * nicht mehr: Eine Anfrage, die etwas Falsches behauptet, ist schlimmer als
 * eine, die ehrlich scheitert — sie kostet einen Aufruf und liefert eine
 * Meldung, die in die Irre führt.
 */
export function analyseTypBestimmen(base64: string, gemeldet?: string | null): TypBefund {
  const echt = typAusBytes(ersteBytesAusBase64(base64))

  if (istAnalyseTyp(echt)) return { ok: true, typ: echt }

  if (echt !== null) {
    return {
      ok: false,
      erkannt: echt,
      grund: `Das Bild liegt als ${echt} vor. Die Analyse nimmt nur JPEG, PNG, GIF und WEBP an. `
        + 'Bitte das Bild in einem dieser Formate speichern und noch einmal versuchen.',
    }
  }

  // NICHTS ERKANNT — und jetzt kommt es darauf an, WARUM.
  //
  // Waren genug Bytes da (die Signaturen brauchen zwoelf) und passte trotzdem
  // keine, dann ist es kein unterstuetztes Bild, egal was das Etikett sagt.
  // Genau hier kaeme sonst eine HTML-Fehlerseite als „image/jpeg" durch — ein
  // Fall, den es in diesem Projekt gibt: Manche Server antworten auf ein
  // fehlendes Bild mit Status 200 und einer HTML-Seite.
  //
  // Nur wenn zu WENIG Bytes da waren, um ueberhaupt zu urteilen, bleibt das
  // Etikett die einzige Auskunft — und auch dann zaehlt es nur, wenn es zu den
  // vier erlaubten gehoert.
  const genugBytes = ersteBytesAusBase64(base64).length >= 12
  const sauber = (gemeldet ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (!genugBytes && istAnalyseTyp(sauber)) return { ok: true, typ: sauber }

  return {
    ok: false,
    erkannt: null,
    grund: 'Die Daten sind kein erkennbares Bild. Häufigste Ursachen: eine SVG-Datei '
      + '(die Analyse kann sie nicht lesen) oder eine Fehlerseite, die der Server '
      + 'statt des Bildes geliefert hat.',
  }
}
