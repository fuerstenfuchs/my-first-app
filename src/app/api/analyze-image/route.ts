import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { ANALYSE_PROMPT, ANALYSE_ANGABEN } from '@/lib/analyse-prompts'

// Die System-Prompts stehen in @/lib/analyse-prompts — nicht mehr hier.
// Grund: Seit dem 03.09.2026 laeuft dieselbe Analyse wahlweise ueber Marks
// eigenen Proxy, und der ist NUR vom Browser aus erreichbar (ein Server bei
// Vercel kommt nicht an 127.0.0.1). Zwei Wege, ein Prompt — laegen sie
// doppelt vor, wuerde einer geaendert und der andere nicht.

// Allow Chrome extension and other trusted origins to call this endpoint
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const ANTHROPIC_MODELS = new Set(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'])
const VALID_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'gpt-4.1-mini',
  'gpt-4o',
])
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = ANALYSE_PROMPT.bild

const SYSTEM_PROMPT_PERSON_PLACEHOLDER = ANALYSE_PROMPT.bildPlatzhalter

function buildSystemPrompt(personPlaceholder: boolean): string {
  return personPlaceholder ? SYSTEM_PROMPT_PERSON_PLACEHOLDER : SYSTEM_PROMPT
}

export async function POST(req: NextRequest) {
  // Auth check — accept both cookie session (web app) and Bearer JWT (extension)
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

  try {
    const { imageUrl, imageBase64, mediaType, personPlaceholder, model: rawModel } = await req.json() as {
      imageUrl?: string
      imageBase64?: string
      mediaType?: string
      personPlaceholder?: boolean
      model?: string
    }

    const model = (rawModel && VALID_MODELS.has(rawModel)) ? rawModel : DEFAULT_MODEL
    const useAnthropic = ANTHROPIC_MODELS.has(model)
    const systemPrompt = buildSystemPrompt(!!personPlaceholder)

    if (useAnthropic && !process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 503, headers: CORS_HEADERS })
    }
    if (!useAnthropic && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503, headers: CORS_HEADERS })
    }

    let imageData: string
    let imageMime: string

    if (imageBase64) {
      imageData = imageBase64
      imageMime = mediaType ?? 'image/jpeg'
    } else if (imageUrl) {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error('Image fetch failed')
      const buf = await res.arrayBuffer()
      imageData = Buffer.from(buf).toString('base64')
      const ct = res.headers.get('content-type') ?? 'image/jpeg'
      imageMime = ct.split(';')[0].trim()
    } else {
      return NextResponse.json({ error: 'No image provided' }, { status: 400, headers: CORS_HEADERS })
    }

    let prompt: string

    if (useAnthropic) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const message = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageMime as Anthropic.Base64ImageSource['media_type'],
                  data: imageData,
                },
              },
              { type: 'text', text: ANALYSE_ANGABEN.bild.nutzerText },
            ],
          },
        ],
      })
      prompt = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    } else {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
      const response = await openai.chat.completions.create({
        model,
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${imageMime};base64,${imageData}` },
              },
              { type: 'text', text: ANALYSE_ANGABEN.bild.nutzerText },
            ],
          },
        ],
      })
      prompt = response.choices[0]?.message?.content?.trim() ?? ''
    }

    return NextResponse.json({ prompt }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('analyze-image error:', err)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500, headers: CORS_HEADERS })
  }
}
