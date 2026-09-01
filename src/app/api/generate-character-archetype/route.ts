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

const SYSTEM_PROMPT = `You are a specialist in character design and casting for AI image generation.

The user gives a short name for a generic CHARACTER ARCHETYPE — a universal type of person, not a real, specific individual. Examples: "Schlagerstar", "Polizistin", "Influencerin", "Rockmusiker", "Geschäftsfrau", "Cowboy", "Wikinger", "Bayerischer Polizist", "Lufthansa Pilot".

RESEARCH MODE: If the name refers to a real, identifiable profession, uniform, organization or institution (e.g. police forces, military, fire department, airlines, public-service roles, regional/national institutions), use your real-world knowledge to make the description and attributes as accurate as possible to how that role/uniform actually looks in reality. For purely fictional or generic archetypes, use plausible, genre-appropriate creative judgement instead.

The user may already provide some fields and attributes filled in (passed as "Already specified" below) — these take priority and must be kept EXACTLY as given in your output, unchanged. Only fill in the fields and attributes that are still empty, in a way that is consistent with what was already specified.

Return ONLY a valid JSON object — no markdown, no code fences, no explanation.

JSON schema:
{
  "short_description": "string — 1 short sentence in German summarizing the character, for the user's own organization",
  "long_description": "string — 3-5 short comma-separated German phrases describing appearance, demeanor and presence in detail",
  "prompt": "string — 5-8 short comma-separated English phrases describing the character for an AI image generator (no full sentences, no trailing period on each phrase except the last)",
  "tags": ["array of 3-5 lowercase English tags"],
  "attributes": {
    "geschlecht": "string or omit if not applicable/unknown",
    "alter": "string (e.g. '40' or '30er Jahre') or omit",
    "koerperbau": "string or omit",
    "groesse": "string or omit",
    "haarfarbe": "string or omit",
    "haarstil": "string or omit",
    "augenfarbe": "string or omit",
    "bart": "string or omit (only relevant if applicable)",
    "hauttyp": "string or omit",
    "nationalitaet": "string or omit",
    "beruf": "string or omit",
    "persoenlichkeit": "string or omit",
    "ausstrahlung": "string or omit",
    "stimmung": "string or omit",
    "besonderheiten": "string or omit"
  }
}

Omit any attribute key entirely if it is not meaningfully applicable — do not invent a value just to fill the schema. All German field values should be in German, the prompt field in English.

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
    const body = await req.json() as { name?: string; attributes?: Record<string, string> }
    const name = body.name?.trim()
    if (!name) return NextResponse.json({ error: 'Kein Name übergeben.' }, { status: 400, headers: CORS_HEADERS })

    const existingAttrs = Object.fromEntries(
      Object.entries(body.attributes ?? {}).filter(([, v]) => v?.trim())
    )
    const userMessage = `Name: ${name}` + (
      Object.keys(existingAttrs).length > 0
        ? `\n\nAlready specified (keep unchanged):\n${JSON.stringify(existingAttrs, null, 2)}`
        : ''
    )

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 768,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw     = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const match   = jsonStr.match(/\{[\s\S]*\}/)
    const parsed  = JSON.parse(match?.[0] ?? jsonStr)

    return NextResponse.json(parsed, { headers: CORS_HEADERS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('generate-character-archetype error:', msg)
    return NextResponse.json({ error: `KI-Generierung fehlgeschlagen: ${msg}` }, { status: 500, headers: CORS_HEADERS })
  }
}
