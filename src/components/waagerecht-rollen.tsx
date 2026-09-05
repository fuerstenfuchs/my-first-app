'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Eine waagerecht rollende Reihe OHNE Rollbalken (PROJ-64).
 *
 * Mark am 05.09.2026: „Jetzt sind da natürlich diese hässlichen Scrollbalken.
 * Die wollte ich eigentlich gar nirgendwo mehr drin haben. […] Kann man die
 * nicht rausnehmen und ich scroll einfach, indem ich mit dem Mausrädchen
 * scroll. […] Oder Du machst halt noch irgendwie Pfeile hin. Oder beides am
 * besten."
 *
 * WARUM DER ERSATZ VOR DEM WEGNEHMEN KOMMT: Am 04.09.2026 habe ich schon
 * einmal einen waagerechten Rollbalken versteckt — ohne Ersatz. Seine Antwort:
 * „Allerdings kann ich jetzt nicht mehr nach rechts scrollen." Ein Balken ist
 * hässlich, aber er ist auch die einzige Anzeige, DASS es weitergeht. Wer ihn
 * entfernt, muss beides ersetzen: das Rollen und den Hinweis.
 *
 * Also drei Dinge zusammen:
 *   1. Der Balken ist weg (`ohne-rollbalken`).
 *   2. Das Mausrad rollt hier waagerecht — auch ohne Umschalttaste.
 *   3. Pfeile links und rechts, die NUR erscheinen, wenn es dort weitergeht.
 *      Sie sind der Ersatz für die Anzeige, die der Balken war.
 */
export function WaagerechtRollen({
  children, className, schrittAnteil = 0.8,
}: {
  children: React.ReactNode
  className?: string
  /** Wie viel einer Breite ein Pfeilklick rollt. */
  schrittAnteil?: number
}) {
  const bahn = useRef<HTMLDivElement>(null)
  const [links, setLinks] = useState(false)
  const [rechts, setRechts] = useState(false)

  const messen = useCallback(() => {
    const e = bahn.current
    if (!e) return
    // Ein Pixel Spielraum: Browser runden die Rollposition unterschiedlich,
    // und ohne diesen Rand bliebe der rechte Pfeil am Ende sichtbar stehen.
    setLinks(e.scrollLeft > 1)
    setRechts(e.scrollLeft + e.clientWidth < e.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const e = bahn.current
    if (!e) return
    messen()
    const b = new ResizeObserver(messen)
    b.observe(e)
    // Auch die Kinder: Bilder ändern die Gesamtbreite erst, wenn sie da sind.
    for (const kind of Array.from(e.children)) b.observe(kind)
    return () => b.disconnect()
  }, [messen, children])

  function rollen(richtung: -1 | 1) {
    const e = bahn.current
    if (!e) return
    const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    e.scrollBy({ left: richtung * e.clientWidth * schrittAnteil,
                 behavior: ruhig ? 'auto' : 'smooth' })
  }

  /**
   * Das Mausrad rollt waagerecht — aber nur, solange es hier noch weitergeht.
   *
   * Ohne diese Bedingung bliebe die Seite am Ende der Reihe stehen: Wir hätten
   * das Ereignis abgefangen und nichts damit getan. Am Anfang und am Ende
   * gehört das Rad wieder der Seite.
   */
  function amRad(e: React.WheelEvent<HTMLDivElement>) {
    const b = bahn.current
    if (!b) return
    // Wer schon waagerecht rollt (Trackpad, Neigerad), braucht uns nicht.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
    const kannLinks = e.deltaY < 0 && b.scrollLeft > 0
    const kannRechts = e.deltaY > 0 && b.scrollLeft + b.clientWidth < b.scrollWidth - 1
    if (!kannLinks && !kannRechts) return
    e.preventDefault()
    b.scrollLeft += e.deltaY
  }

  return (
    <div className="group/rollen relative">
      <div
        ref={bahn}
        onScroll={messen}
        onWheel={amRad}
        className={cn('ohne-rollbalken flex gap-3 overflow-x-auto', className)}
      >
        {children}
      </div>

      {([['links', links, -1], ['rechts', rechts, 1]] as const).map(([seite, sichtbar, richtung]) => (
        sichtbar ? (
          <button
            key={seite}
            type="button"
            onClick={() => rollen(richtung)}
            aria-label={seite === 'links' ? 'Nach links' : 'Nach rechts'}
            className={cn(
              // Über der Reihe, halb transparent, und erst beim Zeigen ganz da:
              // Die Reihe soll ruhig aussehen, solange man sie nur ansieht.
              'absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center',
              'rounded-full border border-[rgba(150,185,220,0.28)] bg-[rgba(12,18,24,0.82)]',
              'text-foreground backdrop-blur transition-opacity',
              'opacity-0 group-hover/rollen:opacity-100 focus-visible:opacity-100',
              seite === 'links' ? 'left-1' : 'right-1',
            )}
          >
            {seite === 'links'
              ? <ChevronLeft className="h-5 w-5" />
              : <ChevronRight className="h-5 w-5" />}
          </button>
        ) : null
      ))}
    </div>
  )
}
