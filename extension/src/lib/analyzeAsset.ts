import { proxyLesen, proxyBereit, analyseUeberProxy } from './proxy'
import { alsAnalysebild, typAusBytes, fuerAnalyseGeeignet } from './bildart'

export type AssetAnalysisType = 'fashion' | 'location' | 'pose' | 'outfit' | 'character'

export interface AssetAnalysisResult {
  name?: string
  category?: string
  tags?: string[]
  description?: string
  prompt?: string
  attributes?: Record<string, string>
}

const ENDPOINT: Record<AssetAnalysisType, string> = {
  fashion:   '/api/analyze-fashion',
  location:  '/api/analyze-location',
  pose:      '/api/analyze-pose',
  outfit:    '/api/analyze-outfit',
  character: '/api/analyze-character',
}

export async function analyzeAsset(
  imageUrl: string,
  type: AssetAnalysisType,
  accessToken: string | null,
  appUrl: string,
  overrideDataUrl?: string  // when set, analyse this cropped image instead of imageUrl
): Promise<AssetAnalysisResult> {
  let requestBody: Record<string, string>

  if (overrideDataUrl?.startsWith('data:')) {
    const commaIdx = overrideDataUrl.indexOf(',')
    const header = overrideDataUrl.slice(0, commaIdx)
    const b64 = overrideDataUrl.slice(commaIdx + 1)
    // Auch hier nicht dem Kopf glauben: Ein `data:image/jpeg`-Kopf sagt nichts
    // darueber, was dahinter wirklich steht — der Zuschnitt liefert zwar
    // sauberes JPEG, aber diese Abzweigung nimmt auch fremde Adressen.
    const gemeldet = header.match(/data:(.*?);/)?.[1] ?? 'image/jpeg'
    const echt = typAusBytes(Uint8Array.from(atob(b64.slice(0, 64)), z => z.charCodeAt(0)))
    requestBody = { imageBase64: b64, mediaType: fuerAnalyseGeeignet(echt) ? echt! : gemeldet }
  } else {
    try {
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error('fetch failed')
      const blob = await imgRes.blob()
      // DEN TYP ABLESEN, NICHT GLAUBEN. Hier stand
      //   const mediaType = blob.type || 'image/jpeg'
      // und genau daran ist Mark am 04.09.2026 gescheitert: Ein AVIF-Bild ohne
      // gemeldeten Typ ging als „image/jpeg" hinaus, und der Dienst antwortete
      // „Image format image/jpeg not supported". `alsAnalysebild` liest die
      // Signatur und wandelt um, was die Analyse nicht versteht.
      const { base64, mediaType } = await alsAnalysebild(blob)
      requestBody = { imageBase64: base64, mediaType }
    } catch (err) {
      // Ein erkennbarer Grund darf nicht im stillen Rueckfall verschwinden:
      // „kein Bild" und „Umwandlung gescheitert" sind Auskuenfte, mit denen
      // Mark etwas anfangen kann. Nur beim Netzfehler die Adresse weiterreichen.
      if (err instanceof Error && /kein erkennbares Bild|Umwandlung/.test(err.message)) throw err
      requestBody = { imageUrl }
    }
  }

  /*
    ERST DER EIGENE PROXY. Die Analysetypen heissen hier genauso wie in
    `ANALYSE_ART` der App, deshalb geht der Name direkt durch.

    Nur mit Base64: Liegt bloss eine Bildadresse vor (der `catch`-Zweig oben),
    muesste der Proxy sie selbst holen — bei einem Bild hinter einer Anmeldung
    kaeme er nicht heran. Dann geht es ohne Umweg ueber die Route, so wie
    bisher.

    Scheitert der Proxy, wird NICHT abgebrochen, sondern die Route genommen.
    Aber nicht stillschweigend: In der Konsole steht, warum — sonst wuerde Mark
    nie erfahren, dass gerade Geld geflossen ist.
  */
  if ('imageBase64' in requestBody) {
    const e = await proxyLesen()
    if (proxyBereit(e)) {
      try {
        return await analyseUeberProxy<AssetAnalysisResult>(
          type, requestBody.imageBase64 as string,
          (requestBody.mediaType as string) || 'image/jpeg', e,
        )
      } catch (err) {
        console.warn(
          `[PromptDB] Eigener Proxy nicht nutzbar (${(err as Error).message}) — ` +
          'die Analyse laeuft jetzt ueber den bezahlten Dienst.',
        )
      }
    }
  }

  const res = await fetch(`${appUrl}${ENDPOINT[type]}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<AssetAnalysisResult>
}
