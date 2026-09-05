'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ein Bild, das die kleine Vorschau lädt statt des Originals (PROJ-68).
 *
 * WARUM ES DAS GIBT: Mark am 05.09.2026: „Mir ist nur aufgefallen, dass alle
 * Bilder immer sehr lange brauchen zu laden. Werden da immer die Originalbilder
 * geladen?"
 *
 * Ja, wurden sie. Im Speicher liegen 661 PNG mit zusammen 1709 MB; das größte
 * ist 38 MB und braucht 35 Sekunden. In einem Raster mit achtzig Kacheln à 132
 * Pixel lud der Browser damit Hunderte Megabyte, um Daumennägel zu zeigen.
 *
 * Der Arbeiter legt neben jedes Bild eine 480px breite Vorschau unter
 * `vorschau/<pfad>.jpg` (`worker/src/vorschaubilder.mts`). Dieses Bauteil
 * benutzt sie — und fällt auf das Original zurück, wenn es sie nicht gibt.
 *
 * DER RÜCKFALL IST KEINE ZIERDE: Die Vorschauen entstehen in einem Lauf über
 * den ganzen Speicher. Zwischen einem neu hochgeladenen Bild und seiner
 * Vorschau liegt Zeit, und ein Raster mit Löchern wäre schlimmer als eines,
 * das langsam lädt.
 */

/** Baut aus einer öffentlichen Speicheradresse die Adresse der Vorschau. */
export function vorschauAdresse(url: string): string | null {
  // .../storage/v1/object/public/<eimer>/<pfad>   →
  // .../storage/v1/object/public/<eimer>/vorschau/<pfad>.jpg
  const m = url.match(/^(.*\/storage\/v1\/object\/public\/[^/]+\/)(.+)$/)
  if (!m) return null
  const [, basis, pfad] = m
  // Ein bereits abgeschnittener Fragezeichen-Teil (Zwischenspeicher-Brecher)
  // gehört an die Vorschau angehängt, nicht in den Dateinamen.
  const [reinerPfad, frage] = pfad.split('?')
  if (reinerPfad.startsWith('vorschau/')) return url
  return `${basis}vorschau/${reinerPfad}.jpg${frage ? `?${frage}` : ''}`
}

export function Vorschaubild({
  src, alt, className, loading = 'lazy', onClick, onFehler,
}: {
  src: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void
  /**
   * Wird gerufen, wenn AUCH das Original nicht lädt — nicht schon, wenn nur
   * die Vorschau fehlt. Wer hier einen Ersatz zeichnet, soll ihn erst zeigen,
   * wenn wirklich kein Bild da ist.
   */
  onFehler?: () => void
}) {
  const vorschau = vorschauAdresse(src)
  const [quelle, setQuelle] = useState(vorschau ?? src)

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={quelle}
      alt={alt}
      loading={loading}
      decoding="async"
      onClick={onClick}
      onError={() => {
        if (quelle !== src) setQuelle(src)   // erst das Original versuchen
        else onFehler?.()                    // und erst dann aufgeben
      }}
      className={cn(className)}
    />
  )
}
