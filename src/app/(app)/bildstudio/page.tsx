'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ImageOff, Clapperboard, RefreshCw } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { ImageLightbox } from '@/components/image-lightbox'
import { ErgebnisKachel } from '@/components/ergebnis-kachel'
import { BildUebernehmenDialog } from '@/components/bild-uebernehmen-dialog'
import { FreieErzeugung } from '@/components/freie-erzeugung'
import { WerkbankDialog } from '@/components/werkbank-dialog'
import { ZiehTrenner, gemerkteBreite } from '@/components/zieh-trenner'
import { useImageJobs, ergebnisUrl, type ImageJob } from '@/hooks/use-image-jobs'
import { useBildUebernehmen } from '@/hooks/use-bild-uebernehmen'
import { useBildLoeschen } from '@/hooks/use-bild-loeschen'
import { useWorkerStatus, seitWann } from '@/hooks/use-worker-status'
import { VERFAHREN_NAME } from '@/lib/upscaling'
import { cn } from '@/lib/utils'
import './lichttisch.css'

/**
 * Der Lichttisch — alle Bilder aus allen Aufträgen als ein Raster.
 *
 * WARUM NEBEN DER WARTESCHLANGE UND NICHT DARIN: Die beiden stellen
 * verschiedene Fragen. Die Warteschlange fragt „läuft es?" — Status,
 * Versuchszähler, Fehlertext, Arbeiter-Ampel. Das ist ein Maschinenraum, und
 * als solcher richtig. Hier wird gefragt „was ist entstanden, und wohin
 * damit?", und dafür braucht es keine Auftragskarten, sondern Bilder.
 *
 * Beide lesen dieselbe Tabelle. Die Kachel samt ihren drei Knöpfen steht
 * bewusst in einer eigenen Datei (`ergebnis-kachel.tsx`) und nicht zweimal da.
 */

type Bild = {
  url: string
  pfad: string
  job: ImageJob
  /** Nummer innerhalb seines Auftrags — für den Dateinamen beim Download. */
  index: number
  gesamt: number
}

type Filter = 'alle' | 'heute' | 'vergroessert' | 'bearbeitet' | 'offen'

const FILTER_LABEL: Record<Filter, string> = {
  alle: 'Alle',
  heute: 'Heute',
  vergroessert: 'Vergrößert',
  bearbeitet: 'Bearbeitet',
  offen: 'Noch nicht abgelegt',
}

function istHeute(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString()
}

/** Was unter der Kachel steht — kurz, aber genug zum Wiedererkennen. */
function beschriftung(job: ImageJob): string {
  if (job.job_type === 'upscale') {
    const ziel = job.upscaler === 'gemini' ? job.ziel_klasse : `${job.scale}×`
    return `${ziel} · ${job.upscaler ? VERFAHREN_NAME[job.upscaler] : ''}`
  }
  const name = (job.scene_meta?.name as string | undefined) ?? job.prompt
  if (job.job_type !== 'bearbeitet') return name
  // Eine bearbeitete Fassung erbt `scene_meta` von ihrer Quelle — ohne dieses
  // Zeichen trügen Original und Fassung dieselbe Unterschrift, und man löscht
  // nach zwei Tagen die falsche. Die Nummer ab der zweiten Fassung, damit sich
  // auch zwei Bearbeitungen desselben Bildes unterscheiden.
  const n = Number(job.scene_meta?.fassung) || 1
  return n > 1 ? `✎${n} ${name}` : `✎ ${name}`
}

export default function BildstudioPage() {
  const { jobs, loading, ladefehler, laden, vergroessern } = useImageJobs()
  const { abgelegteLaden } = useBildUebernehmen()
  const { loeschen } = useBildLoeschen()
  const arbeiter = useWorkerStatus()

  const [filter, setFilter] = useState<Filter>('alle')
  const [abgelegt, setAbgelegt] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ urls: string[]; start: number } | null>(null)
  const [uebernahme, setUebernahme] = useState<{ url: string; pfad: string } | null>(null)
  const [werkbank, setWerkbank] = useState<{ job: ImageJob; url: string; pfad: string } | null>(null)
  /**
   * Breite des Erzeugen-Bereichs.
   *
   * Startet mit der Vorgabe und wird erst nach dem ersten Rendern aus dem
   * Browser nachgeladen — `localStorage` gibt es beim Rendern auf dem Server
   * nicht, und ein Unterschied zwischen Server- und Browserfassung würde
   * React beim Abgleich anmeckern.
   */
  const [panelBreite, setPanelBreite] = useState(300)
  useEffect(() => { setPanelBreite(gemerkteBreite('bildstudio-panel', 300)) }, [])

  const abgelegteHolen = useCallback(() => {
    void abgelegteLaden().then(setAbgelegt)
  }, [abgelegteLaden])

  useEffect(() => { abgelegteHolen() }, [abgelegteHolen])

  /**
   * Aus Aufträgen werden Bilder.
   *
   * Ein Auftrag mit vier Durchläufen ist hier vier Kacheln, kein Eintrag mit
   * vier Bildern darin — genau das ist der Unterschied zur Warteschlange.
   */
  const alleBilder = useMemo<Bild[]>(() => {
    const raus: Bild[] = []
    for (const job of jobs) {
      job.result_paths.forEach((pfad, i) => {
        raus.push({
          // Cache-Brecher wie in der Warteschlange: Ein erneut eingereihter
          // Auftrag schreibt auf denselben Pfad, der Browser zeigte sonst das
          // alte Bild.
          url: `${ergebnisUrl(pfad)}?v=${job.attempts}`,
          pfad,
          job,
          index: i,
          gesamt: job.result_paths.length,
        })
      })
    }
    return raus
  }, [jobs])

  const gefiltert = useMemo(() => {
    switch (filter) {
      case 'heute':        return alleBilder.filter(b => istHeute(b.job.created_at))
      case 'vergroessert': return alleBilder.filter(b => b.job.job_type === 'upscale')
      case 'bearbeitet':   return alleBilder.filter(b => b.job.job_type === 'bearbeitet')
      case 'offen':        return alleBilder.filter(b => !abgelegt.has(b.pfad))
      default:             return alleBilder
    }
  }, [alleBilder, filter, abgelegt])

  const urls = useMemo(() => gefiltert.map(b => b.url), [gefiltert])

  return (
    <div className="lt flex h-full flex-col">
      <header className="lt-kopf flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <SidebarTrigger />
        <h1 className="lt-titel">
          Lichttisch{' '}
          <span className="font-normal text-muted-foreground">({alleBilder.length})</span>
        </h1>

        {/*
          Marks einziger Groessenwunsch war woertlich „nur die Schrift noch ein
          bisschen groesser oben". Die Filter standen in 11px ohne Form — fuenf
          lose Woerter, von denen eines heller war. Gestalt und Groesse stehen
          jetzt in `lichttisch.css` unter `.lt-filter`.
        */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(FILTER_LABEL) as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className="lt-filter"
              data-an={filter === f ? 'ja' : 'nein'}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>

        <Button
          size="icon" variant="ghost" className="lt-feld ml-auto h-9 w-9 shrink-0"
          title="Neu laden"
          onClick={() => { void laden(); abgelegteHolen() }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        {arbeiter.zustand !== 'unbekannt' && (
          <span className={cn(
            'flex min-w-0 items-center gap-2 rounded-full px-3 py-1.5 text-[13px] leading-snug',
            arbeiter.zustand === 'laeuft'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-amber-500/10 text-amber-400',
          )}>
            <span className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              arbeiter.zustand === 'laeuft' ? 'bg-emerald-400' : 'bg-amber-400',
            )} />
            {/*
              Der Text steht in einem eigenen Element, damit er umbrechen KANN.

              Er lief auf einem Bildschirmfoto rechts aus dem Bild — das war
              aber ein Messfehler von mir: Der kopflose Browser rendert nicht
              schmaler als 500px, mein 420er-Bild war also in Wahrheit 500 breit
              und nur beschnitten. Im echten Browser bei 375px steht nichts
              über. Der eigene Kasten bleibt trotzdem: Bei „Arbeiter zuletzt vor
              14 Minuten" wird der Text länger, und dann trägt er.
            */}
            <span className="min-w-0">
              {arbeiter.zustand === 'laeuft'
                ? 'Arbeiter läuft'
                : arbeiter.zustand === 'nie'
                  ? 'Arbeiter noch nie gesehen'
                  : `Arbeiter zuletzt ${seitWann(arbeiter.sekundenHer)}`}
            </span>
          </span>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <FreieErzeugung onEingereiht={laden} breite={panelBreite} />

        <ZiehTrenner
          merkschluessel="bildstudio-panel"
          breite={panelBreite}
          onBreite={setPanelBreite}
          min={240}
          max={720}
        />

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-[12px] bg-muted/20" />
            ))}
          </div>
        ) : ladefehler ? (
          <p className="py-16 text-center text-[15px] text-destructive">
            Bilder konnten nicht geladen werden: {ladefehler}
          </p>
        ) : gefiltert.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <ImageOff className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-[15px] text-muted-foreground">
              {alleBilder.length === 0
                ? 'Noch keine Bilder erzeugt.'
                : `Kein Bild passt zum Filter „${FILTER_LABEL[filter]}".`}
            </p>
            {alleBilder.length === 0 && (
              <Button asChild size="sm" variant="outline" className="lt-feld h-10 border-0 px-4 text-[14px]">
                <Link href="/scene-builder">
                  <Clapperboard className="mr-1.5 h-3.5 w-3.5" />
                  Im Scene Builder eine Szene bauen
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {gefiltert.map((b, i) => (
              <div key={`${b.job.id}-${b.index}`} className="space-y-1">
                <ErgebnisKachel
                  job={b.job}
                  url={b.url}
                  pfad={b.pfad}
                  index={b.index}
                  gesamt={b.gesamt}
                  abgelegt={abgelegt.has(b.pfad)}
                  onAnsehen={() => setLightbox({ urls, start: i })}
                  onUebernehmen={url => setUebernahme({ url, pfad: b.pfad })}
                  onBearbeiten={(url, pfad) => setWerkbank({ job: b.job, url, pfad })}
                  onLoeschen={async pfad => {
                    // AUF das Neuladen warten: Sonst rechnet ein sofort
                    // folgendes zweites Loeschen noch auf dem alten Stand.
                    if (await loeschen(b.job, pfad)) { await laden(); abgelegteHolen() }
                  }}
                  onVergroessern={(pfad, stufe, verfahren) =>
                    void vergroessern(b.job, pfad, stufe, verfahren)}
                />
                <p className="truncate px-0.5 text-[13px] leading-tight text-muted-foreground">
                  {beschriftung(b.job)}
                </p>
              </div>
            ))}
          </div>
          )}
        </div>
      </div>

      <WerkbankDialog
        offen={!!werkbank}
        job={werkbank?.job ?? null}
        bildUrl={werkbank?.url ?? null}
        quellPfad={werkbank?.pfad ?? null}
        onClose={() => setWerkbank(null)}
        onGespeichert={() => { void laden(); abgelegteHolen() }}
      />

      <BildUebernehmenDialog
        offen={!!uebernahme}
        bild={uebernahme}
        onClose={() => setUebernahme(null)}
        onFertig={abgelegteHolen}
      />

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
