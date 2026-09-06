'use client'

import { useRef, useState } from 'react'
import { Loader2, Plus, Users, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AssetPickerDialog } from '@/components/prompts/asset-picker-dialog'
import { Vorschaubild } from '@/components/vorschaubild'
import { useCharacters, type Character } from '@/hooks/use-characters'
import { useOutfits, type Outfit } from '@/hooks/use-outfits'
import { useImageJobs } from '@/hooks/use-image-jobs'
import { groesseFuerFormat, promptFuerAuftrag } from '@/lib/image-generation'
import { createClient } from '@/lib/supabase'
import type { AblageZiel } from '@/lib/ablage-auftrag'
import {
  gruppenPrompt, gruppenReferenzen, gruppenZuordnung, warnung,
  GRUPPE_MAX, GRUPPE_MIN, type Beteiligt,
} from '@/lib/gruppen-referenz'

/**
 * „Gruppenbild" — ein Referenzblatt mit mehreren Personen (PROJ-78).
 *
 * Mark will Paar- und Gruppenshootings. Der naheliegende Weg — mehrere
 * Personenfotos an dasselbe Bild hängen — scheitert an der Zuordnung: Nichts
 * verbindet das dritte Referenzbild mit der ersten Person, und die Jacke
 * landet bei der Falschen.
 *
 * Dieses Blatt löst das einmal. Danach ist die Zuordnung im BILD festgehalten,
 * und jede spätere Aufnahme braucht nur noch dieses eine Referenzbild.
 *
 * ES IST EIN VERSUCH, UND DAS STEHT AUCH DA. Mark: „Ja, auch mal den Weg b.
 * Und dann schauen wir, was dabei rauskommt … Aber probieren wir erst mal."
 * Die Kette kommt erst, wenn das Blatt trägt.
 */
export function GruppenReferenzDialog({
  open, onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { characters } = useCharacters()
  const { outfits } = useOutfits()
  const { anlegen } = useImageJobs(false)
  const [leute, setLeute] = useState<Beteiligt[]>([])
  const [picker, setPicker] = useState<{ art: 'character' | 'outfit'; index: number } | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  /** Sperre im Ref: `setLaeuft` wirkt erst beim nächsten Rendern. */
  const laeuftRef = useRef(false)

  const genug = leute.length >= GRUPPE_MIN
  const hinweis = warnung(leute.length)

  async function handleErzeugen() {
    if (laeuftRef.current || !genug) return
    laeuftRef.current = true
    setLaeuft(true)
    try {
      const refs = gruppenReferenzen(leute)
      const zuordnung = gruppenZuordnung(leute)
      const zielGroesse = groesseFuerFormat('landscape_16_9')

      /*
        DIE GRUPPE WIRD EIN CHARAKTER (PROJ-79).

        Mark: „Sollen wir bei Charakter noch einen eigenen anlegen, der dann
        Gruppe heißt oder so?" — ja, und zwar als GEWOEHNLICHER Charakter, nicht
        als eigener Bereich. Der Grund ist nicht Bequemlichkeit: Ein Charakter
        taucht ueberall auf, wo man einen waehlen kann — Scene Builder,
        Shooting-Kette, Referenzrolle. Ein eigener Bereich „Gruppen" muesste an
        jeder dieser Stellen nachgebaut werden, und beim naechsten Umbau haette
        man zwei Sorten Person, von denen eine die Haelfte nicht kann.

        Das Schlagwort `gruppe` macht sie wiederfindbar, ohne sie zu trennen.

        ANGELEGT WIRD JETZT, nicht nach dem Ergebnis: Der Waechter muss beim
        Ablegen wissen, wohin. Der Eintrag steht also schon in der Liste,
        waehrend das Blatt noch laeuft — und bekommt sein Titelbild, sobald es
        fertig ist.
      */
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const namen = leute.map(l => l.charakter.name)
      const { data: gruppe } = await supabase
        .from('characters')
        .insert({
          user_id: user?.id,
          name: namen.join(' + '),
          description: `Gruppenbild: ${namen.join(', ')}`,
          tags: ['gruppe'],
        })
        .select('id, name')
        .single()

      let ablage: AblageZiel | null = null
      if (gruppe?.id) {
        const { data: variante } = await supabase
          .from('character_variants')
          .insert({
            character_id: gruppe.id, user_id: user?.id,
            name: 'Gruppenbild', description: 'Das Referenzblatt dieser Gruppe',
          })
          .select('id')
          .single()
        ablage = {
          baustein: 'charaktere',
          parentId: gruppe.id as string,
          parentName: gruppe.name as string,
          variantId: (variante?.id as string) ?? null,
          variantName: 'Gruppenbild',
          // Ein frischer Eintrag ohne Bild waere ein leerer Kasten in der Liste.
          alsTitelbild: true,
        }
      } else {
        toast.error('Die Gruppe konnte nicht angelegt werden — das Blatt wird ' +
                    'trotzdem erzeugt und landet in der Warteschlange.')
      }

      const job = await anlegen({
        // DIE BENANNTEN ZEILEN SIND DER GANZE PUNKT. Ohne sie stünde da
        // „Image 2 = OUTFIT" ohne Bezug zu Person 1.
        prompt: promptFuerAuftrag(gruppenPrompt(leute), 'landscape_16_9',
                                  refs.map(r => r.rolle), zuordnung),
        model: 'gpt-image-2',
        size: zielGroesse.size,
        // QUERFORMAT, weil die Leute nebeneinander stehen. Hochkant müsste das
        // Modell sie stapeln oder beschneiden — beides macht das Blatt
        // unbrauchbar.
        aspect_ratio: 'landscape_16_9',
        variants: 1,
        ziel_klasse: null,
        reference_urls: refs.map(r => r.url),
        reference_roles: refs.map(r => r.rolle),
        scene_meta: {
          name: `Gruppenbild — ${leute.map(l => l.charakter.name).join(', ')}`,
          herkunft: 'gruppen-referenz',
          personen: leute.map(l => ({
            charakter_id: l.charakter.id, outfit_id: l.outfit?.id ?? null,
          })),
          ...(ablage ? { ablage } : {}),
        },
      })
      if (job) {
        toast.success(
          ablage
            ? `„${ablage.parentName}" angelegt — das Blatt landet dort, sobald es fertig ist.`
            : 'Gruppenbild eingereiht — es steht in der Warteschlange.',
          { duration: 8_000 },
        )
        onClose()
      }
    } catch (e) {
      toast.error(`Fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      laeuftRef.current = false
      setLaeuft(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="flex max-h-[85svh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Gruppenbild
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Zwei Reihen: oben alle nebeneinander in voller Größe, darunter die
            Gesichter groß. Die untere Reihe ist der Zweck — in der
            Ganzkörperreihe ist ein Kopf rund 115 Pixel hoch, zu wenig, um
            später ein Gesicht zu tragen.
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Die Gruppe wird als eigener Charakter angelegt und steht danach
            überall zur Auswahl — Scene Builder, Shooting-Kette, Referenzbild.
            Das fertige Blatt landet von selbst dort und wird ihr Titelbild.
          </p>

          <div className="space-y-2">
            {leute.map((l, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border/60 p-2">
                <span className="w-5 shrink-0 text-center text-[13px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <Vorschaubild
                  src={l.charakter.cover_image_url} alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{l.charakter.name}</p>
                  <button
                    className="truncate text-[12px] text-muted-foreground hover:text-primary"
                    onClick={() => setPicker({ art: 'outfit', index: i })}
                  >
                    {l.outfit ? l.outfit.name : 'Kleidung wählen (sonst wie im Charakterbild)'}
                  </button>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => setLeute(v => v.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Entfernen</span>
                </Button>
              </div>
            ))}

            {leute.length < GRUPPE_MAX && (
              <Button
                variant="outline" className="w-full justify-start"
                onClick={() => setPicker({ art: 'character', index: leute.length })}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                <span className="text-[13px]">
                  {leute.length === 0 ? 'Erste Person wählen …' : 'Weitere Person …'}
                </span>
              </Button>
            )}
          </div>

          {/*
            DIE REIHENFOLGE IST NICHT KOSMETIK. Sie bestimmt, wer im Blatt links
            steht — und der Platz in der Reihe ist der Anker, an dem das Modell
            später Person und Kleidung auseinanderhält.
          */}
          {leute.length > 1 && (
            <p className="text-[12px] leading-relaxed text-muted-foreground/70">
              Die Reihenfolge oben ist die Reihenfolge im Bild, von links nach
              rechts. Zum Ändern eine Person entfernen und neu hinzufügen.
            </p>
          )}

          {hinweis && (
            <p className="rounded-lg border-l-2 border-amber-500/60 bg-amber-500/10 px-3 py-2 text-[12.5px] leading-relaxed text-amber-200/90">
              {hinweis}
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-500"
            onClick={handleErzeugen}
            disabled={!genug || laeuft}
          >
            {laeuft
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />wird eingereiht …</>
              : <><Users className="mr-1.5 h-3.5 w-3.5" />Gruppenbild erzeugen</>}
          </Button>
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </div>

        {!genug && (
          <p className="text-[12px] text-muted-foreground/60">
            Mindestens {GRUPPE_MIN} Personen — für eine allein gibt es das
            Charakter-Sheet.
          </p>
        )}
      </DialogContent>

      {picker && (
        <AssetPickerDialog
          isOpen
          onClose={() => setPicker(null)}
          rolle={picker.art}
          assets={picker.art === 'character' ? characters : outfits}
          onFertig={(asset) => {
            if (picker.art === 'character') {
              setLeute(v => [...v, { charakter: asset as unknown as Character, outfit: null }])
            } else {
              setLeute(v => v.map((l, j) =>
                j === picker.index ? { ...l, outfit: asset as unknown as Outfit } : l))
            }
            setPicker(null)
          }}
        />
      )}
    </Dialog>
  )
}
