'use client'

import { useEffect, useState } from 'react'
import {
  Loader2, Check, AlertTriangle, Link2, RefreshCw, ArrowRight, ShieldAlert,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useOutfitKette, HINWEIS_NACH_MS } from '@/hooks/use-outfit-kette'
import {
  OUTFIT_KETTEN_SCHRITTE, OUTFIT_SCHRITT_LABEL, OUTFIT_VARIANTEN_NAME,
  type OutfitSchritt,
} from '@/lib/outfit-kette'
import type { Outfit } from '@/hooks/use-outfits'
import { cn } from '@/lib/utils'

/**
 * Die Outfit-Referenzkette (PROJ-54) — als ein Knopf.
 *
 * Das Gegenstück zum Charakter-Dialog, in der Outfit-Farbe. Ein einziger Halt,
 * nach dem freigestellten Vorne-Blatt — weil alle drei folgenden Blätter darauf
 * aufbauen und ein misslungenes Vorne-Blatt sich sonst dreifach fortpflanzt.
 *
 * WAS DIESER DIALOG ÜBER SICH SELBST SAGEN MUSS: Der Ablauf lebt im Browser.
 * Wird der Tab geschlossen, steht die Kette. Das steht sichtbar im Dialog und
 * nicht nur in einem Kommentar — sonst wartet Mark auf etwas, das niemand mehr
 * tut. Beim nächsten Öffnen wird nachgesehen, was schon liegt, und dort
 * weitergemacht.
 */

const BESCHREIBUNG: Record<OutfitSchritt, string> = {
  vorne:         'Das Kleidungsstück von vorne, ohne Person — Referenz ist das Titelbild.',
  rueckseite:    'Dasselbe Stück von hinten — Referenz ist das freigestellte Vorne-Blatt.',
  details:       'Stoff, Naht, Muster, Verschluss als 2×2-Raster — Referenz ist das Vorne-Blatt.',
  referenzsheet: 'Vorne groß, Rückseite, Details auf einem Blatt — Referenz sind alle drei davor.',
}

interface Props {
  offen: boolean
  onClose: () => void
  outfit: Outfit
  /** Damit die Seite ihre Varianten nachlädt, wenn die Kette etwas angelegt hat. */
  onAenderung?: () => void
}

export function OutfitKetteDialog({ offen, onClose, outfit, onAenderung }: Props) {
  const {
    phase, stand, standGeladen, titelbild, titelbildLiegtEigen, naechster,
    starte, vorneNehmen, vorneVerwerfen, abbrechen,
  } = useOutfitKette(outfit, offen, onAenderung)

  // Eine Uhr, damit die Wartezeit sichtbar läuft. Stillstand und „dauert eben"
  // sehen sonst gleich aus — genau die Verwechslung, wegen der man einen
  // Ausfall stundenlang nicht bemerkt.
  const [jetzt, setJetzt] = useState(() => Date.now())
  useEffect(() => {
    if (phase.art !== 'wartet') return
    const t = setInterval(() => setJetzt(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase.art])

  const laeuft = phase.art === 'wartet' || phase.art === 'legt_ab'
  const wartetSeit = phase.art === 'wartet' ? jetzt - phase.seit : 0

  return (
    <Dialog open={offen} onOpenChange={v => { if (!v && !laeuft) onClose() }}>
      <DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-orange-400" />
            Referenzkette
            <span className="ml-1 truncate text-sm font-normal text-muted-foreground">
              — {outfit.name}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Vier Blätter nacheinander, alle ohne Person — jedes Bild ist die
            Referenz für die folgenden. Nach dem ersten hält es an, damit du es
            ansiehst.
          </DialogDescription>
        </DialogHeader>

        {/* ── Titelbild: die Voraussetzung ─────────────────────────────── */}
        {!titelbildLiegtEigen && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle className="text-sm">
              {titelbild ? 'Das Titelbild liegt nicht im eigenen Speicher' : 'Dieses Outfit hat kein Titelbild'}
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {titelbild
                ? 'Der Arbeiter läuft auf deinem PC und nimmt nur Bilder aus dem eigenen Speicher als Referenz an — fremde Adressen lehnt er ab. Sichere das Bild zuerst (PROJ-49), dann geht die Kette.'
                : 'Die Kette braucht ein Ausgangsbild. Lade eines hoch und setze es als Titelbild.'}
            </AlertDescription>
          </Alert>
        )}

        {/* ── Die vier Schritte ────────────────────────────────────────── */}
        <div className="space-y-2">
          {!standGeladen ? (
            OUTFIT_KETTEN_SCHRITTE.map(s => <Skeleton key={s} className="h-16 rounded-xl" />)
          ) : (
            OUTFIT_KETTEN_SCHRITTE.map((schritt, i) => {
              const liegt   = stand.vorhanden[schritt]
              const dran    = !liegt && naechster === schritt
              const aktiv   = (phase.art === 'wartet' || phase.art === 'legt_ab') && phase.schritt === schritt
              const gepruft = phase.art === 'pruefen' && schritt === 'vorne'
              return (
                <div
                  key={schritt}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                    aktiv || gepruft
                      ? 'border-orange-500/50 bg-orange-500/5'
                      : liegt
                        ? 'border-emerald-600/30 bg-emerald-600/5'
                        : 'border-border/60 bg-card/40',
                  )}
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold">
                    {liegt ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                      : aktiv ? <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
                        : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {OUTFIT_SCHRITT_LABEL[schritt]}
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        → Variante „{OUTFIT_VARIANTEN_NAME[schritt]}"
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{BESCHREIBUNG[schritt]}</p>
                    {liegt && (
                      <p className="mt-1 text-[11px] text-emerald-400/80">
                        Liegt schon vor — wird nicht neu erzeugt.
                      </p>
                    )}
                    {dran && phase.art === 'bereit' && (
                      <p className="mt-1 text-[11px] text-orange-300">Hier geht es weiter.</p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Marks eigene Fotos bleiben unangetastet — das ist der Grund für die
            eigenen Variantennamen, und er gehört sichtbar in den Dialog. */}
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          Die Kette legt ihre Ergebnisse in eigene Varianten. Deine Fotos in
          „Vorne", „Seite", „Hinten" und „Detail" werden nicht angefasst und
          nicht überschrieben.
        </p>

        {/* ── Zustand und Knöpfe ───────────────────────────────────────── */}

        {phase.art === 'wartet' && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
              „{OUTFIT_SCHRITT_LABEL[phase.schritt]}" ist eingereiht — der Arbeiter auf dem PC holt den Auftrag ab.
            </p>
            <p className="text-xs text-muted-foreground">
              Wartet seit {Math.floor(wartetSeit / 1000)} s. Dieser Tab muss offen
              bleiben, sonst hält die Kette an — beim nächsten Öffnen wird sie
              dort fortgesetzt, wo sie steht.
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

        {phase.art === 'legt_ab' && (
          <p className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
            Bild wird in die Variante „{OUTFIT_VARIANTEN_NAME[phase.schritt]}" gelegt …
          </p>
        )}

        {/* Der Halt: groß ansehen und entscheiden. */}
        {phase.art === 'pruefen' && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-orange-500/40 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phase.bildUrl}
                alt="Erzeugtes Blatt: Vorne freigestellt"
                className="max-h-[45svh] w-full object-contain"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nimmst du dieses Blatt, laufen Rückseite, Detailaufnahmen und
              Referenzsheet ohne weiteres Zutun durch — alle drei bekommen genau
              dieses Bild als Vorlage.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={() => void vorneNehmen()}>
                <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                Nehmen und weiter
              </Button>
              <Button variant="outline" onClick={() => void vorneVerwerfen()}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Neu erzeugen
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/60">
              „Neu erzeugen" reiht einen weiteren Auftrag ein. Das jetzige Bild
              wird nicht gelöscht — es bleibt in der Warteschlange.
            </p>
          </div>
        )}

        {phase.art === 'fehler' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">
              Abgebrochen bei „{OUTFIT_SCHRITT_LABEL[phase.schritt]}"
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {phase.grund}
              <br />
              Die folgenden Blätter wurden NICHT erzeugt — sie bräuchten dieses
              Bild als Referenz. Was schon liegt, bleibt liegen.
            </AlertDescription>
          </Alert>
        )}

        {phase.art === 'fertig' && (
          <Alert className="border-emerald-600/40 bg-emerald-600/5">
            <Check className="h-4 w-4 text-emerald-400" />
            <AlertTitle className="text-sm">Referenzkette fertig</AlertTitle>
            <AlertDescription className="text-xs">
              Alle vier Blätter liegen als eigene Varianten beim Outfit. Das
              Titelbild ist unverändert geblieben.
            </AlertDescription>
          </Alert>
        )}

        {/* Startknopf — nur, wenn gerade nichts läuft und nichts zu entscheiden ist. */}
        {(phase.art === 'bereit' || phase.art === 'fehler' || phase.art === 'fertig') && (
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!titelbildLiegtEigen || !standGeladen || naechster === null}
              onClick={() => void starte()}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              {naechster === null
                ? 'Alle vier liegen vor'
                : naechster === 'vorne'
                  ? 'Referenzkette erzeugen'
                  : `Weiter mit „${OUTFIT_SCHRITT_LABEL[naechster]}"`}
            </Button>
            <Button variant="outline" onClick={onClose}>Schließen</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
