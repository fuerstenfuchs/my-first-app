'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ein Bild, das die kleine Vorschau lädt statt des Originals (PROJ-68/70).
 *
 * WARUM ES DAS GIBT: Mark am 05.09.2026: „Mir ist nur aufgefallen, dass alle
 * Bilder immer sehr lange brauchen zu laden. Werden da immer die Originalbilder
 * geladen?"
 *
 * Ja, wurden sie. Im Speicher lagen 661 PNG mit zusammen 1709 MB; das größte
 * war 38 MB und brauchte 35 Sekunden. In einem Raster mit achtzig Kacheln à
 * 132 Pixel lud der Browser damit Hunderte Megabyte, um Daumennägel zu zeigen.
 *
 * Der Arbeiter legt neben jedes Bild eine 480px breite Vorschau unter
 * `vorschau/<pfad>.jpg` (`worker/src/vorschaubilder.mts`). Dieses Bauteil
 * benutzt sie — und fällt auf das Original zurück, wenn es sie nicht gibt.
 *
 * DER RÜCKFALL IST KEINE ZIERDE: Die Vorschauen entstehen in einem Lauf über
 * den ganzen Speicher. Zwischen einem neu hochgeladenen Bild und seiner
 * Vorschau liegt Zeit, und ein Raster mit Löchern wäre schlimmer als eines,
 * das langsam lädt.
 *
 * ── WARUM ES ALLE PROPS DURCHREICHT ─────────────────────────────────────────
 *
 * Die erste Fassung nahm nur eine Handvoll Eigenschaften an. Beim Umbau ging
 * dadurch stillschweigend ein `onClick` verloren — die Lupe im Raster tat
 * nichts mehr, und im Code war nichts zu sehen, weil ein nicht angenommenes
 * Prop einfach verschwindet.
 *
 * Deshalb ist dies jetzt ein ECHTER Eins-zu-eins-Ersatz für `<img>`: Alles,
 * was ein `<img>` annimmt, nimmt es auch an und gibt es weiter. `<img …>` wird
 * zu `<Vorschaubild …>`, sonst ändert sich an der Aufrufstelle nichts.
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

type Eigenschaften = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | null | undefined
  /**
   * Wird gerufen, wenn AUCH das Original nicht lädt — nicht schon, wenn nur
   * die Vorschau fehlt. Wer hier einen Ersatz zeichnet, soll ihn erst zeigen,
   * wenn wirklich kein Bild da ist.
   */
  onFehler?: () => void
  /**
   * Das Original laden, nicht die Vorschau. Für die Lupe und überall dort, wo
   * Mark ein Bild wirklich beurteilen will — die Vorschau ist 480px breit und
   * auf einem großen Bildschirm sichtbar weich.
   */
  gross?: boolean
}

export function Vorschaubild({
  src, className, loading = 'lazy', onFehler, gross, onError, ...rest
}: Eigenschaften) {
  const vorschau = gross || !src ? null : vorschauAdresse(src)
  const [quelle, setQuelle] = useState(vorschau ?? src ?? '')

  // Wechselt die Quelle von außen (anderes Bild in derselben Kachel), muss der
  // Zustand mitgehen — sonst zeigte die Kachel weiter das alte Bild. Der
  // Schlüssel dafür ist die gewünschte Adresse, nicht die gerade geladene.
  const gewuenscht = vorschau ?? src ?? ''
  const [zuletzt, setZuletzt] = useState(gewuenscht)
  if (zuletzt !== gewuenscht) {
    setZuletzt(gewuenscht)
    setQuelle(gewuenscht)
  }

  if (!src) return null

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={quelle}
      loading={loading}
      decoding="async"
      onError={e => {
        if (quelle !== src) setQuelle(src)   // erst das Original versuchen
        else { onFehler?.(); onError?.(e) }  // und erst dann aufgeben
      }}
      className={cn(className)}
    />
  )
}
