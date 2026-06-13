import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase-server'

const updateSchema = z.object({
  content: z.string().min(1).max(50000).optional(),
  name: z.string().max(100).nullable().optional(),
}).refine(d => d.content !== undefined || d.name !== undefined, {
  message: 'content oder name muss angegeben werden',
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

interface RouteContext { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  // Fetch current variant (ownership check via user_id)
  const { data: existing, error: fetchErr } = await supabase
    .from('prompt_variants')
    .select('id, prompt_id, sort_order, content')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Variante nicht gefunden' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.content !== undefined) {
    updates.content = parsed.data.content
    const embedding = await embedText(parsed.data.content)
    if (embedding) updates.embedding = `[${embedding.join(',')}]`
  }

  const { data: variant, error: updateErr } = await supabase
    .from('prompt_variants')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, prompt_id, name, content, sort_order, updated_at')
    .single()

  if (updateErr || !variant) {
    return NextResponse.json({ error: 'Update fehlgeschlagen' }, { status: 500 })
  }

  // Keep prompts.content in sync with Variant 1
  if (parsed.data.content && existing.sort_order === 1) {
    await supabase
      .from('prompts')
      .update({ content: parsed.data.content })
      .eq('id', existing.prompt_id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ variant })
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the variant to delete (ownership check)
  const { data: toDelete, error: fetchErr } = await supabase
    .from('prompt_variants')
    .select('id, prompt_id, sort_order')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !toDelete) {
    return NextResponse.json({ error: 'Variante nicht gefunden' }, { status: 404 })
  }

  // Count remaining variants (excluding the one being deleted)
  const { data: remaining } = await supabase
    .from('prompt_variants')
    .select('id, content, sort_order')
    .eq('prompt_id', toDelete.prompt_id)
    .neq('id', id)
    .order('sort_order', { ascending: true })

  if (!remaining) {
    return NextResponse.json({ error: 'Fehler beim Laden der Varianten' }, { status: 500 })
  }

  if (remaining.length === 1) {
    // Reverting to single-variant mode: write survivor back to prompts.content
    const survivor = remaining[0]
    await supabase
      .from('prompts')
      .update({ content: survivor.content })
      .eq('id', toDelete.prompt_id)
      .eq('user_id', user.id)

    // Delete ALL variants for this prompt (including the survivor)
    await supabase
      .from('prompt_variants')
      .delete()
      .eq('prompt_id', toDelete.prompt_id)
      .eq('user_id', user.id)

    return NextResponse.json({ reverted: true })
  }

  // Multiple variants remain — just delete this one
  const { error: delErr } = await supabase
    .from('prompt_variants')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (delErr) {
    return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ reverted: false })
}
