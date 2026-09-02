'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
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

  /**
   * Vergroesserung der Ansicht. 1 = eingepasst.
   *
   * Mark am 02.09.2026: „ein Zoomen auf das Bild, in dem ich mir den Mausrad
   * einfach groesser oder kleiner mache".
   *
   * WARUM NICHT PER CSS-TRANSFORM: Der Rahmen von react-image-crop misst das
   * Kind, ueber dem er liegt. Ein `scale()` liesse den Rahmen an der alten
   * Stelle und die Maus an der falschen — die Bibliothek rechnet in
   * Elementkoordinaten. Stattdessen waechst das Canvas selbst, und die Buehne
   * bekommt Rollbalken. Damit stimmt jede Zeigerposition von allein.
   */
  const [zoom, setZoom] = useState(1)
  /** Solange gedrueckt: das unbearbeitete Bild. */
  const [vergleich, setVergleich] = useState(false)
  const buehneRef = useRef<HTMLDivElement>(null)
  const [buehne, setBuehne] = useState<{ b: number; h: number } | null>(null)

  // ── Laden ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!offen || !bildUrl) return
    let abgebrochen = false
    setLaedt(true); setFehler(null)
    setRegler(REGLER_VORGABE); setAusschnitt(GANZES_BILD)
    setCrop(undefined); setVerhaeltnis('frei'); setReiter('zuschnitt')
    setZoom(1); setVergleich(false)

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

  // ── Anzeigegroesse ───────────────────────────────────────────────────────
  /**
   * Wie gross das Bild auf dem Schirm steht.
   *
   * Ohne Zoom war das Sache von zwei Tailwind-Klassen (`max-h`, `max-w`). Mit
   * Zoom muss die Groesse berechnet werden — und sie muss AUSGERECHNET
   * vorliegen, nicht vom Browser eingepasst, sonst weiss niemand, wie weit
   * bereits vergroessert ist.
   */
  useEffect(() => {
    const el = buehneRef.current
    if (!el || !offen) return
    const messen = () => {
      // `getBoundingClientRect`, NICHT `clientWidth`: Letzteres schrumpft, wenn
      // ein Rollbalken erscheint — das eingepasste Mass wuerde kleiner, das
      // Canvas auch, der Rollbalken verschwaende, und es begaenne von vorn. Das
      // Randmass bleibt davon unberuehrt. Polster hat die Buehne keins mehr
      // (es sass sonst IM Rollbereich und machte das Mass um 16 Punkte zu gross
      // — bei 100 % fehlten dem Bild dadurch 16 Punkte am Rand).
      const r = el.getBoundingClientRect()
      const b = Math.round(r.width), h = Math.round(r.height)
      // NUR bei echter Aenderung neu setzen. Ein frisches Objekt mit denselben
      // Zahlen ist fuer React eine Aenderung: Es zeichnet neu, das Neuzeichnen
      // laesst den Beobachter erneut feuern, und der Browser steht.
      // Am 02.09.2026 genau so passiert — der Renderer war eingefroren.
      setBuehne(v => (v && v.b === b && v.h === h) ? v : { b, h })
    }
    messen()
    const ro = new ResizeObserver(messen)
    ro.observe(el)
    return () => ro.disconnect()
  }, [offen, laedt, fehler])

  /** Die eingepasste Groesse mal Zoom. */
  const anzeige = useMemo(() => {
    if (!masse || !buehne || buehne.b < 2 || buehne.h < 2) return null
    // Einpassen, aber ein kleines Bild nicht kuenstlich aufblasen.
    const passt = Math.min(1, Math.min(buehne.b / masse.b, buehne.h / masse.h))
    return {
      b: Math.max(1, Math.round(masse.b * passt * zoom)),
      h: Math.max(1, Math.round(masse.h * passt * zoom)),
    }
  }, [masse, buehne, zoom])

  // ── Vorschau zeichnen ────────────────────────────────────────────────────
  const zeichnen = useCallback((r: Regler, breiteAufSchirm?: number) => {
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
      // Beim Hineinzoomen darf die Vorschau nicht einfach hochskaliert werden —
      // dann sieht man die eigene Unschaerfe statt der des Bildes, und genau
      // fuer das Hinsehen ist der Zoom da. Also waechst die gerechnete Aufloesung
      // mit, bis 2048: Bei Marks ueblichen Groessen (1122 bis 1536) liegt die
      // Grenze ueber dem Bild selbst, es wird also in voller Aufloesung
      // gerechnet.
      //
      // IN ZWEI STUFEN, nicht stufenlos: Jede Aenderung der Canvasgroesse wirft
      // die drei Zwischenpuffer weg und legt sie neu an. Stufenlos waere das
      // eine Neuanlage bei jeder Zehntelumdrehung des Rades.
      //
      // Nachgerechnet fuer 2048x2048: `zielFarbe` als RGBA16F 33,6 MB, dazu
      // `zielBlurA` und `zielBlurB` je einkanalig als R16F 8,4 MB — zusammen
      // 50 MB. Hier stand vorher „vier Puffer, rund 100 MB": Es sind drei, und
      // zwei davon einkanalig.
      const lang = Math.max(bitmap.width, bitmap.height)
      const dpr = typeof window === 'undefined' ? 1 : (window.devicePixelRatio || 1)
      const gewuenscht = breiteAufSchirm
        ? (breiteAufSchirm / bitmap.width) * lang * dpr
        : 1600
      const kante = gewuenscht > 1600 ? 2048 : 1600
      const f = Math.min(1, kante / lang)
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
    const id = requestAnimationFrame(() =>
      zeichnen(vergleich ? REGLER_VORGABE : regler, anzeige?.b))
    return () => cancelAnimationFrame(id)
  }, [regler, vergleich, anzeige, laedt, fehler, masse, zeichnen])

  /**
   * Mausrad zoomt — und zwar auf die Stelle unter dem Zeiger.
   *
   * WARUM EIN EIGENER LAUSCHER STATT `onWheel`: React haengt Radereignisse
   * passiv ein. Ein passiver Lauscher darf `preventDefault` nicht aufrufen,
   * also rollte die Seite mit, waehrend das Bild zoomte. Mit
   * `{ passive: false }` gehoert das Rad der Buehne.
   *
   * Der Zeiger bleibt auf demselben Bildpunkt stehen: Der Abstand vom linken
   * Rand waechst mit demselben Faktor wie das Bild, also muss die Rolle um die
   * Differenz nachgezogen werden. Ohne das wandert einem beim Hineinzoomen
   * genau die Stelle aus dem Bild, die man sich ansehen wollte.
   */
  /**
   * Der Anker fuer die naechste Rollkorrektur.
   *
   * WARUM NICHT DIREKT IM `setZoom`: Dort stand ein `requestAnimationFrame`
   * mitten im Aktualisierer. Ein Aktualisierer muss nebenwirkungsfrei sein —
   * React ruft ihn im Entwicklungsmodus doppelt auf, dann lief die Korrektur
   * zweimal und der Anker schoss ueber. Jetzt wird nur gemerkt, WOHIN, und
   * korrigiert wird, nachdem die neue Groesse wirklich steht.
   */
  const ankerRef = useRef<{ x: number; y: number; v: number } | null>(null)

  /**
   * Mausrad zoomt — auf die Stelle unter dem Zeiger.
   *
   * NUR BEI DEN ANPASSUNGEN. Mark am 02.09.2026: „Beim Zuschneiden muss ich
   * auch nicht unbedingt zoomen können." Das ist mehr als eine Vereinfachung:
   * react-image-crop rechnet den Rahmen in Prozent seines eigenen Kastens, und
   * der waechst beim Zoomen nicht mit. Ein bei dreifacher Vergroesserung
   * gezogener Rahmen haette beim Speichern einen ganz anderen Bildbereich
   * getroffen als den gezeigten — ohne jede Meldung. Kein Zoom im Zuschnitt,
   * kein solcher Fehler.
   *
   * WARUM EIN EIGENER LAUSCHER STATT `onWheel`: React haengt Radereignisse
   * passiv ein, und ein passiver Lauscher darf `preventDefault` nicht rufen —
   * die Seite rollte mit, waehrend das Bild zoomte.
   */
  useEffect(() => {
    const el = buehneRef.current
    if (!el || !offen) return
    const amRad = (e: WheelEvent) => {
      if (e.ctrlKey) return  // Browser-Zoom bleibt Browser-Zoom
      if (reiter !== 'regler') return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      setZoom(alt => {
        const neu = Math.min(8, Math.max(1, alt * Math.exp(-e.deltaY * 0.0015)))
        if (neu === alt) return alt
        ankerRef.current = { x, y, v: neu / alt }
        return neu
      })
    }
    el.addEventListener('wheel', amRad, { passive: false })
    return () => el.removeEventListener('wheel', amRad)
  }, [offen, laedt, fehler, reiter])

  /**
   * Die Rolle nachziehen, sobald die neue Groesse steht.
   *
   * Der Abstand des Zeigers vom linken Rand waechst mit demselben Faktor wie
   * das Bild; um die Differenz muss gerollt werden, sonst wandert einem genau
   * die Stelle aus dem Bild, die man sich ansehen wollte.
   */
  useLayoutEffect(() => {
    const el = buehneRef.current
    const a = ankerRef.current
    if (!el || !a) return
    ankerRef.current = null
    el.scrollLeft = (el.scrollLeft + a.x) * a.v - a.x
    el.scrollTop  = (el.scrollTop  + a.y) * a.v - a.y
  }, [anzeige])

  // Im Zuschnitt gibt es keinen Zoom — beim Wechsel dorthin zurueck auf 1,
  // sonst bliebe ein vergroessertes Bild mit einem Rahmen stehen, der etwas
  // anderes meint als er zeigt.
  useEffect(() => {
    if (reiter === 'zuschnitt') setZoom(1)
  }, [reiter])

  /**
   * Gedrueckt halten zeigt das Original — Ziehen verschiebt das Bild.
   *
   * Mark am 02.09.2026: „Wenn ich links klicke, dann wird ja wie gewünscht das
   * Originalbild gezeigt, aber wie kann man machen, dass ich auch da hinzoomen
   * kann, wo ich es will?" — Es fehlte das Verschieben. Beides haengt an
   * derselben Taste, unterschieden wird an der Bewegung: Wer stehen bleibt,
   * vergleicht; wer zieht, schiebt. Ab fuenf Bildpunkten gilt es als Ziehen.
   *
   * NUR IM REGLER-REITER: Im Zuschnitt gehoert die Geste dem Rahmen.
   */
  const zugRef = useRef<{ x: number; y: number; sx: number; sy: number; zieht: boolean } | null>(null)

  const vergleichAn = (e: React.PointerEvent) => {
    if (reiter !== 'regler' || e.button !== 0) return
    const el = buehneRef.current
    // Der Fang haelt das Loslassen fest, auch wenn die Maus dabei die Buehne
    // verlassen hat. Er darf aber nicht ueber die Geste entscheiden: Bei einem
    // nicht mehr aktiven Zeiger wirft er (NotFoundError).
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* egal */ }
    zugRef.current = {
      x: e.clientX, y: e.clientY,
      sx: el?.scrollLeft ?? 0, sy: el?.scrollTop ?? 0,
      zieht: false,
    }
    setVergleich(true)
  }

  const vergleichZug = (e: React.PointerEvent) => {
    const z = zugRef.current
    const el = buehneRef.current
    if (!z || !el) return
    const dx = e.clientX - z.x, dy = e.clientY - z.y
    if (!z.zieht && Math.hypot(dx, dy) < 5) return
    // Ab hier wird geschoben, nicht verglichen.
    if (!z.zieht) { z.zieht = true; setVergleich(false) }
    el.scrollLeft = z.sx - dx
    el.scrollTop  = z.sy - dy
  }

  const vergleichAus = (e: React.PointerEvent) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch { /* egal */ }
    zugRef.current = null
    setVergleich(false)
  }

  /**
   * Rueckfall, falls das Loslassen nie ankommt.
   *
   * Wirft `setPointerCapture` und wird ausserhalb der Buehne losgelassen, kaeme
   * kein `pointerup` — das Original bliebe dann dauerhaft stehen, obwohl mit
   * Reglern gespeichert wuerde. Am Fenster kommt es immer an.
   */
  useEffect(() => {
    if (!vergleich) return
    const los = () => { zugRef.current = null; setVergleich(false) }
    window.addEventListener('pointerup', los)
    window.addEventListener('pointercancel', los)
    return () => {
      window.removeEventListener('pointerup', los)
      window.removeEventListener('pointercancel', los)
    }
  }, [vergleich])

  // ── Zuschnitt ────────────────────────────────────────────────────────────
  const seitenverhaeltnis = useMemo(() => {
    const v = VERHAELTNISSE.find(x => x.key === verhaeltnis)
    if (!v) return undefined
    if (v.key === 'original') return masse ? masse.b / masse.h : undefined
    return v.wert ?? undefined
  }, [verhaeltnis, masse])

  /**
   * Was am Ende WIRKLICH herauskommt — eine einzige Rechnung.
   *
   * WARUM ALS EIN WERT UND NICHT DREIMAL GERECHNET: Vorher rechnete die
   * Kopfzeile ohne `seitenverhaeltnis`, der Zuschnitt und die gemeldeten Masse
   * mit. `inPixel` leitet die Hoehe bei gesetztem Verhaeltnis aus der Breite ab,
   * ohne rundet es beide Seiten einzeln — an 1122x1402 mit „Original" plus
   * automatischem Zuschnitt sind das 1192 gegen 1197 Bildpunkte. Die Kopfzeile
   * versprach eine Zahl, die Datei bekam eine andere.
   *
   * `ganz` unterscheidet zusaetzlich den Fall, in dem gar nicht zugeschnitten
   * wird: Ein von Hand auf 99,9 % gezogener Rahmen faellt unter die Toleranz
   * von `istGanzesBild`, das Bild wird also unbeschnitten gespeichert — dann
   * duerfen auch die gemeldeten Masse die vollen sein und nicht die um zwei
   * Punkte kleineren des Rahmens.
   */
  const ergebnis = useMemo(() => {
    if (!masse) return null
    if (istGanzesBild(ausschnitt)) {
      return { x: 0, y: 0, breite: masse.b, hoehe: masse.h, ganz: true }
    }
    return { ...inPixel(ausschnitt, masse.b, masse.h, seitenverhaeltnis), ganz: false }
  }, [ausschnitt, masse, seitenverhaeltnis])

  function cropUebernehmen(c: Crop) {
    /*
      Beide Zustaende IMMER zusammen — aber der leere Rahmen darf nicht
      verschluckt werden.

      Am Anfang jedes Aufziehens meldet react-image-crop einen Rahmen der
      Groesse 0. Vorher stieg diese Funktion an der Stelle aus. Da die
      Bibliothek gesteuert laeuft — sie zeichnet, was in `crop` steht —, kam der
      Zug nie in Gang: Mark konnte gar keinen Rahmen mehr ziehen. Im Browser
      nachgesehen, der Rahmen fehlte im Baum, obwohl ReactCrop sich als
      „--active --new-crop" markiert hatte.

      Ein leerer Rahmen ist trotzdem KEIN Zuschnitt. Er geht als „ganzes Bild"
      in `ausschnitt` — damit stimmen Kopfzeile, Rahmen und Datei ueberein,
      und der Zug kann beginnen.
    */
    setCrop(c)
    setAusschnitt(c.unit === '%' && c.width > 0 && c.height > 0
      ? { x: c.x / 100, y: c.y / 100, breite: c.width / 100, hoehe: c.height / 100 }
      : GANZES_BILD)
  }

  /**
   * Ausschnitt setzen — und den sichtbaren Rahmen gleich mit.
   *
   * WARUM BEIDES ZUSAMMEN: `ausschnitt` ist die Wahrheit fuer das Speichern,
   * `crop` ist das, was react-image-crop zeichnet. Setzt man nur den einen,
   * behauptet die Kopfzeile einen Zuschnitt, den man im Bild nicht sieht —
   * genau das war am 02.09.2026 im Browser zu sehen: „Ausschnitt 1122 x 631",
   * daneben ein Rahmen ueber dem ganzen Hochformat.
   */
  function ausschnittSetzen(a: Ausschnitt) {
    setAusschnitt(a)
    setCrop(istGanzesBild(a)
      ? undefined
      : { unit: '%', x: a.x * 100, y: a.y * 100, width: a.breite * 100, height: a.hoehe * 100 })
  }

  function automatisch() {
    const bitmap = bitmapRef.current
    if (!bitmap) return
    // Ein Knopf, zwei Bedeutungen — je nachdem, ob ein Format gewählt ist.
    // Zwei Knöpfe müsste man erklären.
    const a = seitenverhaeltnis
      ? bestesFenster(bitmap, seitenverhaeltnis)
      : raenderWeg(bitmap)
    ausschnittSetzen(a)
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
    if (!werk || !masse || !ergebnis || !job || !quellPfad || rechnet) return

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
      // `ergebnis` statt einer eigenen Rechnung: Maße aus dem Zustand, NICHT
      // aus dem ImageBitmap — wird der Dialog während der Rechnung geschlossen,
      // gibt der Aufräumer das Bitmap frei, und ein freigegebenes meldet 0 × 0.
      if (ergebnis && !ergebnis.ganz) {
        const p = ergebnis
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

      const neu = await speichern(job, quellPfad, fertig, {
        ausschnitt,
        regler: { ...regler },
      }, { breite: ergebnis.breite, hoehe: ergebnis.hoehe })
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
            {ergebnis && !ergebnis.ganz && ` → Ausschnitt ${ergebnis.breite} × ${ergebnis.hoehe}`}
            {' · Das Original bleibt unverändert — gespeichert wird eine neue Fassung.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          {/* Bühne */}
          {/*
            `min-w-0`: Ein Flex-Element schrumpft von sich aus nicht unter die
            Breite seines Inhalts. Seit das Canvas eine ausgerechnete Breite hat
            statt `max-w-full`, ist dieser Inhalt breit — die Buehne mass sich
            daraufhin breiter als der Dialog und schob die Werkzeugspalte ueber
            den rechten Rand hinaus. Am 02.09.2026 im Browser gesehen: „Anpassu…",
            „Zuschnitt zuruecksetze…" abgeschnitten.
          */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 p-2 pt-0">
          <div
            ref={buehneRef}
            onPointerDown={vergleichAn}
            onPointerMove={vergleichZug}
            onPointerUp={vergleichAus}
            onPointerCancel={vergleichAus}
            onLostPointerCapture={vergleichAus}
            // Doppelklick setzt den Zoom zurueck — wer sich verfahren hat, muss
            // nicht zurueckrollen. Dieselbe Geste wie beim Ziehtrenner.
            onDoubleClick={() => setZoom(1)}
            className={cn(
              // KEIN `items-center justify-center`: Ein zentriertes Flex-Kind,
              // das ueberlaeuft, ragt nach BEIDEN Seiten hinaus — und der obere
              // und linke Ueberhang laesst sich dann nicht anrollen. Genau das
              // fehlte Mark („er zoomt mir irgendwohin, wo ich gar nicht will").
              // Gemittigt wird deshalb das Kind selbst, mit `m-auto`.
              // KEIN Polster: es saesse im Rollbereich und machte das Randmass
              // um 16 Punkte zu gross.
              'flex min-h-0 min-w-0 flex-1 rounded-md bg-black/40',
              // Erst beim Hineinzoomen Rollbalken.
              zoom > 1 ? 'overflow-auto' : 'overflow-hidden',
              reiter === 'regler' && !laedt && !fehler && (zoom > 1 ? 'cursor-grab' : 'cursor-pointer'),
            )}
          >
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
                // `werkbank-buehne` hebt zwei Regeln aus dem CSS der Bibliothek
                // auf, die das vergroesserte Bild abschneiden statt es rollen zu
                // lassen — siehe globals.css. `m-auto` mittigt und bleibt dabei
                // anrollbar.
                className="werkbank-buehne m-auto"
              >
                <canvas
                  ref={canvasRef}
                  // Ausgerechnete Groesse statt `max-h`/`max-w`: Der Browser
                  // soll nicht selbst einpassen, sonst weiss niemand, bei
                  // welcher Vergroesserung man gerade steht. Erst wenn die
                  // Buehne gemessen ist, greift der Stil — bis dahin die alten
                  // Klassen, damit nichts aufblitzt.
                  style={anzeige ? { width: anzeige.b, height: anzeige.h } : undefined}
                  // `touch-action-none`: Die Bibliothek setzt das nur fuer
                  // <img> und <video>, nicht fuer ein <canvas> — auf einem
                  // Tastschirm zoege derselbe Finger sonst Rahmen UND Buehne.
                  className={cn('block touch-none',
                    !anzeige && 'max-h-[68vh] max-w-full object-contain')}
                />
              </ReactCrop>
            )}
          </div>

          {/* Was man hier tun kann, steht nirgends sonst. */}
          <p className="shrink-0 text-center text-[10px] leading-tight text-muted-foreground">
            {reiter === 'regler' ? 'Mausrad zoomt · Maustaste halten zeigt das Original · Ziehen verschiebt' : 'Rahmen aufziehen zum Zuschneiden'}
            {zoom > 1 && <> · <span className="text-foreground">{Math.round(zoom * 100)} %</span> · Doppelklick setzt zurück</>}
          </p>
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
                          // Derselbe Knopf zweimal: Wer den Rahmen erst auf
                          // das Gesicht geschoben und dann versehentlich noch
                          // einmal auf „16:9" geklickt hat, saehe ihn sonst
                          // ohne Rueckfrage in die Mitte zurueckspringen.
                          if (v.key === verhaeltnis) return
                          setVerhaeltnis(v.key)
                          // Der Rahmen springt SOFORT in das gewählte Format —
                          // mittig, so groß wie er hineinpasst. Ein Knopf, nach
                          // dem sichtbar nichts geschieht, ist ein kaputter
                          // Knopf; und den alten freien Zuschnitt einfach
                          // stehen zu lassen wäre noch schlechter: Für den
                          // Betrachter aufgehoben, beim Speichern angewandt.
                          ausschnittSetzen(
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
