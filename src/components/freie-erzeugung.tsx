'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
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
  MODELLE, MODELLE_MIT_REFERENZ, DURCHLAEUFE, KLASSEN, groesseFuerFormat,
  formatHinweis, formatAnsage, rechnetInKlassen,
  type ModellId, type Durchlaeufe, type KlassenId,
} from '@/lib/image-generation'
import { ReferenzAblage, type Referenzbild } from '@/components/referenz-ablage'
import { ASPECT_RATIOS, type AspectRatioKey } from '@/lib/scene-builder-options'
import { PromptAssistent } from '@/components/prompt-assistent'
import type { Zusammenhang } from '@/lib/proxy-text'

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
  const [referenzen, setReferenzen] = useState<Referenzbild[]>([])

  /** Das Prompt-Feld selbst — der Assistent unten schreibt hinein und rollt hierher. */
  const promptRef = useRef<HTMLTextAreaElement | null>(null)

  const mitReferenz = referenzen.length > 0

  /**
   * Sobald Referenzbilder liegen, stehen nur noch Modelle zur Wahl, die sie
   * auch verarbeiten.
   *
   * Das ist keine Bequemlichkeit, sondern der Schutz vor einem stillen
   * Fehlschlag: Der nativen Gemini-Anbindung werden nur Prompt und Format
   * übergeben, Referenzbilder gingen dort verloren. Der Arbeiter bricht solche
   * Aufträge deshalb ausdrücklich ab — die Sperre hier verhindert, dass Mark
   * erst nach dem Warten in der Warteschlange davon erfährt.
   */
  const auswahl = useMemo(
    () => (mitReferenz ? MODELLE_MIT_REFERENZ : MODELLE),
    [mitReferenz],
  )

  // Wer erst Gemini wählt und dann ein Referenzbild dazulegt, hätte sonst ein
  // Modell eingestellt, das gar nicht mehr im Menü steht.
  useEffect(() => {
    if (!auswahl.some(m => m.id === modell)) setModell('gpt-image-2')
  }, [auswahl, modell])

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

  /**
   * Was der Prompt-Assistent über den Auftrag wissen muss.
   *
   * WARUM DAS MITGEHT: Ein Prompt für gpt-image-2 sieht anders aus als einer für
   * Gemini, und mit Referenzbild richtet sich gpt-image-2 nach der Vorlage statt
   * nach dem Format. Ohne diese drei Angaben schriebe der Assistent Prompts für
   * ein Werkzeug, das gar nicht benutzt wird.
   *
   * `useMemo`, weil das Objekt sonst bei jedem Tastendruck im Prompt-Feld neu
   * entstünde und den Assistenten unnötig neu rechnen ließe.
   */
  const zusammenhang = useMemo<Zusammenhang>(() => ({
    bildModell: MODELLE.find(m => m.id === modell)?.label ?? modell,
    format: formatLabel,
    referenzen: referenzen.length,
  }), [modell, formatLabel, referenzen.length])

  /**
   * Den erzeugten Prompt in das Feld oben setzen.
   *
   * Das Rollen ist kein Schmuck: Der Assistent sitzt UNTER dem Erzeugen-Block,
   * das Feld liegt bei gerolltem Panel also außerhalb des Blicks. Ohne den
   * Sprung sähe es aus, als sei nichts passiert.
   */
  const uebernehmen = useCallback((text: string) => {
    setPrompt(text)
    const feld = promptRef.current
    if (!feld) return
    feld.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    feld.focus({ preventScroll: true })
    toast.success('Im Prompt-Feld eingesetzt')
  }, [])
  const schonGespeichert =
    zuletztGespeichert === JSON.stringify([titel.trim(), prompt.trim()])

  async function erzeugen() {
    const text = prompt.trim()
    if (!text || laeuft) return
    setLaeuft(true)
    try {
      const job = await anlegen({
        // Mit Referenzbild ignoriert gpt-image-2 den Größenparameter — das
        // Ergebnis richtet sich dann nach der Vorlage. Die einzige Handhabe ist
        // eine Ansage im Prompt; ohne Referenz wäre sie überflüssig, weil dann
        // `size` wirkt.
        prompt: mitReferenz
          ? [text, formatAnsage(format)].filter(Boolean).join('\n\n')
          : text,
        model: modell,
        // Bei Gemini ist `size` bedeutungslos — die Spalte ist aber Pflicht.
        // Der native Weg nimmt Seitenverhältnis und Klasse, siehe `ziel_klasse`.
        size: groesseFuerFormat(format).size,
        aspect_ratio: format,
        variants: anzahl,
        ziel_klasse: inKlassen ? klasse : null,
        reference_urls: referenzen.map(r => r.url),
        scene_meta: { name: titelVorschlag(text) || 'Freier Prompt', herkunft: 'bildstudio' },
      })
      if (job) {
        // Die Ablage leeren: Der nächste Einfall ist selten derselbe mit
        // denselben Vorlagen — und eine liegengebliebene Referenz, die keiner
        // mehr bemerkt, wäre der teurere Fehler.
        setReferenzen([])
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
      /*
        `overflow-y-auto min-h-0`: Seit das Prompt-Feld eine feste Hoehe hat
        statt `flex-1`, faengt nichts mehr eine Stauchung ab — bei niedrigem
        Fenster oder quer gehaltenem Handy rutschte „Erzeugen lassen" unter
        den Rand und war nicht mehr erreichbar. Jetzt rollt die Spalte.
        Genau das wollte Mark: „Dann scrolle ich lieber da ein bisschen."
      */
      className="flex min-h-0 w-full shrink-0 flex-col gap-2.5 overflow-y-auto border-b border-border/50 bg-muted/10 p-3 lg:w-[var(--panel-breite,260px)] lg:border-b-0"
    >
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold">Erzeugen</h2>
      </div>

      <Textarea
        ref={promptRef}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Was soll entstehen? Zum Beispiel: Eine ältere Frau mit kurzem weißem Haar, Dreiviertelporträt vor heller Wand, weiches Fensterlicht von links …"
        rows={10}
        /*
          KEIN `flex-1`. Mark am 02.09.2026: „Das Promp Fenster beim Lichttisch
          sollte nicht ganz so groß sein … in der Höhe vielleicht nur halb so
          hoch. Dann scrolle ich lieber da ein bisschen. Ansonsten verschiebt
          sich ja alles zu weit nach unten."

          `flex-1` liess das Feld die ganze Spalte fuellen — Modellwahl, Format
          und der Erzeugen-Knopf wurden dadurch an den unteren Rand gedrueckt.
          Jetzt eine feste Hoehe, in der gerollt wird; `resize-y` bleibt, wer
          mehr sehen will, zieht es groesser.
        */
        className="h-[min(34dvh,20rem)] shrink-0 resize-y overflow-y-auto text-xs leading-relaxed"
      />

      <ReferenzAblage bilder={referenzen} onChange={setReferenzen} className="shrink-0" />

      <Select value={modell} onValueChange={v => setModell(v as ModellId)}>
        <SelectTrigger className="h-8 text-xs" aria-label="Modell"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MODELLE.map(m => {
            // Gesperrt, aber sichtbar: Ein Modell, das aus der Liste
            // verschwindet, wirkt wie ein Fehler. Eines, das dasteht und den
            // Grund nennt, erklärt sich selbst.
            const gesperrt = mitReferenz && !m.kannReferenzen
            return (
              <SelectItem key={m.id} value={m.id} disabled={gesperrt} className="text-xs">
                <span className="flex flex-col items-start">
                  <span>{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {gesperrt ? 'Kann keine Referenzbilder verarbeiten' : m.note}
                  </span>
                </span>
              </SelectItem>
            )
          })}
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
      {/* Mit Referenz stimmt die Größenangabe nicht mehr: Der Parameter wirkt
          dann nicht, das Modell richtet sich nach der Vorlage. Am 01.09.2026
          gemessen — 1024x1024 angefragt, 1122x1402 zurückbekommen. Eine Zahl,
          die nicht eintrifft, ist schlechter als keine. */}
      <p className="text-[10px] leading-snug text-muted-foreground">
        {mitReferenz ? (
          <>
            Ergebnis: <span className="text-foreground">richtet sich nach dem Referenzbild</span>
            {' '}— das gewünschte Format geht als Ansage im Prompt mit.
          </>
        ) : (
          <>
            Ergebnis: <span className="text-foreground">
              {inKlassen ? `${formatLabel} · ${hinweis}` : hinweis}
            </span>
            {inKlassen
              ? ' — Gemini kennt alle sieben Verhältnisse.'
              : ' — gpt-image-2 kennt nur drei Größen.'}
          </>
        )}
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

      {/* UNTER dem Erzeugen-Block, so wie Mark es beschrieben hat: „im
          Bildstudio unter dem erzeugen prompt, also auch unter den weiteren
          Eingaben dort." Zugeklappt kostet er nur eine Zeile Höhe — die Spalte
          ist schmal, und zu viel verbrauchte Höhe war hier schon einmal ein
          berechtigter Einwand. */}
      <PromptAssistent zusammenhang={zusammenhang} onUebernehmen={uebernehmen} />

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
