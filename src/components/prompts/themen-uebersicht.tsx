'use client'

import { useMemo, useState } from 'react'
import { Pencil, Merge, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { Prompt } from '@/hooks/use-prompts'
import type { Thema } from '@/hooks/use-themen'
import { cn } from '@/lib/utils'

/**
 * Die Übersicht der Prompt-Datenbank (PROJ-63).
 *
 * WAS SIE ERSETZT: ein endloses Raster aus 80 gleich schweren Kacheln. Mark am
 * 05.09.2026: „Da ist Scrollen angesagt … aber irgendwie findet man da trotzdem
 * nichts."
 *
 * DER AUFBAU IST SEINE WAHL: oben zwei Regale, die sich von selbst füllen
 * („Zuletzt benutzt", „Neu dazugekommen"), darunter die Themen als Vitrine —
 * ein großes Titelbild, drei Belege darunter. Aus vier vorgelegten Formen hat
 * er die Vitrine gewählt.
 */

type Props = {
  prompts: Prompt[]
  themen: Thema[]
  onThema: (id: string) => void
  onPrompt: (p: Prompt) => void
  onUmbenennen: (id: string, name: string) => Promise<boolean>
  onZusammenlegen: (vonId: string, nachId: string) => Promise<boolean>
}

/** Ein Bildfeld — mit dem Prompt-Titel als Rückfall, wenn kein Bild da ist. */
function Feld({ p, className }: { p?: Prompt; className?: string }) {
  if (p?.cover_image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={p.cover_image_url} alt={p.title} loading="lazy"
           className={cn('h-full w-full object-cover', className)} />
    )
  }
  // Fünf der 80 Prompts haben kein Bild. Ein leeres graues Feld sähe nach
  // Fehler aus; der Titel sagt wenigstens, was fehlt.
  return (
    <div className={cn('flex h-full w-full items-center justify-center bg-muted/25 p-2', className)}>
      <span className="line-clamp-3 text-center text-[12px] leading-tight text-muted-foreground">
        {p?.title ?? '—'}
      </span>
    </div>
  )
}

export function ThemenUebersicht({
  prompts, themen, onThema, onPrompt, onUmbenennen, onZusammenlegen,
}: Props) {
  const [bearbeite, setBearbeite] = useState<Thema | null>(null)
  const [neuerName, setNeuerName] = useState('')
  const [zielId, setZielId] = useState<string>('')

  const nachId = useMemo(() => new Map(prompts.map(p => [p.id, p])), [prompts])
  const anzahl = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of prompts) if (p.thema_id) m.set(p.thema_id, (m.get(p.thema_id) ?? 0) + 1)
    return m
  }, [prompts])

  /*
    Die zwei Regale sind ABSICHTLICH aus Daten gebaut, die sich von selbst
    ergeben. Alles, was Mark pflegen müsste, ist bei ihm schon einmal
    eingeschlafen: 51 von 80 Prompts haben kein Schlagwort, 3 sind Favorit.
  */
  const zuletzt = useMemo(() => prompts
    .filter(p => p.last_used_at)
    .sort((a, b) => (b.last_used_at ?? '').localeCompare(a.last_used_at ?? ''))
    .slice(0, 14), [prompts])
  const neu = useMemo(() => [...prompts]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 14), [prompts])

  function bearbeitenOeffnen(t: Thema) {
    setBearbeite(t); setNeuerName(t.name); setZielId('')
  }

  return (
    <div className="p-4 md:p-6">
      {[['Zuletzt benutzt', zuletzt], ['Neu dazugekommen', neu]].map(([titel, liste]) => {
        const l = liste as Prompt[]
        if (l.length === 0) return null
        return (
          <section key={titel as string} className="mb-6">
            <div className="mb-2.5 flex items-baseline gap-2.5">
              <h2 className="text-[17px] font-bold">{titel as string}</h2>
              <span className="text-[13.5px] text-muted-foreground">{l.length}</span>
            </div>
            {/* Waagerecht rollen statt senkrecht: So kostet ein Regal eine
                Reihe Höhe statt fünf. */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {l.map(p => (
                <button key={p.id} onClick={() => onPrompt(p)}
                  className="lt-kachel w-[132px] shrink-0 overflow-hidden text-left">
                  <div className="aspect-square"><Feld p={p} /></div>
                  <p className="line-clamp-2 px-2 py-1.5 text-[13px] leading-tight text-muted-foreground">
                    {p.title}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      <div className="mb-5 mt-1 h-px bg-border/60" />
      <p className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        Themen · von der KI gebildet, von dir änderbar
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {themen.map(t => {
          const titel = t.titelbild_prompt_id ? nachId.get(t.titelbild_prompt_id) : undefined
          const belege = t.beleg_prompt_ids.map(i => nachId.get(i)).filter(Boolean) as Prompt[]
          return (
            <div key={t.id} className="lt-kachel group/thema overflow-hidden">
              <button onClick={() => onThema(t.id)} className="block w-full text-left">
                <div className="aspect-[16/10] overflow-hidden"><Feld p={titel} /></div>
                {/* Drei Belege als Streifen — sie zeigen, dass mehr drin ist,
                    ohne dass man eine Zahl lesen muss. */}
                <div className="grid grid-cols-3 gap-0.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="aspect-square overflow-hidden"><Feld p={belege[i]} /></div>
                  ))}
                </div>
                <div className="px-3.5 py-3">
                  <span className="flex items-center gap-1.5 text-[16.5px] font-bold">
                    {t.name}
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover/thema:opacity-70" />
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {anzahl.get(t.id) ?? 0} Prompts
                  </span>
                </div>
              </button>
              <div className="flex justify-end px-2 pb-2">
                <Button variant="ghost" size="sm" className="h-8 text-[13px]"
                        onClick={() => bearbeitenOeffnen(t)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />Umbenennen
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!bearbeite} onOpenChange={o => !o && setBearbeite(null)}>
        <DialogContent className="lt-menue sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thema ändern</DialogTitle>
            <DialogDescription>
              Der Name ist das, woran du dich erinnerst — der Vorschlag der KI muss nicht
              das letzte Wort sein.
            </DialogDescription>
          </DialogHeader>

          <label className="text-[13.5px] font-medium">Name</label>
          <Input value={neuerName} onChange={e => setNeuerName(e.target.value)}
                 className="h-11 text-[15px]" />

          <div className="mt-3 border-t pt-3">
            <label className="text-[13.5px] font-medium">In ein anderes Thema übernehmen</label>
            <p className="mb-2 mt-0.5 text-[13px] text-muted-foreground">
              Alle {bearbeite ? (anzahl.get(bearbeite.id) ?? 0) : 0} Prompts wandern dorthin,
              dieses Thema verschwindet.
            </p>
            <Select value={zielId} onValueChange={setZielId}>
              <SelectTrigger className="h-11 text-[15px]"><SelectValue placeholder="Thema wählen …" /></SelectTrigger>
              <SelectContent className="lt-menue">
                {themen.filter(t => t.id !== bearbeite?.id).map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-[14.5px]">{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:justify-between">
            <Button variant="outline" disabled={!zielId}
              onClick={async () => {
                if (!bearbeite || !zielId) return
                if (await onZusammenlegen(bearbeite.id, zielId)) setBearbeite(null)
              }}>
              <Merge className="mr-1.5 h-4 w-4" />Zusammenlegen
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setBearbeite(null)}>Abbrechen</Button>
              <Button
                disabled={!neuerName.trim() || neuerName === bearbeite?.name}
                onClick={async () => {
                  if (!bearbeite) return
                  if (await onUmbenennen(bearbeite.id, neuerName.trim())) setBearbeite(null)
                }}>
                Speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
