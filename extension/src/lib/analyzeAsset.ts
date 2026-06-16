export type AssetAnalysisType = 'fashion' | 'location' | 'pose' | 'outfit'

export interface AssetAnalysisResult {
  name?: string
  category?: string
  tags?: string[]
  description?: string
}

const ENDPOINT: Record<AssetAnalysisType, string> = {
  fashion:  '/api/analyze-fashion',
  location: '/api/analyze-location',
  pose:     '/api/analyze-pose',
  outfit:   '/api/analyze-outfit',
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
