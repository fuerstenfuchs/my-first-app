import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const CAMERA_PROMPT = `You are a specialist in cinematography and camera technique for AI image and video generation.

Analyze the image and identify the camera shot type and framing.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

JSON schema:
{
  "name": "string — name of the camera shot in German (e.g. 'Extreme Close-Up', 'Dutch Angle', 'Over-Shoulder-Shot')",
  "category": "one of: nah | mittel | weit | perspektive | sonstiges",
  "tags": ["array of 3-5 English tags describing the shot"],
  "description": "string — 1-2 sentences in English describing the camera framing, angle, and visual effect"
}

Category guide:
- nah: Extreme Close-Up, Close-Up (face/detail fills frame)
- mittel: Portrait, Medium Shot, Full Body (person visible from head to waist or full)
- weit: Wide Shot, Establishing Shot (environment dominant)
- perspektive: Dutch Angle, Bird's Eye, Worm's Eye, POV, Over-Shoulder, Selfie, Drone
- sonstiges: anything else

Output ONLY the JSON object, nothing else.`

const LIGHTING_PROMPT = `You are a specialist in cinematographic lighting for AI image and video generation.

Analyze the image and identify the lighting style, mood, and technique.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

JSON schema:
{
  "name": "string — name of the lighting style in German (e.g. 'Golden Hour', 'Neon Rim Light', 'Candle Light')",
  "category": "one of: natuerlich | studio | dramatisch | urban | warm | sonstiges",
  "tags": ["array of 3-5 English tags describing the lighting"],
  "description": "string — 1-2 sentences in English describing the light quality, color temperature, and mood"
}

Category guide:
- natuerlich: Golden Hour, Blue Hour, Sunlight, Overcast, Moonlight (outdoor/natural)
- studio: Soft Box, Ring Light, Hard Key Light, Three-Point Lighting (controlled studio)
- dramatisch: Stage Lighting, Backlight, Rim Light, Chiaroscuro, Hard shadows
- urban: Neon, Street lights, LED signs, City glow
- warm: Candle, Fireplace, Lantern, Tungsten bulb
- sonstiges: anything else

Output ONLY the JSON object, nothing else.`

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function normalizeMediaType(mime: string): Anthropic.Base64ImageSource['media_type'] {
  const base = mime.split(';')[0].trim().toLowerCase()
  return (ALLOWED_MIME.has(base) ? base : 'image/jpeg') as Anthropic.Base64ImageSource['media_type']
}

export async function POST(req: NextRequest) {
  let user = null
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (bearer) {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data } = await client.auth.getUser(bearer)
    user = data.user
  } else {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data } = await supabase.auth.getUser()
    user = data.user
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'API key not configured' }, { status: 503, headers: CORS_HEADERS })

  try {
    const body = await req.json() as { assetType?: string; imageUrl?: string; imageBase64?: string; mediaType?: string }
    const systemPrompt = body.assetType === 'lighting' ? LIGHTING_PROMPT : CAMERA_PROMPT

    let imageData: string
    let imageMime: Anthropic.Base64ImageSource['media_type']

    if (body.imageBase64) {
      imageData = body.imageBase64
      imageMime = normalizeMediaType(body.mediaType ?? 'image/jpeg')
    } else if (body.imageUrl) {
      const referer = (() => { try { return new URL(body.imageUrl).origin + '/' } catch { return '' } })()
      const res = await fetch(body.imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
          'Referer': referer,
        },
      })
      if (!res.ok) return NextResponse.json({ error: `Bild konnte nicht geladen werden (${res.status}).` }, { status: 422, headers: CORS_HEADERS })
      const ct = res.headers.get('content-type') ?? 'image/jpeg'
      const mime = ct.split(';')[0].trim()
      if (!mime.startsWith('image/')) return NextResponse.json({ error: 'Die URL verweist auf kein gültiges Bild.' }, { status: 422, headers: CORS_HEADERS })
      imageData = Buffer.from(await res.arrayBuffer()).toString('base64')
      imageMime = normalizeMediaType(mime)
    } else {
      return NextResponse.json({ error: 'Kein Bild übergeben.' }, { status: 400, headers: CORS_HEADERS })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: imageMime, data: imageData } },
        { type: 'text', text: 'Analyze this image and return the JSON.' },
      ]}],
    })

    const raw     = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const match   = jsonStr.match(/\{[\s\S]*\}/)
    const parsed  = JSON.parse(match?.[0] ?? jsonStr)

    return NextResponse.json(parsed, { headers: CORS_HEADERS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('analyze-visual-asset error:', msg)
    return NextResponse.json({ error: `Analyse fehlgeschlagen: ${msg}` }, { status: 500, headers: CORS_HEADERS })
  }
}
