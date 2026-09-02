'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Loader2, RotateCw, Trash2, Clock, ImageOff, ChevronDown, ChevronRight, Download, ExternalLink, Maximize2,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ImageLightbox } from '@/components/image-lightbox'
import { useImageJobs, ergebnisUrl, type ImageJob } from '@/hooks/use-image-jobs'
import { STATUS_TEXT, STATUS_FARBE, ROLLEN_LABEL, type JobStatus } from '@/lib/image-generation'
import { bildHerunterladen, dateinameFuerBild } from '@/lib/bild-download'
import { KI_PREIS, VERFAHREN_NAME } from '@/lib/upscaling'
import { useWorkerStatus, seitWann } from '@/hooks/use-worker-status'
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

/**
 * Zeigt vorab, wie groß das Bild würde — 3× klingt abstrakt, 4608×3072 nicht.
 *
 * Nur wenn die Größe auch stimmt: Mit Referenzbild ignoriert gpt-image-2 den
 * Größenparameter und richtet sich nach der Vorlage (am 01.09.2026 gemessen,
 * 1024x1024 angefordert, 1122x1402 bekommen). Dann wäre jede Rechnung aus
 * `size` erfunden, und die Kachel verspräche Maße, die nicht eintreten.
 */
function masse(job: ImageJob, faktor: number): string {
  if (job.reference_urls.length > 0) return ''
  const [b, h] = job.size.split('x').map(Number)
  if (!b || !h) return ''
  return `${b * faktor}×${h * faktor}`
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
  const { jobs, loading, ladefehler, laden, vergroessern, erneutEinreihen, loeschen } = useImageJobs()
  const [laedtHerunter, setLaedtHerunter] = useState<string | null>(null)
  const arbeiter = useWorkerStatus()

  async function herunterladen(job: ImageJob, url: string, index: number) {
    setLaedtHerunter(url)
    try {
      const hinweis = (job.scene_meta as { name?: string } | null)?.name ?? null
      await bildHerunterladen(
        url,
        dateinameFuerBild(job.created_at, index, job.result_paths.length, hinweis),
      )
    } catch (e) {
      toast.error(`Download fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setLaedtHerunter(null)
    }
  }
  const [offen, setOffen] = useState<Set<string>>(new Set())
  const [loeschKandidat, setLoeschKandidat] = useState<ImageJob | null>(null)
  /** Gescheiterter KI-Auftrag, der noch einmal laufen soll — kostet erneut. */
  const [neuKandidat, setNeuKandidat] = useState<ImageJob | null>(null)
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
        <SidebarTrigger />
        <h1 className="flex-1 text-sm font-semibold">
          Warteschlange
          {jobs.length > 0 && (
            <span className="ml-1.5 font-normal text-muted-foreground">({jobs.length})</span>
          )}
        </h1>
        {wartend > 0 && (
          <span className="text-[11px] text-muted-foreground">{wartend} offen</span>
        )}

        {/*
          Ohne diese Auskunft sieht ein wartender Auftrag gleich aus, egal ob der
          Arbeiter ihn gleich abholt oder seit gestern aus ist.
        */}
        {arbeiter.zustand !== 'unbekannt' && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium',
              arbeiter.zustand === 'laeuft'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400',
            )}
            title={
              arbeiter.zustand === 'laeuft'
                ? 'Der Arbeiter auf dem PC meldet sich regelmäßig.'
                : 'Starte den Arbeiter auf dem PC: cd worker && npm start'
            }
          >
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              arbeiter.zustand === 'laeuft' ? 'bg-emerald-400' : 'bg-amber-400',
            )} />
            {arbeiter.zustand === 'laeuft'
              ? 'Arbeiter läuft'
              : arbeiter.zustand === 'nie'
                ? 'Arbeiter nie gesehen'
                : `Arbeiter zuletzt ${seitWann(arbeiter.sekundenHer)}`}
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
        ) : ladefehler ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <ImageOff className="mx-auto h-10 w-10 text-destructive/50" />
            <p className="mt-4 text-sm font-medium">Aufträge konnten nicht geladen werden</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{ladefehler}</p>
            <Button size="sm" className="mt-4" onClick={() => void laden()}>
              Erneut versuchen
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <ImageOff className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-sm font-medium">Noch keine Aufträge</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Stelle im Scene Builder eine Szene zusammen und klicke dort auf
              „Zur Warteschlange". Der Arbeiter auf dem PC holt den Auftrag ab
              und legt das fertige Bild hier ab.
              {arbeiter.zustand !== 'laeuft' && arbeiter.zustand !== 'unbekannt' && (
                <><br /><span className="text-amber-400">
                  Er läuft gerade nicht — starte ihn mit <code>cd worker</code> und <code>npm start</code>.
                </span></>
              )}
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/scene-builder">Zum Scene Builder</Link>
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-2">
            {jobs.map(job => {
              const aufgeklappt = offen.has(job.id)
              // ?v=attempts als Cache-Brecher: Ein Neuversuch schreibt in denselben
              // Pfad, und Supabase liefert öffentliche Objekte eine Stunde lang aus
              // dem Zwischenspeicher — sonst sieht man das alte Ergebnis.
              const bilder = job.result_paths.map(p => `${ergebnisUrl(p)}?v=${job.attempts}`)
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
                          {/* Bei Vergrößerungen ist `upscaler` die maßgebliche
                              Spalte — der Arbeiter richtet sich nach ihr. `model`
                              trägt dieselbe Tatsache nur als Beschriftung mit und
                              könnte auseinanderdriften. */}
                          {job.job_type === 'upscale' && job.upscaler
                            ? VERFAHREN_NAME[job.upscaler]
                            : job.model}
                          {job.reference_urls.length === 0 && ` · ${job.size}`}
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
                          /* Der einzige Knopf, der ungefragt Geld ausgeben
                             konnte: Er setzt attempts auf 0, ein gescheiterter
                             KI-Auftrag lief danach bis zu dreimal erneut. Im
                             Menü steht der Preis vor dem Klick — hier stand
                             gar nichts. */
                          onClick={() => job.upscaler === 'seedvr2'
                            ? setNeuKandidat(job)
                            : void erneutEinreihen(job.id)}
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
                        <div
                          key={url}
                          className="group relative aspect-square overflow-hidden rounded border border-border/40 bg-muted/20"
                        >
                          <button
                            onClick={() => setLightbox({ urls: bilder, start: i })}
                            className="h-full w-full"
                            aria-label={`Ergebnis ${i + 1} vergrößern`}
                          >
                            <img
                              src={url} alt={`Ergebnis ${i + 1}`} loading="lazy"
                              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                            />
                          </button>
                          <div /*
                            Ohne Zeigegeraet gibt es kein Ueberfahren: Auf dem
                            Handy waren die Knoepfe nie sichtbar — aber weiterhin
                            anklickbar, weil opacity-0 keine Klicks abschaltet.
                            Ein Tipp aufs Bild loeste dort einen unsichtbaren
                            Download aus. Jetzt dauerhaft sichtbar, sobald das
                            Geraet kein Ueberfahren kennt.
                          */
                          className="absolute bottom-1.5 right-1.5 flex gap-1 transition [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                            {/* Vergrößern nur beim Erzeugnis anbieten — ein bereits
                                vergrößertes Bild noch einmal zu vergrößern bringt
                                nichts als Dateigröße. */}
                            {job.job_type !== 'upscale' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    className="h-7 w-7 bg-background/80 text-foreground backdrop-blur hover:bg-background"
                                    title="Vergrößern"
                                    aria-label={`Ergebnis ${i + 1} vergrößern`}
                                  >
                                    <Maximize2 className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-52">
                                  {/* Zwei Verfahren, deutlich getrennt: Das eine
                                      kostet nichts, das andere Geld. Der Preis
                                      steht deshalb im Menü und nicht erst in
                                      einer Bestätigung danach — sichtbar sein
                                      muss er vor dem Klick, nicht danach. */}
                                  <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                                    Rechnen · kostet nichts
                                  </DropdownMenuLabel>
                                  {([2, 3, 4] as const).map(f => (
                                    <DropdownMenuItem
                                      key={`lanczos-${f}`}
                                      className="text-xs"
                                      onClick={() => void vergroessern(job, job.result_paths[i], f, 'lanczos')}
                                    >
                                      {f}×{masse(job, f) ? ` · ${masse(job, f)}` : ''}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                                    KI · rekonstruiert Details
                                  </DropdownMenuLabel>
                                  {([2, 3, 4] as const).map(f => (
                                    <DropdownMenuItem
                                      key={`seedvr2-${f}`}
                                      className="flex items-center justify-between gap-3 text-xs"
                                      onClick={() => void vergroessern(job, job.result_paths[i], f, 'seedvr2')}
                                    >
                                      <span>{f}×{masse(job, f) ? ` · ${masse(job, f)}` : ''}</span>
                                      <span className="text-[10px] tabular-nums text-muted-foreground">
                                        {KI_PREIS[f]}
                                      </span>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button
                              size="icon"
                              className="h-7 w-7 bg-background/80 text-foreground backdrop-blur hover:bg-background"
                              title="Bild herunterladen"
                              aria-label={`Ergebnis ${i + 1} herunterladen`}
                              disabled={laedtHerunter === url}
                              onClick={() => void herunterladen(job, url, i)}
                            >
                              {laedtHerunter === url
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
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
                          <div className="flex flex-wrap gap-2">
                            {job.reference_urls.map((url, i) => {
                              const rolle = job.reference_roles?.[i]
                              return (
                                <div key={url} className="w-14">
                                  <button
                                    onClick={() => setLightbox({ urls: job.reference_urls, start: i })}
                                    className="h-14 w-14 overflow-hidden rounded border border-border/40"
                                    aria-label={`Referenz ${i + 1}${rolle ? `, ${ROLLEN_LABEL[rolle]}` : ''}`}
                                  >
                                    <img src={url} alt={`Referenz ${i + 1}`} loading="lazy"
                                      className="h-full w-full object-cover" />
                                  </button>
                                  <p className="mt-0.5 text-center text-[9px] leading-tight text-muted-foreground/70">
                                    {i + 1} · {rolle ? ROLLEN_LABEL[rolle] : '—'}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {bilder.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {bilder.map((url, i) => (
                            <Button key={url} asChild size="sm" variant="outline" className="h-6 text-[10px]">
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1 h-2.5 w-2.5" />
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

      <AlertDialog open={!!neuKandidat} onOpenChange={o => !o && setNeuKandidat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Noch einmal von der KI vergrößern?</AlertDialogTitle>
            <AlertDialogDescription>
              Das kostet erneut{' '}
              {neuKandidat?.scale ? KI_PREIS[neuKandidat.scale as 2 | 3 | 4] : 'Geld'}.
              {' '}Der Arbeiter versucht zuerst, ein bereits bezahltes Ergebnis
              abzuholen — ist bei fal.ai keins mehr da, läuft es neu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (neuKandidat) void erneutEinreihen(neuKandidat.id)
                setNeuKandidat(null)
              }}
            >
              Erneut einreihen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
