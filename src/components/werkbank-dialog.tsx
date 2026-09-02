'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactCrop, { type Crop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
  Loader2, Crop as CropIcon, SlidersHorizontal, RotateCcw, Save, Wand2,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'
import { BildWerk, REGLER_VORGABE, istNeutral, type Regler } from '@/lib/bild-werk'
import {
  VERHAELTNISSE, GANZES_BILD, istGanzesBild, inPixel, raenderWeg, bestesFenster,
  zentriertesFenster,
  type Ausschnitt, type VerhaeltnisSchluessel,
} from '@/lib/zuschnitt'
import { useBildBearbeiten } from '@/hooks/use-bild-bearbeiten'
import type { ImageJob } from '@/hooks/use-image-jobs'
import { cn } from '@/lib/utils'

/**
 * Die Werkbank — zuschneiden und die sieben Regler.
 *
 * Mark am 02.09.2026: „Ich habe hier auf Windows kein
 * Bildbearbeitungsprogramm, außer das direkt von Windows. Das kann auch
 * einfache Dinge, aber das nutze ich sehr ungern und ich möchte nicht noch ein
 * anderes haben." Diese Handgriffe müssen also wirklich reichen — deshalb alle
 * fünfzehn Seitenverhältnisse aus seiner Vorlage und alle sieben Regler, nicht
 * eine Auswahl davon.
 *
 * WARUM DAS BILD ZWEIMAL GERECHNET WIRD: Die Vorschau läuft auf einer
 * verkleinerten Fassung, gespeichert wird aus dem Original. Beides geht durch
 * DENSELBEN Shader (`BildWerk`) — nur so stimmt das Ergebnis mit dem überein,
 * was auf dem Bildschirm stand. Bei der Schärfe wäre es sonst zuverlässig
 * daneben, weil ihr Radius mit der Auflösung skaliert.
 */

const REGLER_LISTE: { key: keyof Regler; label: string; min: number; max: number }[] = [
  { key: 'helligkeit', label: 'Helligkeit',  min: -100, max: 100 },
  { key: 'kontrast',   label: 'Kontrast',    min: -100, max: 100 },
  { key: 'saettigung', label: 'Sättigung',   min: -100, max: 100 },
  { key: 'highlights', label: 'Lichter',     min: -100, max: 100 },
  { key: 'schatten',   label: 'Schatten',    min: -100, max: 100 },
  { key: 'temperatur', label: 'Temperatur',  min: -100, max: 100 },
  { key: 'schaerfe',   label: 'Schärfe',     min: 0,    max: 100 },
]

interface Props {
  offen: boolean
  onClose: () => void
  job: ImageJob | null
  bildUrl: string | null
  quellPfad: string | null
  onGespeichert?: () => void
}

export function WerkbankDialog({
  offen, onClose, job, bildUrl, quellPfad, onGespeichert,
}: Props) {
  const { speichert, speichern } = useBildBearbeiten()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const werkRef = useRef<BildWerk | null>(null)
  const bitmapRef = useRef<ImageBitmap | null>(null)

  /**
   * Läuft gerade eine Rechnung?
   *
   * NICHT dasselbe wie `speichert` aus dem Hook: Das wird erst gesetzt, wenn
   * die Datei fertig ist. Bei 25 Megapixeln liegen davor mehrere Sekunden
   * Exportzeit, in denen weder der Knopf gesperrt noch der Dialog verriegelt
   * war. Zwei Folgen, beide gemeldet:
   *
   *  - zweimal klicken erzeugte zwei Fassungen
   *  - Escape drücken schloss den Dialog, der Aufräumer gab das Bild frei, und
   *    ein freigegebenes ImageBitmap meldet 0 × 0 — gespeichert wurde ein
   *    1×1-Bild, mit Erfolgsmeldung darüber.
   */
  const [rechnet, setRechnet] = useState(false)
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [masse, setMasse] = useState<{ b: number; h: number } | null>(null)

  const [reiter, setReiter] = useState<'zuschnitt' | 'regler'>('zuschnitt')
  const [verhaeltnis, setVerhaeltnis] = useState<VerhaeltnisSchluessel>('frei')
  const [crop, setCrop] = useState<Crop | undefined>()
  const [ausschnitt, setAusschnitt] = useState<Ausschnitt>(GANZES_BILD)
  const [regler, setRegler] = useState<Regler>(REGLER_VORGABE)

  // ── Laden ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!offen || !bildUrl) return
    let abgebrochen = false
    setLaedt(true); setFehler(null)
    setRegler(REGLER_VORGABE); setAusschnitt(GANZES_BILD)
    setCrop(undefined); setVerhaeltnis('frei'); setReiter('zuschnitt')

    // Über fetch statt <img>: Ein ImageBitmap aus einem lokalen Blob kann das
    // Canvas gar nicht verunreinigen — die Herkunftsfrage entfällt damit. Und
    // das Entpacken läuft außerhalb des Hauptfadens, was bei einem 10-MB-PNG
    // spürbar ist.
    void (async () => {
      try {
        const antwort = await fetch(bildUrl, { mode: 'cors', cache: 'no-store' })
        if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`)
        const bitmap = await createImageBitmap(await antwort.blob())
        if (abgebrochen) { bitmap.close(); return }
        bitmapRef.current = bitmap
        setMasse({ b: bitmap.width, h: bitmap.height })
        setLaedt(false)
      } catch (e) {
        if (!abgebrochen) { setFehler((e as Error).message); setLaedt(false) }
      }
    })()

    return () => {
      abgebrochen = true
      werkRef.current?.freigeben(); werkRef.current = null
      bitmapRef.current?.close(); bitmapRef.current = null
    }
  }, [offen, bildUrl])

  // ── Vorschau zeichnen ────────────────────────────────────────────────────
  const zeichnen = useCallback((r: Regler) => {
    const canvas = canvasRef.current
    const bitmap = bitmapRef.current
    if (!canvas || !bitmap) return
    try {
      // Das Canvas muss BEMASST werden, sonst ist es 300×150 — die Vorgabe von
      // HTML. Genau so sah die erste Fassung aus: das Bild in eine Briefmarke
      // gequetscht. `BildWerk` liest die Maße nur, es setzt sie nicht.
      //
      // 1600 Pixel lange Kante reichen für die Vorschau; das volle Bild wird
      // erst beim Speichern gerechnet, durch denselben Shader.
      const lang = Math.max(bitmap.width, bitmap.height)
      const f = Math.min(1, 1600 / lang)
      const b = Math.max(1, Math.round(bitmap.width * f))
      const h = Math.max(1, Math.round(bitmap.height * f))
      if (canvas.width !== b || canvas.height !== h) {
        canvas.width = b
        canvas.height = h
      }
      if (!werkRef.current) {
        werkRef.current = new BildWerk(canvas)
        werkRef.current.laden(bitmap)
      }
      werkRef.current.zeichnen(r)
    } catch (e) {
      setFehler((e as Error).message)
    }
  }, [])

  useEffect(() => {
    if (laedt || fehler || !masse) return
    // Ein Bild pro Rahmen genügt; ohne das rechnet jeder Reglerschritt sofort.
    const id = requestAnimationFrame(() => zeichnen(regler))
    return () => cancelAnimationFrame(id)
  }, [regler, laedt, fehler, masse, zeichnen])

  // ── Zuschnitt ────────────────────────────────────────────────────────────
  const seitenverhaeltnis = useMemo(() => {
    const v = VERHAELTNISSE.find(x => x.key === verhaeltnis)
    if (!v) return undefined
    if (v.key === 'original') return masse ? masse.b / masse.h : undefined
    return v.wert ?? undefined
  }, [verhaeltnis, masse])

  function cropUebernehmen(c: Crop) {
    setCrop(c)
    if (c.unit === '%' && c.width > 0 && c.height > 0) {
      setAusschnitt({ x: c.x / 100, y: c.y / 100, breite: c.width / 100, hoehe: c.height / 100 })
    }
  }

  function automatisch() {
    const bitmap = bitmapRef.current
    if (!bitmap) return
    // Ein Knopf, zwei Bedeutungen — je nachdem, ob ein Format gewählt ist.
    // Zwei Knöpfe müsste man erklären.
    const a = seitenverhaeltnis
      ? bestesFenster(bitmap, seitenverhaeltnis)
      : raenderWeg(bitmap)
    setAusschnitt(a)
    setCrop({ unit: '%', x: a.x * 100, y: a.y * 100, width: a.breite * 100, height: a.hoehe * 100 })
    if (istGanzesBild(a)) {
      toast.info(seitenverhaeltnis
        ? 'Kein besserer Ausschnitt gefunden — das Bild bleibt, wie es ist.'
        : 'Keine einfarbigen Ränder gefunden.')
    }
  }

  function zuruecksetzen() {
    if (reiter === 'regler') { setRegler(REGLER_VORGABE); return }
    setAusschnitt(GANZES_BILD); setCrop(undefined); setVerhaeltnis('frei')
  }

  // ── Speichern ────────────────────────────────────────────────────────────
  async function alsFassungSpeichern() {
    const werk = werkRef.current
    if (!werk || !masse || !job || !quellPfad || rechnet) return

    if (istGanzesBild(ausschnitt) && istNeutral(regler)) {
      toast.info('Nichts geändert — es gibt nichts zu speichern.')
      return
    }

    setRechnet(true)
    try {
      // Erst die Regler auf dem vollen Bild, dann zuschneiden. Die Reihenfolge
      // ist festgenagelt: Andersherum wanderte die Schärfe an die neuen
      // Bildränder, und Vorschau und Ergebnis wichen voneinander ab.
      const voll = await werk.export(regler)

      let fertig = voll
      if (!istGanzesBild(ausschnitt)) {
        // Maße aus dem Zustand, NICHT aus dem ImageBitmap: Wird der Dialog
        // während der Rechnung geschlossen, gibt der Aufräumer das Bitmap frei,
        // und ein freigegebenes meldet 0 × 0.
        const p = inPixel(ausschnitt, masse.b, masse.h, seitenverhaeltnis)
        const gerechnet = await createImageBitmap(voll)
        const c = document.createElement('canvas')
        c.width = p.breite; c.height = p.hoehe
        const ctx = c.getContext('2d')
        if (!ctx) throw new Error('Kein 2D-Kontext für den Zuschnitt.')
        ctx.drawImage(gerechnet, p.x, p.y, p.breite, p.hoehe, 0, 0, p.breite, p.hoehe)
        gerechnet.close()
        fertig = await new Promise<Blob>((ja, nein) =>
          c.toBlob(b => b ? ja(b) : nein(new Error('Zuschnitt ließ sich nicht speichern.')), 'image/png'))
      }

      const p = inPixel(ausschnitt, masse.b, masse.h, seitenverhaeltnis)
      const neu = await speichern(job, quellPfad, fertig, {
        ausschnitt,
        regler: { ...regler },
      }, { breite: p.breite, hoehe: p.hoehe })
      if (neu) { onGespeichert?.(); onClose() }
    } catch (e) {
      toast.error(`Speichern fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setRechnet(false)
    }
  }

  const etwasGeaendert = !istGanzesBild(ausschnitt) || !istNeutral(regler)

  return (
    <Dialog open={offen} onOpenChange={o => { if (!o && !rechnet) onClose() }}>
      <DialogContent className="flex h-[92vh] max-w-[min(96vw,80rem)] flex-col gap-3 overflow-hidden p-4">
        <DialogHeader className="space-y-0.5">
          <DialogTitle className="text-base">Werkbank</DialogTitle>
          <DialogDescription className="text-xs">
            {masse ? `${masse.b} × ${masse.h}` : '…'}
            {!istGanzesBild(ausschnitt) && masse && (() => {
              const p = inPixel(ausschnitt, masse.b, masse.h)
              return ` → Ausschnitt ${p.breite} × ${p.hoehe}`
            })()}
            {' · Das Original bleibt unverändert — gespeichert wird eine neue Fassung.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          {/* Bühne */}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-black/40 p-2">
            {laedt ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : fehler ? (
              <p className="max-w-md text-center text-sm text-destructive">
                Bild konnte nicht geladen werden: {fehler}
              </p>
            ) : (
              /*
                Das Canvas steht IMMER an derselben Stelle im Baum — auch im
                Regler-Reiter, wo nicht zugeschnitten wird.

                Vorher lag es in zwei Zweigen: einmal in ReactCrop, einmal
                daneben. Beim Reiterwechsel erzeugte React damit ein NEUES
                Canvas, während `BildWerk` noch am alten hing — die Bühne blieb
                schwarz. Am 02.09.2026 im laufenden Browser gesehen.

                Beim Zuschneiden wird der Rahmen nur abgeschaltet, nicht
                entfernt.
              */
              <ReactCrop
                // Im Regler-Reiter KEIN Rahmen: react-image-crop legt außerhalb der
                // Auswahl einen halbdurchsichtigen schwarzen Schleier. Farbe und
                // Helligkeit auf einem am Rand abgedunkelten Bild zu beurteilen
                // führt zuverlässig dazu, dass man zu hell einstellt.
                crop={reiter === 'zuschnitt' ? crop : undefined}
                onChange={(_, prozent) => cropUebernehmen(prozent)}
                aspect={seitenverhaeltnis}
                disabled={reiter !== 'zuschnitt'}
                className="max-h-full"
              >
                <canvas ref={canvasRef} className="block max-h-[68vh] max-w-full object-contain" />
              </ReactCrop>
            )}
          </div>

          {/* Werkzeuge */}
          <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-[260px]">
            <div className="grid grid-cols-2 gap-1">
              {([
                ['zuschnitt', 'Zuschneiden', CropIcon],
                ['regler', 'Anpassungen', SlidersHorizontal],
              ] as const).map(([key, label, Icon]) => (
                <button
                  key={key}
                  onClick={() => setReiter(key)}
                  aria-pressed={reiter === key}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] transition',
                    reiter === key
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border/60 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {reiter === 'zuschnitt' ? (
                <div className="space-y-2">
                  <Button size="sm" variant="outline" className="w-full" onClick={automatisch}>
                    <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                    Automatisches Zuschneiden
                  </Button>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    {seitenverhaeltnis
                      ? 'Legt den Rahmen dorthin, wo im Bild etwas los ist.'
                      : 'Schneidet einfarbige Ränder weg.'}
                  </p>

                  <span className="block pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Seitenverhältnis
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {VERHAELTNISSE.map(v => (
                      <button
                        key={v.key}
                        onClick={() => {
                          setVerhaeltnis(v.key)
                          setCrop(undefined)
                          // Der Rahmen springt SOFORT in das gewählte Format —
                          // mittig, so groß wie er hineinpasst. Ein Knopf, nach
                          // dem sichtbar nichts geschieht, ist ein kaputter
                          // Knopf; und den alten freien Zuschnitt einfach
                          // stehen zu lassen wäre noch schlechter: Für den
                          // Betrachter aufgehoben, beim Speichern angewandt.
                          setAusschnitt(
                            v.wert && masse
                              ? zentriertesFenster(masse.b, masse.h, v.wert)
                              : GANZES_BILD,
                          )
                        }}
                        aria-pressed={verhaeltnis === v.key}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded border px-1 py-1.5 text-[10px] transition',
                          verhaeltnis === v.key
                            ? 'border-primary bg-primary/10 font-medium text-primary'
                            : 'border-border/60 text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {/* Ein kleines Rechteck im richtigen Verhältnis — man
                            erkennt „hoch oder quer" schneller als man 5:7 liest. */}
                        <span
                          className="border border-current"
                          style={{
                            width: v.wert ? `${Math.min(22, 14 * Math.max(v.wert, 1))}px` : '18px',
                            height: v.wert ? `${Math.min(22, 14 / Math.min(v.wert, 1))}px` : '14px',
                          }}
                        />
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {REGLER_LISTE.map(r => (
                    <div key={r.key} className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        {/* Ein `label` darf nur auf ein Formularelement zeigen;
                            Radix legt die id auf ein span. Der Griff trägt die
                            Beschriftung selbst (griffLabel). */}
                        <span className="text-[11px] text-muted-foreground">{r.label}</span>
                        <span className="font-mono text-[10px] tabular-nums text-foreground">
                          {regler[r.key] > 0 ? `+${regler[r.key]}` : regler[r.key]}
                        </span>
                      </div>
                      <Slider
                        min={r.min} max={r.max} step={1}
                        value={[regler[r.key]]}
                        onValueChange={([v]) => setRegler(alt => ({ ...alt, [r.key]: v }))}
                        griffLabel={r.label}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button size="sm" variant="ghost" className="w-full" onClick={zuruecksetzen}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {reiter === 'regler' ? 'Regler zurücksetzen' : 'Zuschnitt zurücksetzen'}
            </Button>
          </aside>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={speichert || rechnet}>
            Abbrechen
          </Button>
          <Button
            size="sm"
            onClick={() => void alsFassungSpeichern()}
            disabled={speichert || rechnet || laedt || !!fehler || !etwasGeaendert}
          >
            {speichert || rechnet
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Save className="mr-1.5 h-3.5 w-3.5" />}
            {rechnet ? 'Wird gerechnet …' : 'Als neue Fassung speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
