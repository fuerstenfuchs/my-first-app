'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, AlertTriangle, ImagePlus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useTitelbildErzeugen, HINWEIS_NACH_MS } from '@/hooks/use-titelbild-erzeugen'
import { TITELBILD_PRESET_NAME, TITELBILD_VARIANTE, type VarianteMitBildern } from '@/lib/titelbild-preset'
import type { Character } from '@/hooks/use-characters'
import { cn } from '@/lib/utils'

/**
 * „Titelbild erzeugen" (PROJ-51) — Marks Fünf-Handgriff-Ablauf als ein Knopf.
 *
 * EIN Klick löst aus. Es gibt keine Rückfrage davor: Mark am 03.09.2026 — der
 * Klick ist die Freigabe. Und es gibt keinen anderen Auslöser: Nichts an
 * diesem Ablauf hängt an der Charaktererzeugung oder an der Referenzkette.
 *
 * Der Fortschritt steht in einem Fenster, das sich von selbst öffnet, sobald
 * etwas läuft — nicht in einem stillen Ladekringel am Knopf. Stillstand und
 * „dauert eben" sehen sonst gleich aus, und genau diese Verwechslung ist der
 * Grund, warum man einen Ausfall stundenlang nicht bemerkt.
 */

interface Props {
  character: Character
  /** Die Varianten des Charakters — für die Frage, ob ein Referenzsheet vorliegt. */
  varianten: readonly VarianteMitBildern[]
  /**
   * Setzt das Titelbild und meldet, OB es geklappt hat. Der Rückgabewert ist
   * nicht schmückend: Ohne ihn kann der Ablauf einen Erfolg nur behaupten,
   * nicht messen — und meldete „Titelbild gesetzt", während daneben rot stand,
   * dass genau das nicht ging.
   */
  titelbildSetzen: (url: string) => Promise<boolean>
  onAenderung?: () => void
}

export function TitelbildKnopf({ character, varianten, titelbildSetzen, onAenderung }: Props) {
  const { phase, hindernis, laeuft, starte, abbrechen } = useTitelbildErzeugen(
    character, varianten, { titelbildSetzen, onAenderung },
  )

  // Eine Uhr, damit die Wartezeit sichtbar läuft.
  const [jetzt, setJetzt] = useState(() => Date.now())
  useEffect(() => {
    if (phase.art !== 'wartet') return
    const t = setInterval(() => setJetzt(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase.art])

  const wartetSeit = phase.art === 'wartet' ? jetzt - phase.seit : 0
  const fensterOffen = phase.art !== 'bereit'

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={cn(
          'h-8 gap-1.5 border-primary/40 text-[#ffb066]',
          'hover:bg-primary/10 hover:text-[#ffd0a8]',
        )}
        disabled={!!hindernis || laeuft}
        // Kein stiller gesperrter Knopf: Warum er nicht geht, steht im
        // Mouseover — sonst rätselt man, warum nichts passiert.
        title={hindernis ?? `Erzeugt ein neues Titelbild aus dem Preset „${TITELBILD_PRESET_NAME}" mit dem Referenzsheet als Vorlage. Der Auftrag geht sofort in die Warteschlange.`}
        onClick={() => void starte()}
      >
        {laeuft
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <ImagePlus className="h-3.5 w-3.5" />}
        Titelbild erzeugen
      </Button>

      <Dialog open={fensterOffen} onOpenChange={v => { if (!v && !laeuft) abbrechen() }}>
        <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ImagePlus className="h-4 w-4 text-primary" />
              Titelbild erzeugen
              <span className="ml-1 truncate text-sm font-normal text-muted-foreground">
                — {character.name}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preset „{TITELBILD_PRESET_NAME}" mit dem Referenzsheet als
              Charakter-Referenz. Das Ergebnis kommt in die Variante
              „{TITELBILD_VARIANTE}" und wird als Titelbild gesetzt.
            </DialogDescription>
          </DialogHeader>

          {/* ── Die Schritte ──────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Schritt
              nummer={1}
              text="Auftrag wird eingereiht"
              zustand={
                phase.art === 'reiht_ein' ? 'laeuft'
                  // Im Fehlerfall NICHT „fertig": Scheitert schon das Laden des
                  // Presets (der ausdrücklich vorgesehene Fall „umbenannt oder
                  // gelöscht"), stand hier vorher ein grüner Haken für einen
                  // Auftrag, den es nie gab. Ein Haken, der auch bei
                  // Nichterledigung erscheint, ist keiner.
                  : phase.art === 'fehler' ? 'offen'
                    : phase.art === 'bereit' ? 'offen' : 'fertig'
              }
            />
            <Schritt
              nummer={2}
              text={
                phase.art === 'wartet'
                  ? `Der Arbeiter auf dem PC erzeugt das Bild — wartet seit ${Math.floor(wartetSeit / 1000)} s`
                  : 'Der Arbeiter auf dem PC erzeugt das Bild'
              }
              zustand={
                phase.art === 'wartet' ? 'laeuft'
                  : phase.art === 'legt_ab' || phase.art === 'fertig' ? 'fertig'
                    : 'offen'
              }
            />
            <Schritt
              nummer={3}
              text={`Bild wird in die Variante „${TITELBILD_VARIANTE}" gelegt und als Titelbild gesetzt`}
              zustand={
                phase.art === 'legt_ab' ? 'laeuft'
                  : phase.art === 'fertig' ? 'fertig' : 'offen'
              }
            />
          </div>

          {phase.art === 'wartet' && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">
                Dieser Tab muss offen bleiben, sonst wird das Ergebnis nicht
                abgelegt. Der Auftrag selbst läuft trotzdem zu Ende und liegt
                dann in der Warteschlange.
              </p>
              {wartetSeit > HINWEIS_NACH_MS && (
                <p className="text-xs text-amber-400">
                  Das dauert ungewöhnlich lange. Läuft der Arbeiter? In der
                  Warteschlange (/queue) steht, was er gerade tut.
                </p>
              )}
              <Button size="sm" variant="outline" onClick={abbrechen}>
                Warten aufgeben
              </Button>
            </div>
          )}

          {phase.art === 'fertig' && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-emerald-600/40 bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={phase.bildUrl}
                  alt="Neues Titelbild"
                  className="max-h-[45svh] w-full object-contain"
                />
              </div>
              <Alert className="border-emerald-600/40 bg-emerald-600/5">
                <Check className="h-4 w-4 text-emerald-400" />
                <AlertTitle className="text-sm">Titelbild gesetzt</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed">
                  Das bisherige Titelbild wurde ersetzt. Das neue liegt
                  zusätzlich als Bild in der Variante „{TITELBILD_VARIANTE}" —
                  von dort kann jederzeit ein anderes zum Titelbild gemacht
                  werden.
                </AlertDescription>
              </Alert>
              <Button className="w-full" variant="outline" onClick={abbrechen}>
                Schließen
              </Button>
            </div>
          )}

          {phase.art === 'fehler' && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">Abgebrochen</AlertTitle>
                <AlertDescription className="text-xs leading-relaxed">
                  {phase.grund}
                  <br />
                  Das bisherige Titelbild ist unverändert geblieben.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => void starte()}>
                  Nochmal versuchen
                </Button>
                <Button variant="outline" onClick={abbrechen}>Schließen</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Eine Zeile der Fortschrittsanzeige — im Stil des Referenzkette-Dialogs. */
function Schritt({ nummer, text, zustand }: {
  nummer: number
  text: string
  zustand: 'offen' | 'laeuft' | 'fertig'
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
        zustand === 'laeuft'
          ? 'border-primary/50 bg-primary/5'
          : zustand === 'fertig'
            ? 'border-emerald-600/30 bg-emerald-600/5'
            : 'border-border/60 bg-card/40',
      )}
    >
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold">
        {zustand === 'fertig' ? <Check className="h-3.5 w-3.5 text-emerald-400" />
          : zustand === 'laeuft' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            : nummer}
      </div>
      <p className="min-w-0 flex-1 text-xs leading-relaxed">{text}</p>
    </div>
  )
}
