/**
 * Das Fach beim Charakter suchen oder anlegen, in das ein Ergebnis wandert
 * (PROJ-92) — dieselbe Regel wie im Bilddialog (`prompt-to-image-dialog.tsx`),
 * hier als eigene Funktion, damit die Seite „Personenbilder" sie ohne den
 * Dialog benutzen kann.
 *
 * ERST BEIM ABSCHICKEN, nicht beim Öffnen: Wer es sich anders überlegt, ließe
 * sonst ein leeres Fach zurück. Gesucht wird über `findeVariante` — denselben
 * Vergleich, den auch die Kette benutzt; ein genauerer legte ein zweites Fach
 * neben das vorhandene.
 *
 * Scheitert das Anlegen, kommt `null` zurück: erzeugt wird trotzdem, das Bild
 * bleibt dann in der Warteschlange. Eine bezahlte Erzeugung an einem
 * fehlgeschlagenen Ordner scheitern zu lassen, wäre die teurere Reaktion.
 */
import { findeVariante } from './charakter-varianten'
import type { AblageZiel } from './ablage-auftrag'

/** Das Nötigste von Supabase, das hier gebraucht wird — für den Test ersetzbar. */
export type VariantenClient = {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
  from: (tabelle: 'character_variants') => {
    select: (spalten: string) => {
      eq: (spalte: string, wert: string) => {
        limit: (n: number) => PromiseLike<{ data: { id: string; name: string | null }[] | null }>
      }
    }
    insert: (zeile: Record<string, unknown>) => {
      select: (spalten: string) => {
        single: () => PromiseLike<{ data: { id: string } | null }>
      }
    }
  }
}

export async function ablageMitFach(client: VariantenClient, ziel: AblageZiel): Promise<AblageZiel | null> {
  if (ziel.variantId) return ziel
  try {
    const { data: { user } } = await client.auth.getUser()
    const { data: vorhanden } = await client
      .from('character_variants')
      .select('id, name')
      .eq('character_id', ziel.parentId)
      .limit(200)
    const treffer = findeVariante(vorhanden ?? [], ziel.variantName)
    if (treffer?.id) return { ...ziel, variantId: treffer.id }

    const { data } = await client
      .from('character_variants')
      .insert({
        character_id: ziel.parentId,
        user_id: user?.id,
        name: ziel.variantName,
        // Wie an jeder anderen Anlegestelle im Projekt.
        sort_order: (vorhanden ?? []).length,
      })
      .select('id')
      .single()
    return data?.id ? { ...ziel, variantId: data.id } : null
  } catch {
    return null
  }
}
