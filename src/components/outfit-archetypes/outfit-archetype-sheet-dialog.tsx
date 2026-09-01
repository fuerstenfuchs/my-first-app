'use client'

import { useState } from 'react'
import { Copy, Check, Sparkles, Shirt } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OutfitArchetype } from '@/hooks/use-outfit-archetypes'

const SHEET_PROMPT = `Create a professional outfit reference sheet of the same outfit from multiple
angles for consistent AI generation.

Outfit: Use the uploaded image as the sole reference for this outfit.
Extract and preserve all visual details exactly as shown: colors, fabric texture,
pattern, cut, fit, layering, footwear, and any accessories or distinctive details.
Do not alter, idealize, or modify the outfit's design in any way.

Layout: Display the same outfit worn by a neutral reference model on a plain
neutral grey studio background. Arrange the layout as follows:

TOP ROW – Two large detail close-ups:
- Front Detail (large): Close-up of the upper garment area showing fabric
  texture, color, pattern, and design details clearly and large.
- Back Detail (large): Close-up of the back of the garment showing texture,
  seams, and design details clearly, same large scale as the front detail.

BOTTOM ROW – Two full outfit views:
- Full Outfit Front: Full-body front view showing the complete outfit from
  head to toe, including footwear and accessories.
- Full Outfit Back: Straight rear view, full outfit visible from head to toe.

Style & Consistency:
- Keep the exact same colors, fabric, cut, footwear, and accessories across
  all four views.
- Use a neutral, faceless or softly blurred-face reference model so the focus
  stays entirely on the outfit, not the person wearing it.
- Clean, balanced studio lighting with soft shadows and realistic material
  and fabric textures.
- Sharp, high-detail presentation suitable as a costume design reference.
- Detail close-ups must be significantly larger and more detailed than the
  full outfit views.

Requirements:
- Neutral grey background only.
- No text, labels, logos, watermarks, props, or extra people.
- Symmetrical, organized layout with equal spacing between views.
- All four views must show the complete intended area — nothing cropped accidentally.

Art Style: Photorealistic and cinematic. Fabric, texture, and materials must
look like high-end fashion production photography. Render with cinematic
depth, natural lighting, and true-to-life proportions.
No cartoon, no anime, no comic book style, no stylization, no illustration.
The result must be indistinguishable from a professional costume design bible.`

interface Props {
  open:    boolean
  onClose: () => void
  item:    OutfitArchetype
}

export function OutfitArchetypeSheetDialog({ open, onClose, item }: Props) {
  const [copied, setCopied] = useState(false)

  function handleClose() {
    onClose()
    setTimeout(() => setCopied(false), 300)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(SHEET_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-teal-400" />
            Sheet erstellen
            <span className="text-muted-foreground font-normal text-sm ml-1 truncate">— {item.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* Archetype summary badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
            <div className="w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0">
              {item.cover_image_url ? (
                <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Shirt className="h-5 w-5 text-muted-foreground/50" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.name}</p>
              {item.short_description && (
                <p className="text-[10px] text-muted-foreground/60 truncate">{item.short_description}</p>
              )}
            </div>
          </div>

          {/* Prompt box */}
          <div className="relative">
            <pre className="text-[11px] leading-relaxed bg-muted/30 border border-border/50 rounded-xl p-4 whitespace-pre-wrap font-mono text-foreground/80 max-h-72 overflow-y-auto">
              {SHEET_PROMPT}
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
            Kopiere diesen Prompt, ziehe ihn zusammen mit einem Referenzbild in dein Bildgenerator-Tool.
            Das fertige Sheet kannst du anschließend hier als Referenzbild bzw. Coverbild einfügen.
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-teal-600 hover:bg-teal-500"
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
      </DialogContent>
    </Dialog>
  )
}
