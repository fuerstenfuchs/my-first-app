'use client'

import { useState, useMemo } from 'react'
import { Loader2, Send, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase'
import { useImageJobs } from '@/hooks/use-image-jobs'
import {
  MODELLE, DURCHLAEUFE, KLASSEN, groesseFuerFormat, formatHinweis, rechnetInKlassen,
  type ModellId, type Durchlaeufe, type KlassenId,
} from '@/lib/image-generation'
import { ASPECT_RATIOS, type AspectRatioKey } from '@/lib/scene-builder-options'

/**
 * Ein Bild einfach so erzeugen — ohne Umweg über den Scene Builder.
 *
 * WARUM ES DAS BRAUCHT: Bisher musste jeder Auftrag durch den Scene Builder,
 * mit Charakter, Outfit, Location und Kameraeinstellung. Für einen Einfall,
 * den man gerade im Kopf hat, ist das der falsche Weg.
 *
 * Der Einfügeweg dahinter ist derselbe wie beim Scene Builder (`anlegen()` aus
 * `use-image-jobs`) — er weiß nichts von Szenen und wurde dafür nicht
 * angefasst. Hier fehlt nur der Rahmen drumherum.
 */

/** Ein brauchbarer Titelvorschlag aus dem Prompt — erste Zeile, gekürzt. */
function titelVorschlag(prompt: string): string {
  const ersteZeile = prompt.trim().split('\n')[0] ?? ''
  return ersteZeile.length > 70 ? `${ersteZeile.slice(0, 67).trimEnd()}…` : ersteZeile
}

export function FreieErzeugung(
  { onEingereiht, breite }: { onEingereiht?: () => void; breite?: number },
) {
  const { anlegen } = useImageJobs(false)
  const supabase = createClient()

  const [prompt, setPrompt] = useState('')
  const [modell, setModell] = useState<ModellId>('gpt-image-2')
  const [format, setFormat] = useState<AspectRatioKey>('landscape_16_9')
  const [klasse, setKlasse] = useState<KlassenId>('2K')
  const [anzahl, setAnzahl] = useState<Durchlaeufe>(1)
  const [laeuft, setLaeuft] = useState(false)

  const [titel, setTitel] = useState('')
  const [speichert, setSpeichert] = useState(false)
  /**
   * Was zuletzt gespeichert wurde — Text UND Titel.
   *
   * Vorher war das ein Ja/Nein-Merker, der nur beim Tippen im Prompt-Feld
   * zurückging. Wer nach dem Speichern den TITEL korrigierte, kam nicht mehr
   * an den Knopf: Er stand auf „gespeichert" und war abgeschaltet.
   */
  const [zuletztGespeichert, setZuletztGespeichert] = useState<string | null>(null)

  const inKlassen = rechnetInKlassen(modell)
  const hinweis = useMemo(() => formatHinweis(modell, format), [modell, format])
  const formatLabel = ASPECT_RATIOS.find(f => f.key === format)?.label ?? format
  const schonGespeichert =
    zuletztGespeichert === JSON.stringify([titel.trim(), prompt.trim()])

  async function erzeugen() {
    const text = prompt.trim()
    if (!text || laeuft) return
    setLaeuft(true)
    try {
      const job = await anlegen({
        prompt: text,
        model: modell,
        // Bei Gemini ist `size` bedeutungslos — die Spalte ist aber Pflicht.
        // Der native Weg nimmt Seitenverhältnis und Klasse, siehe `ziel_klasse`.
        size: groesseFuerFormat(format).size,
        aspect_ratio: format,
        variants: anzahl,
        ziel_klasse: inKlassen ? klasse : null,
        scene_meta: { name: titelVorschlag(text) || 'Freier Prompt', herkunft: 'bildstudio' },
      })
      if (job) {
        toast.success(
          anzahl > 1 ? `${anzahl} Bilder eingereiht` : 'Bild eingereiht',
          { description: 'Der Arbeiter holt es ab — Du musst nicht warten.' },
        )
        onEingereiht?.()
      }
    } finally {
      setLaeuft(false)
    }
  }

  /**
   * Den Prompt im Trésor ablegen.
   *
   * Marks Wunsch: „Der Prompt sollte die Möglichkeit haben, dass er gespeichert
   * wird im Tresor." Der Titel steht daneben und ist vorbelegt — ohne Dialog,
   * weil ein Dialog für ein Feld ein Dialog zu viel ist.
   */
  async function inTresor() {
    const text = prompt.trim()
    if (!text || speichert) return
    const kennung = JSON.stringify([titel.trim(), text])
    setSpeichert(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Nicht angemeldet'); return }

      const { data, error } = await supabase
        .from('prompts')
        .insert({
          user_id: user.id,
          title: (titel.trim() || titelVorschlag(text) || 'Ohne Titel').slice(0, 200),
          content: text,
          tags: ['bildstudio'],
        })
        .select('id')
        .single()

      if (error) { toast.error(`Speichern fehlgeschlagen: ${error.message}`); return }

      setZuletztGespeichert(kennung)
      toast.success('Im Trésor gespeichert')
      // Wie beim normalen Anlegen: Der Prompt soll auch über die semantische
      // Suche zu finden sein. Scheitert es, ist der Prompt trotzdem gespeichert.
      fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [data.id] }),
      }).catch(() => {})
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <aside
      // Auf schmalen Bildschirmen liegt es über den Bildern und ist so breit
      // wie die Seite; erst ab lg wird es zur Spalte, deren Breite am Trenner
      // hängt. Deshalb kommt die Breite per Stil und nicht als Klasse — eine
      // Tailwind-Klasse mit einer Zahl aus dem Zustand gäbe es nicht.
      style={breite ? ({ ['--panel-breite' as string]: `${breite}px` }) : undefined}
      className="flex w-full shrink-0 flex-col gap-2.5 border-b border-border/50 bg-muted/10 p-3 lg:w-[var(--panel-breite,260px)] lg:border-b-0"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold">Erzeugen</h2>
      </div>

      <Textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Was soll entstehen? Zum Beispiel: Eine ältere Frau mit kurzem weißem Haar, Dreiviertelporträt vor heller Wand, weiches Fensterlicht von links …"
        rows={10}
        className="min-h-[9rem] flex-1 resize-y text-xs leading-relaxed"
      />

      <Select value={modell} onValueChange={v => setModell(v as ModellId)}>
        <SelectTrigger className="h-8 text-xs" aria-label="Modell"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MODELLE.map(m => (
            <SelectItem key={m.id} value={m.id} className="text-xs">
              <span className="flex flex-col items-start">
                <span>{m.label}</span>
                <span className="text-[10px] text-muted-foreground">{m.note}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-2 gap-1.5">
        <Select value={format} onValueChange={v => setFormat(v as AspectRatioKey)}>
          <SelectTrigger className="h-8 text-xs" aria-label="Format"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ASPECT_RATIOS.map(f => (
              <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {inKlassen ? (
          <Select value={klasse} onValueChange={v => setKlasse(v as KlassenId)}>
            <SelectTrigger className="h-8 text-xs" aria-label="Größenklasse"><SelectValue /></SelectTrigger>
            <SelectContent>
              {KLASSEN.map(k => (
                <SelectItem key={k.id} value={k.id} className="text-xs">
                  {k.label} · {k.note}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={String(anzahl)} onValueChange={v => setAnzahl(Number(v) as Durchlaeufe)}>
            <SelectTrigger className="h-8 text-xs" aria-label="Anzahl Bilder"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURCHLAEUFE.map(d => (
                <SelectItem key={d} value={String(d)} className="text-xs">
                  {d} {d === 1 ? 'Bild' : 'Bilder'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {inKlassen && (
        <Select value={String(anzahl)} onValueChange={v => setAnzahl(Number(v) as Durchlaeufe)}>
          <SelectTrigger className="h-8 text-xs" aria-label="Anzahl Bilder"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DURCHLAEUFE.map(d => (
              <SelectItem key={d} value={String(d)} className="text-xs">
                {d} {d === 1 ? 'Bild' : 'Bilder'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Was das Format bei diesem Modell wirklich ergibt. gpt-image-2 kennt nur
          drei Größen und macht aus 16:9 ein 3:2 — das gehört vor den Klick. */}
      {/* Erst das Format, dann die Genauigkeit. „Format: auf ~1 % genau" allein
          beantwortet die Frage „was kommt heraus?" nicht. */}
      <p className="text-[10px] leading-snug text-muted-foreground">
        Ergebnis: <span className="text-foreground">
          {inKlassen ? `${formatLabel} · ${hinweis}` : hinweis}
        </span>
        {inKlassen
          ? ' — Gemini kennt alle sieben Verhältnisse.'
          : ' — gpt-image-2 kennt nur drei Größen.'}
      </p>

      <Button size="sm" onClick={() => void erzeugen()} disabled={!prompt.trim() || laeuft}>
        {laeuft
          ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          : <Send className="mr-1.5 h-3.5 w-3.5" />}
        Erzeugen lassen
      </Button>

      <p className="text-[10px] leading-snug text-muted-foreground">
        Landet in derselben Warteschlange. Der Arbeiter holt es ab — Du musst
        nicht warten.
      </p>

      {prompt.trim() && (
        <div className="mt-auto space-y-1.5 border-t border-border/50 pt-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            War gut?
          </span>
          <Input
            value={titel}
            onChange={e => setTitel(e.target.value)}
            placeholder={titelVorschlag(prompt) || 'Titel im Trésor'}
            className="h-8 text-xs"
          />
          <Button
            size="sm" variant="outline" className="w-full"
            onClick={() => void inTresor()}
            disabled={speichert || schonGespeichert}
          >
            {speichert
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {schonGespeichert ? 'Im Trésor gespeichert' : 'Im Trésor speichern'}
          </Button>
        </div>
      )}
    </aside>
  )
}
