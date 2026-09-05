'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Loader2, RotateCw, Trash2, Clock, ImageOff, ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ImageLightbox } from '@/components/image-lightbox'
import { BildUebernehmenDialog } from '@/components/bild-uebernehmen-dialog'
import { ErgebnisKachel } from '@/components/ergebnis-kachel'
/*
  DIE KACHEL WIRD VON ZWEI SEITEN BENUTZT (PROJ-62).

  `ergebnis-kachel.tsx` traegt seit dem Umbau `lt-kachel`, `lt-mini` und
  `lt-menue`. Das Stilblatt dazu hing aber nur am Lichttisch — hier waere die
  Kachel ohne Rahmen, Rundung und Schatten gewesen, und schlimmer: je nachdem,
  ob man von dort herkommt oder die Seite frisch laedt, verschieden. Deshalb
  gehoert es auch hierher. Die Klassen wirken eigenstaendig, sie brauchen das
  umgebende `.lt` nicht.
*/
import '../bildstudio/lichttisch.css'
import { useImageJobs, ergebnisUrl, type ImageJob } from '@/hooks/use-image-jobs'
import { STATUS_TEXT, STATUS_FARBE, ROLLEN_LABEL, type JobStatus } from '@/lib/image-generation'
import { preis, VERFAHREN_NAME, kostetGeld } from '@/lib/upscaling'
import { useWorkerStatus, seitWann } from '@/hooks/use-worker-status'
import { cn } from '@/lib/utils'
import { arbeiterLage } from '@/lib/arbeiter-lage'

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
  const { jobs, loading, ladefehler, laden, vergroessern, erneutEinreihen, loeschen } = useImageJobs()
  const arbeiter = useWorkerStatus()
  const [offen, setOffen] = useState<Set<string>>(new Set())
  const [loeschKandidat, setLoeschKandidat] = useState<ImageJob | null>(null)
  /** Gescheiterter KI-Auftrag, der noch einmal laufen soll — kostet erneut. */
  const [neuKandidat, setNeuKandidat] = useState<ImageJob | null>(null)
  /** Das Bild, das gerade in einen Baustein übernommen werden soll. */
  const [uebernahme, setUebernahme] = useState<{ url: string; pfad: string } | null>(null)
  const [lightbox, setLightbox] = useState<{ urls: string[]; start: number } | null>(null)

  function umschalten(id: string) {
    setOffen(prev => {
      const neu = new Set(prev)
      neu.has(id) ? neu.delete(id) : neu.add(id)
      return neu
    })
  }

  const wartend  = jobs.filter(j => j.status === 'queued' || j.status === 'running').length
  const inWarte  = jobs.filter(j => j.status === 'queued').length
  const inArbeit = jobs.filter(j => j.status === 'running').length

  /*
    Wie lange laeuft der aelteste laufende Auftrag schon?

    HIER WIRD BEWUSST DIE BROWSER-UHR BENUTZT, anders als bei `sekunden_her`,
    das die Datenbank rechnet. Grund: Der Vergleich dort entscheidet bei 60
    Sekunden, und die PC-Uhr wich am 01.09.2026 um 34 Sekunden ab — das haette
    gereicht, um „laeuft" in „weg" zu drehen. Hier geht es um eine Schwelle von
    20 Minuten; eine halbe Minute Abweichung spielt keine Rolle.
  */
  const laengsterLaufSekunden = (() => {
    const laufend = jobs
      .filter(j => j.status === 'running' && j.started_at)
      .map(j => (Date.now() - new Date(j.started_at!).getTime()) / 1000)
    return laufend.length > 0 ? Math.max(...laufend) : null
  })()

  const lage = arbeiterLage({
    zustand: arbeiter.zustand,
    sekundenHer: arbeiter.zustand === 'laeuft' || arbeiter.zustand === 'weg' ? arbeiter.sekundenHer : 0,
    wartend: inWarte,
    inArbeit,
    laengsterLaufSekunden,
  })

  return (
    /*
      DIE WARTESCHLANGE AUF DEM BELEUCHTETEN TISCH (PROJ-65).

      Mark am 05.09.2026: „Als Nächstes können wir noch die Warteschlange in
      unserem neuen Design machen, also mit dem Blau und Licht und so weiter."

      `lt` steht hier AN DER WURZEL, und das ist geprueft: Kein direktes Kind
      ist `absolute` oder `fixed`. Auf der Prompt-Seite war das anders — dort
      hat genau dieser Griff den rollenden Bereich zerlegt.
    */
    <div className="lt flex h-svh flex-col overflow-hidden">
      <header className="lt-kopf flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <SidebarTrigger />
        <h1 className="lt-titel flex-1">
          Warteschlange
          {jobs.length > 0 && (
            <span className="ml-1.5 text-[15px] font-normal text-muted-foreground">({jobs.length})</span>
          )}
        </h1>
        {wartend > 0 && (
          <span className="text-[13px] text-muted-foreground">{wartend} offen</span>
        )}

        {/*
          Ohne diese Auskunft sieht ein wartender Auftrag gleich aus, egal ob der
          Arbeiter ihn gleich abholt oder seit gestern aus ist.
        */}
        {arbeiter.zustand !== 'unbekannt' && (
          <span
            className={cn(
              'inline-flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium leading-snug',
              lage.art === 'alarm'
                ? 'bg-red-500/20 text-red-300'
                : arbeiter.zustand === 'laeuft'
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
              'h-2 w-2 shrink-0 rounded-full',
              lage.art === 'alarm' ? 'bg-red-400 animate-pulse'
                : arbeiter.zustand === 'laeuft' ? 'bg-emerald-400' : 'bg-amber-400',
            )} />
            {arbeiter.zustand === 'laeuft'
              ? 'Arbeiter läuft'
              : arbeiter.zustand === 'nie'
                ? 'Arbeiter nie gesehen'
                : `Arbeiter zuletzt ${seitWann(arbeiter.sekundenHer)}`}
          </span>
        )}
      </header>

      {/*
        DER KASTEN, DER AM 04.09.2026 GEFEHLT HAT.

        Die Ampel oben rechts zeigte damals das Richtige — „Arbeiter zuletzt
        vor 2 Stunden", in Gelb — und trotzdem stand fast zwei Stunden alles
        still, ohne dass es jemandem auffiel. Ein 10px-Abzeichen neben der
        Ueberschrift ist keine Meldung. Und der Hinweistext lautete „Starte den
        Arbeiter auf dem PC", obwohl der Arbeiter LIEF; er hing nur.

        Deshalb hier: gross, an der Stelle, an der die Auftragsliste anfaengt,
        mit dem Grund statt nur dem Zustand — und nur dann, wenn wirklich etwas
        zu melden ist. Was der Kasten sagt, entscheidet `arbeiterLage`.
      */}
      {lage.art !== 'still' && (
        <div
          role={lage.art === 'alarm' ? 'alert' : 'status'}
          className={cn(
            'mx-4 mt-3 shrink-0 rounded-[14px] border px-4 py-3.5',
            lage.art === 'alarm'
              ? 'border-red-500/40 bg-red-500/10'
              : 'border-amber-500/35 bg-amber-500/5',
          )}
        >
          <p className={cn(
            'text-sm font-semibold',
            lage.art === 'alarm' ? 'text-red-300' : 'text-amber-300',
          )}>
            {lage.art === 'alarm' ? '\u26a0 ' : ''}{lage.titel}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {lage.text}
          </p>
          {lage.befehl && (
            <code className="mt-2.5 inline-block rounded-[10px] bg-black/40 px-3 py-1.5 text-[13px] text-foreground/90">
              {lage.befehl}
            </code>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-24 animate-pulse rounded-[14px] bg-muted/20" />
            ))}
          </div>
        ) : ladefehler ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <ImageOff className="mx-auto h-10 w-10 text-destructive/50" />
            <p className="mt-4 text-[16px] font-bold">Aufträge konnten nicht geladen werden</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{ladefehler}</p>
            <Button className="lt-haupt mt-5 h-11 px-6 text-[15px] font-bold hover:bg-transparent"
                    onClick={() => void laden()}>
              Erneut versuchen
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md text-center">
            <ImageOff className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-4 text-[16px] font-bold">Noch keine Aufträge</p>
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
            <Button asChild className="lt-haupt mt-5 h-11 px-6 text-[15px] font-bold hover:bg-transparent">
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
                /* Eine Platte auf dem Tisch: Lichtkante oben, Schatten darunter.
                   Kein `lt-kachel`, weil die Karte kein Knopf ist — sie hebt
                   sich beim Zeigen nicht an, sie klappt nur auf. */
                <div key={job.id} className="lt-platte overflow-hidden">
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
                          {/* Bei Gemini ist `size` bedeutungslos — die Spalte wird nur
                              gefüllt, weil sie Pflicht ist. Angezeigt gehört die
                              Größenklasse; der Arbeiter protokolliert sie auch so. */}
                          {job.reference_urls.length === 0 &&
                            ` · ${job.model.startsWith('gemini') ? (job.ziel_klasse ?? '—') : job.size}`}
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
                          onClick={() => kostetGeld(job.upscaler)
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
                        <ErgebnisKachel
                          key={url}
                          job={job}
                          url={url}
                          pfad={job.result_paths[i]}
                          index={i}
                          gesamt={bilder.length}
                          onAnsehen={() => setLightbox({ urls: bilder, start: i })}
                          onUebernehmen={u => setUebernahme({ url: u, pfad: job.result_paths[i] })}
                          onVergroessern={(pfad, stufe, verfahren) =>
                            void vergroessern(job, pfad, stufe, verfahren)}
                        />
                      ))}
                    </div>
                  )}

                  {aufgeklappt && (
                    <div className="space-y-3 border-t border-[rgba(150,185,220,0.14)] px-4 py-3.5 text-xs">
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
                                    className="h-14 w-14 overflow-hidden rounded-[10px] border border-[rgba(150,185,220,0.22)]"
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

      <BildUebernehmenDialog
        offen={!!uebernahme}
        bild={uebernahme}
        onClose={() => setUebernahme(null)}
      />

      <AlertDialog open={!!neuKandidat} onOpenChange={o => !o && setNeuKandidat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Noch einmal mit {neuKandidat?.upscaler ? VERFAHREN_NAME[neuKandidat.upscaler] : 'der KI'} vergrößern?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Das kostet erneut{' '}
              {neuKandidat?.scale && neuKandidat.upscaler
                ? preis(neuKandidat.upscaler, { art: 'faktor', wert: neuKandidat.scale as 2 | 3 | 4 })
                : 'Geld'}.
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
