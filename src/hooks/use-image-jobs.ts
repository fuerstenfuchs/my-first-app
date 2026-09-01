'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import type { JobStatus, ReferenzRolle } from '@/lib/image-generation'

export interface ImageJob {
  id:             string
  user_id:        string
  created_at:     string
  started_at:     string | null
  finished_at:    string | null
  status:         JobStatus
  attempts:       number
  error:          string | null
  prompt:         string
  model:          string
  size:           string
  aspect_ratio:   string | null
  input_fidelity: string | null
  variants:       number
  reference_urls: string[]
  reference_roles: ReferenzRolle[]
  scene_meta:     Record<string, unknown> | null
  result_paths:   string[]
}

export interface ImageJobInput {
  prompt:          string
  model:           string
  size:            string
  aspect_ratio?:   string | null
  variants:        number
  reference_urls?: string[]
  reference_roles?: ReferenzRolle[]
  scene_meta?:     Record<string, unknown> | null
  preset_id?:      string | null
}

const TABLE  = 'image_jobs'
const BUCKET = 'generated-images'

export function ergebnisUrl(pfad: string): string {
  const supabase = createClient()
  return supabase.storage.from(BUCKET).getPublicUrl(pfad).data.publicUrl
}

export function useImageJobs(aktiv = true) {
  const [jobs, setJobs] = useState<ImageJob[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const laden = useCallback(async () => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      toast.error('Aufträge konnten nicht geladen werden')
      setLoading(false)
      return
    }
    setJobs((data ?? []) as ImageJob[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (!aktiv) return
    void laden()
  }, [aktiv, laden])

  /**
   * Solange etwas wartet oder läuft, alle fünf Sekunden nachsehen.
   * Steht nichts an, wird nicht gefragt — der Arbeiter läuft auf dem PC, die
   * Seite kann nicht wissen, wann er etwas tut, aber sie soll auch nicht
   * dauerhaft Anfragen erzeugen.
   */
  // Abgeleitetes Merkmal statt jobs in der Abhängigkeitsliste: laden() setzt bei
  // jedem Abruf ein neues Array, der Effekt liefe sonst jede Runde neu an.
  const etwasOffen = jobs.some(j => j.status === 'queued' || j.status === 'running')

  useEffect(() => {
    if (!aktiv || !etwasOffen) return
    const timer = setInterval(() => { void laden() }, 5000)
    return () => clearInterval(timer)
  }, [aktiv, etwasOffen, laden])

  const anlegen = useCallback(async (input: ImageJobInput): Promise<ImageJob | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Nicht angemeldet')
      return null
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id:        user.id,
        prompt:         input.prompt,
        model:          input.model,
        size:           input.size,
        aspect_ratio:   input.aspect_ratio ?? null,
        variants:       input.variants,
        reference_urls:  input.reference_urls ?? [],
        reference_roles: input.reference_roles ?? [],
        scene_meta:     input.scene_meta ?? null,
        preset_id:      input.preset_id ?? null,
      })
      .select()
      .single()

    if (error) {
      toast.error(`Auftrag konnte nicht eingereiht werden: ${error.message}`)
      return null
    }

    const job = data as ImageJob
    setJobs(prev => [job, ...prev])
    return job
  }, [supabase])

  /** Fehlgeschlagenen Auftrag zurück in die Warteschlange. */
  const erneutEinreihen = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from(TABLE)
      .update({ status: 'queued', attempts: 0, error: null, started_at: null, finished_at: null })
      .eq('id', id)

    if (error) {
      toast.error('Erneutes Einreihen fehlgeschlagen')
      return false
    }
    setJobs(prev => prev.map(j =>
      j.id === id ? { ...j, status: 'queued' as JobStatus, attempts: 0, error: null } : j,
    ))
    toast.success('Wieder eingereiht')
    return true
  }, [supabase])

  const loeschen = useCallback(async (job: ImageJob): Promise<boolean> => {
    // Erst die Bilder, dann die Zeile — andersherum wüsste niemand mehr,
    // welche Dateien zu löschen wären.
    if (job.result_paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(job.result_paths)
      if (storageError) {
        // Nicht weitermachen: Ohne die Zeile wüsste niemand mehr, wozu die
        // zurückgebliebenen Dateien gehören.
        toast.error(`Bilder konnten nicht gelöscht werden: ${storageError.message}`)
        return false
      }
    }
    const { error } = await supabase.from(TABLE).delete().eq('id', job.id)
    if (error) {
      toast.error('Löschen fehlgeschlagen')
      return false
    }
    setJobs(prev => prev.filter(j => j.id !== job.id))
    return true
  }, [supabase])

  return { jobs, loading, laden, anlegen, erneutEinreihen, loeschen }
}
