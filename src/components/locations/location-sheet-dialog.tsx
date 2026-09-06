'use client'

import { useState } from 'react'
import { Copy, Check, ChevronLeft, Sparkles, MapPin, ImagePlus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LOCATION_TYPES, type Location } from '@/hooks/use-locations'
import { cn } from '@/lib/utils'
import { Vorschaubild } from '@/components/vorschaubild'
import { PromptToImageDialog } from '@/components/prompts/prompt-to-image-dialog'

// ── Sheet types ───────────────────────────────────────────────────────────────

type SheetType = 'location' | 'shooting' | 'gebaeude'

const SHEET_TYPES: { id: SheetType; label: string; icon: string; description: string; views: string[] }[] = [
  {
    id: 'location',
    label: 'Location-Sheet',
    icon: '📍',
    description: 'Den Ort sehen — ein großes Bild, vier Ansichten',
    views: ['Großes Hero-Bild', '4 Ansichten', 'Gleiches Licht', 'Fünf Felder'],
  },
  {
    id: 'shooting',
    label: 'Shooting-Sheet',
    icon: '📸',
    description: 'Wo hier ein Shooting ginge — leere Hintergründe zum Davorstellen',
    views: ['Hero-Hintergrund', '5 Hintergründe', 'Standposition', 'Licht & Tageszeit', 'Brennweite'],
  },
  {
    id: 'gebaeude',
    label: 'Gebäude-Sheet',
    icon: '🏛️',
    description: 'Architektur — das Gebäude aus acht Winkeln',
    views: ['Hero-Bild', '8 Ansichten', '3 Details', 'Tag & Nacht', '14 Felder'],
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
Where the reference image gives no information, stay generic and typical for
this building type and region. Never borrow distinctive features from another,
similar-looking place — an invented rear facade that quotes a different
building becomes the truth for everything generated from this sheet later.

However:

• Never contradict visible reference images.
• Reference images always take priority over inferred information.
• If information is uncertain, remain conservative and visually plausible.
• Do not invent iconic features that are not supported by references or known facts.

The goal is to create the most complete and realistic visual reference sheet possible while remaining faithful to the uploaded images. If multiple reference images are provided, combine information from all images before creating the sheet.`

const LOCATION_PROMPT = `Analyze the uploaded image and transform it into a visual reference sheet of
this location.

The goal is NOT technical documentation and NOT a moodboard. The goal is to
show what this place looks like, so clearly that someone who has never been
there could recognise it.

${RESEARCH_ENRICHMENT}

Preserve all visible architectural features, furniture, materials, colours,
lighting and atmosphere from the original image.

Reconstruct unseen areas logically while remaining fully consistent with what
is visible.

SHEET STRUCTURE — FIVE PANELS, NO MORE

FEW PANELS, EACH LARGE. This sheet has exactly five images. Do not add further
panels, detail crops, material samples or mood tiles. One large photograph that
can actually be read is worth more than twelve thumbnails.

All five panels are mandatory. Do not drop any of them, and do not shrink them
to fit more in.

1. HERO IMAGE — approximately 55% of the sheet
   The single most representative view of the location, at the highest level of
   detail on the sheet. This is the image someone remembers.

2-5. FOUR SUPPORTING VIEWS — sharing the remaining space, all the same size
   • The opposite angle, looking back from where the hero image was taken
   • The view to the left
   • The view to the right
   • A wide overview that explains how the space fits together

All five views are taken from a position inside the place or immediately at it,
looking outward or across it. Do not step back and show the place as an object
seen from outside — that is what the building sheet is for.

CONSISTENCY

Keep scale, proportions and materials identical across all five panels. Light
all five with the same time of day and the same sun direction — this is one
place at one moment, seen from five positions, not five different days.

Mark any view that could not be derived from the reference image with a small
caption reading RECONSTRUCTED.

WHAT NOT TO DRAW

• No floor plans.
• No blueprints.
• No architectural drawings.
• No technical diagrams.
• No measurement lines.
• No camera maps.

TYPOGRAPHY

Label each panel with two or three words naming what it shows, in a small
clean sans-serif. No sentences, no paragraphs.

STYLE

Ultra-realistic photography.
Clean white or light neutral presentation background.
Generous spacing — the panels may breathe.

The finished sheet should let someone see this location at a glance, and give
another AI system enough to place a scene here convincingly.`

const SHOOTING_PROMPT = `Analyze the uploaded image and transform it into a SHOOTING SHEET for this
location.

This sheet answers one question: where at this place could you photograph
someone, and what would the background look like?

${RESEARCH_ENRICHMENT}

Preserve all visible features, materials, colours and lighting from the
original image. Reconstruct unseen areas logically while remaining fully
consistent with what is visible.

THE PANELS ARE EMPTY — THIS IS THE POINT

Every panel shows the location WITHOUT any person in it. Do not place a model,
a figure, a silhouette or a bystander anywhere. Each panel is a background
plate, framed and lit as if the subject were about to step in, with the spot
where they would stand left clear and unobstructed.

SHEET STRUCTURE — SIX PANELS, NO MORE

If more content is listed below than fits at this size, keep the earlier
sections complete and drop the later ones entirely. Never shrink every panel
to squeeze everything in — a sheet of unreadable thumbnails teaches nothing.

1. HERO PLATE — approximately 45% of the sheet
   The strongest shooting spot this location has — even if that is not the most
   famous view of the place. Framed for a full-body shot of someone who is not
   there yet: the standing position sits in the lower centre of the frame and is
   completely empty. Shot at eye level, 35 mm equivalent.

2-6. FIVE FURTHER BACKGROUND PLATES — sharing the remaining space, equal size
   Choose five genuinely different backgrounds this place offers, not five
   variations of the same wall. Aim for this range:
   • A wide one, where the location itself is the subject behind the standing position
   • One with depth — a corridor, path, arcade or row that leads the eye back
   • A plain textured surface for a tight portrait, close enough to read the
     material
   • The signature element of this place, whatever a visitor would photograph
   • One backlit spot, where the light comes from behind the standing position

FOR EACH PANEL, GIVE THE PRACTICAL FACTS

Under each plate, a two-word name plus three short fact lines — four lines
maximum, no sentences:
• where the subject stands
• the light: direction and best time of day for this spot
• the lens: 24 mm, 35 mm, 50 mm or 85 mm equivalent

Name the standing position in words only. Never mark it in the image with a
circle, a cross, an outline or a silhouette — a marker becomes a figure.

The light must be physically possible for that spot. A north-facing wall does
not get afternoon sun from the front. If two panels state different times of
day, that is correct and useful — but each panel must be internally consistent
in sun direction and shadow length.

HONESTY

Mark any plate that could not be derived from the reference image with a small
caption reading RECONSTRUCTED. This sheet has the highest invented share of the
three — five different spots from one photograph — and it is the one someone
actually travels to a place for. An invented backlit corner looks exactly as
real on the sheet as the one that is there.

WHAT NOT TO DRAW

• No floor plans.
• No blueprints.
• No architectural drawings.
• No technical diagrams.
• No measurement lines.
• No camera maps.
• No people, no mannequins, no silhouettes, no shadows of a person.

TYPOGRAPHY

Label each panel with two or three words naming what it shows, in a small
clean sans-serif. No sentences, no paragraphs.

STYLE

Ultra-realistic photography.
Clean white or light neutral presentation background.
Generous spacing — the panels may breathe.

The finished sheet should let someone pick a spot, know when to be there and
with which lens, and drop a subject straight into the plate.`

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
FOURTEEN PANELS, NO MORE

This sheet holds exactly fourteen images: one hero, eight building views, three
close-ups and two lighting versions. Do not add further panels, swatch strips
or context tiles. If more content is listed below than fits at this size, keep
the earlier sections complete and drop the later ones entirely — never shrink
every panel to squeeze everything in. Twelve unreadable thumbnails teach less
than three panels one can actually see.

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

Dominant centerpiece occupying approximately 25% of the sheet. The eight
building views are the second-largest panels; the three close-ups and the two
lighting versions may be smaller. At 45% the remaining thirteen panels would be
thumbnails, which is exactly what this sheet warns against above.

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

3. Left side, photographed straight on from a distance with a long lens so
   that perspective distortion is minimal

4. Right side, photographed the same way

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

LIGHTING FOR THESE EIGHT VIEWS
Light all eight views with the same soft, even overcast daylight from high
above, so that no view carries a directional sun. Shadows stay short and
neutral. This is deliberate: a front facade and a rear facade cannot both be
lit by the sun from the front, and a sheet that claims otherwise teaches the
next generation an impossible light. Directional sunlight belongs only in the
hero image and in the time-of-day panels.

CAMERA FOR THESE EIGHT VIEWS
Camera height 1.6 m for views 1-6, roughly 40 m for view 7. Use a 50 mm
equivalent lens for views 1-4 so the proportions stay true, 35 mm for views 5,
6 and 8. Keep the building filling a similar share of the frame in views 1-4,
and keep its height in storeys identical across all eight.

━━━━━━━━━━━━━━━━━━━━━━
ARCHITECTURAL DETAIL REFERENCES
━━━━━━━━━━━━━━━━━━━━━━

Create exactly THREE enlarged close-up panels, no more:

• The main entrance
• The dominant facade material, close enough to read its texture
• The one architectural detail that most defines this building

Twelve tiny crops teach less than three that can actually be seen.

Each detail panel should resemble professional luxury real-estate marketing photography.

━━━━━━━━━━━━━━━━━━━━━━
MATERIALS
━━━━━━━━━━━━━━━━━━━━━━

No separate swatch strip. The three close-up panels above already carry the
materials — make sure the facade material among them is photographed close
enough that stone, mortar, timber or metal can be told apart by texture alone.

━━━━━━━━━━━━━━━━━━━━━━
ATMOSPHERE REFERENCES
━━━━━━━━━━━━━━━━━━━━━━

Create additional environmental views:

• One daylight version with low directional sun and long, clearly readable
  shadows — this is the panel that shows the building's modelling, so it must
  differ from the even overcast light of the eight views
• One night version with the building's own lighting

Preserve identical architecture while demonstrating different lighting conditions.

━━━━━━━━━━━━━━━━━━━━━━
ENVIRONMENT & CONTEXT
━━━━━━━━━━━━━━━━━━━━━━

No separate context panels. View 8 above IS the context view — make it show
the adjacent structures, the vegetation and the way one arrives at the
building, all in that single frame.

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

/**
 * Was die App ueber den Ort WEISS, gehoert in den Prompt.
 *
 * Vorher stand in RESEARCH_ENRICHMENT „identify ... if it is recognizable" —
 * das Modell sollte raten, was drei Zeilen weiter im Objekt stand. Ein
 * genannter Ort steuert ein Bildmodell sehr wohl; eine Aufforderung, zu
 * recherchieren, tut es nicht.
 */
function ortsAngabe(location: Location): string {
  const teile = [location.name]

  // NICHT DEN SCHLUESSEL, SONDERN DAS WORT. Im Objekt steht 'stadtgebiet' oder
  // 'eventlocation' — kleingeschriebene Datenbankkuerzel, die im Bildprompt wie
  // ein Leck aussehen und dem Modell wenig sagen. Und 'sonstiges' heisst
  // „keine Angabe": es einzusetzen waere schlechter als es wegzulassen, weil das
  // Modell dann eine Aussage zu lesen bekommt, wo keine ist.
  if (location.location_type && location.location_type !== 'sonstiges') {
    const art = LOCATION_TYPES.find(t => t.key === location.location_type)
    if (art) teile.push(art.label)
  }

  if (location.description?.trim()) teile.push(location.description.trim())
  return `THE DEPICTED LOCATION IS: ${teile.join(' — ')}.\n` +
         `Treat this as established fact, not as a guess.\n\n`
}

function getPrompt(type: SheetType, location: Location): string {
  const basis = type === 'shooting' ? SHOOTING_PROMPT
              : type === 'gebaeude' ? GEBAEUDE_PROMPT
              : LOCATION_PROMPT
  return ortsAngabe(location) + basis
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
  const [bildDialogOffen, setBildDialogOffen] = useState(false)
  const [copied, setCopied]     = useState(false)

  const prompt = selected ? getPrompt(selected, location) : ''

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
            <Sparkles className="h-4 w-4 text-primary" />
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
                  <Vorschaubild src={location.cover_image_url} alt="" className="w-full h-full object-cover" />
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
                className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-border/60 bg-card/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
              >
                <span className="text-2xl leading-none shrink-0 mt-0.5">{type.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold group-hover:text-[#ffb066] transition-colors">{type.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {type.views.map(v => (
                      <span key={v} className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">{v}</span>
                    ))}
                  </div>
                </div>
                <span className="text-muted-foreground/30 group-hover:text-primary transition-colors text-lg leading-none mt-0.5">›</span>
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
              Entweder direkt hier erzeugen lassen — das Referenzbild dieser Location
              ist dann schon angehängt — oder kopieren und in ein anderes Werkzeug geben.
              Das fertige Sheet kannst du anschließend hier als Titelbild oder Referenzbild dieser Location speichern.
            </p>

            {/*
              OHNE REFERENZBILD KEIN ERZEUGEN. Alle drei Prompts beginnen mit
              „Analyze the uploaded image" — ohne Foto bekaeme das Modell nichts
              zu analysieren und erfaende einen Ort. Ein Knopf, der dann trotzdem
              etwas erzeugt, waere schlimmer als kein Knopf.
            */}
            {location.cover_image_url ? (
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-500"
                onClick={() => setBildDialogOffen(true)}
              >
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                Bild daraus erzeugen
              </Button>
            ) : (
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                Diese Location hat noch kein Titelbild. Der Prompt beginnt mit
                „Analyze the uploaded image" — ohne Foto gäbe es nichts zu
                analysieren. Lege zuerst ein Bild an, dann kannst du hier direkt
                erzeugen lassen.
              </p>
            )}

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
          das waeren sonst drei Abfragen bei jedem geoeffneten Sheet. */}
      {bildDialogOffen && selected && (
        <PromptToImageDialog
          isOpen
          onClose={() => setBildDialogOffen(false)}
          prompt={prompt}
          titel={`${location.name} — ${selectedType?.label ?? 'Sheet'}`}
          vorauswahlLocation={location}
          /*
            NUR DIE LOCATION — und zwar aus zwei genauen Gruenden, nicht aus
            Ordnungsliebe.

            ERSTENS: Haengt man hier ein Charakterfoto an, schreibt
            `promptFuerAuftrag` „Image 2 = CHARACTER — take the person's
            identity from it" in den Auftrag. Dann baut das Modell eine
            BESTIMMTE Person in ein Blatt, das den ORT zeigen soll. Wo im
            Gebaeude-Prompt ein Mensch vorkommt („Street-Level Human
            Perspective"), ist er MASSSTAB, nicht Person — irgendjemand, der
            die Groesse zeigt.

            ZWEITENS, und staerker: Das Shooting-Sheet VERBIETET Personen
            ausdruecklich („No people, no mannequins, no silhouettes, no
            shadows of a person"). Ein angehaengtes Charakterfoto stuende dort
            in direktem Widerspruch zum Prompt.

            Wer eine Figur an diesem Ort will, nimmt den Weg ueber das
            Bildstudio — dort ist das Sheet dann die Vorlage.
          */
          rollen={['location']}
        />
      )}
    </Dialog>
  )
}
