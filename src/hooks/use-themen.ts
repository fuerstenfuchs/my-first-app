'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'

/**
 * Die Themen der Prompt-Datenbank (PROJ-63).
 *
 * WARUM ES SIE GIBT: Von 80 Prompts hatten 51 kein Schlagwort, 3 waren Favorit,
 * einer war bewertet, 30 lagen in einer Sammlung. Es gab kein Feld mit wenigen
 * festen Werten, nach dem man ordnen konnte. Die Ordnung, die Mark nicht
 * pflegt, hat deshalb einmalig eine Text-KI gemacht — ab hier gehört sie ihm.
 */
export interface Thema {
  id: string
  name: string
  beschreibung: string | null
  /**
   * DIE VIER BILDER DER KARTE STEHEN FEST.
   *
   * Mark am 05.09.2026: „Wenn die immer gleich blieben, also nicht dass auch
   * die Neuesten immer dann angezeigt werden, sondern wirklich feste, die für
   * diese Rubrik auch wirklich stehen." Ein Titelbild, das wechselt, ist kein
   * Titelbild — man müsste die Karte jedes Mal neu lesen. Neue Prompts wandern
   * ins Thema, aber nicht auf die Karte.
   */
  titelbild_prompt_id: string | null
  beleg_prompt_ids: string[]
  sortierung: number
}

export function useThemen() {
  const [themen, setThemen] = useState<Thema[]>([])
  const [loading, setLoading] = useState(true)

  const laden = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('themen')
      .select('id, name, beschreibung, titelbild_prompt_id, beleg_prompt_ids, sortierung')
      .order('sortierung', { ascending: true })
    if (error) {
      toast.error('Themen konnten nicht geladen werden')
    } else {
      setThemen((data ?? []).map(t => ({ ...t, beleg_prompt_ids: t.beleg_prompt_ids ?? [] })) as Thema[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void laden() }, [laden])

  const umbenennen = useCallback(async (id: string, name: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('themen')
      .update({ name, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Umbenennen fehlgeschlagen'); return false }
    setThemen(v => v.map(t => t.id === id ? { ...t, name } : t))
    return true
  }, [])

  /**
   * Zusammenlegen: Die Prompts des einen Themas wandern in das andere, dann
   * verschwindet das leere.
   *
   * REIHENFOLGE IST WICHTIG — erst umhängen, dann löschen. Andersherum würden
   * die Prompts durch `on delete set null` themenlos und wären danach nicht
   * mehr auffindbar, weil niemand weiß, wo sie hingehörten.
   */
  const zusammenlegen = useCallback(async (vonId: string, nachId: string) => {
    const supabase = createClient()
    const { error: e1 } = await supabase.from('prompts')
      .update({ thema_id: nachId }).eq('thema_id', vonId)
    if (e1) { toast.error('Zusammenlegen fehlgeschlagen'); return false }
    const { error: e2 } = await supabase.from('themen').delete().eq('id', vonId)
    if (e2) { toast.error('Das leere Thema blieb stehen'); return false }
    setThemen(v => v.filter(t => t.id !== vonId))
    toast.success('Themen zusammengelegt')
    return true
  }, [])

  const titelbildSetzen = useCallback(async (themaId: string, promptId: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('themen')
      .update({ titelbild_prompt_id: promptId, updated_at: new Date().toISOString() })
      .eq('id', themaId)
    if (error) { toast.error('Titelbild konnte nicht gesetzt werden'); return false }
    setThemen(v => v.map(t => t.id === themaId ? { ...t, titelbild_prompt_id: promptId } : t))
    toast.success('Titelbild gesetzt')
    return true
  }, [])

  /** Einen Prompt in die drei Belege aufnehmen — der älteste fällt heraus. */
  const belegSetzen = useCallback(async (themaId: string, promptId: string) => {
    const thema = themen.find(t => t.id === themaId)
    if (!thema) return false
    const neu = [promptId, ...thema.beleg_prompt_ids.filter(i => i !== promptId)].slice(0, 3)
    const supabase = createClient()
    const { error } = await supabase.from('themen')
      .update({ beleg_prompt_ids: neu, updated_at: new Date().toISOString() }).eq('id', themaId)
    if (error) { toast.error('Beleg konnte nicht gesetzt werden'); return false }
    setThemen(v => v.map(t => t.id === themaId ? { ...t, beleg_prompt_ids: neu } : t))
    toast.success('Als Beleg übernommen')
    return true
  }, [themen])

  const verschieben = useCallback(async (promptId: string, themaId: string | null) => {
    const supabase = createClient()
    const { error } = await supabase.from('prompts').update({ thema_id: themaId }).eq('id', promptId)
    if (error) { toast.error('Verschieben fehlgeschlagen'); return false }
    return true
  }, [])

  return { themen, loading, laden, umbenennen, zusammenlegen, titelbildSetzen, belegSetzen, verschieben }
}
