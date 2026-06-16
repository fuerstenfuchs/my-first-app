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

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function normalizeMediaType(mime: string): Anthropic.Base64ImageSource['media_type'] {
  const base = mime.split(';')[0].trim().toLowerCase()
  return (ALLOWED_MIME.has(base) ? base : 'image/jpeg') as Anthropic.Base64ImageSource['media_type']
}

async function urlToBase64(url: string): Promise<{ data: string; mediaType: Anthropic.Base64ImageSource['media_type'] } | null> {
  try {
    const referer = (() => { try { return new URL(url).origin + '/' } catch { return '' } })()
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
        'Referer': referer,
      },
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? 'image/jpeg'
    if (!ct.startsWith('image/')) return null
    const buf = await res.arrayBuffer()
    return {
      data: Buffer.from(buf).toString('base64'),
      mediaType: normalizeMediaType(ct),
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  // Auth
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

  if (!process.env.ANTHROPIC_API_KEY)
    return NextResponse.json({ error: 'Anthropic API key nicht konfiguriert' }, { status: 503, headers: CORS_HEADERS })

  try {
    const body = await req.json() as {
      outfitName: string
      outfitDescription?: string | null
      outfitTags?: string[]
      imageUrls?: string[]
    }

    const { outfitName, outfitDescription, outfitTags = [], imageUrls = [] } = body
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // Build image blocks for Claude
    const imageBlocks: Anthropic.MessageParam['content'] = []
    for (const url of imageUrls.slice(0, 4)) {
      const img = await urlToBase64(url)
      if (img) {
        imageBlocks.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mediaType, data: img.data },
        })
      }
    }

    const metaParts = [`Outfit name: "${outfitName}"`]
    if (outfitDescription) metaParts.push(`Description: ${outfitDescription}`)
    if (outfitTags.length) metaParts.push(`Tags: ${outfitTags.join(', ')}`)
    const metaText = metaParts.join('. ')

    const userContent: Anthropic.MessageParam['content'] = [
      ...imageBlocks,
      {
        type: 'text',
        text: imageBlocks.length > 0
          ? `${metaText}

Analyze every clothing piece and accessory visible in these outfit images. Then generate a single, ready-to-use image generation prompt (for Midjourney, Flux, or Stable Diffusion) that shows the complete outfit as a ghost mannequin / invisible mannequin photo.

Requirements for the prompt:
- Ghost mannequin effect: clothes look worn and 3D-shaped, but NO person, NO model, NO skin, NO face, NO hands, NO feet visible anywhere
- Front view on the LEFT side, back view on the RIGHT side — both on one image side by side
- White or very light neutral background
- Professional fashion product photography style
- Describe every garment precisely (color, fabric texture, cut, details like buttons/zippers/prints)
- Do NOT mention any person, body, or model

Output ONLY the prompt text. No explanation, no intro, no quotes around it.`
          : `${metaText}

Generate a single, ready-to-use image generation prompt (for Midjourney, Flux, or Stable Diffusion) that shows this outfit as a ghost mannequin / invisible mannequin photo.

Requirements:
- Ghost mannequin effect: clothes look worn and 3D-shaped, but NO person, NO model, NO skin visible
- Front view on the LEFT, back view on the RIGHT — both on one image
- White background, professional fashion product photography
- Describe plausible garments based on the outfit name and tags

Output ONLY the prompt text. No explanation, no intro.`,
      },
    ]

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: userContent }],
    })

    const prompt = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
    if (!prompt) throw new Error('Kein Prompt generiert')

    return NextResponse.json({ prompt }, { headers: CORS_HEADERS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('generate-outfit-sheet error:', msg)
    return NextResponse.json({ error: `Prompt-Generierung fehlgeschlagen: ${msg}` }, { status: 500, headers: CORS_HEADERS })
  }
}
