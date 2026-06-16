'use client'

import { useState } from 'react'
import { Copy, Check, ChevronLeft, Sparkles } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FASHION_CATEGORIES, type FashionAsset, type FashionCategory } from '@/hooks/use-fashion-assets'
import { cn } from '@/lib/utils'

// ── Sheet types ───────────────────────────────────────────────────────────────

type SheetType = 'reference' | 'detail' | 'outfit'

const SHEET_TYPES: { id: SheetType; label: string; icon: string; description: string; views: string[] }[] = [
  {
    id: 'reference',
    label: 'Fashion Reference Sheet',
    icon: '📐',
    description: 'Kleidungsstück aus mehreren Perspektiven',
    views: ['Front', 'Left Side', 'Right Side', 'Back'],
  },
  {
    id: 'detail',
    label: 'Garment Detail Sheet',
    icon: '🔍',
    description: 'Nahaufnahmen aller Details',
    views: ['Stoff', 'Kragen', 'Taschen', 'Knöpfe / Verschlüsse', 'Nähte', 'Saum'],
  },
  {
    id: 'outfit',
    label: 'Outfit Sheet',
    icon: '🧍',
    description: 'Kompletter Look — Ganzkörperdarstellung',
    views: ['Front', 'Side', 'Back'],
  },
]

// ── Category → English label ──────────────────────────────────────────────────

const CATEGORY_EN: Record<FashionCategory, string> = {
  oberteile:       'top / shirt',
  unterteile:      'pants / trousers',
  kleider:         'dress',
  jacken:          'jacket / coat',
  schuhe:          'shoes',
  accessoires:     'accessory',
  kopfbedeckungen: 'hat / headwear',
  sonstiges:       'garment',
}

// ── Prompt generator ──────────────────────────────────────────────────────────

function generatePrompt(type: SheetType, asset: FashionAsset): string {
  const cat  = CATEGORY_EN[asset.category as FashionCategory] ?? 'garment'
  const tags = asset.tags.length > 0 ? asset.tags.join(', ') : null
  const desc = asset.description?.trim() || null

  const metaBlock = [
    `Garment type: ${cat}`,
    desc  ? `Description: ${desc}` : null,
    tags  ? `Style details: ${tags}` : null,
  ].filter(Boolean).join('\n')

  if (type === 'reference') {
    return `Using @image1 as the garment reference.

Create a professional fashion reference sheet for: ${asset.name}

${metaBlock}

Preserve exactly:
- exact garment design and silhouette
- colors and tonal values
- fabric texture and material
- fit, cut and proportions
- all stitching, seams and closures
- pockets, buttons, zippers and all surface details

Sheet layout — 4 panels on white seamless background:
┌──────────────┬──────────────┐
│  Front view  │  Left side   │
├──────────────┼──────────────┤
│  Right side  │  Back view   │
└──────────────┴──────────────┘

White seamless background.
Fashion catalog photography.
No model — garment on invisible hanger or flat lay.
Ultra-detailed. High resolution.`
  }

  if (type === 'detail') {
    return `Using @image1 as the garment reference.

Create a professional garment detail documentation sheet for: ${asset.name}

${metaBlock}

Document in individual close-up panels — each panel white background:
- Fabric / material texture (macro shot)
- Collar / neckline construction
- Pocket design and placement
- Button / zipper / closure details
- Seam and stitching quality
- Hem and cuff finishing${tags ? `\n- Characteristic features: ${tags}` : ''}

Consistent soft lighting across all panels.
Fashion technical documentation style.
Ultra-detailed. High resolution.`
  }

  // outfit
  return `Using @image1 as the garment reference.

Create a professional outfit reference sheet for: ${asset.name}

${metaBlock}

Display a complete styled look — 3 full-body views:
- Front view: standing pose, full-body
- Side view: profile, full-body
- Back view: standing pose, full-body

Preserve all garment details exactly as shown in the reference image.
Style with neutral, complementary pieces.

White or light grey seamless background.
Fashion editorial photography.
Ultra-detailed. High resolution.`
}

// ── Dialog component ──────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  asset: FashionAsset
}

export function FashionSheetDialog({ open, onClose, asset }: Props) {
  const [step, setStep]           = useState<'choose' | 'prompt'>('choose')
  const [selected, setSelected]   = useState<SheetType | null>(null)
  const [copied, setCopied]       = useState(false)

  const prompt = selected ? generatePrompt(selected, asset) : ''

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

  const catLabel = FASHION_CATEGORIES.find(c => c.key === asset.category)
  const selectedType = SHEET_TYPES.find(t => t.id === selected)

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-rose-400" />
            Sheet erstellen
            <span className="text-muted-foreground font-normal text-sm ml-1 truncate">— {asset.name}</span>
          </DialogTitle>
        </DialogHeader>

        {step === 'choose' ? (
          /* ── Step 1: Type selection ── */
          <div className="space-y-2.5 pt-1">
            <p className="text-xs text-muted-foreground">
              Wähle den Sheet-Typ. Der Prompt wird automatisch auf Basis deines Assets generiert.
            </p>

            {/* Asset summary badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
              {asset.cover_image_url && (
                <img src={asset.cover_image_url} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{asset.name}</p>
                <p className="text-[11px] text-muted-foreground">{catLabel?.emoji} {catLabel?.label}</p>
                {asset.tags.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/60 truncate">{asset.tags.slice(0, 4).join(' · ')}</p>
                )}
              </div>
            </div>

            {SHEET_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => handleSelect(type.id)}
                className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card/60 hover:border-rose-500/40 hover:bg-rose-500/5 transition-all text-left group"
              >
                <span className="text-2xl leading-none shrink-0 mt-0.5">{type.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold group-hover:text-rose-300 transition-colors">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {type.views.map(v => (
                      <span key={v} className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">{v}</span>
                    ))}
                  </div>
                </div>
                <span className="text-muted-foreground/30 group-hover:text-rose-400 transition-colors text-lg leading-none mt-0.5">›</span>
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

            {/* KI-Analyse note if asset has data */}
            {(asset.tags.length > 0 || asset.description) && (
              <div className="flex items-start gap-1.5 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20 text-[11px] text-rose-300/80">
                <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-rose-400" />
                KI-Analyse-Daten wurden automatisch in den Prompt eingebaut.
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
              Kopiere diesen Prompt und füge ihn in dein Bildgenerator-Tool ein (z. B. Midjourney, ComfyUI, Flux).
              Das fertige Sheet kannst du anschließend als Variante bei diesem Asset speichern.
            </p>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-rose-600 hover:bg-rose-500"
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
    </Dialog>
  )
}
