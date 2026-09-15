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
    const vier = (i: number) => String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!)
    const marke = vier(8)
    if (marke.startsWith('avif') || marke.startsWith('avis')) return 'image/avif'
    if (marke.startsWith('heic') || marke.startsWith('heix')) return 'image/heic'
    if (marke.startsWith('mif1')) {
      // `mif1` ist nur der allgemeine HEIF-Rahmen — auch AVIF-Dateien tragen
      // ihn als Hauptmarke. Was es wirklich ist, steht in den KOMPATIBLEN
      // Marken ab Byte 16 (15.09.2026, Critic K2). Reichen die Bytes dafür
      // nicht, bleibt es bei HEIC wie bisher.
      const ende = Math.min(b.length, ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0)
      for (let i = 16; i + 4 <= ende; i += 4) {
        const k = vier(i)
        if (k === 'avif' || k === 'avis') return 'image/avif'
      }
      return 'image/heic'
    }
  }
  return null
}

const ENDUNG_FUER_TYP: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/bmp': 'bmp', 'image/avif': 'avif', 'image/heic': 'heic',
}

/** Die Dateiendung zu einem Bildtyp, `null` bei Unbekanntem. Zeichensatz-Anhang egal. */
export function endungFuerTyp(typ: string | null | undefined): string | null {
  const sauber = (typ ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  return ENDUNG_FUER_TYP[sauber] ?? null
}

/**
 * Die Dateiendung eines Bildes — aus den BYTES, nicht aus dem Namen.
 *
 * WARUM: Mark hat am 15.09.2026 entschieden, große Bilder in allen Eimern an
 * DERSELBEN Adresse durch WebP zu ersetzen. Die Endung im Pfad bleibt dabei
 * (`0.png` enthält dann WebP). Wer die Endung aus dem Pfad nimmt, schreibt ab
 * da falsche Namen: ein WebP als `.png`. Der Browser zeigt es trotzdem an (er
 * rät), ein Bildprogramm oder eine Druckerei lehnt es ab — und der Fehler
 * fällt erst außerhalb der App auf.
 *
 * Reihenfolge: Bytes → gemeldeter Typ (nur wenn bekannt) → `rueckfall`.
 * Der gemeldete Typ steht an zweiter Stelle, weil der Speicher zurückgibt, was
 * beim Hochladen behauptet wurde — und das stimmt nach einem Austausch nur,
 * wenn der Austausch es richtig gesetzt hat.
 */
export function bildTyp(
  bytes: Uint8Array, gemeldet?: string | null, rueckfall = 'image/png',
): string {
  // Der Typ, unter dem ein Bild abgelegt wird — dieselbe Reihenfolge wie
  // `bildEndung`. WARUM BEIDE AUS DENSELBEN BYTES (15.09.2026, Critic S1):
  // Die Endung kam schon aus den Bytes, der Typ noch aus dem Kopf der Antwort.
  // Nach dem Austausch an derselben Adresse meldet der Speicher bis zu einer
  // Stunde lang weiter `image/png` für WebP-Bytes — die Kopie hieße `.webp`
  // und läge als `image/png` im Speicher.
  const echt = typAusBytes(bytes)
  if (echt) return echt
  const sauber = (gemeldet ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  if (!endungFuerTyp(sauber)) return rueckfall
  return sauber === 'image/jpg' ? 'image/jpeg' : sauber
}

export function bildEndung(
  bytes: Uint8Array, gemeldet?: string | null, rueckfall = 'png',
): string {
  return endungFuerTyp(typAusBytes(bytes)) ?? endungFuerTyp(gemeldet) ?? rueckfall
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
  // 32 statt 16 Bytes: Bei `mif1` stehen die entscheidenden kompatiblen
  // Marken erst ab Byte 16.
  const echt = typAusBytes(ersteBytesAusBase64(base64, 32))

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
