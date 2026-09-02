'use client'

import { useMemo, useState } from 'react'
import { ImageOff, Images } from 'lucide-react'
import { ImageLightbox } from '@/components/image-lightbox'
import { cn } from '@/lib/utils'

/**
 * Alle Bilder eines Eintrags auf einen Blick — über alle Varianten hinweg.
 *
 * WARUM ES DAS GIBT: Mark am 02.09.2026 — „Ich weiß sowieso nicht, warum das
 * so ist, dass wir Bilder haben und dann nochmal, wenn man auf ein Bild geht,
 * unter Bilder hat. … Man sollte eigentlich schon alle Bilder sehen können,
 * die den jeweiligen Charakter betreffen, ohne dass man immer klicken muss,
 * um zu schauen, ob da noch irgendwelche Unterbilder sind."
 *
 * Die Varianten bleiben, wie sie sind — sie tragen Prompt und Beschreibung und
 * sind der Grund, warum es sie gibt. Was fehlte, war die Übersicht darüber.
 * Deshalb kommt diese Ansicht DAZU und ersetzt nichts: Ein Klick auf ein Bild
 * öffnet es groß, ein Klick auf die Variantenmarke springt in die Variante.
 */

export type VariantenBild = { id: string; url: string }
export type BildVariante = { id: string; name: string; images: VariantenBild[] }

interface Props {
  varianten: BildVariante[]
  /** Springt in eine Variante — dort lässt sich sortieren, löschen, ergänzen. */
  onVariante: (id: string) => void
}

export function AlleVariantenBilder({ varianten, onVariante }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null)

  const bilder = useMemo(
    () => varianten.flatMap(v => v.images.map(b => ({ ...b, variantId: v.id, variantName: v.name }))),
    [varianten],
  )

  if (varianten.length === 0) return null

  return (
    <div className="mt-6 border-t border-border/50 pt-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Images className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Alle Bilder ({bilder.length})
        </h3>
        <span className="text-[11px] text-muted-foreground/70">
          aus {varianten.length} {varianten.length === 1 ? 'Variante' : 'Varianten'}
        </span>
      </div>

      {bilder.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <ImageOff className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            In keiner Variante liegt bisher ein Bild.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
          {bilder.map((b, i) => (
            <div
              key={b.id}
              className="group relative aspect-square overflow-hidden rounded border border-border/40 bg-muted/20"
            >
              <button
                onClick={() => setLightbox(i)}
                className="h-full w-full"
                aria-label={`Bild aus Variante ${b.variantName} groß ansehen`}
              >
                <img
                  src={b.url} alt="" loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                />
              </button>
              {/* Die Marke sagt, wo das Bild herkommt — und bringt einen dorthin. */}
              <button
                onClick={() => onVariante(b.variantId)}
                title={`Zur Variante „${b.variantName}"`}
                className={cn(
                  'absolute bottom-1 left-1 right-1 truncate rounded bg-background/85 px-1.5 py-0.5',
                  'text-left text-[10px] text-foreground backdrop-blur transition hover:bg-background',
                )}
              >
                {b.variantName}
              </button>
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <ImageLightbox
          images={bilder.map(b => ({ url: b.url }))}
          initialIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
