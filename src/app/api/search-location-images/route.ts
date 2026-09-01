import { NextRequest, NextResponse } from 'next/server'
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

export interface ImageSearchResult {
  url: string
  thumbnailUrl: string
  title: string
  source: string
}

// ── Provider: Serper.dev (Google Images) ─────────────────────────────────────

async function searchSerper(query: string): Promise<ImageSearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) throw new Error('Serper API nicht konfiguriert (SERPER_API_KEY)')

  const res = await fetch('https://google.serper.dev/images', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num: 20 }),
  })
  if (!res.ok) throw new Error(`Serper: HTTP ${res.status}`)

  const data = await res.json() as {
    images?: Array<{
      imageUrl:     string
      thumbnailUrl: string
      title:        string
      source:       string
      link:         string
    }>
  }

  return (data.images ?? []).map(item => ({
    url:          item.imageUrl,
    thumbnailUrl: item.thumbnailUrl,
    title:        item.title,
    source:       item.source,
  }))
}

// ── Provider: Google Custom Search ───────────────────────────────────────────

async function searchGoogle(query: string): Promise<ImageSearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  const cx    = process.env.GOOGLE_SEARCH_ENGINE_ID
  if (!apiKey || !cx) throw new Error('Google API nicht konfiguriert (GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID)')

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('searchType', 'image')
  url.searchParams.set('num', '10')
  url.searchParams.set('safe', 'active')
  url.searchParams.set('imgSize', 'large')

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`Google: ${err.error?.message ?? res.status}`)
  }

  const data = await res.json() as {
    items?: Array<{
      link: string
      image: { thumbnailLink: string }
      title: string
      displayLink: string
    }>
  }

  return (data.items ?? []).map(item => ({
    url:          item.link,
    thumbnailUrl: item.image.thumbnailLink,
    title:        item.title,
    source:       item.displayLink,
  }))
}

// ── Provider: Bing Image Search ───────────────────────────────────────────────

async function searchBing(query: string): Promise<ImageSearchResult[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY
  if (!apiKey) throw new Error('Bing API nicht konfiguriert (BING_SEARCH_API_KEY)')

  const url = new URL('https://api.bing.microsoft.com/v7.0/images/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', '20')
  url.searchParams.set('imageType', 'Photo')
  url.searchParams.set('size', 'Large')
  url.searchParams.set('safeSearch', 'Moderate')

  const res = await fetch(url.toString(), {
    headers: { 'Ocp-Apim-Subscription-Key': apiKey },
  })
  if (!res.ok) throw new Error(`Bing: HTTP ${res.status}`)

  const data = await res.json() as {
    value?: Array<{
      contentUrl:          string
      thumbnailUrl:        string
      name:                string
      hostPageDisplayUrl:  string
    }>
  }

  return (data.value ?? []).map(item => ({
    url:          item.contentUrl,
    thumbnailUrl: item.thumbnailUrl,
    title:        item.name,
    source:       item.hostPageDisplayUrl,
  }))
}

// ── Route ─────────────────────────────────────────────────────────────────────

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

  try {
    const { query } = await req.json() as { query?: string }
    if (!query?.trim()) {
      return NextResponse.json({ error: 'Suchbegriff fehlt' }, { status: 400, headers: CORS_HEADERS })
    }

    let results: ImageSearchResult[]

    // Provider-Priorität: Serper → Google → Bing
    if (process.env.SERPER_API_KEY) {
      results = await searchSerper(query.trim())
    } else if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      results = await searchGoogle(query.trim())
    } else if (process.env.BING_SEARCH_API_KEY) {
      results = await searchBing(query.trim())
    } else {
      return NextResponse.json(
        { error: 'Keine Bildsuche konfiguriert. Bitte SERPER_API_KEY in den Vercel-Umgebungsvariablen einrichten.' },
        { status: 503, headers: CORS_HEADERS }
      )
    }

    return NextResponse.json({ results }, { headers: CORS_HEADERS })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('search-location-images error:', msg)
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS_HEADERS })
  }
}
