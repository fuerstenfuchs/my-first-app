'use client'

import { useState } from 'react'
import { Download, Loader2, Maximize2, FolderInput, Check, Wand2, Trash2 } from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { bildHerunterladen, dateinameFuerBild } from '@/lib/bild-download'
import {
  preis, VERFAHREN_NAME, VERFAHREN_HINWEIS, kostetGeld, IM_MENUE, STUFEN,
  stufeLabel, KLASSE_FLAECHE, type Stufe, type Upscaler,
} from '@/lib/upscaling'
import type { ImageJob } from '@/hooks/use-image-jobs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * Eine Ergebniskachel mit ihren drei Knöpfen.
 *
 * WARUM ALS EIGENE DATEI: Sie steht jetzt an zwei Stellen — in der
 * Warteschlange und im Lichttisch des Bildstudios. Als Kopie würden die beiden
 * genau dort auseinanderdriften, wo es weh tut: bei den Preisangaben und beim
 * Vergrößerungsmenü. Denselben Fehler hat Critic in diesem Projekt schon
 * einmal gefunden (Menü und Bestätigung nannten verschiedene Preise).
 */

export type KachelAktionen = {
  /** Vergrößern einreihen. */
  onVergroessern: (pfad: string, stufe: Stufe, verfahren: Upscaler) => void
  /** In einen Baustein übernehmen. */
  onUebernehmen: (url: string) => void
  /** Zuschneiden und Regler — fehlt sie, wird der Knopf nicht gezeigt. */
  onBearbeiten?: (url: string, pfad: string) => void
  /**
   * Bild loeschen — fehlt sie, wird der Knopf nicht gezeigt.
   *
   * Die Warteschlange bekommt ihn bewusst NICHT: Dort geht es um den Fortgang
   * eines Auftrags, nicht ums Aufraeumen, und ein Loeschknopf neben einem
   * laufenden Auftrag laedt zum Verwechseln ein. Mark hat ihn fuer den
   * Lichttisch verlangt, dort steht er.
   */
  onLoeschen?: (pfad: string) => Promise<void> | void
  /** Groß ansehen. */
  onAnsehen: () => void
}

interface Props extends KachelAktionen {
  job: ImageJob
  url: string
  pfad: string
  index: number
  gesamt: number
  /** Schon in einen Baustein übernommen? */
  abgelegt?: boolean
}

/**
 * Zeigt vorab, wie groß das Bild würde — 3× klingt abstrakt, 4608×3072 nicht.
 *
 * Nur wenn die Größe auch stimmt: Mit Referenzbild ignoriert gpt-image-2 den
 * Größenparameter und richtet sich nach der Vorlage (am 01.09.2026 gemessen,
 * 1024x1024 angefordert, 1122x1402 bekommen). Dann wäre jede Rechnung aus
 * `size` erfunden, und die Kachel verspräche Maße, die nicht eintreten.
 */
function zielMasse(job: ImageJob, faktor: number): string {
  if (job.reference_urls.length > 0) return ''
  const [b, h] = job.size.split('x').map(Number)
  if (!b || !h) return ''
  return `${b * faktor}×${h * faktor}`
}

export function ErgebnisKachel({
  job, url, pfad, index, gesamt, abgelegt,
  onVergroessern, onUebernehmen, onAnsehen, onBearbeiten, onLoeschen,
}: Props) {
  const [laedt, setLaedt] = useState(false)
  const [fragt, setFragt] = useState(false)
  const [loescht, setLoescht] = useState(false)

  async function herunterladen() {
    setLaedt(true)
    try {
      // Bewusst nur der Szenenname und NICHT der Prompt als Rückfall: So war es
      // vorher in der Warteschlange, und ein Prompt im Dateinamen ergäbe
      // hundert Zeichen Buchstabensalat.
      const hinweis = (job.scene_meta as { name?: string } | null)?.name ?? null
      await bildHerunterladen(url, dateinameFuerBild(job.created_at, index, gesamt, hinweis, pfad))
    } catch (e) {
      toast.error(`Download fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setLaedt(false)
    }
  }

  return (
    <div className="group relative aspect-square overflow-hidden rounded border border-border/40 bg-muted/20">
      <button onClick={onAnsehen} className="h-full w-full" aria-label={`Ergebnis ${index + 1} ansehen`}>
        <img
          src={url} alt={`Ergebnis ${index + 1}`} loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.03]"
        />
      </button>

      {/* Schon abgelegt — links oben, damit es die Knöpfe rechts nicht stört */}
      {abgelegt && (
        <span
          title="Schon in einen Baustein übernommen"
          className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-emerald-500/85 px-1 py-0.5 text-[9px] font-medium text-emerald-950 backdrop-blur"
        >
          <Check className="h-2.5 w-2.5" /> abgelegt
        </span>
      )}

      <div /*
        Ohne Zeigegeraet gibt es kein Ueberfahren: Auf dem Handy waren die
        Knoepfe nie sichtbar — aber weiterhin anklickbar, weil opacity-0 keine
        Klicks abschaltet. Ein Tipp aufs Bild loeste dort einen unsichtbaren
        Download aus. Jetzt dauerhaft sichtbar, sobald das Geraet kein
        Ueberfahren kennt.
      */
      className="absolute bottom-1.5 right-1.5 flex gap-1 transition [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
        {/* Ein bereits vergrößertes Bild noch einmal zu vergrößern bringt
            nichts als Dateigröße. */}
        {job.job_type !== 'upscale' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                className="h-7 w-7 bg-background/80 text-foreground backdrop-blur hover:bg-background"
                title="Vergrößern"
                aria-label={`Ergebnis ${index + 1} vergrößern`}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              {IM_MENUE.map((v, nr) => (
                <div key={v}>
                  {nr > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[10px] font-normal text-muted-foreground">
                    {VERFAHREN_NAME[v]} · {VERFAHREN_HINWEIS[v]}
                  </DropdownMenuLabel>
                  {STUFEN[v].map(stufe => (
                    <DropdownMenuItem
                      key={`${v}-${stufe.wert}`}
                      className="flex items-center justify-between gap-3 text-xs"
                      onClick={() => onVergroessern(pfad, stufe, v)}
                    >
                      <span>
                        {stufeLabel(stufe)}
                        {stufe.art === 'faktor'
                          ? (zielMasse(job, stufe.wert) ? ` · ${zielMasse(job, stufe.wert)}` : '')
                          : ` · ${KLASSE_FLAECHE[stufe.wert]}`}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {kostetGeld(v) ? preis(v, stufe) : 'gratis'}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {onBearbeiten && (
          <Button
            size="icon"
            className="h-7 w-7 bg-background/80 text-foreground backdrop-blur hover:bg-background"
            title="Zuschneiden und anpassen"
            aria-label={`Ergebnis ${index + 1} bearbeiten`}
            onClick={() => onBearbeiten(url, pfad)}
          >
            <Wand2 className="h-3.5 w-3.5" />
          </Button>
        )}

        <Button
          size="icon"
          className={cn(
            'h-7 w-7 bg-background/80 text-foreground backdrop-blur hover:bg-background',
            abgelegt && 'text-emerald-400',
          )}
          title={abgelegt ? 'Nochmal übernehmen' : 'In einen Baustein übernehmen'}
          aria-label={`Ergebnis ${index + 1} in einen Baustein übernehmen`}
          onClick={() => onUebernehmen(url)}
        >
          <FolderInput className="h-3.5 w-3.5" />
        </Button>

        <Button
          size="icon"
          className="h-7 w-7 bg-background/80 text-foreground backdrop-blur hover:bg-background"
          title="Bild herunterladen"
          aria-label={`Ergebnis ${index + 1} herunterladen`}
          disabled={laedt}
          onClick={() => void herunterladen()}
        >
          {laedt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        </Button>

        {onLoeschen && (
          <Button
            size="icon"
            className="h-7 w-7 bg-background/80 text-destructive backdrop-blur hover:bg-destructive hover:text-destructive-foreground"
            title="Bild löschen"
            aria-label={`Ergebnis ${index + 1} löschen`}
            disabled={loescht}
            onClick={() => setFragt(true)}
          >
            {loescht ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>

      {/*
        Rueckfrage, weil sich Loeschen nicht zuruecknehmen laesst. Der Text sagt
        ausdruecklich, was NICHT mitgeht — sonst traut sich niemand, der ein
        Bild schon in einen Baustein uebernommen hat.
      */}
      <AlertDialog open={fragt} onOpenChange={setFragt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dieses Bild löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Datei wird endgültig entfernt — das lässt sich nicht rückgängig machen.
              {abgelegt
                ? ' Die Kopie im Baustein bleibt davon unberührt, sie wurde beim Übernehmen kopiert.'
                : ' Bereits in Bausteine übernommene Kopien bleiben unberührt.'}
              {gesamt > 1 && ` Die anderen ${gesamt - 1} Bilder des Auftrags bleiben stehen.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loescht}>Behalten</AlertDialogCancel>
            <AlertDialogAction
              disabled={loescht}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async e => {
                // Der Dialog schliesst sich sonst sofort und die Kachel
                // verschwaende, bevor klar ist, ob es geklappt hat.
                e.preventDefault()
                setLoescht(true)
                try { await onLoeschen?.(pfad) } finally { setLoescht(false); setFragt(false) }
              }}
            >
              {loescht ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Löschen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
