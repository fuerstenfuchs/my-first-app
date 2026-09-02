'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Loader2, Wand2, Send, Copy, Check, ArrowUp, RotateCcw, ChevronDown, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  TEXT_MODELLE, promptSchreiben, textModellLesen, textModellSchreiben, ProxyAus,
  type Nachricht, type Zusammenhang,
} from '@/lib/proxy-text'
import { cn } from '@/lib/utils'

/**
 * Der Prompt-Assistent — von der vagen Idee zum fertigen Bildprompt.
 *
 * Mark am 03.09.2026: „Oft habe ich zwar eine Idee von irgendwas, kann das aber
 * nicht genau ausdrücken und dann frage ich einfach … nach einem Prompt zum
 * Beispiel für irgendwas und der wird mir dann ausgegeben. Im besten Fall
 * erscheint der Prompt dann direkt im Erzeugen-Fenster."
 *
 * WARUM EIN VERLAUF UND NICHT EIN EINZELNER SCHUSS: Das Nachschärfen ist der
 * eigentliche Grund, warum er sonst das Fenster wechselt — „kürzer", „mehr
 * Nebel", „ohne Personen". Deshalb geht bei jeder Runde der GANZE Verlauf an
 * `promptSchreiben`, nicht nur die letzte Zeile; sonst wüsste das Modell beim
 * zweiten Zuruf nicht, was es kürzen soll.
 *
 * WARUM KEIN RÜCKFALL AUF EINEN BEZAHLTEN DIENST: Bei den Bildanalysen gibt es
 * einen bestehenden bezahlten Weg, auf den zurückgefallen wird. Hier gibt es
 * keinen — ein neues Feld, das ungefragt Geld ausgibt, wäre die falsche
 * Voreinstellung. Ist der Proxy aus, sagt das Feld das und zeigt den Weg zu den
 * Einstellungen.
 */

interface Props {
  /**
   * Was gerade im Erzeugen-Block eingestellt ist. Ohne diese Angaben schriebe
   * der Assistent Prompts für ein Werkzeug, das gar nicht benutzt wird.
   */
  zusammenhang: Zusammenhang
  /** Den fertigen Prompt in das Feld darüber setzen — der Hauptzweck. */
  onUebernehmen: (text: string) => void
  className?: string
}

export function PromptAssistent({ zusammenhang, onUebernehmen, className }: Props) {
  const [offen, setOffen] = useState(false)
  const [verlauf, setVerlauf] = useState<Nachricht[]>([])
  const [eingabe, setEingabe] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [modell, setModell] = useState<string>(TEXT_MODELLE[0].id)
  /**
   * Der Proxy fehlt. Eigener Zustand statt nur einer Toast-Meldung: Ein Toast
   * ist nach fünf Sekunden weg, die Ursache aber nicht — Mark stünde vor einem
   * Feld, das grundlos nichts tut.
   */
  const [proxyAus, setProxyAus] = useState<string | null>(null)
  const [kopiert, setKopiert] = useState<number | null>(null)

  const abbruchRef = useRef<AbortController | null>(null)
  const endeRef = useRef<HTMLDivElement | null>(null)

  /*
    Die Modellwahl liegt in localStorage und ist damit erst nach dem Aufbau der
    Seite lesbar. Würde `useState` sie direkt lesen, käme beim Server-Rendern
    ein anderer Wert heraus als im Browser — React meldet das als Hydrations-
    fehler. Deshalb erst hier.
  */
  useEffect(() => { setModell(textModellLesen()) }, [])

  // Beim Abräumen der Komponente eine laufende Anfrage nicht weiterlaufen lassen.
  useEffect(() => () => abbruchRef.current?.abort(), [])

  // Nach jeder Antwort ans Ende rollen — sonst steht die Neuigkeit unter dem Rand.
  useEffect(() => {
    if (verlauf.length > 0) endeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [verlauf])

  function modellWaehlen(id: string) {
    setModell(id)
    textModellSchreiben(id)
  }

  const senden = useCallback(async () => {
    const frage = eingabe.trim()
    if (!frage || laeuft) return

    const naechster: Nachricht[] = [...verlauf, { rolle: 'nutzer', text: frage }]
    setVerlauf(naechster)
    setEingabe('')
    setLaeuft(true)
    setProxyAus(null)

    const steuerung = new AbortController()
    abbruchRef.current = steuerung

    try {
      const text = await promptSchreiben(naechster, zusammenhang, {
        modell,
        signal: steuerung.signal,
      })
      setVerlauf([...naechster, { rolle: 'assistent', text }])
    } catch (e) {
      // Ein selbst ausgelöster Abbruch ist kein Fehler — dafür keine rote Meldung.
      if (e instanceof DOMException && e.name === 'AbortError') {
        setVerlauf(naechster)
      } else if (e instanceof ProxyAus) {
        // Die Meldung ist in `proxy-text.ts` schon für Mark geschrieben —
        // unverändert zeigen, nicht umformulieren.
        setProxyAus(e.message)
        toast.error('Der Proxy ist nicht eingerichtet')
      } else {
        const meldung = e instanceof Error ? e.message : 'Unbekannter Fehler'
        toast.error('Der Prompt konnte nicht geschrieben werden', { description: meldung })
      }
    } finally {
      abbruchRef.current = null
      setLaeuft(false)
    }
  }, [eingabe, laeuft, verlauf, zusammenhang, modell])

  function abbrechen() {
    abbruchRef.current?.abort()
  }

  function zuruecksetzen() {
    abbruchRef.current?.abort()
    setVerlauf([])
    setEingabe('')
    setProxyAus(null)
  }

  async function kopieren(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text)
      setKopiert(i)
      setTimeout(() => setKopiert(k => (k === i ? null : k)), 1500)
    } catch {
      // Ohne HTTPS oder mit gesperrter Zwischenablage wirft das. Stumm
      // scheitern wäre hier das Schlimmste: Mark klickt, glaubt es liegt an,
      // und fügt woanders etwas Altes ein.
      toast.error('Kopieren nicht möglich', {
        description: 'Der Browser gibt die Zwischenablage nicht frei — markier den Text und nimm Strg+C.',
      })
    }
  }

  return (
    <Collapsible
      open={offen}
      onOpenChange={setOffen}
      /*
        `min-w-0` überall: Die Spalte ist ab 240px schmal, und ein langer
        englischer Prompt ohne Umbruchstelle würde sie sonst aufdrücken statt
        umzubrechen.
      */
      className={cn('min-w-0 shrink-0 space-y-2 border-t border-border/50 pt-2.5', className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 text-left text-xs font-semibold hover:text-primary"
        >
          <Wand2 className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">Prompt-Assistent</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', offen && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="min-w-0 space-y-2">
        {/* Der Zusammenhang steht sichtbar da: Er verändert das Ergebnis, also
            soll man ihn sehen, ohne ihn zu suchen. */}
        <p className="text-[10px] leading-snug text-muted-foreground">
          Schreibt für <span className="text-foreground">{zusammenhang.bildModell}</span>
          {' · '}{zusammenhang.format}
          {zusammenhang.referenzen > 0 && (
            <> · {zusammenhang.referenzen} {zusammenhang.referenzen === 1 ? 'Referenz' : 'Referenzen'}</>
          )}
        </p>

        <Select value={modell} onValueChange={modellWaehlen}>
          <SelectTrigger className="h-8 text-xs" aria-label="Textmodell"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEXT_MODELLE.map(m => (
              <SelectItem key={m.id} value={m.id} className="text-xs">
                <span className="flex flex-col items-start">
                  <span>{m.id}</span>
                  <span className="text-[10px] text-muted-foreground">{m.beschreibung}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {proxyAus && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[10px] leading-snug text-muted-foreground">
            <p className="break-words">{proxyAus}</p>
            <Link
              href="/einstellungen"
              className="mt-1 inline-block font-medium text-primary underline underline-offset-2"
            >
              Zu den Einstellungen
            </Link>
          </div>
        )}

        {verlauf.length > 0 && (
          /*
            Eigene Rollhöhe statt „wächst ins Unendliche": Die Spalte rollt zwar
            schon, aber ein langes Gespräch schöbe den Erzeugen-Knopf sonst
            beliebig weit nach oben aus dem Blick.

            60 % statt der ursprünglichen 38 %: Eine vollständige Antwort auf
            „gib mir zwölf Prompts" hat rund 10 000 Zeichen (am 03.09.2026
            gemessen). In einem Drittel Bildschirm sieht das aus wie
            abgeschnitten, obwohl nur gerollt werden muss.
          */
          <div className="max-h-[60dvh] min-w-0 space-y-1.5 overflow-y-auto pr-0.5">
            {verlauf.map((n, i) => (
              n.rolle === 'nutzer' ? (
                <p
                  key={i}
                  className="ml-3 break-words rounded-md bg-muted/60 px-2 py-1 text-[11px] leading-snug"
                >
                  {n.text}
                </p>
              ) : (
                <div
                  key={i}
                  className="min-w-0 space-y-1 rounded-md border border-border/60 bg-background p-2"
                >
                  <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                    {n.text}
                  </p>
                  <div className="flex gap-1">
                    {/* Der Hauptknopf: Genau dafür sitzt der Assistent auf
                        derselben Seite wie das Prompt-Feld. */}
                    <Button
                      size="sm"
                      className="h-7 min-w-0 flex-1 px-2 text-[11px]"
                      onClick={() => onUebernehmen(n.text)}
                    >
                      <ArrowUp className="mr-1 h-3 w-3 shrink-0" />
                      <span className="truncate">In das Prompt-Feld</span>
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="h-7 w-7 shrink-0 p-0"
                      title="Kopieren"
                      aria-label="Prompt kopieren"
                      onClick={() => void kopieren(n.text, i)}
                    >
                      {kopiert === i
                        ? <Check className="h-3 w-3" />
                        : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              )
            ))}
            <div ref={endeRef} />
          </div>
        )}

        <Textarea
          value={eingabe}
          onChange={e => setEingabe(e.target.value)}
          onKeyDown={e => {
            // Enter schickt ab, Umschalt+Enter macht eine neue Zeile. Solange
            // eine Eingabemethode (z. B. für Umlaute per Tastenfolge) aktiv
            // ist, gehört Enter ihr — sonst risse es die Eingabe ab.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void senden()
            }
          }}
          placeholder={verlauf.length === 0
            ? 'Was schwebt dir vor? Zum Beispiel: irgendwas mit einem alten Fischer im Nebel …'
            : 'Nachfassen: kürzer, mehr Nebel, ohne Personen …'}
          rows={3}
          className="min-h-[4.5rem] resize-y text-xs leading-relaxed"
        />

        <div className="flex gap-1.5">
          {laeuft ? (
            <Button
              size="sm" variant="outline"
              className="min-w-0 flex-1 text-xs"
              onClick={abbrechen}
            >
              <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" />
              <span className="truncate">Abbrechen</span>
            </Button>
          ) : (
            <Button
              size="sm"
              className="min-w-0 flex-1 text-xs"
              onClick={() => void senden()}
              disabled={!eingabe.trim()}
            >
              <Send className="mr-1.5 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {verlauf.length === 0 ? 'Prompt schreiben' : 'Nachfassen'}
              </span>
            </Button>
          )}

          {(verlauf.length > 0 || eingabe.trim()) && (
            <Button
              size="sm" variant="ghost"
              className="h-8 w-8 shrink-0 p-0"
              title="Gespräch zurücksetzen"
              aria-label="Gespräch zurücksetzen"
              onClick={zuruecksetzen}
            >
              {laeuft ? <X className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
