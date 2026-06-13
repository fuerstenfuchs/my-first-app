import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase-server'

const inputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(25),
})

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ indexed: 0, error: 'OPENAI_API_KEY not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { ids } = parsed.data

  // Fetch prompts — RLS ensures only the user's own prompts are returned
  const { data: prompts, error: fetchError } = await supabase
    .from('prompts')
    .select('id, title, content, description')
    .in('id', ids)
    .eq('user_id', user.id)

  if (fetchError) {
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
  }
  if (!prompts || prompts.length === 0) {
    return NextResponse.json({ indexed: 0 })
  }

  // Build embedding texts: title + description + content, capped at ~8000 chars (~6000 tokens)
  const texts = prompts.map(p =>
    [p.title, p.description, p.content]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 8000)
  )

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  let embeddings: number[][]
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    })
    embeddings = response.data.map(e => e.embedding)
  } catch {
    return NextResponse.json({ error: 'Embedding generation failed' }, { status: 502 })
  }

  // Store embeddings — pgvector expects "[v1,v2,...,vN]" string via PostgREST
  await Promise.allSettled(
    prompts.map((prompt, i) =>
      supabase
        .from('prompts')
        .update({ embedding: `[${embeddings[i].join(',')}]` })
        .eq('id', prompt.id)
        .eq('user_id', user.id)
    )
  )

  return NextResponse.json({ indexed: prompts.length })
}
