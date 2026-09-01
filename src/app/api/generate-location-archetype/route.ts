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

const SYSTEM_PROMPT = `You are a specialist in location scouting and set design for AI image generation.

The user gives a short, often single-word name for a generic LOCATION ARCHETYPE — a universal place concept, not a real, specific location. Examples: "Bar", "Restaurant", "Hotelzimmer", "Rooftop", "Luxusvilla", "Yacht", "Tonstudio", "Nachtclub", "Berghütte", "Waldweg", "Verlassene Fabrik", "Cyberpunk Gasse".

Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

JSON schema:
{
  "short_description": "string — 1 short sentence in German summarizing the place, for the user's own organization",
  "long_description": "string — 3-5 short comma-separated German phrases describing the atmosphere, key features and mood of the place in detail",
  "prompt": "string — 5-8 short comma-separated English phrases describing the location for an AI image generator (no full sentences, no trailing period on each phrase except the last), professional architectural/photography terminology",
  "tags": ["array of 3-5 lowercase English tags"]
}

Output ONLY the JSON object, nothing else.`

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
    const body = await req.json() as { input?: string }
    const input = body.input?.trim()
    if (!input) return NextResponse.json({ error: 'Kein Name übergeben.' }, { status: 400, headers: CORS_HEADERS })

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: input }],
    })

    const raw     = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const match   = jsonStr.match(/\{[\s\S]*\}/)
    const parsed  = JSON.parse(match?.[0] ?? jsonStr)

    return NextResponse.json(parsed, { headers: CORS_HEADERS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('generate-location-archetype error:', msg)
    return NextResponse.json({ error: `KI-Generierung fehlgeschlagen: ${msg}` }, { status: 500, headers: CORS_HEADERS })
  }
}
