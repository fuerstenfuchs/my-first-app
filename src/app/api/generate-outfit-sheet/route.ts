import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
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
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ error: 'OpenAI API key nicht konfiguriert' }, { status: 503, headers: CORS_HEADERS })

  try {
    const body = await req.json() as {
      outfitName: string
      outfitDescription?: string | null
      outfitTags?: string[]
      imageUrls?: string[]
    }

    const { outfitName, outfitDescription, outfitTags = [], imageUrls = [] } = body

    // Step 1: Use Claude Vision to analyze outfit images and describe all clothing pieces
    let outfitPiecesDescription = ''

    const imagesToAnalyze = imageUrls.slice(0, 4) // max 4 images for Claude
    if (imagesToAnalyze.length > 0) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

      const imageBlocks: Anthropic.MessageParam['content'] = []
      for (const url of imagesToAnalyze) {
        const img = await urlToBase64(url)
        if (img) {
          imageBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: img.mediaType, data: img.data },
          })
        }
      }

      if (imageBlocks.length > 0) {
        imageBlocks.push({
          type: 'text',
          text: `This is an outfit called "${outfitName}". Analyze every visible clothing piece and accessory. List each item with: exact name, color, material (if visible), style details, and any distinctive features. Focus ONLY on the clothing and accessories — ignore the model/person entirely. Output a concise comma-separated list in English, e.g.: "black cropped halter-neck top with fringe trim, black high-waisted tailored shorts, black strappy stiletto heels". Do not mention any person, body, or model.`,
        })

        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: imageBlocks as Anthropic.MessageParam['content'] }],
        })
        outfitPiecesDescription = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
      }
    }

    // Fallback: use outfit metadata if no images could be analyzed
    if (!outfitPiecesDescription) {
      const parts = [outfitName]
      if (outfitDescription) parts.push(outfitDescription)
      if (outfitTags.length > 0) parts.push(outfitTags.join(', '))
      outfitPiecesDescription = parts.join('. ')
    }

    // Step 2: Generate flat-lay image with gpt-image-1
    const generationPrompt = [
      'Top-down flat lay fashion photography on a pure white seamless background.',
      `Complete outfit: ${outfitPiecesDescription}.`,
      'All clothing items and accessories carefully arranged on the white surface as if gently laid out, showing the full outfit composition.',
      'NO person, NO model, NO mannequin, NO body parts, NO hands, NO feet.',
      'Pure clothing product photography only.',
      'Professional studio lighting, soft shadows, high-end fashion editorial style, ultra-sharp details.',
    ].join(' ')

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: generationPrompt,
      n: 1,
      size: '1024x1024',
    })

    const b64 = response.data?.[0]?.b64_json
    if (!b64) throw new Error('Kein Bild generiert')

    return NextResponse.json({ imageBase64: b64 }, { headers: CORS_HEADERS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('generate-outfit-sheet error:', msg)
    return NextResponse.json({ error: `Generierung fehlgeschlagen: ${msg}` }, { status: 500, headers: CORS_HEADERS })
  }
}
