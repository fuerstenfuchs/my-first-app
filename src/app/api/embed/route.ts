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

  // Fetch variants for these prompts
  const { data: variants } = await supabase
    .from('prompt_variants')
    .select('id, prompt_id, content')
    .in('prompt_id', ids)
    .eq('user_id', user.id)

  // Build embedding texts: title + description + content, capped at ~8000 chars (~6000 tokens)
  const promptTexts = prompts.map(p =>
    [p.title, p.description, p.content]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 8000)
  )
  const variantTexts = (variants ?? []).map(v => (v.content ?? '').slice(0, 8000))

  const allTexts = [...promptTexts, ...variantTexts]

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  let allEmbeddings: number[][]
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: allTexts,
    })
    allEmbeddings = response.data.map(e => e.embedding)
  } catch {
    return NextResponse.json({ error: 'Embedding generation failed' }, { status: 502 })
  }

  const promptEmbeddings = allEmbeddings.slice(0, prompts.length)
  const variantEmbeddings = allEmbeddings.slice(prompts.length)

  // Store prompt embeddings
  await Promise.allSettled(
    prompts.map((prompt, i) =>
      supabase
        .from('prompts')
        .update({ embedding: `[${promptEmbeddings[i].join(',')}]` })
        .eq('id', prompt.id)
        .eq('user_id', user.id)
    )
  )

  // Store variant embeddings
  if (variants && variants.length > 0) {
    await Promise.allSettled(
      variants.map((variant, i) =>
        supabase
          .from('prompt_variants')
          .update({ embedding: `[${variantEmbeddings[i].join(',')}]` })
          .eq('id', variant.id)
          .eq('user_id', user.id)
      )
    )
  }

  return NextResponse.json({ indexed: prompts.length })
}
