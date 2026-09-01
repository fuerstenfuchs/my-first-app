'use client'

import { createClient } from '@/lib/supabase'

/**
 * Referenzbilder eines Assets laden.
 *
 * Lag ursprünglich im Scene Builder. Ausgelagert, weil der Weg „gespeicherter
 * Prompt → Bild" (PROJ-38) dieselbe Auswahl braucht — zwei Kopien derselben
 * Abfrage wären genau die Art Doppelung, die später auseinanderläuft.
 */

export type RefImage = { url: string; label: string }

export async function loadRefImages(
  table: 'character_variants' | 'outfit_variants' | 'location_variants',
  fk: 'character_id' | 'outfit_id' | 'location_id',
  assetId: string,
): Promise<RefImage[]> {
  const supabase = createClient()
  const imageTable = table === 'character_variants' ? 'character_images'
    : table === 'outfit_variants' ? 'outfit_images' : 'location_images'

  const { data, error } = await supabase
    .from(table)
    .select(`name, images:${imageTable}(url, sort_order)`)
    .eq(fk, assetId)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  const results: RefImage[] = []
  for (const variant of data as Array<{ name: string; images: Array<{ url: string; sort_order: number }> }>) {
    const sorted = [...(variant.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    for (const img of sorted) {
      if (img.url) results.push({ url: img.url, label: variant.name })
    }
  }
  return results
}

// Archetype images (Character/Outfit/Location) have no variant grouping — they hang
// directly off the archetype, so this is a flat lookup instead of the variant+images join above.
export async function loadArchetypeRefImages(
  table: 'character_archetype_images' | 'outfit_archetype_images' | 'location_archetype_images',
  archetypeId: string,
): Promise<RefImage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from(table)
    .select('url, sort_order')
    .eq('archetype_id', archetypeId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return (data as Array<{ url: string }>)
    .filter(img => img.url)
    .map(img => ({ url: img.url, label: 'Referenzbild' }))
}
