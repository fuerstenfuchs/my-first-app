import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase-server'

const createSchema = z.object({
  prompt_id: z.string().uuid(),
  content: z.string().min(1, 'Inhalt darf nicht leer sein').max(50000),
  name: z.string().max(100).optional(),
})

async function embedText(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
    return res.data[0].embedding
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  const { prompt_id, content, name } = parsed.data

  // Verify the prompt belongs to this user
  const { data: prompt, error: promptErr } = await supabase
    .from('prompts')
    .select('id, content')
    .eq('id', prompt_id)
    .eq('user_id', user.id)
    .single()

  if (promptErr || !prompt) {
    return NextResponse.json({ error: 'Prompt nicht gefunden' }, { status: 404 })
  }

  // Count existing variants to determine if this is the first one
  const { count } = await supabase
    .from('prompt_variants')
    .select('id', { count: 'exact', head: true })
    .eq('prompt_id', prompt_id)

  const existingCount = count ?? 0

  if (existingCount === 0) {
    // First additional variant: migrate existing prompts.content → Variant 1
    const v1Embedding = await embedText(prompt.content ?? '')
    const { error: v1Err } = await supabase.from('prompt_variants').insert({
      prompt_id,
      user_id: user.id,
      name: 'Variante 1',
      content: prompt.content ?? '',
      sort_order: 1,
      embedding: v1Embedding ? `[${v1Embedding.join(',')}]` : null,
    })
    if (v1Err) return NextResponse.json({ error: 'Fehler beim Erstellen von Variante 1' }, { status: 500 })
  }

  // Create the new variant
  const newSortOrder = existingCount + 2 // +2 because Variant 1 was just created (or existed)
  const actualSortOrder = existingCount === 0 ? 2 : existingCount + 1
  void newSortOrder // suppress unused warning
  const variantName = name?.trim() || `Variante ${actualSortOrder}`
  const embedding = await embedText(content)

  const { data: variant, error: varErr } = await supabase
    .from('prompt_variants')
    .insert({
      prompt_id,
      user_id: user.id,
      name: variantName,
      content,
      sort_order: actualSortOrder,
      embedding: embedding ? `[${embedding.join(',')}]` : null,
    })
    .select('id, prompt_id, name, content, sort_order, created_at')
    .single()

  if (varErr || !variant) {
    return NextResponse.json({ error: 'Variante konnte nicht erstellt werden' }, { status: 500 })
  }

  return NextResponse.json({ variant }, { status: 201 })
}
