'use client'

import { useState, useMemo, useCallback } from 'react'
import { Copy, Sparkles, X, Plus, Loader2, ImageOff, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCharacters } from '@/hooks/use-characters'
import { useOutfits } from '@/hooks/use-outfits'
import { useLocations } from '@/hooks/use-locations'
import { usePoseActions } from '@/hooks/use-pose-actions'
import { useVisualAssets, CAMERA_CATEGORIES } from '@/hooks/use-visual-assets'
import { useLookGrading } from '@/hooks/use-look-grading'
import { cn } from '@/lib/utils'
import {
  type SceneType, type TimeOfDayKey, type SeasonKey, type WeatherKey,
  type LightSourceKey, type LightStyleKey, type LightModifierKey, type BackgroundKey,
  type ShotTypeKey, type CameraAngleKey, type LensKey, type DepthOfFieldKey, type AspectRatioKey,
  type GroundStateKey, type WindKey, GROUND_STATES, WINDS,
  SCENE_TYPES, OUTDOOR_ONLY_TIMES, TIME_OF_DAY, SEASONS, WEATHERS,
  LIGHT_SOURCES, LIGHT_STYLES, LIGHT_MODIFIERS, STUDIO_BACKGROUNDS,
  SHOT_TYPES, CAMERA_ANGLES, LENSES, DEPTH_OF_FIELDS, ASPECT_RATIOS,
  optionLabel, optionLabels,
} from '@/lib/scene-builder-options'
import { useScenePresets } from '@/hooks/use-scene-presets'
import { ScenePresetDialog } from '@/components/scene-builder/scene-preset-dialog'
import { QueueButton } from '@/components/scene-builder/queue-button'
import type { Referenz, ReferenzRolle } from '@/lib/image-generation'
import { loadRefImages, type RefImage } from '@/lib/reference-images'
import type { ScenePresetConfig } from '@/lib/scene-preset-types'
import { kategorieEintrag, OUTFIT_KATEGORIE_LABELS } from '@/lib/outfit-kategorien'
import { BausteinFilter } from '@/components/baustein-filter'
import { useBausteinFilter } from '@/hooks/use-baustein-filter'
import { buildPrompt, type Scene, type SceneRefs } from '@/lib/szene-prompt'

/*
  Die Papier-Anmutung (PROJ-55) steckt vollstaendig in dieser einen Datei
  daneben — und gilt nur innerhalb von `.sb-papier`. Keine andere Seite wird
  davon beruehrt, auch `globals.css` nicht. Warum das so ist und wie ein
  spaeteres Ausrollen aussieht, steht oben in `papier.css`.
*/
import './papier.css'

// ── Types ─────────────────────────────────────────────────────────────────────

// `Scene`, `SceneRefs` und `buildPrompt` liegen seit PROJ-51 in
// `@/lib/szene-prompt` — wörtlich dieselbe Logik, nur außerhalb dieser Seite,
// damit der Knopf „Titelbild erzeugen" im Charakter-Bereich denselben Prompt
// erzeugt und nicht einen zweiten, leicht anderen.

// Seit PROJ-52 gibt es je Bereich EINEN Reiter: die drei Archetyp-Reiter sind
// ersatzlos entfallen, mit ihnen die Möglichkeit, eine Beschreibung ohne Bild
// beizusteuern.
type TabKey = 'charaktere' | 'outfits' | 'locations' | 'posen' | 'ausdruck' | 'kamera' | 'stil' | 'grading'

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'charaktere', label: 'Charaktere', emoji: '👤' },
  { key: 'outfits',    label: 'Outfits',    emoji: '👗' },
  { key: 'locations',  label: 'Locations',  emoji: '📍' },
  { key: 'posen',      label: 'Posen',      emoji: '🎭' },
  { key: 'ausdruck',   label: 'Mimik',      emoji: '😊' },
  { key: 'kamera',     label: 'Kamera-Asset', emoji: '📷' },
  { key: 'stil',       label: 'Stil',       emoji: '🎥' },
  { key: 'grading',    label: 'Grading',    emoji: '🎨' },
]

type SlotKey = keyof Pick<Scene, 'character' | 'outfit' | 'location' | 'pose' | 'expression' | 'camera' | 'style' | 'grading'>
type RefSlotKey = keyof SceneRefs

/**
 * `code` ist die Randnummer auf dem Bausteinbogen („01 — CHR"). Sie steht
 * ABSICHTLICH hier neben dem Feld und nicht in einer zweiten Liste: Kommt
 * jemals ein neunter Baustein dazu, wandert die Nummer mit ihm mit.
 */
const SLOTS: { key: SlotKey; label: string; emoji: string; tab: TabKey; code: string }[] = [
  { key: 'character', label: 'Charakter', emoji: '👤', tab: 'charaktere', code: 'CHR' },
  { key: 'outfit',    label: 'Outfit',    emoji: '👗', tab: 'outfits',    code: 'OUT' },
  { key: 'location',  label: 'Location',  emoji: '📍', tab: 'locations',  code: 'LOC' },
  { key: 'pose',      label: 'Pose',      emoji: '🎭', tab: 'posen',      code: 'POS' },
  { key: 'expression',label: 'Mimik',     emoji: '😊', tab: 'ausdruck',   code: 'MIM' },
  { key: 'camera',    label: 'Kamera-Asset', emoji: '📷', tab: 'kamera',  code: 'KAM' },
  { key: 'style',     label: 'Stil',       emoji: '🎥', tab: 'stil',      code: 'STL' },
  { key: 'grading',   label: 'Grading',    emoji: '🎨', tab: 'grading',   code: 'GRD' },
]

const REF_SLOTS: RefSlotKey[] = ['character', 'outfit', 'location']

/**
 * Die Beschriftungen der Kamera-Kategorien für die Chips — aus derselben
 * Liste, aus der auch die Kamera-Seite sie nimmt. Sonst hiesse „nah" hier
 * „Nah" und dort „Nahaufnahme".
 */
const KAMERA_LABELS: Record<string, string> =
  Object.fromEntries(CAMERA_CATEGORIES.map(c => [c.key, c.label]))

// ── Druckgrafische Kleinteile ────────────────────────────────────────────────

/** Passkreuz. Reine Zierde — deshalb `aria-hidden`. */
function Passkreuz() {
  return <span className="sb-reg" aria-hidden="true"><i /></span>
}

/** Perforationsleiste unter dem Bausteinbogen. */
function Perforation() {
  return (
    <div className="sb-sprock mt-2 pt-1.5" aria-hidden="true">
      {Array.from({ length: 40 }).map((_, i) => <i key={i} />)}
    </div>
  )
}

/** Die Doppellinie — Grenze zwischen Druckgrafik (oben) und Karten (unten). */
function Doppellinie() {
  return <div className="sb-dbl my-4" aria-hidden="true" />
}

// ── Chips ─────────────────────────────────────────────────────────────────────

/**
 * Ein Auswahlknopf. ORANGE HEISST „AUSGEWÄHLT" — in dieser App überall, und
 * deshalb trägt kein Typenschild Orange.
 */
function Chip({
  aktiv, onClick, children, title, gedaempft = false, disabled = false,
}: {
  aktiv: boolean; onClick: () => void; children: React.ReactNode
  title?: string; gedaempft?: boolean; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={aktiv}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 rounded-[3px] border px-[11px] py-[7px] text-sm transition-colors',
        aktiv
          ? 'border-[var(--sb-or)] bg-[var(--sb-or-t)] font-bold text-white'
          : gedaempft
            ? 'border-[var(--sb-rule)] bg-[#faf8f2] text-[var(--sb-ink3)] hover:border-[var(--sb-ink3)] hover:text-[var(--sb-ink2)]'
            : 'border-[var(--sb-rule)] bg-[var(--sb-card)] text-[var(--sb-ink2)] hover:border-[var(--sb-ink3)] hover:text-[var(--sb-ink)]',
      )}
    >
      {children}
    </button>
  )
}

/** Eine Zeile in einer Einstellungskarte: Beschriftung links, Chips rechts. */
function ChipZeile({ label, breit = false, children }: {
  label: string; breit?: boolean; children: React.ReactNode
}) {
  return (
    <div className="mb-[9px] flex items-start gap-[9px] last:mb-0">
      <div className={cn(
        'flex-none pt-2 text-sm text-[var(--sb-ink2)]',
        breit ? 'w-[118px]' : 'w-[102px]',
      )}>
        {label}
      </div>
      <div className="flex flex-wrap gap-[7px]">{children}</div>
    </div>
  )
}

function ChipGroup<T extends string>({
  label, options, selected, onSelect, breit, gedaempft,
}: {
  label: string
  options: readonly { key: T; label: string; emoji: string }[]
  selected: T | null
  onSelect: (key: T | null) => void
  breit?: boolean
  gedaempft?: boolean
}) {
  return (
    <ChipZeile label={label} breit={breit}>
      {options.map(opt => (
        <Chip
          key={opt.key}
          aktiv={selected === opt.key}
          gedaempft={gedaempft}
          onClick={() => onSelect(selected === opt.key ? null : opt.key)}
        >
          <span aria-hidden="true">{opt.emoji}</span>
          <span>{opt.label}</span>
        </Chip>
      ))}
    </ChipZeile>
  )
}

// ── Karte mit Typenschild ─────────────────────────────────────────────────────

type Kennfarbe = 'gr' | 'cy' | 'am' | 'or' | 'neutral'

/**
 * Eine Einstellungsgruppe als aufgelegte Karte.
 *
 * „Studio-Hintergrund" und „Zugeklappt" bekommen KEINE Kennfarbe: Das sind
 * keine Einstellungskategorien wie die vier anderen, und fünf bis sechs
 * Kennfarben nebeneinander wären wieder das, was Mark beanstandet hat —
 * alles gleich laut.
 */
function Karte({ titel, farbe = 'neutral', dim = false, children }: {
  titel: string; farbe?: Kennfarbe; dim?: boolean; children: React.ReactNode
}) {
  return (
    <div className={cn('sb-mod px-[14px] pb-[13px] pt-3', dim && 'sb-mod-dim')}>
      <div className={cn('sb-plate mb-[11px]', farbe !== 'neutral' && `sb-k-${farbe}`)}>
        {titel}
      </div>
      {children}
    </div>
  )
}

/**
 * Eine zugeklappte Gruppe: Beschriftung, der AKTUELLE WERT in Orange, Pfeil.
 *
 * Der Wert wird nicht abgetippt, sondern über `optionLabel` aus derselben
 * Liste geholt, aus der die Chips darunter gezeichnet werden.
 */
function Fold({ label, wert, offen, onToggle, children }: {
  label: string; wert: string | null; offen: boolean; onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-[9px] border border-[var(--sb-rule2)] bg-[var(--sb-card)] shadow-[0_1px_2px_rgba(60,48,25,0.05)] last:mb-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={offen}
        className="flex w-full items-center gap-2.5 px-[13px] py-2.5 text-left"
      >
        <span className="flex-1 text-sm text-[var(--sb-ink2)]">{label}</span>
        <span className={cn(
          'text-[14.5px] font-bold',
          wert ? 'text-[var(--sb-or-t)]' : 'text-[var(--sb-ink3)] font-normal',
        )}>
          {wert ?? 'nicht gesetzt'}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[var(--sb-ink3)] transition-transform', offen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {offen && (
        <div className="border-t border-dotted border-[var(--sb-rule)] px-[13px] py-2.5">
          <div className="flex flex-wrap gap-[7px]">{children}</div>
        </div>
      )}
    </div>
  )
}

// ── Kachel in der Auswahlspalte ───────────────────────────────────────────────

function AssetThumb({
  name, imageUrl, emoji, isSelected, onClick, hinweis = null,
}: {
  name: string; imageUrl: string | null; emoji: string
  isSelected: boolean; onClick: () => void
  /**
   * Eine Zeile unter dem Namen, die sagt, WAS die Kachel ist.
   *
   * Gebraucht seit PROJ-53: Im Outfit-Fach liegen jetzt komplette Looks UND
   * einzelne Kleidungsstuecke nebeneinander — aus 17 kuratierten Eintraegen
   * wurden 36. Ohne diese Zeile waehlt man eine Lederjacke an der Stelle, an
   * der ein ganzer Look hingehoert, und sieht es erst am erzeugten Bild.
   */
  hinweis?: string | null
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full overflow-hidden bg-[var(--sb-card)] text-left transition-all',
        isSelected
          ? 'border-2 border-[var(--sb-or)] p-1 shadow-[0_2px_5px_rgba(190,90,20,0.18)]'
          : 'border border-[var(--sb-rule)] p-[5px] shadow-[0_1px_2px_rgba(60,48,25,0.07)] hover:border-[var(--sb-ink3)]',
      )}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[var(--sb-pap2)]">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl opacity-25">
            {emoji}
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/15">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sb-or-t)]">
              <span className="text-xs font-bold text-white">✓</span>
            </div>
          </div>
        )}
      </div>
      <div className="px-0.5 pb-0.5 pt-2">
        <p className={cn(
          'truncate text-sm leading-tight',
          isSelected ? 'font-bold text-[var(--sb-ink)]' : 'text-[var(--sb-ink2)]',
        )}>
          {name}
        </p>
        {hinweis && (
          <p className="truncate text-[13px] leading-tight text-[var(--sb-ink3)]">{hinweis}</p>
        )}
      </div>
    </button>
  )
}

// ── Referenz-Auswahl innerhalb eines Feldes ──────────────────────────────────

function RefPicker({
  images, selectedUrl, onSelect, loading,
}: {
  images: RefImage[]; selectedUrl: string | null; onSelect: (img: RefImage | null) => void; loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--sb-ink3)]" />
        <span className="text-[13px] text-[var(--sb-ink3)]">Lade Bilder…</span>
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center gap-1.5 py-1.5">
        <ImageOff className="h-3.5 w-3.5 text-[var(--sb-ink3)]" />
        <span className="text-[13px] text-[var(--sb-ink3)]">Keine Bilder</span>
      </div>
    )
  }

  return (
    <div className="scrollbar-hide flex gap-1.5 overflow-x-auto py-1">
      {/* „Kein Bild" */}
      <button
        onClick={() => onSelect(null)}
        title="Kein Referenzbild"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded border text-[11px] transition-colors',
          selectedUrl === null
            ? 'border-[var(--sb-or)] bg-[var(--sb-or-l)] text-[var(--sb-or-t)]'
            : 'border-[var(--sb-rule)] bg-[var(--sb-card)] text-[var(--sb-ink3)] hover:border-[var(--sb-ink3)]',
        )}
      >
        ✕
      </button>
      {images.map((img, i) => (
        <button
          key={i}
          onClick={() => onSelect(img)}
          title={img.label}
          className={cn(
            'h-8 w-8 shrink-0 overflow-hidden border-2 transition-all',
            selectedUrl === img.url
              ? 'border-[var(--sb-or)] shadow-[0_1px_3px_rgba(190,90,20,0.3)]'
              : 'border-[var(--sb-rule)] hover:border-[var(--sb-ink3)]',
          )}
        >
          <img src={img.url} alt={img.label} className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  )
}

// ── Ein Feld auf dem Bausteinbogen ───────────────────────────────────────────

/**
 * Ersetzt die frühere hochformatige `SceneSlot`-Karte.
 *
 * KEIN AUFKLAPPEN DER AUSWAHL HIER — von Mark verworfen. Ein Klick auf ein
 * leeres Feld schaltet die linke Spalte auf den passenden Reiter; gewählt wird
 * weiterhin dort, an Gesichtern und Stoffen.
 */
function SzenenFeld({
  slot, asset, refImages, refLoading, selectedRef, onSelectRef, onClear, onSelect,
}: {
  slot: typeof SLOTS[number]
  asset: { name: string; cover_image_url?: string | null } | null
  refImages?: RefImage[]
  refLoading?: boolean
  selectedRef?: RefImage | null
  onSelectRef?: (img: RefImage | null) => void
  onClear: () => void
  onSelect: () => void
}) {
  const hasRefPicker = Boolean(onSelectRef)
  const displayImage = (hasRefPicker && selectedRef?.url) ? selectedRef.url : asset?.cover_image_url

  if (!asset) {
    return (
      <button
        onClick={onSelect}
        className="sb-leer flex h-full w-full flex-1 items-center gap-[11px] border border-[var(--sb-rule)] p-[9px] text-left transition-colors hover:border-[var(--sb-or)]"
      >
        <span className="flex h-[54px] w-[54px] flex-none items-center justify-center border border-dashed border-[var(--sb-rule)] bg-white text-2xl text-[var(--sb-ink3)]">
          <Plus className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] uppercase tracking-[0.1em] text-[var(--sb-ink3)]">{slot.label}</span>
          <span className="mt-0.5 block text-[15.5px] font-medium text-[var(--sb-ink3)]">wählen</span>
        </span>
      </button>
    )
  }

  return (
    <div className="relative flex-1 border-2 border-[var(--sb-or)] bg-white p-2">
      <div className="flex items-center gap-[11px]">
        <div className="h-[54px] w-[54px] flex-none overflow-hidden border border-[var(--sb-rule)] bg-[var(--sb-pap2)]">
          {displayImage ? (
            <img src={displayImage} alt={asset.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl opacity-40">{slot.emoji}</div>
          )}
        </div>
        <div className="min-w-0 pr-5">
          <p className="text-[13px] uppercase tracking-[0.1em] text-[var(--sb-ink3)]">{slot.label}</p>
          <p className="mt-0.5 truncate text-[15.5px] font-bold text-[var(--sb-ink)]">{asset.name}</p>
          {hasRefPicker && selectedRef && (
            <p className="truncate text-[13px] text-[var(--sb-or-t)]">{selectedRef.label}</p>
          )}
        </div>
      </div>

      {hasRefPicker && onSelectRef && (
        <div className="mt-2 border-t border-dotted border-[var(--sb-rule)] pt-1">
          <p className="text-[13px] uppercase tracking-[0.1em] text-[var(--sb-ink3)]">Referenz</p>
          <RefPicker
            images={refImages ?? []}
            selectedUrl={selectedRef?.url ?? null}
            onSelect={onSelectRef}
            loading={refLoading ?? false}
          />
        </div>
      )}

      <button
        onClick={onClear}
        title={`${slot.label} entfernen`}
        aria-label={`${slot.label} entfernen`}
        className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--sb-rule)] bg-white text-[var(--sb-ink3)] transition-colors hover:border-[var(--sb-k-or)] hover:text-[var(--sb-k-or)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ── Referenz-Export (rechte Spalte) ──────────────────────────────────────────

function RefExportCard({ label, emoji, asset, refImage }: {
  label: string; emoji: string
  asset: { name: string; cover_image_url?: string | null } | null
  refImage?: RefImage | null
}) {
  if (!asset) return null

  const imageUrl = refImage?.url ?? asset.cover_image_url
  const sublabel = refImage?.label ?? null

  return (
    <div className="flex items-start gap-2.5">
      <div className="h-14 w-14 shrink-0 overflow-hidden border border-[var(--sb-rule)] bg-[var(--sb-pap2)]">
        {imageUrl ? (
          <img src={imageUrl} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg">{emoji}</div>
        )}
      </div>
      <div className="min-w-0 py-0.5">
        <p className="text-[13px] uppercase tracking-[0.15em] text-[var(--sb-ink3)]">{label}</p>
        <p className="truncate text-sm font-bold text-[var(--sb-ink)]">{asset.name}</p>
        {sublabel ? (
          <p className="truncate text-[13px] text-[var(--sb-or-t)]">{sublabel}</p>
        ) : (
          <p className="truncate text-[13px] text-[var(--sb-ink3)]">Titelbild</p>
        )}
      </div>
    </div>
  )
}

/** Kleiner Eintrag rechts für Pose/Mimik/Kamera/Stil/Grading. */
function NebenAsset({ label, emoji, asset }: {
  label: string; emoji: string
  asset: { name: string; cover_image_url?: string | null } | null
}) {
  if (!asset) return null
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-[var(--sb-rule)] bg-[var(--sb-pap2)] text-base">
        {asset.cover_image_url
          ? <img src={asset.cover_image_url} alt={asset.name} className="h-full w-full object-cover" />
          : emoji}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] uppercase tracking-[0.15em] text-[var(--sb-ink3)]">{label}</p>
        <p className="truncate text-sm font-medium text-[var(--sb-ink)]">{asset.name}</p>
      </div>
    </div>
  )
}

/** Ein Merkmal in der Szenen-Übersicht rechts. */
function Marke({ children, betont = false }: { children: React.ReactNode; betont?: boolean }) {
  return (
    <span className={cn(
      'border bg-[var(--sb-card)] px-2.5 py-1.5 text-[13.5px]',
      betont
        ? 'border-[var(--sb-or)] font-bold text-[var(--sb-or-t)]'
        : 'border-[var(--sb-rule)] text-[var(--sb-ink2)]',
    )}>
      {children}
    </span>
  )
}

/** Überschrift eines Feldes in der rechten Spalte. */
function Feldname({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-[7px] text-[13px] uppercase tracking-[0.15em] text-[var(--sb-ink3)]">
      {children}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SceneBuilderPage() {
  const { characters, loading: loadingChars } = useCharacters()
  const { outfits,    loading: loadingOutfits } = useOutfits()
  const { locations,  loading: loadingLocs } = useLocations()
  const { poseActions, loading: loadingPoses } = usePoseActions()
  const { assets: visualAssets, loading: loadingVisual } = useVisualAssets()
  const { styles, gradings, loading: loadingLookGrading } = useLookGrading()
  const {
    items: presetItems, loading: loadingPresets, createPreset, deletePreset,
    duplicatePreset, exportPreset, importPresetFromFile,
  } = useScenePresets()
  const [presetsOpen, setPresetsOpen] = useState(false)

  const cameras  = useMemo(() => visualAssets.filter(a => a.asset_type === 'camera'),  [visualAssets])
  const expressions = useMemo(() => visualAssets.filter(a => a.asset_type === 'expression'), [visualAssets])

  const [activeTab, setActiveTab] = useState<TabKey>('charaktere')
  const [scene, setScene] = useState<Scene>({
    scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
    light_source: null, light_style: null, light_modifiers: [],
    ground: null, wind: null,
    shot_type: null, camera_angle: null, lens: null, depth_of_field: null, aspect_ratio: null,
    character: null, outfit: null,
    location: null, pose: null, expression: null, camera: null,
    style: null, grading: null, background: null,
  })

  /**
   * Welche der selten gebrauchten Gruppen gerade aufgeklappt ist.
   *
   * REINE ANZEIGE. Nichts davon geht in den Prompt, in ein Preset oder in einen
   * Auftrag — zugeklappt heisst nicht „nicht gesetzt". Der aktuelle Wert steht
   * deshalb im Kopf der Zeile, damit man ihn auch zugeklappt sieht.
   */
  const [aufgeklappt, setAufgeklappt] = useState<Record<string, boolean>>({})
  const klappe = (id: string) => setAufgeklappt(prev => ({ ...prev, [id]: !prev[id] }))

  // Reference images loaded from DB per asset (keyed by asset ID)
  const [refImagesMap, setRefImagesMap] = useState<Record<string, RefImage[]>>({})
  const [refLoadingMap, setRefLoadingMap] = useState<Record<string, boolean>>({})

  // Selected reference image per ref slot
  const [sceneRefs, setSceneRefs] = useState<SceneRefs>({
    character: null, outfit: null, location: null,
  })

  // Der Prompt hängt seit PROJ-52 nur noch an der Szene, nicht mehr an den
  // gewählten Referenzbildern — die gehen weiterhin als Bilder mit, siehe
  // `referenzen` weiter unten.
  const prompt = useMemo(() => buildPrompt(scene), [scene])
  const hasAnyAsset = Boolean(
    scene.character || scene.outfit || scene.location ||
    scene.pose || scene.expression || scene.camera || scene.style || scene.grading
  )
  const hasAnyCondition = Boolean(
    scene.time_of_day || scene.season || scene.weather || scene.light_source || scene.light_style || scene.light_modifiers.length > 0
  )
  const hasAnyCameraSetting = Boolean(
    scene.shot_type || scene.camera_angle || scene.lens || scene.depth_of_field || scene.aspect_ratio
  )

  /** „x von 8 belegt" — die Zahl im Kopf des Bausteinbogens. */
  const belegt = SLOTS.filter(s => scene[s.key]).length

  // Indoor and Outdoor use mutually exclusive lighting parameters — switching scene type
  // clears whichever set no longer applies, so e.g. "Indoor + Gewitter" can never occur.
  function setSceneType(type: SceneType) {
    setScene(prev => {
      if (type === 'indoor') {
        return {
          ...prev,
          scene_type: type,
          weather: null,
          season: null,
          time_of_day: prev.time_of_day && OUTDOOR_ONLY_TIMES.includes(prev.time_of_day) ? null : prev.time_of_day,
        }
      }
      return {
        ...prev,
        scene_type: type,
        light_source: null,
        light_style: null,
        light_modifiers: [],
      }
    })
  }

  function setCondition<K extends 'time_of_day' | 'season' | 'weather' | 'ground' | 'wind' | 'light_source' | 'light_style'>(key: K, value: Scene[K]) {
    setScene(prev => ({ ...prev, [key]: value }))
  }

  function setBackground(value: BackgroundKey | null) {
    setScene(prev => ({ ...prev, background: value }))
  }

  function setCameraSetting<K extends 'shot_type' | 'camera_angle' | 'lens' | 'depth_of_field' | 'aspect_ratio'>(key: K, value: Scene[K]) {
    setScene(prev => ({ ...prev, [key]: value }))
  }

  function toggleLightModifier(key: LightModifierKey) {
    setScene(prev => ({
      ...prev,
      light_modifiers: prev.light_modifiers.includes(key)
        ? prev.light_modifiers.filter(m => m !== key)
        : [...prev.light_modifiers, key],
    }))
  }

  const loadRefImages_forSlot = useCallback(async (
    slotKey: RefSlotKey,
    assetId: string,
  ) => {
    if (refImagesMap[assetId] !== undefined) return // already loaded
    setRefLoadingMap(prev => ({ ...prev, [assetId]: true }))
    const table = slotKey === 'character' ? 'character_variants'
      : slotKey === 'outfit' ? 'outfit_variants' : 'location_variants'
    const fk = slotKey === 'character' ? 'character_id'
      : slotKey === 'outfit' ? 'outfit_id' : 'location_id'
    const imgs = await loadRefImages(table, fk, assetId)
    setRefImagesMap(prev => ({ ...prev, [assetId]: imgs }))
    setRefLoadingMap(prev => ({ ...prev, [assetId]: false }))
  }, [refImagesMap])

  function setSlot(key: SlotKey, value: Scene[SlotKey]) {
    setScene(prev => ({ ...prev, [key]: value }))

    // Auto-load ref images for character/outfit/location
    if (REF_SLOTS.includes(key as RefSlotKey) && value) {
      const slotKey = key as RefSlotKey
      const asset = value as { id: string }
      // Reset selected ref when changing asset
      setSceneRefs(prev => ({ ...prev, [slotKey]: null }))
      loadRefImages_forSlot(slotKey, asset.id)
    }
  }

  function clearSlot(key: SlotKey) {
    setScene(prev => ({ ...prev, [key]: null }))
    if (REF_SLOTS.includes(key as RefSlotKey)) {
      setSceneRefs(prev => ({ ...prev, [key as RefSlotKey]: null }))
    }
  }

  function clearAll() {
    setScene({
      scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
      light_source: null, light_style: null, light_modifiers: [],
      ground: null, wind: null,
      shot_type: null, camera_angle: null, lens: null, depth_of_field: null, aspect_ratio: null,
      character: null, outfit: null,
      location: null, pose: null, expression: null, camera: null,
      style: null, grading: null, background: null,
    })
    setSceneRefs({
      character: null, outfit: null, location: null,
    })
  }

  function handleCopy() {
    if (!prompt) return
    navigator.clipboard.writeText(prompt)
    toast.success('Prompt kopiert!')
  }

  // ── Bildgenerierung (PROJ-37) ──────────────────────────────────────────────

  /**
   * Genau die Bilder, die im Abschnitt „Referenz-Export" angezeigt werden.
   * Dieselbe Regel wie dort: das gewählte Referenzbild schlägt das Titelbild
   * des Assets.
   */
  const referenzen = useMemo(() => {
    type MitTitelbild = { cover_image_url?: string | null } | null
    // Die Rolle geht mit, sonst weiß das Bildmodell nicht, welches Bild wofür
    // steht — und nimmt schon mal die Person aus dem Outfit-Bild.
    const paare: [MitTitelbild, RefImage | null, ReferenzRolle][] = [
      [scene.character, sceneRefs.character, 'character'],
      [scene.outfit,    sceneRefs.outfit,    'outfit'],
      [scene.location,  sceneRefs.location,  'location'],
    ]
    const gesammelt: Referenz[] = []
    for (const [asset, ref, rolle] of paare) {
      if (!asset) continue
      const url = ref?.url ?? asset.cover_image_url
      if (url && !gesammelt.some(r => r.url === url)) gesammelt.push({ url, rolle })
    }
    return gesammelt
  }, [scene, sceneRefs])

  // ── Presets (PROJ-31A) ──────────────────────────────────────────────────────

  function buildPresetConfigFromScene(): ScenePresetConfig {
    return {
      scene_type: scene.scene_type,
      time_of_day: scene.time_of_day,
      season: scene.season,
      weather: scene.weather,
      light_source: scene.light_source,
      light_style: scene.light_style,
      light_modifiers: scene.light_modifiers,
      shot_type: scene.shot_type,
      ground: scene.ground,
      wind: scene.wind,
      camera_angle: scene.camera_angle,
      lens: scene.lens,
      depth_of_field: scene.depth_of_field,
      aspect_ratio: scene.aspect_ratio,
      background: scene.background,
      character_id: scene.character?.id ?? null,
      outfit_id: scene.outfit?.id ?? null,
      location_id: scene.location?.id ?? null,
      pose_id: scene.pose?.id ?? null,
      expression_id: scene.expression?.id ?? null,
      camera_id: scene.camera?.id ?? null,
      style_id: scene.style?.id ?? null,
      grading_id: scene.grading?.id ?? null,
      refs: {
        character: sceneRefs.character,
        outfit:    sceneRefs.outfit,
        location:  sceneRefs.location,
      },
    }
  }

  const autoPresetCoverUrl =
    sceneRefs.location?.url ?? scene.location?.cover_image_url ??
    sceneRefs.character?.url ?? scene.character?.cover_image_url ??
    sceneRefs.outfit?.url ?? scene.outfit?.cover_image_url ??
    scene.style?.cover_image_url ?? scene.grading?.cover_image_url ?? null

  function applyPresetConfig(config: ScenePresetConfig) {
    setScene({
      scene_type: config.scene_type,
      time_of_day: config.time_of_day as TimeOfDayKey | null,
      season: config.season as SeasonKey | null,
      weather: config.weather as WeatherKey | null,
      light_source: config.light_source as LightSourceKey | null,
      light_style: config.light_style as LightStyleKey | null,
      light_modifiers: config.light_modifiers as LightModifierKey[],
      shot_type: config.shot_type as ShotTypeKey | null,
      ground: (config.ground ?? null) as GroundStateKey | null,
      wind: (config.wind ?? null) as WindKey | null,
      camera_angle: config.camera_angle as CameraAngleKey | null,
      lens: config.lens as LensKey | null,
      depth_of_field: config.depth_of_field as DepthOfFieldKey | null,
      aspect_ratio: config.aspect_ratio as AspectRatioKey | null,
      background: config.background as BackgroundKey | null,
      character: config.character_id ? characters.find(c => c.id === config.character_id) ?? null : null,
      outfit: config.outfit_id ? outfits.find(o => o.id === config.outfit_id) ?? null : null,
      location: config.location_id ? locations.find(l => l.id === config.location_id) ?? null : null,
      pose: config.pose_id ? poseActions.find(p => p.id === config.pose_id) ?? null : null,
      expression: config.expression_id ? expressions.find(e => e.id === config.expression_id) ?? null : null,
      camera: config.camera_id ? cameras.find(c => c.id === config.camera_id) ?? null : null,
      style: config.style_id ? styles.find(s => s.id === config.style_id) ?? null : null,
      grading: config.grading_id ? gradings.find(g => g.id === config.grading_id) ?? null : null,
    })
    // Ein vor PROJ-52 gespeichertes Preset kann noch Archetyp-Felder enthalten.
    // Die werden hier schlicht nicht mehr gelesen — das Laden scheitert daran
    // nicht, siehe EMPTY_PRESET_CONFIG in `scene-preset-types.ts`.
    // `config.refs?.` mit Rückfall, nicht `config.refs.`: `normalize()` in
    // `use-scene-presets.ts` ist ein FLACHER Spread über `EMPTY_PRESET_CONFIG`.
    // Steht in einem gespeicherten Preset `"refs": null`, überschreibt das den
    // Vorgabewert vollständig — und der Zugriff hier würfe. Und zwar erst NACH
    // `setScene(...)` weiter oben: Die Szene wäre dann halb angewendet, der
    // Erfolgshinweis käme nie, und auf dem Bildschirm stünde ein Zustand, den
    // niemand ausgewählt hat. Ein halb übernommenes Preset ist schlimmer als
    // ein abgelehntes.
    setSceneRefs({
      character: config.refs?.character ?? null,
      outfit:    config.refs?.outfit ?? null,
      location:  config.refs?.location ?? null,
    })
    if (config.character_id) loadRefImages_forSlot('character', config.character_id)
    if (config.outfit_id) loadRefImages_forSlot('outfit', config.outfit_id)
    if (config.location_id) loadRefImages_forSlot('location', config.location_id)
    toast.success('Preset angewendet')
  }

  // ── Left panel content per tab ─────────────────────────────────────────────

  /**
   * Die Kacheln des aktuellen Reiters — UNGEFILTERT.
   *
   * Gefiltert wird eine Stufe später (`useBausteinFilter`). Wichtig ist, dass
   * hier `description`, `category` und `tags` MITKOMMEN: Ohne sie sucht
   * `passtZurSuche` nur über den Namen, und genau das war der Befund von
   * PROJ-46. Nachgemessen am 04.09.2026 an den Hooks — alle Listen-Abfragen
   * holen `select('*')`, die Felder sind also da:
   *
   *   characters      description, tags               — keine Kategorie
   *   outfits         description, category, tags
   *   locations       description, category, tags
   *   pose_actions    description, category, tags
   *   visual_assets   description, category, tags     — Mimik hat nur „alle"
   *   look/grading    description, tags               — keine Kategorie
   */
  const leftContent = useMemo((): {
    loading: boolean
    einzahl: string
    labels?: Record<string, string>
    items: Array<{
      id: string; name: string; imageUrl: string | null
      description?: string | null; category?: string | null; tags?: string[] | null
      hinweis?: string | null
      isSelected: boolean; onSelect: () => void
    }>
  } => {
    switch (activeTab) {
      case 'charaktere': return {
        loading: loadingChars, einzahl: 'Charakter',
        items: characters.map(c => ({
          id: c.id, name: c.name, imageUrl: c.cover_image_url,
          description: c.description, tags: c.tags,
          isSelected: scene.character?.id === c.id, onSelect: () => setSlot('character', c),
        }))
      }
      case 'outfits': return {
        loading: loadingOutfits, einzahl: 'Outfit',
        // Eine Quelle für die Beschriftung: „komplett" heißt überall
        // „Komplett-Look" — auf dem Chip wie auf der Kachel.
        labels: OUTFIT_KATEGORIE_LABELS,
        // Komplett-Looks zuerst, dann die Einzelteile: Das Fach heisst
        // „Outfit", und der ganze Look ist der Normalfall. Innerhalb der
        // beiden Gruppen bleibt die Reihenfolge des Hooks (nach Namen).
        items: [...outfits]
          .sort((a, b) => Number(b.category === 'komplett') - Number(a.category === 'komplett'))
          .map(o => ({
            id: o.id, name: o.name, imageUrl: o.cover_image_url,
            description: o.description, category: o.category, tags: o.tags,
            hinweis: kategorieEintrag(o.category)?.label ?? null,
            isSelected: scene.outfit?.id === o.id,
            onSelect: () => setSlot('outfit', o),
          }))
      }
      case 'locations': return {
        loading: loadingLocs, einzahl: 'Location',
        items: locations.map(l => ({
          id: l.id, name: l.name, imageUrl: l.cover_image_url,
          description: l.description, category: l.category, tags: l.tags,
          isSelected: scene.location?.id === l.id, onSelect: () => setSlot('location', l),
        }))
      }
      case 'posen': return {
        loading: loadingPoses, einzahl: 'Pose',
        items: poseActions.map(p => ({
          id: p.id, name: p.name, imageUrl: p.cover_image_url,
          description: p.description, category: p.category, tags: p.tags,
          isSelected: scene.pose?.id === p.id, onSelect: () => setSlot('pose', p),
        }))
      }
      case 'ausdruck': return {
        loading: loadingVisual, einzahl: 'Mimik',
        // Alle Mimik-Einträge liegen in der Kategorie „alle" — `chipListe`
        // blendet die Zeile deshalb von selbst aus. Das Feld wird trotzdem
        // mitgegeben, damit die Suche es sieht.
        items: expressions.map(e => ({
          id: e.id, name: e.name, imageUrl: e.cover_image_url,
          description: e.description, category: e.category, tags: e.tags,
          isSelected: scene.expression?.id === e.id, onSelect: () => setSlot('expression', e),
        }))
      }
      case 'kamera': return {
        loading: loadingVisual, einzahl: 'Kamera-Asset',
        labels: KAMERA_LABELS,
        items: cameras.map(c => ({
          id: c.id, name: c.name, imageUrl: c.cover_image_url,
          description: c.description, category: c.category, tags: c.tags,
          isSelected: scene.camera?.id === c.id, onSelect: () => setSlot('camera', c),
        }))
      }
      case 'stil': return {
        loading: loadingLookGrading, einzahl: 'Stil',
        items: styles.map(s => ({
          id: s.id, name: s.name, imageUrl: s.cover_image_url,
          description: s.description, tags: s.tags,
          isSelected: scene.style?.id === s.id, onSelect: () => setSlot('style', s),
        }))
      }
      case 'grading': return {
        loading: loadingLookGrading, einzahl: 'Grading',
        items: gradings.map(g => ({
          id: g.id, name: g.name, imageUrl: g.cover_image_url,
          description: g.description, tags: g.tags,
          isSelected: scene.grading?.id === g.id, onSelect: () => setSlot('grading', g),
        }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, characters, outfits, locations, poseActions, expressions, cameras, styles, gradings, scene, loadingChars, loadingOutfits, loadingLocs, loadingPoses, loadingVisual, loadingLookGrading])

  /**
   * Suchfeld und Kategorie-Chips über der Auswahlspalte (PROJ-46).
   *
   * Bis hierher zeigte die Spalte je Reiter eine reine Kachelliste. Seit der
   * Zusammenlegung von Fashion und Outfits (PROJ-53) liegen dort 36 Einträge
   * statt 17, bei den Locations 46 — davon 31 Stadien in EINER Kategorie. Das
   * ist genau das Scrollen, von dem Mark am 03.09.2026 gesprochen hat, nur an
   * der zweiten Stelle.
   *
   * `activeTab` als Bereich: Beim Reiterwechsel fallen Suche und Kategorie
   * zurück — „natur" gilt bei den Posen nicht.
   */
  const filter = useBausteinFilter(leftContent.items, activeTab)

  const currentTab = TABS.find(t => t.key === activeTab)!

  // Die Tageszeiten, die drinnen keinen Sinn ergeben, fallen dort weg.
  const tageszeiten = scene.scene_type === 'indoor'
    ? TIME_OF_DAY.filter(t => !OUTDOOR_ONLY_TIMES.includes(t.key))
    : TIME_OF_DAY

  return (
    <div className="sb-papier flex h-svh min-w-0 overflow-hidden">

      {/* ── Spalte 1: Auswahl — bleibt der Ort der Auswahl ── */}
      <div className="sb-kante-r flex w-[26rem] shrink-0 flex-col bg-[var(--sb-pap2)]">
        <header className="flex shrink-0 items-center gap-2 border-b border-[var(--sb-rule)] px-3.5 py-3.5">
          <SidebarTrigger />
          <span className="text-base font-bold tracking-[0.06em]">Scene Builder</span>
        </header>

        {/* Reiter */}
        <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-[var(--sb-rule2)] px-3.5 py-3">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-[4px] border px-2.5 py-1.5 text-sm transition-colors',
                activeTab === tab.key
                  ? 'border-[var(--sb-or)] bg-[var(--sb-or-l)] font-bold text-[var(--sb-or-t)]'
                  : 'border-transparent text-[var(--sb-ink3)] hover:bg-[var(--sb-card)] hover:text-[var(--sb-ink)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Suchen & filtern — steht FEST über der Rollflaeche und rollt nicht
            mit weg: Wer bei Eintrag 30 merkt, dass er sucht, soll nicht erst
            wieder nach oben scrollen muessen. */}
        {!leftContent.loading && leftContent.items.length > 0 && (
          <div className="sb-filter shrink-0 border-b border-[var(--sb-rule2)] px-3.5 py-2.5">
            <BausteinFilter
              suche={filter.suche}
              onSuche={filter.setSuche}
              kategorie={filter.kategorie}
              onKategorie={filter.setKategorie}
              chips={filter.chips}
              platzhalter={`${leftContent.einzahl} suchen …`}
              labels={leftContent.labels}
            />
          </div>
        )}

        {/* Kachelliste */}
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken overflow-y-auto overflow-x-hidden p-3.5">
            <div className="mb-2.5 flex items-center gap-2.5 pr-4">
              <b className="text-[13px] uppercase tracking-[0.15em] text-[var(--sb-ink2)]">{currentTab.label}</b>
              <div
                className="sb-punktlinie h-px flex-1"
                aria-hidden="true"
              />
              <span className="text-[13px] tabular-nums text-[var(--sb-ink3)]">{filter.gefiltert.length}</span>
            </div>

            {leftContent.loading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4]" />
                ))}
              </div>
            ) : leftContent.items.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center">
                <span className="text-3xl opacity-25">{currentTab.emoji}</span>
                <p className="text-sm text-[var(--sb-ink3)]">Noch keine {currentTab.label}</p>
              </div>
            ) : filter.gefiltert.length === 0 ? (
              /* Leer wegen des Filters, nicht wegen fehlender Eintraege — die
                 beiden Faelle duerfen nicht denselben Satz zeigen, sonst sucht
                 man den Fehler bei den Daten statt im Suchfeld. */
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-3 text-center">
                <span className="text-3xl opacity-25">🔍</span>
                <p className="text-sm text-[var(--sb-ink3)]">
                  Kein Treffer unter {leftContent.items.length} {currentTab.label}
                </p>
                <button
                  onClick={() => { filter.setSuche(''); filter.setKategorie(null) }}
                  className="text-sm font-medium text-[var(--sb-or-t)] underline underline-offset-2 hover:text-[var(--sb-or-t)]"
                >
                  Filter aufheben
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filter.gefiltert.map(item => (
                  <AssetThumb
                    key={item.id}
                    name={item.name}
                    imageUrl={item.imageUrl}
                    emoji={currentTab.emoji}
                    isSelected={item.isSelected}
                    onClick={item.onSelect}
                    hinweis={item.hinweis ?? null}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Spalte 2: der Bogen ── */}
      <div className="sb-blatt flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative flex h-[58px] shrink-0 items-center gap-3.5 border-b border-[var(--sb-rule)] px-6">
          <Passkreuz />
          <h1 className="text-[19px] font-bold uppercase tracking-[0.22em]">Szene</h1>
          <span className="text-[13px] tracking-[0.14em] text-[var(--sb-ink3)]">
            SZENENBOGEN · {SLOTS.length} FELDER
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-9 border-[var(--sb-rule)] bg-[var(--sb-card)] text-sm text-[var(--sb-ink2)] hover:bg-[var(--sb-pap2)] hover:text-[var(--sb-ink)]"
            onClick={() => setPresetsOpen(true)}
          >
            Presets
          </Button>
          {hasAnyAsset && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 border-[var(--sb-rule)] bg-[var(--sb-card)] text-sm text-[var(--sb-ink2)] hover:bg-[var(--sb-pap2)] hover:text-[var(--sb-ink)]"
              onClick={clearAll}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />Leeren
            </Button>
          )}
          <Passkreuz />
          <div className="pointer-events-none absolute inset-x-0 bottom-[3px] h-px bg-[var(--sb-rule2)]" aria-hidden="true" />
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken overflow-y-auto overflow-x-hidden px-6 py-[18px]">

            {/* ══ Bausteine — ganz oben, weil man erst weiss WER im Bild ist ══ */}
            <div className="mb-2.5 flex items-center gap-3">
              <h2 className="text-[13.5px] font-bold uppercase tracking-[0.22em]">Bausteine</h2>
              <div className="sb-sech-rule flex-1" aria-hidden="true" />
              <span className="text-[13px] tabular-nums tracking-[0.1em] text-[var(--sb-ink3)]">
                {belegt} VON {SLOTS.length} BELEGT
              </span>
            </div>

            <div className="sb-strip px-2.5 pb-[7px] pt-2.5">
              {/*
                RANDNUMMER UND FELD STEHEN IN DERSELBEN ZELLE — nicht in zwei
                getrennten Rastern uebereinander. Zwei Raster stimmen nur so
                lange ueberein, wie beide gleich viele Spalten haben; sobald
                die Spalte schmal wird und das Raster auf zwei Spalten
                umbricht, stuende „03 — LOC" ueber dem Charakterfeld.
              */}
              <div className="sb-raster-felder">
                {SLOTS.map((slot, i) => {
                  const assetId = (scene[slot.key] as { id: string } | null)?.id
                  const hasRef = REF_SLOTS.includes(slot.key as RefSlotKey)
                  return (
                    <div key={slot.key} className="flex h-full flex-col">
                      <div className="mb-[5px] flex items-baseline gap-2 text-[13px] tabular-nums tracking-[0.14em] text-[var(--sb-ink3)]">
                        <span>{String(i + 1).padStart(2, '0')} — {slot.code}</span>
                        {scene[slot.key] && (
                          <span className="ml-auto font-bold tracking-[0.14em] text-[var(--sb-or-t)]">GEWÄHLT</span>
                        )}
                      </div>
                      <SzenenFeld
                        slot={slot}
                        asset={scene[slot.key] as { name: string; cover_image_url?: string | null } | null}
                        refImages={hasRef && assetId ? (refImagesMap[assetId] ?? []) : undefined}
                        refLoading={hasRef && assetId ? (refLoadingMap[assetId] ?? false) : undefined}
                        selectedRef={hasRef ? sceneRefs[slot.key as RefSlotKey] : undefined}
                        onSelectRef={hasRef ? (img) => setSceneRefs(prev => ({ ...prev, [slot.key]: img })) : undefined}
                        onClear={() => clearSlot(slot.key)}
                        onSelect={() => setActiveTab(slot.tab)}
                      />
                    </div>
                  )
                })}
              </div>
              <Perforation />
            </div>

            {!hasAnyAsset && (
              <p className="mt-2.5 text-[13px] text-[var(--sb-ink3)]">
                Links auswählen — der Baustein erscheint hier im Feld.
              </p>
            )}

            {/* Ab hier: weiche Karten. Alles Druckgrafische bleibt oberhalb. */}
            <Doppellinie />

            <div className="mb-3.5 sb-raster-karten">
              <Karte titel="Szenentyp" farbe="gr">
                <div className="flex flex-wrap gap-[7px]">
                  {SCENE_TYPES.map(t => (
                    <Chip key={t.key} aktiv={scene.scene_type === t.key} onClick={() => setSceneType(t.key)}>
                      <span aria-hidden="true">{t.emoji}</span>
                      <span>{t.label}</span>
                    </Chip>
                  ))}
                </div>

                {/*
                  DAS WETTER STEHT HIER, NICHT MEHR ZUGEKLAPPT (Mark, 04.09.2026:
                  „das Wetter sollte unter den Szenentyp, da ist noch Platz").
                  Die Karte trug nur zwei Knoepfe und liess darunter eine hohe
                  Leerflaeche stehen, waehrend das Wetter eine Zeile tiefer
                  zugeklappt war. Drinnen gibt es kein Wetter — dann bleibt die
                  Karte so klein wie vorher.
                */}
                {scene.scene_type === 'outdoor' && (
                  <div className="mt-3">
                    <ChipGroup
                      label="Wetter"
                      options={WEATHERS}
                      selected={scene.weather}
                      onSelect={v => setCondition('weather', v)}
                    />
                  </div>
                )}
              </Karte>

              <Karte titel="Szenenbedingungen" farbe="cy">
                <ChipGroup
                  label="Tageszeit"
                  options={tageszeiten}
                  selected={scene.time_of_day}
                  onSelect={v => setCondition('time_of_day', v)}
                />
                {scene.scene_type === 'outdoor' ? (
                  <ChipGroup
                    label="Jahreszeit"
                    options={SEASONS}
                    selected={scene.season}
                    onSelect={v => setCondition('season', v)}
                  />
                ) : (
                  <ChipGroup
                    label="Lichtquelle"
                    options={LIGHT_SOURCES}
                    selected={scene.light_source}
                    onSelect={v => setCondition('light_source', v)}
                  />
                )}

                {/*
                  BODEN UND WIND SIND EIGENE ACHSEN (PROJ-56).

                  Vorher steckte beides im Wetter: „Schnee" hiess zugleich
                  Schneefall UND Schneedecke, Wind gab es nur als „Sturm".
                  Mark: „Es kann natuerlich auch sein, dass zwar Schnee liegt,
                  aber die Sonne scheint." Genau das geht jetzt.
                */}
                {scene.scene_type === 'outdoor' && (
                  <ChipGroup
                    label="Bodenzustand"
                    options={GROUND_STATES}
                    selected={scene.ground}
                    onSelect={v => setCondition('ground', v)}
                  />
                )}

                {/*
                  WIND GILT IN BEIDEN SZENENTYPEN — drinnen ist es die
                  Windmaschine. Deshalb wechselt hier die Beschriftung, nicht
                  das Feld: derselbe Wert, im Prompt aber ein anderer Satz
                  (`WINDS[].studio` statt `.prompt`), damit im Studio keine
                  wehenden Blaetter stehen.
                */}
                <ChipGroup
                  label={scene.scene_type === 'outdoor' ? 'Wind' : 'Windmaschine'}
                  options={WINDS}
                  selected={scene.wind}
                  onSelect={v => setCondition('wind', v)}
                />
              </Karte>
            </div>

            <div className="mb-3.5 sb-raster-karten">
              <Karte titel="Kamera-Einstellungen" farbe="am">
                <ChipGroup
                  label="Bildausschnitt"
                  options={SHOT_TYPES}
                  selected={scene.shot_type}
                  onSelect={v => setCameraSetting('shot_type', v)}
                />
                {/*
                  135 mm BLEIBT IN DER REIHE. Im Entwurf fehlte es nur, damit
                  die Zeile im Bild nicht umbricht — das war eine Notloesung
                  fuers Bild, kein Vorschlag. Der Umbruch ist stattdessen
                  erlaubt: `flex-wrap` in `ChipZeile`.
                */}
                <ChipGroup
                  label="Objektiv"
                  options={LENSES}
                  selected={scene.lens}
                  onSelect={v => setCameraSetting('lens', v)}
                />
              </Karte>

              <Karte titel="Bild & Schärfe" farbe="or">
                <ChipGroup
                  label="Tiefenschärfe"
                  options={DEPTH_OF_FIELDS}
                  selected={scene.depth_of_field}
                  onSelect={v => setCameraSetting('depth_of_field', v)}
                />
                <ChipGroup
                  label="Bildorientierung"
                  breit
                  options={ASPECT_RATIOS}
                  selected={scene.aspect_ratio}
                  onSelect={v => setCameraSetting('aspect_ratio', v)}
                />
              </Karte>
            </div>

            {/*
              Sitzt oben eine Location im Baustein, faellt die Karte
              „Studio-Hintergrund" weg — dann bekommt „Zugeklappt" die ganze
              Zeile. Frueher stand dafuer eine Fallunterscheidung hier; seit
              das Raster `auto-fit` benutzt, erledigt sich das von selbst: ein
              einzelnes Kind fuellt die Zeile.
            */}
            <div className="sb-raster-karten">
              {/*
                Studio-Hintergrund — er wirkt nur DRINNEN und nur, solange keine
                Location im Baustein sitzt. Deshalb steht die Karte auch nur
                dann da.

                VORHER STAND SIE AUCH DRAUSSEN, mit dem Hinweis „wird
                ignoriert". Sie wurde aber nicht ignoriert: Der Prompt-Bau
                fragte den Szenentyp gar nicht und schrieb den Hintergrundkarton
                mitten in die Aussenszene. Mark hat das am 04.09.2026 gemeldet.
                Ein Hinweis, der nicht stimmt, ist schlimmer als keiner — jetzt
                kann der Fall gar nicht mehr entstehen.
              */}
              {scene.scene_type !== 'outdoor' && !scene.location && (
                <Karte titel="Studio-Hintergrund" dim>
                  <ChipGroup
                    label="Grundton"
                    options={STUDIO_BACKGROUNDS}
                    selected={scene.background}
                    onSelect={setBackground}
                    gedaempft
                  />
                  <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--sb-ink3)]">
                    Der Rückfall, wenn keine <b className="font-semibold text-[var(--sb-ink2)]">Location</b> gewählt
                    ist. Sobald oben eine im Baustein sitzt, gewinnt sie — und draußen gibt es keinen
                    Hintergrundkarton, dort steht diese Karte deshalb gar nicht.
                  </p>
                </Karte>
              )}

              {/*
                ZUGEKLAPPT, ABER NICHT VERSTECKT. Jede Zeile nennt ihren
                aktuellen Wert in Orange — zugeklappt heisst „selten gebraucht",
                nicht „nicht gesetzt". Kein Wert geht dabei verloren; jede
                Gruppe ist mit einem Klick wieder offen.
              */}
              {/*
                ZUGEKLAPPT, ABER NICHT VERSTECKT. Jede Zeile nennt ihren
                aktuellen Wert — zugeklappt heisst „selten gebraucht", nicht
                „nicht gesetzt". Kein Wert geht verloren; ein Klick oeffnet.

                DRAUSSEN GIBT ES HIER NICHTS MEHR. Der Kamerawinkel ist am
                04.09.2026 auf Marks Wunsch ganz herausgefallen („den haben wir
                ja sonst doppelt — den gibt's ja oben auch schon mal", gemeint
                ist der Baustein Kamera-Asset, der die Kamerafuehrung mitbringt),
                und das Wetter steht jetzt in der Szenentyp-Karte. Uebrig
                bleiben nur die beiden Licht-Gruppen, und die gelten drinnen.
              */}
              {scene.scene_type !== 'outdoor' && (
                <Karte titel="Zugeklappt">
                  <Fold
                    label="Lichtstil"
                    wert={optionLabel(LIGHT_STYLES, scene.light_style)}
                    offen={!!aufgeklappt.lichtstil}
                    onToggle={() => klappe('lichtstil')}
                  >
                    {LIGHT_STYLES.map(o => (
                      <Chip
                        key={o.key}
                        aktiv={scene.light_style === o.key}
                        onClick={() => setCondition('light_style', scene.light_style === o.key ? null : o.key)}
                      >
                        <span aria-hidden="true">{o.emoji}</span>
                        <span>{o.label}</span>
                      </Chip>
                    ))}
                  </Fold>
                  <Fold
                    label="Lichtmodifier"
                    wert={optionLabels(LIGHT_MODIFIERS, scene.light_modifiers)}
                    offen={!!aufgeklappt.lichtmod}
                    onToggle={() => klappe('lichtmod')}
                  >
                    {LIGHT_MODIFIERS.map(o => (
                      <Chip
                        key={o.key}
                        aktiv={scene.light_modifiers.includes(o.key)}
                        onClick={() => toggleLightModifier(o.key)}
                      >
                        <span aria-hidden="true">{o.emoji}</span>
                        <span>{o.label}</span>
                      </Chip>
                    ))}
                  </Fold>
                </Karte>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Spalte 3: Prompt & Referenzen ── */}
      <div className="sb-kante-l flex w-[25rem] shrink-0 flex-col overflow-hidden bg-[var(--sb-pap2)]">
        <header className="flex h-[58px] shrink-0 items-center gap-2.5 border-b border-[var(--sb-rule)] px-4">
          <Passkreuz />
          <span className="flex-1 text-base font-bold tracking-[0.06em]">Prompt &amp; Referenzen</span>
          <Button size="sm" onClick={handleCopy} disabled={!prompt}
            className="h-9 shrink-0 bg-[var(--sb-or-t)] text-sm font-bold text-white hover:bg-[var(--sb-or-t)] disabled:opacity-40">
            <Copy className="mr-1.5 h-3.5 w-3.5" />Kopieren
          </Button>
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken space-y-4 overflow-y-auto overflow-x-hidden p-4">

            {/* Bildgenerierung (PROJ-37) — der Prompt bleibt unverändert, er wird nur weitergereicht */}
            <QueueButton
              prompt={prompt}
              scene={scene}
              referenzen={referenzen}
              aspectRatio={scene.aspect_ratio}
              sceneMeta={buildPresetConfigFromScene() as unknown as Record<string, unknown>}
              szenenName={
                scene.character?.name ?? scene.location?.name ??
                scene.outfit?.name ?? scene.style?.name ?? null
              }
            />

            {/* Szenentyp + Bedingungen als Marken */}
            <div>
              <Feldname>Szene</Feldname>
              <div className="flex flex-wrap items-center gap-[7px]">
                <Marke betont>
                  {SCENE_TYPES.find(t => t.key === scene.scene_type)?.label}
                </Marke>
                {hasAnyCondition && (
                  <>
                    {scene.time_of_day && (
                      <Marke>{optionLabel(TIME_OF_DAY, scene.time_of_day)}</Marke>
                    )}
                    {scene.scene_type === 'outdoor' && scene.season && (
                      <Marke>{optionLabel(SEASONS, scene.season)}</Marke>
                    )}
                    {scene.scene_type === 'outdoor' && scene.weather && (
                      <Marke>{optionLabel(WEATHERS, scene.weather)}</Marke>
                    )}
                    {scene.scene_type === 'indoor' && scene.light_source && (
                      <Marke>{optionLabel(LIGHT_SOURCES, scene.light_source)}</Marke>
                    )}
                    {scene.scene_type === 'indoor' && scene.light_style && (
                      <Marke>{optionLabel(LIGHT_STYLES, scene.light_style)}</Marke>
                    )}
                    {scene.scene_type === 'indoor' && scene.light_modifiers.map(m => (
                      <Marke key={m}>{optionLabel(LIGHT_MODIFIERS, m)}</Marke>
                    ))}
                  </>
                )}
                {hasAnyCameraSetting && (
                  <>
                    {scene.shot_type && <Marke>{optionLabel(SHOT_TYPES, scene.shot_type)}</Marke>}
                    {scene.camera_angle && <Marke>{optionLabel(CAMERA_ANGLES, scene.camera_angle)}</Marke>}
                    {scene.lens && <Marke>{optionLabel(LENSES, scene.lens)}</Marke>}
                    {scene.depth_of_field && <Marke>{optionLabel(DEPTH_OF_FIELDS, scene.depth_of_field)}</Marke>}
                    {scene.aspect_ratio && <Marke>{optionLabel(ASPECT_RATIOS, scene.aspect_ratio)}</Marke>}
                  </>
                )}
                {!scene.location && scene.background && (
                  <Marke>{optionLabel(STUDIO_BACKGROUNDS, scene.background)}</Marke>
                )}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <Feldname>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[var(--sb-or-t)]" aria-hidden="true" />
                  Prompt
                </span>
              </Feldname>

              {prompt ? (
                <div className="border border-[var(--sb-rule)] bg-[var(--sb-card)] p-4">
                  <pre className="whitespace-pre-wrap font-sans text-[14.5px] leading-[1.62] text-[var(--sb-ink2)]">{prompt}</pre>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 border border-dashed border-[var(--sb-rule)] p-6 text-center">
                  <span className="text-3xl opacity-25">✨</span>
                  <p className="text-sm text-[var(--sb-ink3)]">
                    Füge Bausteine zur Szene hinzu — der Prompt wird automatisch erzeugt.
                  </p>
                </div>
              )}
            </div>

            {/* Referenz-Export */}
            {(scene.character || scene.outfit || scene.location) && (
              <div>
                <Feldname>Referenz-Export</Feldname>
                <p className="-mt-1 mb-2.5 text-[13px] text-[var(--sb-ink3)]">
                  Diese Bilder werden als Referenz übergeben.
                </p>
                <div className="space-y-2.5">
                  <RefExportCard label="Charakter" emoji="👤" asset={scene.character} refImage={sceneRefs.character} />
                  <RefExportCard label="Outfit"    emoji="👗" asset={scene.outfit}    refImage={sceneRefs.outfit}    />
                  <RefExportCard label="Location"  emoji="📍" asset={scene.location}  refImage={sceneRefs.location}  />
                </div>
              </div>
            )}

            {/* Pose / Mimik / Kamera / Stil / Grading */}
            {(scene.pose || scene.expression || scene.camera || scene.style || scene.grading) && (
              <div>
                <Feldname>Stil &amp; Komposition</Feldname>
                <div className="space-y-2.5">
                  <NebenAsset label="Pose"         emoji="🎭" asset={scene.pose} />
                  <NebenAsset label="Mimik"        emoji="😊" asset={scene.expression} />
                  <NebenAsset label="Kamera-Asset" emoji="📷" asset={scene.camera} />
                  <NebenAsset label="Stil"         emoji="🎥" asset={scene.style} />
                  <NebenAsset label="Grading"      emoji="🎨" asset={scene.grading} />
                </div>
              </div>
            )}

          </div>
        </div>

        <div className="flex shrink-0 items-center border-t border-[var(--sb-rule2)] px-4 py-3 text-[13px] tracking-[0.16em] text-[var(--sb-ink3)]">
          <span>PROMPT TRÉSOR</span>
          <span className="ml-auto tabular-nums">BOGEN {belegt} / {SLOTS.length}</span>
        </div>
      </div>

      <ScenePresetDialog
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        items={presetItems}
        loading={loadingPresets}
        currentConfig={buildPresetConfigFromScene()}
        autoCoverUrl={autoPresetCoverUrl}
        onApply={applyPresetConfig}
        onCreate={createPreset}
        onDelete={deletePreset}
        onDuplicate={duplicatePreset}
        onExport={exportPreset}
        onImport={importPresetFromFile}
        characters={characters}
        outfits={outfits}
        locations={locations}
        poseActions={poseActions}
        expressions={expressions}
        cameras={cameras}
        styles={styles}
        gradings={gradings}
      />
    </div>
  )
}
