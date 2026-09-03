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

  if (error) {
    // Nicht als "keine Bilder" ausgeben: Netzfehler, RLS-Ablehnung und ein
    // wirklich leeres Ergebnis sähen für den Benutzer sonst gleich aus.
    console.error('Referenzbilder konnten nicht geladen werden:', error.message)
    throw new Error(error.message)
  }
  if (!data) return []

  const results: RefImage[] = []
  for (const variant of data as Array<{ name: string; images: Array<{ url: string; sort_order: number }> }>) {
    const sorted = [...(variant.images ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    for (const img of sorted) {
      if (img.url) results.push({ url: img.url, label: variant.name })
    }
  }
  return results
}

// Hier stand bis PROJ-52 `loadArchetypeRefImages` — der flache Sonderweg für
// Archetyp-Bilder, die ohne Variante direkt am Eintrag hingen. Mit den
// Archetypen ist auch er entfallen; es gibt nur noch den Weg über Varianten.
