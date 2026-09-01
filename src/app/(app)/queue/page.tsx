'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Loader2, RotateCw, Trash2, Clock, ImageOff, ChevronDown, ChevronRight, Download,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ImageLightbox } from '@/components/image-lightbox'
import { useImageJobs, ergebnisUrl, type ImageJob } from '@/hooks/use-image-jobs'
import { STATUS_TEXT, STATUS_FARBE, type JobStatus } from '@/lib/image-generation'
import { cn } from '@/lib/utils'

function zeit(iso: string): string {
  const d = new Date(iso)
  const heute = new Date()
  const gleicherTag = d.toDateString() === heute.toDateString()
  return gleicherTag
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) +
      ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function dauer(job: ImageJob): string | null {
  if (!job.started_at || !job.finished_at) return null
  const s = Math.round(
    (new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000,
  )
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`
}

function StatusChip({ status }: { status: JobStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
      STATUS_FARBE[status],
    )}>
      {status === 'running' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {status === 'queued' && <Clock className="h-2.5 w-2.5" />}
      {STATUS_TEXT[status]}
    </span>
  )
}

export default function QueuePage() {
  const { jobs, loading, erneutEinreihen, loeschen } = useImageJobs()
  const [offen, setOffen] = useState<Set<string>>(new Set())
  const [loeschKandidat, setLoeschKandidat] = useState<ImageJob | null>(null)
  const [lightbox, setLightbox] = useState<{ urls: string[]; start: number } | null>(null)

  function umschalten(id: string) {
    setOffen(prev => {
      const neu = new Set(prev)
      neu.has(id) ? neu.delete(id) : neu.add(id)
      return neu
    })
  }

  const wartend = jobs.filter(j => j.status === 'queued' || j.status === 'running').length

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
        <SidebarTrigger className="md:hidden" />
        <h1 className="flex-1 text-sm font-semibold">
          Warteschlange
          {jobs.length > 0 && (
            <span className="ml-1.5 font-normal text-muted-foreground">({jobs.length})</span>
          )}
        </h1>
        {wartend > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {wartend} offen — der Arbeiter holt sie ab
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <ImageOff className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-sm font-medium">Noch keine Aufträge</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Stelle im Scene Builder eine Szene zusammen und klicke dort auf
              „Zur Warteschlange". Der Arbeiter auf dem PC holt den Auftrag ab
              und legt das fertige Bild hier ab.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/scene-builder">Zum Scene Builder</Link>
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-2">
            {jobs.map(job => {
              const aufgeklappt = offen.has(job.id)
              const bilder = job.result_paths.map(ergebnisUrl)
              return (
                <div key={job.id} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                  <div className="flex items-start gap-3 p-3">
                    <button
                      onClick={() => umschalten(job.id)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={aufgeklappt ? 'Einzelheiten verbergen' : 'Einzelheiten zeigen'}
                      aria-expanded={aufgeklappt}
                    >
                      {aufgeklappt ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip status={job.status} />
                        <span className="text-[11px] text-muted-foreground">{zeit(job.created_at)}</span>
                        <span className="text-[11px] text-muted-foreground/60">
                          {job.model} · {job.size}
                          {job.aspect_ratio ? ` · ${job.aspect_ratio.replace(/_/g, ':').replace(/^[a-z]+:/, '')}` : ''}
                          {job.variants > 1 ? ` · ${job.variants}×` : ''}
                          {job.reference_urls.length > 0 ? ` · ${job.reference_urls.length} Ref.` : ''}
                        </span>
                        {dauer(job) && (
                          <span className="text-[11px] text-muted-foreground/60">{dauer(job)}</span>
                        )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {job.prompt}
                      </p>

                      {job.status === 'failed' && job.error && (
                        <p className="mt-1.5 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                          {job.error}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 gap-1">
                      {job.status === 'failed' && (
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => void erneutEinreihen(job.id)}
                          title="Erneut einreihen"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon" variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setLoeschKandidat(job)}
                        title="Auftrag löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {bilder.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 px-3 pb-3 sm:grid-cols-3 md:grid-cols-4">
                      {bilder.map((url, i) => (
                        <button
                          key={url}
                          onClick={() => setLightbox({ urls: bilder, start: i })}
                          className="group relative aspect-square overflow-hidden rounded border border-border/40 bg-muted/20"
                        >
                          <img
                            src={url} alt={`Ergebnis ${i + 1}`} loading="lazy"
                            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {aufgeklappt && (
                    <div className="space-y-3 border-t border-border/40 bg-muted/10 px-3 py-3 text-xs">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Vollständiger Prompt
                        </p>
                        <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
                          {job.prompt}
                        </p>
                      </div>

                      {job.reference_urls.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Verwendete Referenzen
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {job.reference_urls.map((url, i) => (
                              <button
                                key={url}
                                onClick={() => setLightbox({ urls: job.reference_urls, start: i })}
                                className="h-14 w-14 overflow-hidden rounded border border-border/40"
                              >
                                <img src={url} alt={`Referenz ${i + 1}`} loading="lazy"
                                  className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {bilder.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {bilder.map((url, i) => (
                            <Button key={url} asChild size="sm" variant="outline" className="h-6 text-[10px]">
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-1 h-2.5 w-2.5" />
                                Bild {i + 1} öffnen
                              </a>
                            </Button>
                          ))}
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground/50">
                        Auftrag {job.id}
                        {job.attempts > 1 ? ` · ${job.attempts} Versuche` : ''}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!loeschKandidat} onOpenChange={o => !o && setLoeschKandidat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {loeschKandidat && loeschKandidat.result_paths.length > 0
                ? `Der Auftrag und ${loeschKandidat.result_paths.length} erzeugte(s) Bild(er) werden endgültig gelöscht.`
                : 'Der Auftrag wird endgültig gelöscht.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (loeschKandidat) void loeschen(loeschKandidat)
                setLoeschKandidat(null)
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightbox && (
        <ImageLightbox
          images={lightbox.urls.map(url => ({ url }))}
          initialIndex={lightbox.start}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
