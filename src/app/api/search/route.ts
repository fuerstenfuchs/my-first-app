import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase-server'

const inputSchema = z.object({
  query: z.string().min(2).max(500),
  activeTag: z.string().nullable().optional(),
  favoritesOnly: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    // Graceful fallback when API key not configured — frontend shows keyword results only
    return NextResponse.json({ ids: [] })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { query, activeTag, favoritesOnly } = parsed.data

  // Generate query embedding
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  let embedding: number[]
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    })
    embedding = response.data[0].embedding
  } catch {
    // OpenAI unavailable — silent fallback to keyword-only results
    return NextResponse.json({ ids: [] })
  }

  // Run hybrid search via RPC
  const { data, error } = await supabase.rpc('hybrid_search', {
    query_embedding: `[${embedding.join(',')}]`,
    query_text: query,
    p_user_id: user.id,
    tag_filter: activeTag ?? null,
    p_favorites_only: favoritesOnly ?? false,
    match_count: 50,
  })

  if (error) {
    // hybrid_search not available yet (migration pending) — silent fallback
    return NextResponse.json({ ids: [] })
  }

  const ids = (data as Array<{ id: string; score: number }>).map(r => r.id)
  return NextResponse.json({ ids })
}
