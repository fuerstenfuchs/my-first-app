'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { dateienFreigeben } from '@/lib/datei-freigeben'
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
 * WARUM SEIT 15.09.2026 ERST DIE ZEILE, DANN DIE DATEI: Hier stand bis dahin
 * das Gegenteil — erst die Datei, weil sonst eine verwaiste Datei im Speicher
 * läge. Das stimmte, solange jede Datei genau EINER Zeile gehörte. Werden
 * byte-gleiche Bilder zusammengelegt, zeigen mehrere Zeilen auf dieselbe
 * Datei; sie darf erst weg, wenn niemand mehr darauf zeigt. Gezählt werden
 * kann aber erst, wenn die eigene Zeile nicht mehr mitzählt.
 *
 * Die alte Sorge bleibt als bewusster Preis stehen: Scheitert das Freigeben
 * nach dem Aktualisieren der Zeile, bleibt eine verwaiste Datei liegen. Das
 * ist der billigere Fehler — ein kaputtes Bild in einer fremden Zeile wäre
 * nicht mehr zurückzuholen. Siehe `src/lib/datei-freigeben.ts`.
 */

/** `result_paths` sind laut proj-37 immer Pfade in diesem Eimer. */
const BUCKET = 'generated-images'

export function useBildLoeschen() {
  const [loescht, setLoescht] = useState<string | null>(null)
  const supabase = createClient()

  const loeschen = useCallback(async (job: ImageJob, pfad: string): Promise<boolean> => {
    setLoescht(pfad)
    try {
      // Den Stand FRISCH holen statt aus dem Zustand: `job.result_paths` ist
      // eine Momentaufnahme vom letzten Zeichnen. Loescht man zwei Bilder
      // schnell hintereinander, rechnet das zweite Loeschen sonst auf dem alten
      // Stand und schreibt den ersten Pfad wieder hinein — eine Kachel ohne
      // Datei.
      const { data: frisch } = await supabase
        .from('image_jobs')
        .select('result_paths, source_path')
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
      } else {
        const { error } = await supabase
          .from('image_jobs')
          .update({ result_paths: rest })
          .eq('id', job.id)
        if (error) {
          toast.error(`Eintrag ließ sich nicht aktualisieren: ${error.message}`)
          return false
        }
      }

      // Erst jetzt zählt die eigene Zeile nicht mehr mit. Bleibt die Datei
      // liegen (noch verwendet, Zählung gescheitert), ist das Bild für diesen
      // Auftrag trotzdem gelöscht — deshalb keine Fehlermeldung, nur das
      // Protokoll in `dateiFreigeben`.
      //
      // War es das letzte Bild, ist der Auftrag weg — und mit ihm sein Verweis
      // auf die QUELLE einer Vergrößerung oder Bearbeitung. Dann ist auch sie
      // Kandidat; die Zählung entscheidet (siehe `use-image-jobs.ts`).
      const quelle = rest.length === 0 ? (frisch?.source_path ?? job.source_path ?? null) : null
      await dateienFreigeben(supabase, [
        { bucket: BUCKET, pfad },
        ...(quelle ? [{ bucket: BUCKET, pfad: quelle }] : []),
      ])

      if (rest.length === 0) {
        toast.success('Bild gelöscht', {
          description: 'Es war das letzte des Auftrags — der Eintrag ist mit weg.',
        })
        return true
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
