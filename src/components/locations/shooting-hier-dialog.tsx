'use client'

import { useState } from 'react'
import { Camera, UserRound, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCharacters } from '@/hooks/use-characters'
import { useOutfits } from '@/hooks/use-outfits'
import { AssetPickerDialog } from '@/components/prompts/asset-picker-dialog'
import { ShootingKetteButton } from '@/components/shooting-kette-button'
import { Vorschaubild } from '@/components/vorschaubild'
import type { Referenz } from '@/lib/image-generation'
import type { Scene } from '@/lib/szene-prompt'
import type { Location } from '@/hooks/use-locations'
import type { Character } from '@/hooks/use-characters'
import type { Outfit } from '@/hooks/use-outfits'

/**
 * „Shooting hier" — der zweite Einstieg in die Shooting-Kette (PROJ-75).
 *
 * WARUM ES IHN NEBEN DEM SCENE BUILDER GIBT: Mark auf die Frage, wo die Kette
 * starten soll: „werden mir beide Wege recht." Der Unterschied ist der
 * Ausgangspunkt. Im Scene Builder baut er eine Szene und wählt am Ende einen
 * Ort. Hier ist der ORT schon da — er steht ja gerade davor — und es fehlt nur
 * noch, wer dort fotografiert wird.
 *
 * WAS HIER BEWUSST FEHLT: Licht, Wetter, Kamera, Stil. Wer das braucht, nimmt
 * den Scene Builder; dort steht es ohnehin. Dieser Weg ist der kurze, und ein
 * kurzer Weg mit zwanzig Feldern wäre keiner mehr.
 */
export function ShootingHierDialog({
  open, onClose, location,
}: {
  open: boolean
  onClose: () => void
  location: Location
}) {
  const { characters } = useCharacters()
  const { outfits } = useOutfits()
  const [charakter, setCharakter] = useState<Character | null>(null)
  const [outfit, setOutfit] = useState<Outfit | null>(null)
  const [picker, setPicker] = useState<'character' | 'outfit' | null>(null)

  /**
   * EINE MINIMALE SZENE. `baueShooting` erwartet eine `Scene` — hier wird sie
   * aus dem gebaut, was dieser Weg kennt. Alles andere bleibt null; der
   * Promptbau lässt weg, was nicht gesetzt ist, statt Platzhalter zu erfinden.
   */
  const scene = {
    scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
    light_source: null, light_style: null, light_modifiers: [],
    shot_type: null, camera_angle: null, lens: null, depth_of_field: null,
    aspect_ratio: null, character: charakter, outfit, location,
    pose: null, expression: null, camera: null, style: null, grading: null,
    background: null, ground: null, wind: null,
  } as unknown as Scene

  const referenzen: Referenz[] = [
    ...(charakter?.cover_image_url
      ? [{ url: charakter.cover_image_url, rolle: 'character' as const }] : []),
    ...(outfit?.cover_image_url
      ? [{ url: outfit.cover_image_url, rolle: 'outfit' as const }] : []),
    ...(location.cover_image_url
      ? [{ url: location.cover_image_url, rolle: 'location' as const }] : []),
  ]

  function handleClose() {
    setCharakter(null); setOutfit(null); setPicker(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Shooting hier
            <span className="text-sm font-normal text-muted-foreground">
              — {location.name}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Waehler
            label="Wer wird fotografiert?"
            gewaehlt={charakter}
            leerText="Charakter wählen …"
            icon={<UserRound className="h-3.5 w-3.5" />}
            onOeffnen={() => setPicker('character')}
            onLeeren={() => setCharakter(null)}
          />

          <Waehler
            label="Was trägt die Person?"
            gewaehlt={outfit}
            leerText="Outfit wählen (kann auch leer bleiben) …"
            icon={<UserRound className="h-3.5 w-3.5" />}
            onOeffnen={() => setPicker('outfit')}
            onLeeren={() => setOutfit(null)}
          />

          <ShootingKetteButton
            scene={scene}
            referenzen={referenzen}
            aspectRatio={null}
            sceneMeta={{ location_id: location.id }}
            szenenName={location.name}
          />
        </div>
      </DialogContent>

      {picker && (
        <AssetPickerDialog
          isOpen
          onClose={() => setPicker(null)}
          rolle={picker}
          assets={picker === 'character' ? characters : outfits}
          onFertig={(asset) => {
            if (picker === 'character') setCharakter(asset as unknown as Character)
            else setOutfit(asset as unknown as Outfit)
            setPicker(null)
          }}
        />
      )}
    </Dialog>
  )
}

/** Eine Zeile: Beschriftung, gewähltes Ding mit Bild, oder ein Knopf. */
function Waehler({
  label, gewaehlt, leerText, icon, onOeffnen, onLeeren,
}: {
  label: string
  gewaehlt: { name: string; cover_image_url?: string | null } | null
  leerText: string
  icon: React.ReactNode
  onOeffnen: () => void
  onLeeren: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[13px] font-medium">{label}</div>
      {gewaehlt ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 p-2">
          <Vorschaubild
            src={gewaehlt.cover_image_url}
            alt=""
            className="h-10 w-10 rounded-lg object-cover"
          />
          <span className="flex-1 text-[13px]">{gewaehlt.name}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onLeeren}>
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Auswahl entfernen</span>
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="w-full justify-start" onClick={onOeffnen}>
          {icon}
          <span className="ml-1.5 text-[13px]">{leerText}</span>
        </Button>
      )}
    </div>
  )
}
