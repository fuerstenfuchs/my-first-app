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

const FASHION_SYSTEM_PROMPT = `You are a fashion expert and clothing analyst.

Analyze the image and identify the clothing item, outfit, shoe, or accessory shown.
Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

JSON schema:
{
  "name": "string — short descriptive name in German (e.g. 'Schwarze Lederjacke', 'Weiße Sneaker')",
  "category": "one of: oberteile | unterteile | kleider | jacken | schuhe | accessoires | kopfbedeckungen | sonstiges",
  "tags": ["array of 3-6 German tags describing color, style, material, fit"],
  "description": "string — 1-2 sentences in German describing the item"
}

Rules:
- name: concise, in German, color + type (e.g. 'Marineblaues Strickkleid')
- category: pick the single best matching category
- tags: lowercase, no spaces, e.g. ["dunkelblau", "strick", "midi", "casual"]
- description: factual, no marketing language
- If the image shows multiple items, focus on the most prominent one
- If the image does not show clothing/fashion at all, use category "sonstiges"

Output ONLY the JSON object, nothing else.`

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
    const { imageUrl } = await req.json() as { imageUrl?: string }
    if (!imageUrl) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400, headers: CORS_HEADERS })
    }

    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error('Image fetch failed')
    const buf = await res.arrayBuffer()
    const imageData = Buffer.from(buf).toString('base64')
    const ct = res.headers.get('content-type') ?? 'image/jpeg'
    const imageMime = ct.split(';')[0].trim() as Anthropic.Base64ImageSource['media_type']

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: FASHION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageMime, data: imageData },
            },
            { type: 'text', text: 'Analyze this fashion item and return the JSON.' },
          ],
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const parsed = JSON.parse(raw) as {
      name: string
      category: string
      tags: string[]
      description: string
    }

    return NextResponse.json(parsed, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('analyze-fashion error:', err)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500, headers: CORS_HEADERS })
  }
}
