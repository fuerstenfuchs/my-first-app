import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const SYSTEM_PROMPT = `You are an expert in AI image generation (MidJourney, DALL-E, Stable Diffusion, Flux).
Analyze the image and create a detailed English prompt that can recreate this image or something very similar with an AI image generator.

Rules:
- Output ONLY the prompt, no explanations, no comments, no intro text
- Write in English (image generators perform best with English prompts)
- Describe subject, style, composition, lighting, colors, mood, and atmosphere
- Include quality keywords like: 8k, highly detailed, photorealistic, cinematic lighting, sharp focus
- Optimize for MidJourney v6 / DALL-E 3 / Flux style
- Keep it between 50–150 words
- Use comma-separated descriptive phrases`

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 503 })

  try {
    const { imageUrl, imageBase64, mediaType } = await req.json() as {
      imageUrl?: string
      imageBase64?: string
      mediaType?: string
    }

    let imageData: string
    let imageMime: Anthropic.Base64ImageSource['media_type']

    if (imageBase64) {
      imageData = imageBase64
      imageMime = (mediaType as Anthropic.Base64ImageSource['media_type']) || 'image/jpeg'
    } else if (imageUrl) {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error('Image fetch failed')
      const buf = await res.arrayBuffer()
      imageData = Buffer.from(buf).toString('base64')
      const ct = res.headers.get('content-type') ?? 'image/jpeg'
      imageMime = ct.split(';')[0].trim() as Anthropic.Base64ImageSource['media_type']
    } else {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageMime, data: imageData },
            },
            { type: 'text', text: 'Generate a prompt for this image.' },
          ],
        },
      ],
    })

    const prompt = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return NextResponse.json({ prompt })
  } catch (err) {
    console.error('analyze-image error:', err)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500 })
  }
}
