export type AssetAnalysisType = 'fashion' | 'location' | 'pose'

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
}

export async function analyzeAsset(
  imageUrl: string,
  type: AssetAnalysisType,
  accessToken: string | null,
  appUrl: string
): Promise<AssetAnalysisResult> {
  let requestBody: Record<string, string>

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
