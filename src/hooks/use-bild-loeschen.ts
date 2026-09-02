'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { ImageJob } from '@/hooks/use-image-jobs'

/**
 * Ein einzelnes Ergebnisbild löschen.
 *
 * Mark am 02.09.2026: „Was natürlich auch noch gut würde, wenn man die Bilder
 * direkt auch im Lichttisch löschen könnte."
 *
 * WARUM DAS BILD UND NICHT DER AUFTRAG: Ein Auftrag mit vier Durchläufen hat
 * vier Bilder, und meistens taugt eines davon nichts. Den ganzen Auftrag
 * wegzuwerfen, weil ein Bild misslungen ist, wäre die falsche Einheit. War es
 * das LETZTE Bild, geht die Auftragszeile mit — sonst bliebe eine Kachel ohne
 * Bild im Lichttisch stehen.
 *
 * WAS NICHT MITGEHT: Bilder, die schon in einen Baustein übernommen wurden.
 * Beim Übernehmen wird KOPIERT, nicht verknüpft (so entschieden am 02.09.2026,
 * genau für diesen Fall). Ein Charakterbild überlebt das Löschen hier also.
 *
 * WARUM ERST DIE DATEI, DANN DIE ZEILE: Andersherum wäre die Zeile weg und die
 * Datei läge verwaist im Speicher — niemand fände sie je wieder, und sie
 * zählte weiter gegen das Speicherkontingent. Scheitert dagegen die Zeile,
 * steht die Kachel noch da und man kann es erneut versuchen.
 */

const BUCKET = 'generated-images'

export function useBildLoeschen() {
  const [loescht, setLoescht] = useState<string | null>(null)
  const supabase = createClient()

  const loeschen = useCallback(async (job: ImageJob, pfad: string): Promise<boolean> => {
    setLoescht(pfad)
    try {
      const { error: dateiErr } = await supabase.storage.from(BUCKET).remove([pfad])
      if (dateiErr) {
        toast.error(`Datei ließ sich nicht löschen: ${dateiErr.message}`)
        return false
      }

      const rest = (job.result_paths ?? []).filter(p => p !== pfad)

      if (rest.length === 0) {
        const { error } = await supabase.from('image_jobs').delete().eq('id', job.id)
        if (error) {
          toast.error(`Auftrag ließ sich nicht entfernen: ${error.message}`)
          return false
        }
        toast.success('Bild gelöscht', {
          description: 'Es war das letzte des Auftrags — der Eintrag ist mit weg.',
        })
        return true
      }

      const { error } = await supabase
        .from('image_jobs')
        .update({ result_paths: rest })
        .eq('id', job.id)
      if (error) {
        toast.error(`Eintrag ließ sich nicht aktualisieren: ${error.message}`)
        return false
      }
      toast.success('Bild gelöscht', {
        description: `${rest.length} ${rest.length === 1 ? 'Bild' : 'Bilder'} des Auftrags ${rest.length === 1 ? 'bleibt' : 'bleiben'} stehen.`,
      })
      return true
    } catch (e) {
      toast.error(`Löschen fehlgeschlagen: ${(e as Error).message}`)
      return false
    } finally {
      setLoescht(null)
    }
  }, [supabase])

  return { loescht, loeschen }
}
