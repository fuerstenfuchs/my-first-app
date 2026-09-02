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
      if (dateiErr && !/not.?found|does not exist|404/i.test(dateiErr.message)) {
        toast.error(`Datei ließ sich nicht löschen: ${dateiErr.message}`)
        return false
      }
      // Eine schon fehlende Datei ist KEIN Grund aufzuhoeren. Sonst waere jede
      // Kachel, deren Datei aus irgendeinem Grund fehlt, fuer immer
      // unloeschbar — sie stuende da und zeigte ein kaputtes Bild.

      // Den Stand FRISCH holen statt aus dem Zustand: `job.result_paths` ist
      // eine Momentaufnahme vom letzten Zeichnen. Loescht man zwei Bilder
      // schnell hintereinander, rechnet das zweite Loeschen sonst auf dem alten
      // Stand und schreibt den ersten Pfad wieder hinein — eine Kachel ohne
      // Datei.
      const { data: frisch } = await supabase
        .from('image_jobs')
        .select('result_paths')
        .eq('id', job.id)
        .maybeSingle()
      const stand: string[] = frisch?.result_paths ?? job.result_paths ?? []
      const rest = stand.filter(p => p !== pfad)

      // Die Notiz „schon abgelegt" haengt am PFAD, und Ergebnispfade sind
      // wiederverwendbar (`<nutzer>/<auftrag>/<index>.png`). Bliebe sie stehen,
      // truege ein spaeteres, anderes Bild an derselben Stelle faelschlich die
      // Marke „abgelegt" — und der Filter „Noch nicht abgelegt" verbaerge es.
      // Ein still verschwundenes Bild ist der teurere Fehler.
      await supabase.from('bild_uebernahmen').delete().eq('quell_pfad', pfad)

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
