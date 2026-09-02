import { proxyLesen, proxyBereit, analyseUeberProxy } from './proxy'

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
    const mediaType = header.match(/data:(.*?);/)?.[1] ?? 'image/jpeg'
    requestBody = { imageBase64: b64, mediaType }
  } else {
    try {
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error('fetch failed')
      const blob = await imgRes.blob()
      const mediaType = blob.type || 'image/jpeg'
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '')
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      requestBody = { imageBase64, mediaType }
    } catch {
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
