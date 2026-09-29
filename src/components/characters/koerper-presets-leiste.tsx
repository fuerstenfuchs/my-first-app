'use client'

import { KOERPER_PRESETS } from '@/lib/koerper-presets'
import type { KoerperAuswahl } from '@/lib/referenzkette'
import { Vorschaubild } from '@/components/vorschaubild'

/**
 * Die Preset-Leiste (PROJ-89) — ein Klick statt Körpermerkmale-Feld und
 * Referenzbild einzeln setzen.
 *
 * Mark am 29.09.2026: „Ich müsste dann eigentlich nur noch so ein Preset
 * auswählen können. Aber natürlich auch die Möglichkeit weiterhin haben, das
 * manuell zu machen." Deshalb: Ein Klick setzt Bild UND Merkmal — und
 * verändert an den Körpermerkmale-Feldern darunter sonst nichts, sie bleiben
 * genauso editierbar wie ohne Preset.
 */
export function KoerperPresetsLeiste({
  onWaehlen,
}: {
  /** `merkmale` wird in die bestehende Auswahl EINGEMISCHT, nicht ersetzt —
   *  siehe Kommentar in koerper-presets.ts. `bildUrl` wird als Körperquelle
   *  übernommen, wie ein „Vorhandenes wählen". */
  onWaehlen: (bildUrl: string, merkmale: KoerperAuswahl) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        Preset wählen — setzt Bild und Merkmal zusammen, alles andere bleibt frei einstellbar.
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {KOERPER_PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            title={p.label}
            onClick={() => onWaehlen(p.bildUrl, p.merkmale)}
            className="group flex w-16 shrink-0 flex-col items-center gap-1"
          >
            <div className="h-16 w-16 overflow-hidden rounded-lg border border-border/60 bg-black/20 transition-colors group-hover:border-primary/60">
              <Vorschaubild src={p.bildUrl} alt={p.label} className="h-full w-full object-cover" />
            </div>
            <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground group-hover:text-foreground">
              {p.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
