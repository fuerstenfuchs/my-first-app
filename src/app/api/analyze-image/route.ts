import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Allow Chrome extension and other trusted origins to call this endpoint
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const SYSTEM_PROMPT = `You are an expert reverse-prompt engineer for AI image generators (MidJourney v6, DALL-E 3, Stable Diffusion, Flux).

Your task: analyze the image with extreme precision and output a single, highly detailed English prompt that would recreate this image as closely as possible.

Cover ALL of the following aspects — skip none:

SUBJECT & PEOPLE (if present):
- Number of people, gender, approximate age, ethnicity
- Facial expression, eye color, hair color, hair length and style
- Skin tone, any visible makeup or accessories
- Exact body pose, posture, gesture, hand position
- Clothing: every garment, color, fabric texture, fit, pattern, brand style
- Body proportions visible, camera distance (close-up / half-body / full-body)

COMPOSITION & FORMAT:
- Aspect ratio / framing (portrait, landscape, square, cinematic widescreen)
- Camera angle (eye-level, low angle, high angle, bird's eye, dutch tilt)
- Shot type (extreme close-up, close-up, medium shot, wide shot, establishing shot)
- Rule of thirds, symmetry, depth, foreground/midground/background layers

COLORS & PALETTE:
- Dominant colors with specific names (e.g. deep burgundy, dusty rose, slate blue)
- Overall color palette mood (warm, cool, desaturated, high contrast, pastel, neon)
- Color grading style (golden hour warm tones, cold blue shadows, teal-orange split, etc.)

LIGHTING:
- Light source (natural sunlight, golden hour, overcast, studio softbox, neon, candle, backlit)
- Direction (front-lit, side-lit, rim light, contre-jour/backlit, overhead)
- Shadows: hard/soft, visible shadow detail
- Highlights and specular reflections

BACKGROUND & ENVIRONMENT:
- Location (indoor/outdoor, specific setting)
- Background description in detail (blurred bokeh, sharp, specific scenery)
- Depth of field (shallow bokeh, deep focus, everything sharp)
- Any props or objects in frame

STYLE & MEDIUM:
- Photography vs. digital art vs. painting vs. illustration vs. 3D render
- If photo: camera type feel (DSLR, film, medium format, smartphone), lens type (wide, 50mm, telephoto, macro)
- If art: artistic style, art movement, specific technique
- Artist references if style is recognizable

QUALITY DESCRIPTORS:
- Resolution feel (ultra-detailed, sharp, soft, grainy, film grain)
- Post-processing style (HDR, matte, cinematic grade, clean, gritty)

Output ONLY the prompt text. No explanations, no labels, no bullet points. Write as comma-separated descriptive phrases optimized for MidJourney v6. Be exhaustive — more detail is always better.`

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
      max_tokens: 1024,
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
    return NextResponse.json({ prompt }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('analyze-image error:', err)
    return NextResponse.json({ error: 'Analyse fehlgeschlagen' }, { status: 500, headers: CORS_HEADERS })
  }
}
