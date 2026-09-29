'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { KoerperAuswahl } from '@/lib/referenzkette'
import {
  bereinigeMerkmale, bereinigeName, zeileZuPreset, type NutzerPreset,
} from '@/lib/koerper-nutzer-presets'

/**
 * Eigene Körperform-Presets laden, anlegen, überschreiben, löschen (PROJ-92).
 *
 * Die Tabelle `koerper_presets` hat Zeilensicherheit auf den eigenen Nutzer;
 * es wird deshalb nirgends nach `user_id` gefiltert — das täte die Datenbank
 * ohnehin, und ein Filter hier suggerierte eine Sicherheit, die er nicht ist.
 *
 * Fehlt die Tabelle noch (Migration nicht eingespielt), zeigt die Seite das
 * mit einem klaren Satz statt einer leeren Liste: „keine Presets" und „Tabelle
 * fehlt" dürfen nicht gleich aussehen.
 */
const TABELLE = 'koerper_presets'

/** Postgres / PostgREST sagen es je nach Stand anders — beide Formulierungen erkennen. */
function tabelleFehlt(text: string): boolean {
  return /schema cache|does not exist|relation .* koerper_presets/i.test(text) && /koerper_presets/i.test(text)
}

export function useKoerperPresets() {
  const [presets, setPresets] = useState<NutzerPreset[]>([])
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABELLE)
      .select('id, name, merkmale, koerper_bild')
      .order('sortierung', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      setFehler(tabelleFehlt(error.message)
        ? 'Die Tabelle für Presets fehlt noch — die Migration 20260929_koerper_presets.sql muss eingespielt werden.'
        : error.message)
      setLaedt(false)
      return
    }
    setFehler(null)
    setPresets((data ?? []).map(z => zeileZuPreset(z as Record<string, unknown>)).filter((p): p is NutzerPreset => p !== null))
    setLaedt(false)
  }, [])

  useEffect(() => { void laden() }, [laden])

  const anlegen = useCallback(async (
    name: string, merkmale: KoerperAuswahl, koerperBild: string | null,
  ): Promise<NutzerPreset | null> => {
    const sauber = bereinigeName(name)
    if (!sauber) { toast.error('Das Preset braucht einen Namen.'); return null }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Nicht angemeldet'); return null }
    const { data, error } = await supabase
      .from(TABELLE)
      .insert({
        user_id: user.id, name: sauber,
        merkmale: bereinigeMerkmale(merkmale), koerper_bild: koerperBild,
        sortierung: presets.length,
      })
      .select('id, name, merkmale, koerper_bild')
      .single()
    if (error || !data) { toast.error(`Preset nicht gespeichert: ${error?.message ?? 'unbekannt'}`); return null }
    const neu = zeileZuPreset(data as Record<string, unknown>)
    if (neu) setPresets(alt => [...alt, neu])
    return neu
  }, [presets.length])

  const ueberschreiben = useCallback(async (
    id: string, merkmale: KoerperAuswahl, koerperBild: string | null,
  ): Promise<boolean> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABELLE)
      .update({ merkmale: bereinigeMerkmale(merkmale), koerper_bild: koerperBild, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
    if (error) { toast.error(`Preset nicht gespeichert: ${error.message}`); return false }
    // Keine Zeile getroffen (gelöscht, fremde Zeile): nicht als Erfolg melden.
    if (!data || data.length === 0) { toast.error('Das Preset gibt es nicht mehr.'); return false }
    setPresets(alt => alt.map(p => p.id === id ? { ...p, merkmale: bereinigeMerkmale(merkmale), koerperBild } : p))
    return true
  }, [])

  const umbenennen = useCallback(async (id: string, name: string): Promise<boolean> => {
    const sauber = bereinigeName(name)
    if (!sauber) return false
    const supabase = createClient()
    const { error } = await supabase.from(TABELLE).update({ name: sauber }).eq('id', id)
    if (error) { toast.error(`Umbenennen ging nicht: ${error.message}`); return false }
    setPresets(alt => alt.map(p => p.id === id ? { ...p, name: sauber } : p))
    return true
  }, [])

  const loeschen = useCallback(async (id: string): Promise<boolean> => {
    const supabase = createClient()
    const { error } = await supabase.from(TABELLE).delete().eq('id', id)
    if (error) { toast.error(`Löschen ging nicht: ${error.message}`); return false }
    setPresets(alt => alt.filter(p => p.id !== id))
    return true
  }, [])

  return { presets, laedt, fehler, anlegen, ueberschreiben, umbenennen, loeschen, neuLaden: laden }
}
