import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { ANALYSE_PROMPT } from '@/lib/analyse-prompts'
import { analyseTypBestimmen } from '@/lib/bildtyp'

// Die System-Prompts stehen in @/lib/analyse-prompts — nicht mehr hier.
// Grund: Seit dem 03.09.2026 laeuft dieselbe Analyse wahlweise ueber Marks
// eigenen Proxy, und der ist NUR vom Browser aus erreichbar (ein Server bei
// Vercel kommt nicht an 127.0.0.1). Zwei Wege, ein Prompt — laegen sie
// doppelt vor, wuerde einer geaendert und der andere nicht.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

const LOCATION_SYSTEM_PROMPT = ANALYSE_PROMPT.location


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
      // DEN TYP AN DER SIGNATUR BESTIMMEN, NICHT UMBENENNEN.
      // Hier stand `normalizeMediaType(...)`, und die machte aus jedem
      // unbekannten Typ stillschweigend „image/jpeg". Ein AVIF ging damit als
      // JPEG an Anthropic, und die Antwort lautete „Image format image/jpeg
      // not supported" — eine Meldung, die aussieht, als laege es an JPEG.
      // Mark am 04.09.2026 beim Prompt aus einem Outfit-Foto.
      const befund = analyseTypBestimmen(body.imageBase64, body.mediaType)
      if (!befund.ok) {
        return NextResponse.json({ error: befund.grund }, { status: 415 })
      }
      imageMime = befund.typ
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
      // Auch hier die Signatur befragen: Was ein fremder Server im
      // Content-Type meldet, stimmt oft nicht — und manche liefern auf ein
      // fehlendes Bild eine HTML-Seite mit Status 200.
      const befundUrl = analyseTypBestimmen(imageData, mime)
      if (!befundUrl.ok) {
        return NextResponse.json({ error: befundUrl.grund }, { status: 415 })
      }
      imageMime = befundUrl.typ
    } else {
      return NextResponse.json({ error: 'Kein Bild übergeben.' }, { status: 400, headers: CORS_HEADERS })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: LOCATION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imageMime, data: imageData },
            },
            { type: 'text', text: 'Analyze this location and return the JSON.' },
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
    console.error('analyze-location error:', msg)
    return NextResponse.json({ error: `Analyse fehlgeschlagen: ${msg}` }, { status: 500, headers: CORS_HEADERS })
  }
}
