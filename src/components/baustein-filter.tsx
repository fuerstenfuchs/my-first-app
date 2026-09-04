'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { kategorieLabel } from '@/lib/bausteine'
import { cn } from '@/lib/utils'

/**
 * Suchfeld plus Kategorie-Chips über einer Baustein-Liste (PROJ-46).
 *
 * WARUM EINE KOMPONENTE UND KEIN DRITTES MAL DASSELBE MARKUP: Die Chipzeile
 * hat einen Fallstrick, der beim ersten Bau einen halben Tag gekostet hat
 * (siehe `shrink-0` unten). Steht sie an drei Stellen, steht der Fallstrick an
 * drei Stellen — und beim vierten Mal fällt jemand wieder hinein.
 *
 * Die Rechnerei steckt NICHT hier: Was gefiltert wird und welche Chips es
 * gibt, entscheidet `useBausteinFilter` bzw. `chipListe` in `@/lib/bausteine`.
 * Diese Datei zeichnet nur.
 */
export function BausteinFilter({
  suche, onSuche, kategorie, onKategorie, chips,
  platzhalter, labels, kompakt = false,
}: {
  suche: string
  onSuche: (wert: string) => void
  /** Die angeklickte Kategorie — `null` heißt „alle". */
  kategorie: string | null
  onKategorie: (wert: string | null) => void
  /** Aus `chipListe()`: die Auswahl aus allen, die Zahl aus den gesuchten. */
  chips: Array<{ wert: string; anzahl: number }>
  platzhalter: string
  /**
   * Feste Beschriftungen der Kategoriewerte, wo es eine gepflegte Liste gibt —
   * `baustein.kategorieLabels`. Ohne sie wird der technische Schlüssel
   * abgeleitet („natur" → „Natur"), was fast überall reicht.
   */
  labels?: Record<string, string>
  /** Schmaler für enge Spalten wie die Auswahlspalte des Scene Builders. */
  kompakt?: boolean
}) {
  return (
    <div className={cn('space-y-1.5', kompakt && 'space-y-1')}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={suche}
          onChange={e => onSuche(e.target.value)}
          placeholder={platzhalter}
          className={cn('pl-8 text-xs', kompakt ? 'h-7' : 'h-8', suche && 'pr-7')}
        />
        {suche && (
          <button
            onClick={() => onSuche('')}
            title="Suche löschen"
            aria-label="Suche löschen"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/*
        Kategorien als Chips — nur, wo es sie gibt und wo mehr als eine
        vorkommt (das entscheidet `chipListe`). Ein einzelner Chip filtert
        nichts und kostet nur Platz.

        Mark am 03.09.2026 nachgemessen: Von 46 Locations sind 31 Stadien und
        zehn Natur; im Outfit-Fach liegen seit PROJ-53 36 Einträge, davon 19
        einzelne Kleidungsstücke. Wer eine Naturkulisse oder einen ganzen Look
        sucht, blättert sonst an allem anderen vorbei. Die Zahl steht deshalb
        neben dem Namen — man soll sehen, was hinter einem Knopf steckt, BEVOR
        man ihn drückt.

        `shrink-0` ist hier NICHT schmückendes Beiwerk. Ohne das war die Zeile
        im Browser 5 Punkte hoch, obwohl ihr Inhalt 23 braucht — von den Chips
        blieb ein Streifen übrig (am 03.09.2026 im Übernehmen-Dialog
        nachgemessen). Ein Flex-Kind schrumpft nämlich unter seinen Inhalt,
        wenn das Geschwister daneben Platz will, und das Bildraster will immer
        Platz. `max-h-16` war unschuldig: Die Höhe scheiterte nicht an der
        Obergrenze, sondern am Zusammenquetschen.
      */}
      {chips.length > 0 && (
        <div className="flex max-h-16 shrink-0 flex-wrap gap-1 overflow-y-auto">
          {chips.map(k => {
            const aktiv = kategorie === k.wert
            const text = kategorieLabel(k.wert, labels)
            return (
              <button
                key={k.wert}
                onClick={() => onKategorie(aktiv ? null : k.wert)}
                aria-pressed={aktiv}
                title={aktiv ? 'Filter aufheben' : `Nur ${text} zeigen`}
                className={cn(
                  'shrink-0 rounded-full border px-2 py-0.5 text-[11px] transition',
                  aktiv
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                {text}
                <span className="ml-1 tabular-nums opacity-60">{k.anzahl}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
