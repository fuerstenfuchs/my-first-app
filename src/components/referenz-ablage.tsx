'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase'
import { cn } from '@/lib/utils'

/**
 * Die Referenz-Ablage — Bilder, die dem Modell als Vorlage mitgehen.
 *
 * Mark am 02.09.2026: „Wir haben ja gar nicht die Möglichkeit, ein
 * Referenzbild hochzuladen zu meinen Erzeugen eines Bildes. Also es soll
 * natürlich auch mehrere möglich sein. Und man soll die Bilder auch reinziehen
 * können von überall aus. Also von einer Webseite oder sonst irgendwo."
 *
 * Deshalb DREI Wege hinein, nicht einer: Knopf, Zwischenablage, Hineinziehen.
 * Der dritte ist der, der Arbeit spart — und der, der am ehesten schiefgeht,
 * siehe `adresseAus()`.
 *
 * WARUM DIE BILDER IN `generated-images` LANDEN, EINEN ÖFFENTLICH LESBAREN
 * EIMER: Der Arbeiter läuft auf Marks PC, nicht im Browser. Er holt die
 * Referenzen später über eine schlichte HTTP-Anfrage ab — mit einer
 * signierten, ablaufenden Adresse müsste er sich anmelden, und die Adresse
 * stünde trotzdem dauerhaft im Auftrag. Öffentlich lesbar ist hier also
 * Absicht und keine vergessene Regel. Geschrieben werden darf nur in den
 * eigenen Ordner: Die Schreibregel prüft `storage.foldername(name)[1]` gegen
 * `auth.uid()`, ein anderer erster Ordner wird abgelehnt. Der Pfad unten ist
 * deshalb keine Ordnungsfrage, sondern Bedingung.
 */

export type Referenzbild = {
  /** Der Speicherpfad — dient zugleich als stabiler Schlüssel in der Liste. */
  id: string
  url: string
  name: string
}

const BUCKET = 'generated-images'

/**
 * Grenzen, und warum genau diese:
 *
 * - ACHT Bilder: gpt-image-2 nimmt mehrere Vorlagen an, aber jede zusätzliche
 *   verwässert die Zuordnung („welches Bild war noch die Person?"). Über acht
 *   hinaus ist das Ergebnis nicht mehr steuerbar, und die Anfrage wird groß.
 * - FÜNFZEHN MB je Bild: Handyfotos liegen darunter, ein unkomprimiertes PNG
 *   aus der Werkbank auch. Darüber dauert allein das Hochladen so lange, dass
 *   es wie ein Hänger aussieht.
 * - Nur `image/*`: Alles andere lehnt das Modell ohnehin ab — dann lieber hier
 *   und mit einem lesbaren Satz.
 */
export const MAX_REFERENZEN = 8
const MAX_MB = 15
const MAX_BYTES = MAX_MB * 1024 * 1024

/** Die Dateiendung für den Speicherpfad — aus dem Namen, sonst aus dem Typ. */
function endungAus(datei: File): string {
  const ausName = /\.([a-z0-9]{2,5})$/i.exec(datei.name)?.[1]
  if (ausName) return ausName.toLowerCase()
  const ausTyp = datei.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return ausTyp || 'png'
}

/**
 * Was in einem Fallenlassen steckt, wenn es KEINE Datei ist.
 *
 * Ein Bild von einer Webseite kommt nicht als Datei an — der Browser gibt nur
 * eine Adresse weiter, und je nach Quelle unter einem anderen Namen. Deshalb
 * drei Versuche in dieser Reihenfolge:
 *
 * 1. `text/uri-list` — das Vorgesehene. Kann mehrere Zeilen und Kommentare
 *    (`#`) enthalten, deshalb wird die erste echte Zeile genommen.
 * 2. `text/plain` — Firefox und viele Web-Anwendungen legen die Adresse hier
 *    (auch) ab.
 * 3. `text/html` — bei einem gezogenen Bild steckt hier das ganze `<img>`-Tag;
 *    aus ihm wird das erste `src` herausgezogen. Das ist der Fall, in dem die
 *    ersten beiden leer bleiben, etwa bei manchen Galerien.
 */
function adresseAus(dt: DataTransfer): string | null {
  const uri = dt.getData('text/uri-list')
    .split('\n').map(z => z.trim())
    .find(z => z.length > 0 && !z.startsWith('#'))
  if (uri) return uri

  const text = dt.getData('text/plain').trim()
  if (/^(https?:|data:image\/)/i.test(text)) return text

  const html = dt.getData('text/html')
  const treffer = /<img[^>]+src=["']([^"']+)["']/i.exec(html)
  return treffer?.[1] ?? null
}

/** Base64 aus der Route zurück in Bytes — `atob` liefert nur Zeichen. */
function blobAusBase64(base64: string, typ: string): Blob {
  const roh = atob(base64)
  const bytes = new Uint8Array(roh.length)
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i)
  return new Blob([bytes], { type: typ || 'image/png' })
}

interface Props {
  bilder: Referenzbild[]
  /**
   * Setzer im Stil von React — NICHT als Wert, sondern als Fortschreibung.
   *
   * WARUM: `onChange([...bilder, ...neue])` liest `bilder` aus dem Abschluss,
   * also den Stand vom letzten Zeichnen. Faellt eine grosse Datei herein und
   * man fuegt waehrend des Hochladens ein zweites Bild ein, sehen BEIDE Aufrufe
   * eine leere Liste — der zweite ueberschreibt den ersten. Das erste Bild
   * verschwindet aus der Liste und bleibt als verwaiste Datei im Speicher
   * liegen, ohne jede Meldung.
   */
  onChange: Dispatch<SetStateAction<Referenzbild[]>>
  className?: string
}

export function ReferenzAblage({ bilder, onChange, className }: Props) {
  const supabase = createClient()
  const dateiFeld = useRef<HTMLInputElement | null>(null)
  const [laedt, setLaedt] = useState(false)
  const [ueberzogen, setUeberzogen] = useState(false)

  /**
   * `dragenter`/`dragleave` feuern auch beim Wechsel auf ein Kindelement.
   * Ohne Zähler flackert der Rahmen, sobald die Maus über eine Miniatur zieht.
   */
  const tiefe = useRef(0)

  const hochladen = useCallback(async (dateien: File[]) => {
    const platz = MAX_REFERENZEN - bilder.length
    if (platz <= 0) {
      toast.error(`Mehr als ${MAX_REFERENZEN} Referenzbilder gehen nicht mit.`)
      return
    }

    const brauchbar: File[] = []
    for (const datei of dateien) {
      const name = datei.name || 'Bild'
      if (!datei.type.startsWith('image/')) {
        toast.error(`„${name}" ist kein Bild — nur Bilder gehen als Referenz mit.`)
        continue
      }
      if (datei.size > MAX_BYTES) {
        toast.error(
          `„${name}" ist ${(datei.size / 1024 / 1024).toFixed(1)} MB groß — ` +
          `mehr als ${MAX_MB} MB je Bild gehen nicht.`,
        )
        continue
      }
      brauchbar.push(datei)
    }
    if (brauchbar.length === 0) return

    const nehmen = brauchbar.slice(0, platz)
    if (nehmen.length < brauchbar.length) {
      toast.error(
        `Nur ${nehmen.length} von ${brauchbar.length} Bildern übernommen — ` +
        `mehr als ${MAX_REFERENZEN} gehen nicht mit.`,
      )
    }

    setLaedt(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Nicht angemeldet'); return }

      const neue: Referenzbild[] = []
      for (const datei of nehmen) {
        // Der erste Ordner MUSS die eigene Benutzerkennung sein, sonst lehnt
        // die Schreibregel ab. `referenzen/` trennt sie von den Ergebnissen,
        // die im selben Eimer liegen.
        const pfad = `${user.id}/referenzen/${crypto.randomUUID()}.${endungAus(datei)}`
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(pfad, datei, { contentType: datei.type || 'image/png', upsert: false })

        if (error) {
          toast.error(`„${datei.name || 'Bild'}" konnte nicht abgelegt werden: ${error.message}`)
          continue
        }

        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(pfad)
        neue.push({ id: pfad, url: publicUrl, name: datei.name || 'Referenz' })
      }

      if (neue.length > 0) onChange(vorher => [...vorher, ...neue].slice(0, MAX_REFERENZEN))
    } finally {
      setLaedt(false)
    }
  }, [bilder.length, onChange, supabase])

  /**
   * Ein Bild, von dem nur die Adresse bekannt ist.
   *
   * WARUM DER UMWEG ÜBER `/api/referenz-holen`: Ein `fetch` aus dem Browser auf
   * eine fremde Domain scheitert an CORS — die meisten Bildserver erlauben es
   * schlicht nicht, und das ist kein Fehler, den man wegprogrammieren kann. Der
   * Server hat diese Beschränkung nicht. Er holt das Bild und reicht es zurück.
   *
   * `data:`-Adressen (aus Word, aus manchen Editoren) tragen das Bild selbst
   * bei sich — dafür braucht es keinen Server.
   */
  const vonAdresse = useCallback(async (adresse: string) => {
    setLaedt(true)
    try {
      if (adresse.startsWith('data:')) {
        const blob = await (await fetch(adresse)).blob()
        const endung = blob.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png'
        await hochladen([new File([blob], `eingefuegt.${endung}`, { type: blob.type })])
        return
      }

      const antwort = await fetch('/api/referenz-holen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: adresse }),
      })
      const daten = await antwort.json().catch(() => null) as
        { pfad?: string; url?: string; typ?: string; fehler?: string } | null

      // Der Fehlertext der Route ist schon für Mark geschrieben — er wird
      // unverändert gezeigt und nicht in ein eigenes „Fehlgeschlagen" übersetzt.
      if (!antwort.ok || !daten?.url) {
        toast.error(daten?.fehler ?? 'Das Bild konnte nicht geholt werden.')
        return
      }

      // Die Route hat das Bild bereits abgelegt — hier kommt nur noch die
      // Adresse an. Vorher kam es als base64 zurueck und wurde von hier aus
      // hochgeladen; das riss an der Antwortgrenze der Plattform, lange bevor
      // die versprochenen 15 MB erreicht waren.
      onChange(vorher => vorher.length >= MAX_REFERENZEN ? vorher : [...vorher, {
        id: daten.pfad as string,
        url: daten.url as string,
        name: (daten.pfad as string).split('/').pop() ?? 'referenz',
      }])
    } catch {
      toast.error('Das Bild konnte nicht geholt werden — keine Verbindung zum Server.')
    } finally {
      setLaedt(false)
    }
  }, [hochladen])

  /**
   * Einfügen aus der Zwischenablage — bewusst am ganzen Dokument, nicht nur an
   * dieser Kachel: Wer ein Bild kopiert hat, drückt Strg+V irgendwo im Fenster
   * und nicht zielgenau auf einer Ablage, die er erst anklicken müsste.
   *
   * Nur BILDER werden abgefangen. Kopierter Text läuft weiter ins Prompt-Feld —
   * sonst wäre das Einfügen eines Prompts kaputt, und das wäre der weit
   * häufigere Handgriff.
   */
  useEffect(() => {
    function beiEinfuegen(e: ClipboardEvent) {
      const dateien = Array.from(e.clipboardData?.files ?? [])
        .filter(d => d.type.startsWith('image/'))
      if (dateien.length === 0) return
      e.preventDefault()
      void hochladen(dateien)
    }
    document.addEventListener('paste', beiEinfuegen)
    return () => document.removeEventListener('paste', beiEinfuegen)
  }, [hochladen])

  function entfernen(id: string) {
    // Nur aus der Liste, die Datei bleibt liegen. Löschen wäre hier nicht
    // sicher rückgängig zu machen, und dieselbe Adresse kann bereits in einem
    // eingereihten Auftrag stehen — die würde damit still kaputtgehen.
    onChange(vorher => vorher.filter(b => b.id !== id))
  }

  function abwerfen(e: React.DragEvent) {
    e.preventDefault()
    tiefe.current = 0
    setUeberzogen(false)

    const dateien = Array.from(e.dataTransfer.files)
    if (dateien.length > 0) { void hochladen(dateien); return }

    const adresse = adresseAus(e.dataTransfer)
    if (adresse) { void vonAdresse(adresse); return }

    toast.error('Darin war kein Bild — zieh ein Bild oder eine Bildadresse hierher.')
  }

  const voll = bilder.length >= MAX_REFERENZEN

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Referenzbilder{bilder.length > 0 ? ` (${bilder.length}/${MAX_REFERENZEN})` : ''}
        </span>
        {laedt && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <div
        onDragEnter={e => { e.preventDefault(); tiefe.current++; setUeberzogen(true) }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDragLeave={e => {
          e.preventDefault()
          tiefe.current = Math.max(0, tiefe.current - 1)
          if (tiefe.current === 0) setUeberzogen(false)
        }}
        onDrop={abwerfen}
        className={cn(
          'rounded-md border border-dashed p-2 transition-colors',
          ueberzogen
            ? 'border-primary bg-primary/10'
            : 'border-border/60 bg-muted/10',
        )}
      >
        {bilder.length > 0 && (
          <div className="mb-2 grid grid-cols-4 gap-1.5">
            {bilder.map(b => (
              <div key={b.id} className="group relative aspect-square overflow-hidden rounded border border-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url} alt={b.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => entfernen(b.id)}
                  aria-label={`${b.name} entfernen`}
                  title={`${b.name} entfernen`}
                  // Auf dem Handy gibt es kein Überfahren mit der Maus — deshalb
                  // ist der Knopf immer sichtbar und wird am PC nur deutlicher.
                  className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 text-muted-foreground opacity-80 transition hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={dateiFeld}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            const dateien = Array.from(e.target.files ?? [])
            // Zurücksetzen, sonst löst dieselbe Datei beim zweiten Mal kein
            // `change` mehr aus und es sieht aus, als sei nichts passiert.
            e.target.value = ''
            if (dateien.length > 0) void hochladen(dateien)
          }}
        />

        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 w-full text-[11px]"
          disabled={laedt || voll}
          onClick={() => dateiFeld.current?.click()}
        >
          <ImagePlus className="mr-1.5 h-3 w-3" />
          {voll ? `${MAX_REFERENZEN} Bilder — voll` : 'Bilder wählen'}
        </Button>

        <p className="mt-1 text-center text-[9px] leading-snug text-muted-foreground/70">
          Oder hierher ziehen — vom Rechner oder direkt von einer Webseite.
          Kopierte Bilder mit Strg+V einfügen.
        </p>
      </div>
    </div>
  )
}
