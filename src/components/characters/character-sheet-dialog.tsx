'use client'

import { useState } from 'react'
import { Copy, Check, ChevronLeft, Sparkles, User, ImagePlus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Character } from '@/hooks/use-characters'
import { cn } from '@/lib/utils'
import { PromptToImageDialog } from '@/components/prompts/prompt-to-image-dialog'

// ── Sheet types ───────────────────────────────────────────────────────────────

export type SheetType = 'kopf' | 'ausdruecke' | 'koerper' | 'gesichtsdetails' | 'referenzsheet'
type Gender = 'woman' | 'man'

const SHEET_TYPES: { id: SheetType; label: string; icon: string; description: string; views: string[] }[] = [
  {
    id: 'kopf',
    label: 'Kopf-Sheet',
    icon: '🧑',
    description: 'Gesicht aus allen Perspektiven',
    views: ['Front', '3/4 Links', 'Profil Links', '3/4 Rechts', 'Profil Rechts'],
  },
  {
    id: 'ausdruecke',
    label: 'Ausdrücke-Sheet',
    icon: '😊',
    description: 'Mimik-Varianten für Konsistenz',
    views: ['Neutral', 'Lächeln', 'Breites Lächeln', 'Nachdenklich', 'Selbstbewusst'],
  },
  {
    id: 'koerper',
    label: 'Körper-Sheet',
    icon: '🧍',
    description: 'Ganzkörper aus mehreren Ansichten',
    views: ['Front', '3/4 Links', 'Profil Links', 'Rücken'],
  },
  {
    id: 'gesichtsdetails',
    label: 'Gesichtsdetails-Sheet',
    icon: '🔍',
    description: 'Nahaufnahmen einzelner Gesichtsmerkmale',
    views: ['Augen', 'Augenbrauen', 'Nase', 'Lippen', 'Kieferlinie'],
  },
  {
    // Marks meistgebrauchtes Blatt (PROJ-48). Es steht hier auch EINZELN in der
    // Liste und nicht nur am Ende der Referenzkette: Wer Kopf und Körper schon
    // hat, will das dritte Blatt nachziehen können, ohne die ganze Kette
    // durchzulaufen.
    id: 'referenzsheet',
    label: 'Referenzsheet',
    icon: '🪪',
    description: 'Großer 3/4-Kopf, Körper vorne ohne Kopf, Körper hinten',
    views: ['3/4 Kopf groß', 'Körper vorne (kopflos)', 'Körper hinten'],
  },
]

// ── Fixed prompts ────────────────────────────────────────────────────────────

export const KOPF_PROMPT = `Using @image1-3 as the reference character, create a professional facial features reference sheet.

Preserve exact facial structure and appearance. Do not modify or reinterpret any facial feature.

The sheet contains exactly five panels, arranged in a single horizontal row — nothing above or below, no second row, no grid:
- Front-facing headshot
- 3/4 left view
- Left profile view
- 3/4 right view
- Right profile view

CRITICAL RULE: each of these five views appears exactly ONCE. Do not repeat the sequence, do not duplicate the row, do not add a second set of the same views anywhere on the sheet.

Use neutral facial expressions throughout.

Style requirements:
- Photorealistic
- Studio lighting
- Clean white background
- Ultra-sharp details
- High-resolution facial close-ups
- Consistent lighting in every image
- No makeup changes
- No accessories
- No artistic filters
- No beauty retouching
- No background distractions

The goal is to create a detailed facial reference sheet that accurately documents every important facial feature for future image generation consistency.`

function ausdrueckePrompt(gender: Gender): string {
  return `Using @image1 as the reference character, create a professional expression reference sheet.

Preserve exact facial structure, facial features, skin tone, hairstyle, hair color, eye color, and overall appearance. Do not modify or reinterpret the character in any way.

The sheet contains exactly five panels, arranged in a single horizontal row — nothing above or below, no second row, no grid:
- Neutral expression
- Natural smile
- Big smile
- Thoughtful expression
- Confident expression

CRITICAL RULE: each of these five expressions appears exactly ONCE. Do not repeat the sequence, do not duplicate the row, do not add a second set of the same expressions anywhere on the sheet.

Ensure that every expression still clearly looks like the same ${gender}. Maintain consistency in facial proportions, eye shape, nose shape, lip shape, and overall facial structure.

Style requirements:
- Photorealistic
- Professional studio photography
- Clean white background
- Consistent studio lighting
- Sharp focus
- High detail
- Symmetrical layout
- Natural expressions
- No exaggerated emotions
- No artistic effects
- No accessories
- No distracting elements

The goal is to create a detailed expression reference sheet that helps maintain consistency when generating future lifestyle, fitness, and influencer images.`
}

export const KOERPER_PROMPT = `Using @image1-3 as the reference character, create a professional full-body character reference sheet.

Preserve exact facial features, body proportions, skin tone, hairstyle, hair color, and overall appearance. Do not redesign, alter, or reinterpret the character in any way.

The sheet contains exactly four panels, arranged in a single horizontal row — nothing above or below, no second row, no grid:
- Full-body front view
- Full-body 3/4 left view
- Full-body left side profile
- Full-body back view

CRITICAL RULE: each of these four views appears exactly ONCE. Do not repeat the sequence, do not duplicate the row, do not add a second set of the same views anywhere on the sheet.

Use the exact same outfit, hairstyle, and styling in every view.

The person should be standing naturally with arms relaxed at the sides and a neutral expression.

Style requirements:
- Photorealistic
- Studio-quality reference sheet
- Clean white background
- Professional even lighting
- Sharp focus
- High detail
- Symmetrical layout
- Consistent scale across all views
- No artistic effects
- No dramatic posing
- No props
- No background elements
- Character centered in each frame

The goal is to create a clear full-body reference sheet that can be used to maintain consistency across future image generations.

CLOTHING — neutral, but the body must stay readable:
- Plain, unpatterned, close-fitting garments in a single neutral tone (light grey or off-white)
- Fitted short sleeves and fitted shorts, plain shoes
- The clothing must NOT hide the body proportions: shoulder width, waist, hip width, limb length and build must remain clearly recognisable
- No logos, prints, patterns, jewellery or accessories

LIGHTING — flat and shadow-free:
- Even, diffuse light from the front, no directional key light
- NO cast shadows on the background, NO shadow pooling under the feet
- No dramatic modelling, no rim light, no vignetting`

/**
 * Das dritte Referenzbild — Marks meistgebrauchtes, und es gab es noch nicht.
 *
 * Seine Beschreibung vom 03.09.2026: „Ein großes Kopfbild von leicht schräg
 * vorne, also so drei Viertel vorne, sodass man eine Seite auch ein wenig
 * sieht. Und daneben den Körper von vorne komplett ohne Kopf. Daneben noch ein
 * Körperbild von hinten. Sodass mit einem Referenzbild alles abgedeckt ist.
 * Man den Kopf aber nur einmal in groß sieht, sodass die KI nicht
 * durcheinanderkommt."
 *
 * DER KOPFLOSE KÖRPER IST DER KERN und keine Marotte. Ein Blatt, auf dem
 * dasselbe Gesicht dreimal klein auftaucht, gibt dem Bildmodell drei
 * widersprüchliche Vorlagen desselben Gesichts — es mischt sie. Genau einmal
 * groß, sonst gar nicht: Dann weiß es, welches Gesicht gemeint ist.
 */
export const REFERENZSHEET_PROMPT = `Using @image1 and @image2 as the reference character, create ONE single combined reference sheet.

The sheet contains exactly three panels side by side, left to right:

PANEL 1 (leftmost, LARGE — roughly half the total width):
- Head and shoulders only, in a three-quarter front view turned slightly to one side so that one cheek and the side of the face are partly visible
- Large and sharp: this is the only place in the entire sheet where the face appears
- Neutral expression, eyes to camera

PANEL 2 (middle):
- Full body from the front, standing straight, arms relaxed at the sides
- CROPPED AT THE NECK — the head must NOT be visible in this panel at all
- Body proportions clearly readable: shoulder width, waist, hips, limb length and build

PANEL 3 (rightmost):
- Full body from behind, standing straight, arms relaxed at the sides
- The back of the head may be visible, but no face

CRITICAL RULE: the face appears exactly ONCE, in panel 1. Panels 2 and 3 must not show it. Do not add any extra small head shots, insets or thumbnails anywhere on the sheet.

Preserve exact facial features, body proportions, skin tone, hairstyle, hair colour and overall appearance from the references. Do not redesign or reinterpret the character.

CLOTHING — neutral, but the body must stay readable:
- Plain, unpatterned, close-fitting garments in a single neutral tone (light grey or off-white)
- Fitted short sleeves and fitted shorts, plain shoes
- The clothing must NOT hide the body proportions
- No logos, prints, patterns, jewellery or accessories

LIGHTING — flat and shadow-free:
- Even, diffuse light from the front, no directional key light
- NO cast shadows on the background, NO shadow pooling under the feet
- No dramatic modelling, no rim light, no vignetting

Style requirements:
- Photorealistic
- Clean white background
- Consistent scale and identical lighting across all three panels
- Sharp focus, high detail
- No artistic effects, no props, no background elements, no text or labels

The goal is one single sheet that covers face, front and back in a form that can be handed to an image model as the only character reference.`

const GESICHTSDETAILS_PROMPT = `Using @image1-3 as the reference character, create a professional details reference sheet.

Preserve exact appearance and facial structure. Do not redesign, alter, or reinterpret any feature.

The sheet contains exactly five panels, arranged in a single horizontal row — nothing above or below, no second row, no grid:
- Eyes
- Eyebrows
- Nose
- Lips
- Jawline and face shape

CRITICAL RULE: each of these five details appears exactly ONCE. Do not repeat the sequence, do not duplicate the row, do not add a second set of the same details anywhere on the sheet.

Each detail should be clearly visible and given enough space to capture fine characteristics accurately.

Style requirements:
- Photorealistic
- Professional studio photography
- Clean white background
- Consistent studio lighting
- Ultra-sharp focus
- High detail
- High-resolution close-ups
- No artistic effects
- No accessories
- No beauty retouching
- No distracting elements

The goal is to create a highly detailed appearance reference sheet that accurately documents the most important facial characteristics of the woman for maximum consistency in future image generations.`

function getPrompt(type: SheetType, gender: Gender): string {
  if (type === 'kopf') return KOPF_PROMPT
  if (type === 'ausdruecke') return ausdrueckePrompt(gender)
  if (type === 'gesichtsdetails') return GESICHTSDETAILS_PROMPT
  if (type === 'referenzsheet') return REFERENZSHEET_PROMPT
  return KOERPER_PROMPT
}

// ── Dialog component ──────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  character: Character
}

export function CharacterSheetDialog({ open, onClose, character }: Props) {
  const [step, setStep]         = useState<'choose' | 'prompt'>('choose')
  const [selected, setSelected] = useState<SheetType | null>(null)
  const [gender, setGender]     = useState<Gender>('woman')
  const [copied, setCopied]     = useState(false)
  const [bildDialogOffen, setBildDialogOffen] = useState(false)

  const prompt = selected ? getPrompt(selected, gender) : ''

  function handleSelect(type: SheetType) {
    setSelected(type)
    setStep('prompt')
    setCopied(false)
  }

  function handleBack() {
    setStep('choose')
    setSelected(null)
    setCopied(false)
  }

  function handleClose() {
    onClose()
    setTimeout(() => { setStep('choose'); setSelected(null); setCopied(false) }, 300)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedType = SHEET_TYPES.find(t => t.id === selected)

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Sheet erstellen
            <span className="text-muted-foreground font-normal text-sm ml-1 truncate">— {character.name}</span>
          </DialogTitle>
        </DialogHeader>

        {step === 'choose' ? (
          /* ── Step 1: Type selection ── */
          <div className="space-y-2.5 pt-1">
            <p className="text-xs text-muted-foreground">
              Wähle den Sheet-Typ. Der Prompt ist fest definiert — du musst nur noch die Referenzbilder anhängen.
            </p>

            {/* Character summary badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
              <div className="w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0">
                {character.cover_image_url ? (
                  <img src={character.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{character.name}</p>
                {character.description && (
                  <p className="text-[10px] text-muted-foreground/60 truncate">{character.description}</p>
                )}
              </div>
            </div>

            {SHEET_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => handleSelect(type.id)}
                className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card/60 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all text-left group"
              >
                <span className="text-2xl leading-none shrink-0 mt-0.5">{type.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold group-hover:text-violet-300 transition-colors">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {type.views.map(v => (
                      <span key={v} className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">{v}</span>
                    ))}
                  </div>
                </div>
                <span className="text-muted-foreground/30 group-hover:text-violet-400 transition-colors text-lg leading-none mt-0.5">›</span>
              </button>
            ))}
          </div>
        ) : (
          /* ── Step 2: Generated prompt ── */
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Zurück
              </button>
              <span className="text-[11px] text-muted-foreground/50">·</span>
              <span className="text-xs font-medium">{selectedType?.icon} {selectedType?.label}</span>
            </div>

            {selected === 'ausdruecke' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Person:</span>
                <div className="flex rounded-lg border border-border/60 overflow-hidden">
                  <button
                    onClick={() => setGender('woman')}
                    className={cn('px-2.5 py-1 text-[11px] transition-colors', gender === 'woman' ? 'bg-violet-600 text-white' : 'hover:bg-muted/50')}
                  >
                    Frau
                  </button>
                  <button
                    onClick={() => setGender('man')}
                    className={cn('px-2.5 py-1 text-[11px] transition-colors', gender === 'man' ? 'bg-violet-600 text-white' : 'hover:bg-muted/50')}
                  >
                    Mann
                  </button>
                </div>
              </div>
            )}

            {/* Prompt box */}
            <div className="relative">
              <pre className="text-[11px] leading-relaxed bg-muted/30 border border-border/50 rounded-xl p-4 whitespace-pre-wrap font-mono text-foreground/80 max-h-72 overflow-y-auto">
                {prompt}
              </pre>
              <button
                onClick={handleCopy}
                className={cn(
                  'absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                  copied
                    ? 'bg-emerald-600/90 text-white'
                    : 'bg-black/50 hover:bg-black/70 text-white/80 hover:text-white'
                )}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Kopiert!' : 'Kopieren'}
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
              Entweder direkt hier erzeugen lassen — der Charakter ist dann schon
              vorausgewählt — oder kopieren und in ein anderes Werkzeug geben.
              Das fertige Sheet kannst du anschließend als Variante bei diesem Charakter speichern.
            </p>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500"
              onClick={() => setBildDialogOffen(true)}
            >
              <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
              Bild daraus erzeugen
            </Button>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopy}
                disabled={copied}
              >
                {copied ? (
                  <><Check className="mr-1.5 h-3.5 w-3.5" />Prompt kopiert!</>
                ) : (
                  <><Copy className="mr-1.5 h-3.5 w-3.5" />Prompt kopieren</>
                )}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Schließen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Erst mounten, wenn gebraucht: Der Dialog laedt drei Bibliotheken,
          das waeren sonst drei Abfragen bei jedem geoeffneten Prompt. */}
      {bildDialogOffen && <PromptToImageDialog
        isOpen
        onClose={() => setBildDialogOffen(false)}
        prompt={prompt}
        titel={`${character.name} — Sheet`}
        vorauswahlCharakter={character}
        // Sheets beschreiben ausdrücklich einen neutralen Hintergrund —
        // eine Location würde dem Prompt widersprechen. Outfit dagegen ist hier
        // gewollt.
        rollen={['character', 'outfit']}
      />}
    </Dialog>
  )
}
