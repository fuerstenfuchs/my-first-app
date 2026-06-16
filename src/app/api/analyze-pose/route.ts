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

const POSE_SYSTEM_PROMPT = `You are an expert in body language, movement, and pose analysis for visual reference in film and photography production.

Analyze the image and identify the body pose, movement, gesture, or action shown.
Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

JSON schema:
{
  "name": "string — descriptive name in German (e.g. 'Lässig an Wand lehnen', 'Selbstbewusst stehen')",
  "category": "one of: stehend | gehen | rennen | tanzen | sitzen | liegen | gestik | interaktion | emotion | sonstiges",
  "tags": ["array of 3-6 German tags describing the pose, mood, style"],
  "description": "string — 1-2 sentences in German describing the pose and its visual character for prompt use"
}

Rules:
- name: specific and descriptive in German (e.g. 'Arme verschränkt, Blick zur Seite', 'Gehend auf Kamera zu')
- category: pick the single best matching category
- tags: lowercase, e.g. ["lässig", "cool", "urban", "selbstbewusst"]
- description: focus on body position, limb placement, movement direction, expression — useful for image/video prompts
- If multiple people are shown, focus on the primary figure
- If no clear pose is shown, use category "sonstiges"

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
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 503, headers: CORS_HEADERS })
  }

  try {
    const body = await req.json() as {
      imageUrl?: string
      imageBase64?: string
      mediaType?: string
    }

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
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          'Referer': referer,
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-site',
        },
      })
      if (!res.ok) {
        return NextResponse.json(
          { error: `Bild konnte nicht geladen werden (${res.status}).` },
          { status: 422, headers: CORS_HEADERS }
        )
      }
      const ct = res.headers.get('content-type') ?? 'image/jpeg'
      const mime = ct.split(';')[0].trim()
      if (!mime.startsWith('image/')) {
        return NextResponse.json(
          { error: 'Die URL verweist auf kein gültiges Bild.' },
          { status: 422, headers: CORS_HEADERS }
        )
      }
      const buf = await res.arrayBuffer()
      imageData = Buffer.from(buf).toString('base64')
      imageMime = normalizeMediaType(mime)
    } else {
      return NextResponse.json({ error: 'Kein Bild übergeben.' }, { status: 400, headers: CORS_HEADERS })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: POSE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageMime, data: imageData },
            },
            { type: 'text', text: 'Analyze this pose/action and return the JSON.' },
          ],
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch?.[0] ?? jsonStr) as {
      name: string
      category: string
      tags: string[]
      description: string
    }

    return NextResponse.json(parsed, { headers: CORS_HEADERS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('analyze-pose error:', msg)
    return NextResponse.json({ error: `Analyse fehlgeschlagen: ${msg}` }, { status: 500, headers: CORS_HEADERS })
  }
}
