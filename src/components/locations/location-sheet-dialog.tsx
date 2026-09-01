'use client'

import { useState } from 'react'
import { Copy, Check, ChevronLeft, Sparkles, MapPin } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Location } from '@/hooks/use-locations'
import { cn } from '@/lib/utils'

// ── Sheet types ───────────────────────────────────────────────────────────────

type SheetType = 'location' | 'cinematic' | 'gebaeude'

const SHEET_TYPES: { id: SheetType; label: string; icon: string; description: string; views: string[] }[] = [
  {
    id: 'location',
    label: 'Location-Sheet',
    icon: '📍',
    description: 'Generischer Ansatz für jede Art von Ort',
    views: ['Hero-Bild', '4-6 Ansichten', 'Detail-Referenzen', 'Atmosphäre'],
  },
  {
    id: 'cinematic',
    label: 'Cinematic-Sheet',
    icon: '🎬',
    description: 'Filmset-orientiert — Sichtachsen, POV, Wege',
    views: ['Hero-Bild', 'Establishing Shot', 'Charakter-POV', 'Approach/Exit-Path', 'Filmmaking Value'],
  },
  {
    id: 'gebaeude',
    label: 'Gebäude-Sheet',
    icon: '🏛️',
    description: 'Architektur — Fassaden aus mehreren Winkeln',
    views: ['Hero-Bild', '8 Fassadenansichten', 'Architektur-Details', 'Material-Referenzen', 'Tageszeiten'],
  },
]

// ── Fixed prompts (aus dem bestehenden Prompt Tresor übernommen) ───────────────

const RESEARCH_ENRICHMENT = `RESEARCH & KNOWLEDGE ENRICHMENT

Before creating the reference sheet, identify and analyze the depicted location, building, environment, venue, landmark, district, or place if it is recognizable.

Use both:

• The uploaded reference image(s)
• General world knowledge about the location

Research and infer:

• Real-world appearance
• Architectural characteristics
• Surrounding environment
• Typical viewpoints
• Street-level appearance
• Aerial appearance
• Interior layout (if publicly known)
• Historical and cultural characteristics
• Materials and construction style
• Lighting conditions typically associated with the location
• Important landmarks and nearby features

When additional information is known, enrich the sheet with these findings.

However:

• Never contradict visible reference images.
• Reference images always take priority over inferred information.
• If information is uncertain, remain conservative and visually plausible.
• Do not invent iconic features that are not supported by references or known facts.

The goal is to create the most complete and realistic visual reference sheet possible while remaining faithful to the uploaded images. If multiple reference images are provided, combine information from all images before creating the sheet.`

const LOCATION_PROMPT = `Analyze the uploaded image and transform it into a premium AI visual reference sheet.

The goal is NOT technical documentation. The goal is to visually teach an AI exactly how this location looks, feels, and should be recreated.

${RESEARCH_ENRICHMENT}

Preserve all visible architectural features, furniture, materials, decorations, colors, lighting, atmosphere, layout logic, and design language from the original image.

Reconstruct unseen areas logically while remaining fully consistent with what is visible.

REFERENCE SHEET STRUCTURE

HERO IMAGE
• One very large centerpiece image occupying approximately 40–50% of the entire sheet.
• The most iconic and representative view of the location.
• Highest level of detail.

LARGE LOCATION VIEWS
• 4–6 large images showing the location from different viewpoints.
• Opposite angle view.
• Left perspective.
• Right perspective.
• Wide overview shot.
• Eye-level visitor perspective.
• Additional viewpoint that best explains the space.

DETAIL REFERENCES
• 4–6 medium-sized detail images.
• Important furniture.
• Signature decorations.
• Lighting fixtures.
• Surface materials.
• Architectural details.
• Unique visual features that define the location.

ATMOSPHERE REFERENCES
• One image focused on overall mood and lighting.
• One image focused on colors, materials, and visual style.
• One image showing how the space feels when experienced by a visitor.

VISUAL PRIORITIES

• 90% imagery.
• 10% labels.
• Very few words.
• No floor plans.
• No blueprints.
• No architectural drawings.
• No technical diagrams.
• No measurement lines.
• No operation charts.
• No engineering documentation.

STYLE

Premium environment reference board.
Luxury hospitality presentation quality.
AAA game environment concept art quality.
Professional film production moodboard quality.
Ultra-realistic photography.
Clean white or light neutral presentation background.
Organized grid layout with large images and excellent spacing.

The final sheet should instantly communicate how the location looks from multiple angles and provide enough visual information for another AI system to accurately recreate the entire environment.`

const CINEMATIC_PROMPT = `Analyze the uploaded image and transform it into a PREMIUM CINEMATIC LOCATION REFERENCE SHEET.

The goal is NOT architectural documentation.

The goal is to visually teach an AI, filmmaker, production designer, concept artist, or environment generator exactly how this location looks, feels, functions, and can be used as a cinematic setting.

${RESEARCH_ENRICHMENT}

Preserve all visible characteristics from the original image:

• Architecture
• Spatial layout
• Terrain and elevation
• Sightlines and viewpoints
• Materials and textures
• Environmental details
• Weathering and age
• Surrounding context
• Natural and artificial lighting
• Atmosphere and mood
• Human scale and movement patterns

Reconstruct unseen areas logically while remaining fully consistent with the visible environment.

────────────────────────
REFERENCE SHEET STRUCTURE
────────────────────────

HERO IMAGE

• One large cinematic hero image occupying roughly 40–50% of the sheet.
• Most iconic and visually powerful perspective.
• Magazine-quality environmental photography.

────────────────────────

LOCATION COVERAGE

Include highly detailed visual references for:

• Wide establishing view
• Opposite direction view
• Eye-level perspective
• Character POV view
• Elevated overview
• Corner perspective
• Approach path
• Exit path
• Environmental context view
• Landmark relationship view

Show how the location connects to its surroundings.

────────────────────────

SPATIAL STORYTELLING

Visually communicate:

• Arrival experience
• Movement flow
• Human interaction zones
• Gathering areas
• Transition spaces
• Focal points
• Hero viewpoints
• Background opportunities
• Framing opportunities

────────────────────────

DETAIL REFERENCES

Generate close-up visual references for:

• Architectural details
• Surface materials
• Stonework
• Pavement
• Railings
• Signage
• Vegetation
• Street elements
• Lighting fixtures
• Sculptures
• Monuments
• Environmental props

────────────────────────

ATMOSPHERE REFERENCES

Include dedicated visual panels showing:

• Mood
• Lighting
• Color palette
• Weather potential
• Time-of-day variation
• Environmental storytelling

────────────────────────

FILMMAKING VALUE

Clearly communicate through imagery:

• Best establishing-shot positions
• Best character-shot positions
• Hero framing opportunities
• Scale references
• Background compositions
• Visual depth opportunities
• Crowd potential
• Action sequence potential

────────────────────────

VISUAL STYLE

Hollywood production design moodboard quality.

AAA cinematic environment concept art quality.

Premium film-location scouting board quality.

Ultra-realistic photography.

Photorealistic lighting.

Natural environmental realism.

High-end editorial presentation design.

────────────────────────

LAYOUT RULES

• 90% imagery
• 10% labels
• Minimal text
• Large images
• Clean grid layout
• Premium black or dark charcoal presentation board
• No floor plans
• No technical drawings
• No camera maps
• No lighting diagrams
• No blueprint aesthetics

The final sheet should instantly communicate the visual identity, atmosphere, storytelling potential, cinematic scale, and production value of the location.`

const GEBAEUDE_PROMPT = `Analyze the uploaded image and transform it into a PREMIUM ARCHITECTURAL VISUAL REFERENCE SHEET.

This is NOT an architectural blueprint, floor plan, construction drawing, or technical documentation.

The goal is to visually teach an AI exactly how this building, structure, and surrounding environment look and should be recreated from any angle.

${RESEARCH_ENRICHMENT}

Preserve all visible architectural characteristics from the original image:

• Overall building form and proportions
• Architectural style and historical character
• Stonework, masonry, and facade textures
• Tower geometry and silhouette
• Roof shapes and roofing materials
• Windows, arches, and openings
• Entrance structures and gateways
• Decorative architectural details
• Exterior lighting design
• Weathering, aging, and material patina
• Landscaping and surrounding vegetation
• Pathways, courtyards, and environmental context
• Relationship between building and surroundings

Reconstruct unseen portions logically while remaining fully consistent with the visible architecture.

━━━━━━━━━━━━━━━━━━━━━━
REFERENCE SHEET LAYOUT
━━━━━━━━━━━━━━━━━━━━━━

PREMIUM LARGE-FORMAT PRESENTATION BOARD

Clean luxury architectural presentation design.

Dark charcoal or light neutral background.

Minimal typography.

90% imagery, 10% labels.

No floor plans.
No blueprints.
No measurements.
No CAD drawings.
No technical diagrams.

━━━━━━━━━━━━━━━━━━━━━━
HERO IMAGE
━━━━━━━━━━━━━━━━━━━━━━

Dominant centerpiece occupying approximately 45% of the sheet.

Ultra-photorealistic architectural photograph.

Most iconic exterior angle.

Preserve:

• Building massing
• Architectural identity
• Materials
• Lighting character
• Environmental atmosphere
• Surrounding landscape

Magazine-quality architectural photography.

━━━━━━━━━━━━━━━━━━━━━━
MULTI-ANGLE BUILDING VIEWS
━━━━━━━━━━━━━━━━━━━━━━

Create consistent photorealistic reconstructions showing:

1. Front Facade

2. Rear Facade

3. Left Elevation

4. Right Elevation

5. Corner Perspective

6. Street-Level Human Perspective

7. Elevated Drone Perspective

8. Contextual Surroundings View

Each image should clearly communicate:

• Overall form
• Roof structure
• Facade composition
• Entrances
• Windows
• Material transitions
• Architectural hierarchy

Maintain identical architecture across every view.

━━━━━━━━━━━━━━━━━━━━━━
ARCHITECTURAL DETAIL REFERENCES
━━━━━━━━━━━━━━━━━━━━━━

Create enlarged close-up panels showing:

• Main entrance and gateway
• Window designs
• Roof and tower details
• Stone masonry texture
• Facade material transitions
• Decorative carvings and ornaments
• Archways and structural elements
• Exterior lighting fixtures
• Signage and branding elements
• Landscaping details
• Pavement and courtyard materials
• Architectural weathering and aging

Each detail panel should resemble professional luxury real-estate marketing photography.

━━━━━━━━━━━━━━━━━━━━━━
MATERIAL REFERENCE STRIP
━━━━━━━━━━━━━━━━━━━━━━

High-resolution close-up material samples showing:

• Stone texture
• Mortar texture
• Roof materials
• Timber elements
• Metal components
• Window framing
• Glass characteristics
• Exterior lighting materials

Presented as photographic swatches rather than technical samples.

━━━━━━━━━━━━━━━━━━━━━━
ATMOSPHERE REFERENCES
━━━━━━━━━━━━━━━━━━━━━━

Create additional environmental views:

• Bright daylight version
• Golden hour version
• Blue hour version
• Soft overcast version
• Night illumination version

Preserve identical architecture while demonstrating different lighting conditions.

━━━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT & CONTEXT
━━━━━━━━━━━━━━━━━━━━━━

Show the building within its setting:

• Adjacent structures
• Trees and vegetation
• Pathways and circulation routes
• Courtyard spaces
• Landscape design
• Arrival experience
• Visitor perspective
• Relationship to surrounding environment

━━━━━━━━━━━━━━━━━━━━━━
VISUAL STYLE
━━━━━━━━━━━━━━━━━━━━━━

Ultra-realistic architectural visualization.

Luxury hospitality development board quality.

Premium heritage-property marketing presentation.

Architectural Digest quality.

High-end real-estate photography.

Perfect lighting balance.

Natural materials.

Authentic aging and texture.

Crisp detail.

Consistent architectural accuracy.

The final reference sheet must enable another AI to accurately reconstruct the entire building, materials, environment, and atmosphere from any viewpoint with maximum architectural fidelity.`

function getPrompt(type: SheetType): string {
  if (type === 'cinematic') return CINEMATIC_PROMPT
  if (type === 'gebaeude') return GEBAEUDE_PROMPT
  return LOCATION_PROMPT
}

// ── Dialog component ──────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  location: Location
}

export function LocationSheetDialog({ open, onClose, location }: Props) {
  const [step, setStep]         = useState<'choose' | 'prompt'>('choose')
  const [selected, setSelected] = useState<SheetType | null>(null)
  const [copied, setCopied]     = useState(false)

  const prompt = selected ? getPrompt(selected) : ''

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
            <Sparkles className="h-4 w-4 text-teal-400" />
            Sheet erstellen
            <span className="text-muted-foreground font-normal text-sm ml-1 truncate">— {location.name}</span>
          </DialogTitle>
        </DialogHeader>

        {step === 'choose' ? (
          /* ── Step 1: Type selection ── */
          <div className="space-y-2.5 pt-1">
            <p className="text-xs text-muted-foreground">
              Wähle den Sheet-Typ. Der Prompt ist fest definiert — du musst nur noch dein Referenzbild anhängen.
            </p>

            {/* Location summary badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
              <div className="w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0">
                {location.cover_image_url ? (
                  <img src={location.cover_image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{location.name}</p>
                {location.description && (
                  <p className="text-[10px] text-muted-foreground/60 truncate">{location.description}</p>
                )}
              </div>
            </div>

            {SHEET_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => handleSelect(type.id)}
                className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card/60 hover:border-teal-500/40 hover:bg-teal-500/5 transition-all text-left group"
              >
                <span className="text-2xl leading-none shrink-0 mt-0.5">{type.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold group-hover:text-teal-300 transition-colors">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {type.views.map(v => (
                      <span key={v} className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">{v}</span>
                    ))}
                  </div>
                </div>
                <span className="text-muted-foreground/30 group-hover:text-teal-400 transition-colors text-lg leading-none mt-0.5">›</span>
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
              Kopiere diesen Prompt, ziehe ihn zusammen mit deinem Referenzbild in dein Bildgenerator-Tool.
              Das fertige Sheet kannst du anschließend hier als Titelbild oder Referenzbild dieser Location speichern.
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
        )}
      </DialogContent>
    </Dialog>
  )
}
