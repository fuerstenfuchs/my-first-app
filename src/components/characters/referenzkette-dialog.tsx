'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Loader2, Check, AlertTriangle, Link2, RefreshCw, ArrowRight, ShieldAlert,
  Upload, PersonStanding, Images,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useReferenzkette, HINWEIS_NACH_MS } from '@/hooks/use-referenzkette'
import {
  KETTEN_SCHRITTE, SCHRITT_LABEL, VARIANTEN_NAME,
  type KettenSchritt, type KoerperAuswahl,
} from '@/lib/referenzkette'
import type { Character } from '@/hooks/use-characters'
import { cn } from '@/lib/utils'

/**
 * Die Referenzkette (PROJ-48) — Marks häufigster Handgriff, als ein Knopf.
 *
 * Heute: Sheet erzeugen, Ergebnis herunterladen, wieder hochladen, nächstes
 * Sheet erzeugen. Dreimal je Charakter.
 *
 * Hier: einmal drücken. Ein einziger Halt, nach dem Kopf — weil ein
 * misslungener Kopf sich sonst in beide folgenden Bilder fortpflanzt.
 *
 * WAS DIESER DIALOG ÜBER SICH SELBST SAGEN MUSS: Der Ablauf lebt im Browser.
 * Wird der Tab geschlossen, steht die Kette. Das steht sichtbar im Dialog und
 * nicht nur in einem Kommentar — sonst wartet Mark auf etwas, das niemand mehr
 * tut. Beim nächsten Öffnen wird nachgesehen, was schon liegt, und dort
 * weitergemacht.
 */

const BESCHREIBUNG: Record<KettenSchritt, string> = {
  kopf:          'Gesicht aus allen Perspektiven — Referenz ist das Titelbild.',
  koerper:       'Ganzkörper, neutrale Kleidung — Referenz ist der erzeugte Kopf plus eine Körperquelle (eigenes „Körper Original", sonst das Titelbild).',
  referenzsheet: 'Großer 3/4-Kopf, Körper vorne ohne Kopf, Körper hinten — Referenz ist Kopf und Körper.',
}

/**
 * Der Platzhalterwert für „Keine Angabe".
 *
 * NICHT der leere String: Radix' Select benutzt `''` intern, um „nichts
 * gewählt" darzustellen, und wirft bei einem `SelectItem` mit leerem Wert. Der
 * Sentinel wird beim Setzen wieder in „Schlüssel entfernen" übersetzt — im
 * `KoerperAuswahl`-Objekt landet er nie.
 */
const KEINE_ANGABE = '__keine__'

/**
 * Ein Feld pro Schlüssel aus `KoerperAuswahl`, mit GENAU dessen erlaubten
 * Werten in `optionen` — nicht `wert: string`.
 *
 * Critic-Befund R18 vom 03.09.2026: Mit `wert: string` prüfte TypeScript
 * `MERKMAL_FELDER` unten gar nicht gegen `KoerperAuswahl` nach — ein Tippfehler
 * in einem Optionswert (oder eine Option, die es in `MERKMAL_TEXT` in
 * referenzkette.ts nicht gibt) hätte anstandslos kompiliert. Erst zur Laufzeit
 * wäre daraus eine Zeile „- undefined" im Körper-Prompt geworden, der an
 * gpt-image-2 geht — ohne Fehler, ohne dass es auffiele. Diese Bauart macht
 * genau das zu einem Kompilierfehler: Jeder Eintrag wird gegen die Optionen
 * SEINES EIGENEN `schluessel` geprüft, nicht gegen eine allgemeine `string`.
 */
type MerkmalFeld = {
  [K in keyof KoerperAuswahl]-?: {
    schluessel: K
    label: string
    optionen: { wert: NonNullable<KoerperAuswahl[K]>; text: string }[]
  }
}[keyof KoerperAuswahl]

/**
 * Die Merkmale, die Mark von Hand vorgeben kann.
 *
 * Alle fünf werden immer gezeigt: Am Charakter-Datenmodell hängt keine
 * Geschlechtsangabe, aus der man Felder ableiten könnte. Ein geratenes
 * Ausblenden nähme Mark genau die Eingriffsmöglichkeit, für die es diesen
 * Abschnitt gibt.
 */
const MERKMAL_FELDER: MerkmalFeld[] = [
  {
    schluessel: 'bau',
    label: 'Körperbau',
    optionen: [
      { wert: 'schlank',          text: 'Schlank' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'kraeftig',         text: 'Kräftig' },
      { wert: 'sportlich',        text: 'Sportlich' },
    ],
  },
  {
    schluessel: 'groesse',
    label: 'Größe',
    optionen: [
      { wert: 'klein',            text: 'Klein' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'gross',            text: 'Groß' },
    ],
  },
  {
    schluessel: 'oberweite',
    label: 'Oberweite',
    optionen: [
      { wert: 'klein',  text: 'Klein' },
      { wert: 'mittel', text: 'Mittel' },
      { wert: 'gross',  text: 'Groß' },
    ],
  },
  {
    schluessel: 'becken',
    label: 'Becken',
    optionen: [
      { wert: 'schmal',           text: 'Schmal' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'ausladend',        text: 'Ausladend' },
    ],
  },
  {
    schluessel: 'beinlaenge',
    label: 'Beinlänge',
    optionen: [
      { wert: 'kurz',             text: 'Kurz' },
      { wert: 'durchschnittlich', text: 'Durchschnittlich' },
      { wert: 'lang',             text: 'Lang' },
    ],
  },
]

interface Props {
  offen: boolean
  onClose: () => void
  character: Character
  /** Damit die Seite ihre Varianten nachlädt, wenn die Kette etwas angelegt hat. */
  onAenderung?: () => void
}

export function ReferenzketteDialog({ offen, onClose, character, onAenderung }: Props) {
  const {
    phase, stand, standGeladen, titelbild, titelbildLiegtEigen, naechster,
    starte, kopfNehmen, kopfVerwerfen, abbrechen,
    koerperfotoUrl, koerperfotoLaedt, koerperfotoHochladen,
    koerperAuswahl, setKoerperAuswahl, jobUnterwegsSchritt,
    koerperbildIstAuswahl, kandidaten, kandidatenLaden, kandidatenHolen,
    koerperbildWaehlen,
  } = useReferenzkette(character, offen, onAenderung)

  const dateiFeld = useRef<HTMLInputElement>(null)
  const [auswahlOffen, setAuswahlOffen] = useState(false)

  /**
   * Die vorhandenen Bilder erst beim Öffnen holen, und nur einmal.
   *
   * Wer die Kette nur startet, braucht diese Abfrage nie — sie beim Öffnen des
   * Dialogs mitzuladen wäre eine Abfrage für alle, damit einer sie manchmal
   * benutzt.
   */
  function oeffneAuswahl() {
    setAuswahlOffen(true)
    if (kandidaten === null) void kandidatenHolen()
  }

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

  /**
   * Ob „Vorgaben für den Körper" gerade etwas bewirken würde.
   *
   * Sichtbar, solange das Körper-Sheet fehlt UND kein abgegebener Auftrag
   * schon mit den alten Werten unterwegs ist (`jobUnterwegsSchritt`,
   * Critic-Befund R04). Zusätzlich zu `bereit`/`pruefen`/`fehler` auch
   * während `wartet` auf den KOPF selbst: Zu diesem Zeitpunkt hat `kopfNehmen`
   * die Werte noch gar nicht gelesen — sie werden erst beim Klick auf
   * „Nehmen und weiter" aus dem dann aktuellen Zustand übernommen (siehe
   * use-referenzkette.ts). Das Kopf-Warten ist gerade das Zeitfenster, in dem
   * Mark ohnehin nichts anderes tut — es wegzunehmen, nähme ihm ausgerechnet
   * die bequemste Gelegenheit.
   */
  const koerperVorgabenSichtbar =
    standGeladen
    && !stand.vorhanden.koerper
    && jobUnterwegsSchritt === null
    && (
      phase.art === 'bereit'
      || phase.art === 'pruefen'
      || phase.art === 'fehler'
      || (phase.art === 'wartet' && phase.schritt === 'kopf')
    )

  return (
    <Dialog open={offen} onOpenChange={v => { if (!v && !laeuft) onClose() }}>
      <DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-violet-400" />
            Referenzkette
            <span className="ml-1 truncate text-sm font-normal text-muted-foreground">
              — {character.name}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Kopf, Körper und Referenzsheet nacheinander — jedes Bild ist die
            Referenz für das nächste. Nach dem Kopf hält es an, damit du ihn
            ansiehst.
          </DialogDescription>
        </DialogHeader>

        {/* ── Titelbild: die Voraussetzung ─────────────────────────────── */}
        {!titelbildLiegtEigen && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle className="text-sm">
              {titelbild ? 'Das Titelbild liegt nicht im eigenen Speicher' : 'Dieser Charakter hat kein Titelbild'}
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {titelbild
                ? 'Der Arbeiter läuft auf deinem PC und nimmt nur Bilder aus dem eigenen Speicher als Referenz an — fremde Adressen lehnt er ab. Sichere das Bild zuerst (PROJ-49), dann geht die Kette.'
                : 'Die Kette braucht ein Ausgangsbild. Lade eines hoch und setze es als Titelbild.'}
            </AlertDescription>
          </Alert>
        )}

        {/* ── Die drei Schritte ────────────────────────────────────────── */}
        <div className="space-y-2">
          {!standGeladen ? (
            KETTEN_SCHRITTE.map(s => <Skeleton key={s} className="h-16 rounded-xl" />)
          ) : (
            KETTEN_SCHRITTE.map((schritt, i) => {
              const liegt   = stand.vorhanden[schritt]
              const dran    = !liegt && naechster === schritt
              const aktiv   = (phase.art === 'wartet' || phase.art === 'legt_ab') && phase.schritt === schritt
              const gepruft = phase.art === 'pruefen' && schritt === 'kopf'
              return (
                <div
                  key={schritt}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors',
                    aktiv || gepruft
                      ? 'border-violet-500/50 bg-violet-500/5'
                      : liegt
                        ? 'border-emerald-600/30 bg-emerald-600/5'
                        : 'border-border/60 bg-card/40',
                  )}
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold">
                    {liegt ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                      : aktiv ? <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                        : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {SCHRITT_LABEL[schritt]}
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        → Variante „{VARIANTEN_NAME[schritt]}"
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{BESCHREIBUNG[schritt]}</p>
                    {liegt && (
                      <p className="mt-1 text-[11px] text-emerald-400/80">
                        Liegt schon vor — wird nicht neu erzeugt.
                      </p>
                    )}
                    {dran && phase.art === 'bereit' && (
                      <p className="mt-1 text-[11px] text-violet-300">Hier geht es weiter.</p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Vorgaben für den Körper-Schritt ──────────────────────────────
          * Bedingung: siehe `koerperVorgabenSichtbar` oben. */}
        {koerperVorgabenSichtbar && (
          <div className="space-y-4 rounded-xl border border-violet-500/50 bg-violet-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <PersonStanding className="h-4 w-4 text-violet-400" />
              Vorgaben für den Körper
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                — freiwillig
              </span>
            </p>

            {/* ── Körperfoto ──────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-xs">Eigenes „Körper Original"</Label>

              {koerperfotoUrl ? (
                <div className="flex items-start gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-violet-500/40 bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={koerperfotoUrl}
                      alt="Hochgeladenes Körper-Original"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-xs text-emerald-400/80">
                      {koerperbildIstAuswahl
                        ? 'Gewähltes Bild wird als Körperquelle benutzt.'
                        : '„Körper Original" liegt vor.'}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" disabled={koerperfotoLaedt}
                        onClick={() => dateiFeld.current?.click()}>
                        {koerperfotoLaedt
                          ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                        Anderes hochladen
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => oeffneAuswahl()}>
                        <Images className="mr-1.5 h-3.5 w-3.5" />
                        Vorhandenes wählen
                      </Button>
                      {koerperbildIstAuswahl && (
                        <Button size="sm" variant="ghost" onClick={() => koerperbildWaehlen(null)}>
                          Auswahl aufheben
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" disabled={koerperfotoLaedt}
                    onClick={() => dateiFeld.current?.click()}>
                    {koerperfotoLaedt
                      ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    Bild hochladen
                  </Button>
                  {/* Marks häufigerer Fall: Das Körperbild ist längst da — über
                      die Erweiterung nachgeladen und in „Sonstige" gelandet.
                      Es soll dort bleiben und nur auswählbar sein. */}
                  <Button size="sm" variant="outline" onClick={() => oeffneAuswahl()}>
                    <Images className="mr-1.5 h-3.5 w-3.5" />
                    Vorhandenes Bild wählen
                  </Button>
                </div>
              )}

              {/* ── Die Auswahl vorhandener Bilder ─────────────────────── */}
              {auswahlOffen && (
                <div className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-2.5">
                  {kandidatenLaden ? (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Bilder werden geladen …
                    </p>
                  ) : !kandidaten || kandidaten.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Dieser Charakter hat noch keine Bilder, die als Körperquelle
                      taugen. (Bilder außerhalb des eigenen Speichers stehen nicht
                      zur Wahl — der Arbeiter würde sie ablehnen.)
                    </p>
                  ) : (
                    kandidaten.map(gruppe => (
                      <div key={gruppe.label} className="space-y-1">
                        <p className="text-[11px] font-medium text-muted-foreground">{gruppe.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {gruppe.bilder.map(url => (
                            <button
                              key={url}
                              type="button"
                              onClick={() => { koerperbildWaehlen(url); setAuswahlOffen(false) }}
                              className={cn(
                                'h-16 w-16 overflow-hidden rounded-md border-2 bg-black/30 transition-colors',
                                url === koerperfotoUrl
                                  ? 'border-violet-400'
                                  : 'border-transparent hover:border-violet-500/50',
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`Bild aus ${gruppe.label}`} className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setAuswahlOffen(false)}>
                    Schließen
                  </Button>
                </div>
              )}

              <input
                ref={dateiFeld}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={koerperfotoLaedt}
                onChange={e => {
                  const datei = e.target.files?.[0]
                  // Zurücksetzen, sonst löst dieselbe Datei beim zweiten Mal
                  // kein `change` mehr aus und es sieht aus, als sei nichts
                  // passiert.
                  e.target.value = ''
                  // Erfolg und Fehler meldet der Hook selbst als Toast — hier
                  // nichts zusätzlich anzeigen, sonst steht dieselbe Nachricht
                  // zweimal.
                  if (datei) void koerperfotoHochladen(datei)
                }}
              />

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Wird NUR für die Körperform im Körper-Sheet genutzt, nicht fürs
                Gesicht. Ohne eigenes Foto nimmt die Kette automatisch das
                Titelbild als Körper-Vorlage.
              </p>
            </div>

            {/* ── Merkmale ────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-xs">Körpermerkmale</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MERKMAL_FELDER.map(feld => (
                  <div key={feld.schluessel} className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">{feld.label}</span>
                    <Select
                      value={koerperAuswahl[feld.schluessel] ?? KEINE_ANGABE}
                      onValueChange={wert => setKoerperAuswahl(vorher => {
                        const neu = { ...vorher }
                        if (wert === KEINE_ANGABE) {
                          delete neu[feld.schluessel]
                        } else {
                          // `feld.schluessel` ist hier weiterhin die Vereinigung
                          // aller fünf Feldschlüssel; TypeScript verlangt für den
                          // Schreibzugriff deren Schnittmenge, die leer ist — das
                          // erzwingt diesen Umweg. Sicher ist er trotzdem: `wert`
                          // stammt oben aus `feld.optionen.map(o => o.wert)`, und
                          // die sind seit dem `MerkmalFeld`-Typ compile-geprüft
                          // genau die erlaubten Werte VON DIESEM `schluessel` —
                          // kein freier String kann hier ankommen.
                          ;(neu as Record<string, string>)[feld.schluessel] = wert
                        }
                        return neu
                      })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={KEINE_ANGABE} className="text-xs">
                          Keine Angabe
                        </SelectItem>
                        {feld.optionen.map(o => (
                          <SelectItem key={o.wert} value={o.wert} className="text-xs">
                            {o.text}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Zusätzlich zu dem, was die Referenzbilder zeigen — wird nur beim
                Körper-Sheet angewendet.
              </p>
            </div>
          </div>
        )}

        {/* ── Zustand und Knöpfe ───────────────────────────────────────── */}

        {phase.art === 'wartet' && (
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
              {SCHRITT_LABEL[phase.schritt]} ist eingereiht — der Arbeiter auf dem PC holt ihn ab.
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
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            Bild wird in die Variante „{VARIANTEN_NAME[phase.schritt]}" gelegt …
          </p>
        )}

        {/* Der Halt: groß ansehen und entscheiden. */}
        {phase.art === 'pruefen' && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-violet-500/40 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phase.bildUrl}
                alt="Erzeugtes Kopf-Sheet"
                className="max-h-[45svh] w-full object-contain"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nimmst du diesen Kopf, laufen Körper und Referenzsheet ohne
              weiteres Zutun durch — beide bekommen genau dieses Gesicht als
              Vorlage.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={() => void kopfNehmen()}>
                <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                Nehmen und weiter
              </Button>
              <Button variant="outline" onClick={() => void kopfVerwerfen()}>
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
              Abgebrochen bei {SCHRITT_LABEL[phase.schritt]}
            </AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              {phase.grund}
              <br />
              Die folgenden Schritte wurden NICHT erzeugt — sie bräuchten dieses
              Bild als Referenz. Was schon liegt, bleibt liegen.
            </AlertDescription>
          </Alert>
        )}

        {phase.art === 'fertig' && (
          <Alert className="border-emerald-600/40 bg-emerald-600/5">
            <Check className="h-4 w-4 text-emerald-400" />
            <AlertTitle className="text-sm">Referenzkette fertig</AlertTitle>
            <AlertDescription className="text-xs">
              Kopf, Körper und Referenzsheet liegen als eigene Varianten beim
              Charakter. Das Titelbild ist unverändert geblieben.
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
                ? 'Alle drei liegen vor'
                : naechster === 'kopf'
                  ? 'Referenzkette erzeugen'
                  : `Weiter mit ${SCHRITT_LABEL[naechster]}`}
            </Button>
            <Button variant="outline" onClick={onClose}>Schließen</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
