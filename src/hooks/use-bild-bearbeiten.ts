'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { ImageJob } from '@/hooks/use-image-jobs'
import type { Ausschnitt } from '@/lib/zuschnitt'

/**
 * Eine bearbeitete Fassung ablegen.
 *
 * WARUM DER BROWSER DAS SELBST MACHT UND NICHT DER ARBEITER: Das Bild liegt
 * beim Bearbeiten ohnehin schon im Browser — es durch die Warteschlange zu
 * schicken hieße, auf etwas zu warten, das gerade fertig auf dem Bildschirm
 * steht. Und die Speicherregel erlaubt es ihm: `generated write own` lässt den
 * angemeldeten Nutzer in seinen eigenen Ordner schreiben (nachgemessen am
 * 02.09.2026).
 *
 * WARUM TROTZDEM EINE ZEILE IN `image_jobs`: Ohne sie taucht die Fassung im
 * Lichttisch nicht auf — der liest die Auftragstabelle, nicht den Speicher.
 *
 * WARUM EIN EIGENER AUFTRAG UND NICHT ANS ORIGINAL ANGEHÄNGT: Ein Auftrag mit
 * vier Durchläufen bekäme sonst ein fünftes Bild, obwohl `variants` vier sagt,
 * und ein erneutes Einreihen würde es überschreiben. Die Bearbeitung ist eine
 * neue Fassung, kein weiteres Ergebnis desselben Auftrags. Das Original bleibt
 * unangetastet — ein misslungener Beschnitt ist damit kein Verlust, sondern
 * eine Kachel, die man löscht.
 */

export type Bearbeitung = {
  ausschnitt: Ausschnitt
  regler: Record<string, number>
}

const BUCKET = 'generated-images'

export function useBildBearbeiten() {
  const [speichert, setSpeichert] = useState(false)
  const supabase = createClient()

  const speichern = useCallback(async (
    quelle: ImageJob,
    quellPfad: string,
    blob: Blob,
    bearbeitung: Bearbeitung,
    /**
     * Die TATSÄCHLICHEN Maße der Fassung.
     *
     * Nicht die der Quelle: Nach einem Zuschnitt sind sie andere, und
     * `ergebnis-kachel.tsx` rechnet die Vergrößerungsvorschau aus `size`. Ohne
     * diese Angabe böte das Menü zu einem 1200×675-Bild „3× · 3072×3072" an —
     * derselbe Fehlertyp, der hier schon einmal gefunden wurde: ein Menü, das
     * Maße verspricht, die nicht eintreten.
     */
    masse: { breite: number; hoehe: number },
  ): Promise<ImageJob | null> => {
    setSpeichert(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Nicht angemeldet'); return null }

      // Erst die Zeile, dann die Datei: Der Pfad enthält die Auftragskennung,
      // und die gibt es erst mit der Zeile. Scheitert das Hochladen danach,
      // wird die Zeile wieder entfernt — sonst stünde im Lichttisch eine
      // Kachel ohne Bild.
      const { data: zeile, error: zeilenErr } = await supabase
        .from('image_jobs')
        .insert({
          user_id:     user.id,
          job_type:    'bearbeitet',
          status:      'done',
          source_path: quellPfad,
          bearbeitung,
          // Kein „Bearbeitet · Bearbeitet · …" beim Bearbeiten einer Fassung.
          prompt: quelle.prompt.startsWith('Bearbeitet · ')
            ? quelle.prompt.slice(0, 140)
            : `Bearbeitet · ${quelle.prompt.slice(0, 120)}`,
          model:       'browser',
          size:        `${masse.breite}x${masse.hoehe}`,
          // Das Seitenverhältnis der Quelle stimmt nach einem Zuschnitt nicht
          // mehr — und ein falsches ist schlechter als keins.
          aspect_ratio: null,
          variants:    1,
          scene_meta:  {
            ...(quelle.scene_meta ?? {}),
            herkunft: 'bearbeitung',
            quelle: quelle.id,
          },
        })
        .select()
        .single()

      if (zeilenErr || !zeile) {
        toast.error(`Speichern fehlgeschlagen: ${zeilenErr?.message ?? 'unbekannt'}`)
        return null
      }

      const pfad = `${user.id}/${zeile.id}/0.png`
      const { error: hochErr } = await supabase.storage
        .from(BUCKET)
        .upload(pfad, blob, { contentType: 'image/png', upsert: true })

      if (hochErr) {
        await supabase.from('image_jobs').delete().eq('id', zeile.id)
        toast.error(`Ablegen fehlgeschlagen: ${hochErr.message}`)
        return null
      }

      const { error: pfadErr } = await supabase
        .from('image_jobs')
        .update({ result_paths: [pfad], finished_at: new Date().toISOString() })
        .eq('id', zeile.id)

      if (pfadErr) {
        // Datei liegt, Zeile weiß nichts davon — beides wieder weg, sonst
        // bleibt eine verwaiste Datei und eine leere Kachel.
        await supabase.storage.from(BUCKET).remove([pfad])
        await supabase.from('image_jobs').delete().eq('id', zeile.id)
        toast.error(`Eintragen fehlgeschlagen: ${pfadErr.message}`)
        return null
      }

      toast.success('Fassung gespeichert', {
        description: 'Das Original bleibt unverändert daneben stehen.',
      })
      return { ...zeile, result_paths: [pfad] } as ImageJob
    } catch (e) {
      toast.error(`Speichern fehlgeschlagen: ${(e as Error).message}`)
      return null
    } finally {
      setSpeichert(false)
    }
  }, [supabase])

  return { speichert, speichern }
}
