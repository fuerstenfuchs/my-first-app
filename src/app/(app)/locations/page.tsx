'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Search, X, Pencil, Trash2, ExternalLink, Sparkles, Check, ChevronLeft, Crown, Upload, GripVertical, ZoomIn } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ImageLightbox } from '@/components/image-lightbox'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LocationForm } from '@/components/locations/location-form'
import { LocationVariantForm } from '@/components/locations/location-variant-form'
import { LocationSheetDialog } from '@/components/locations/location-sheet-dialog'
import { LocationImportWizard } from '@/components/locations/location-import-wizard'
// Eine Variantenkarte für alle Bibliotheken. Bis PROJ-53 lag sie unter
// `components/fashion-assets/`; mit der Zusammenlegung von Fashion und Outfits
// ist sie dorthin gezogen, wo sie jetzt zuhause ist. `accent="rose"` haelt das
// Aussehen dieser Seite unveraendert — die Outfit-Seite selbst ist orange.
import { OutfitVariantCard } from '@/components/outfits/outfit-variant-card'
import { CustomCategoryDialog } from '@/components/categories/custom-category-dialog'
import { useCustomCategories } from '@/hooks/use-custom-categories'
import {
  LOCATION_CATEGORIES, LOCATION_TYPES,
  useLocations, useLocationDetail,
  type Location, type LocationVariant, type LocationImage,
  type LocationInput, type LocationVariantInput, type LocationCategory,
} from '@/hooks/use-locations'
import { cn } from '@/lib/utils'
import { analysiere, type AnalyseBild } from '@/hooks/use-analyse'
import { useCappedImageSrc } from '@/hooks/use-capped-image-src'
import { passtZurSuche } from '@/lib/bausteine'
import { bildFuerAnalyse } from '@/lib/bild-fuer-analyse'

// ── Gallery card ──────────────────────────────────────────────────────────────

function LocationCard({
  location, categoryEmoji, isSelected, onClick, onEdit, onDelete,
}: {
  location: Location
  categoryEmoji: string
  isSelected: boolean
  onClick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative rounded-xl overflow-hidden border-2 transition-all text-left group bg-card/60',
        isSelected
          ? 'border-teal-500 ring-2 ring-teal-500/20 shadow-lg shadow-teal-500/10'
          : 'border-border/40 hover:border-teal-500/40'
      )}
    >
      <div className="aspect-[3/4] bg-muted/30 relative overflow-hidden">
        {location.cover_image_url ? (
          <img
            src={location.cover_image_url}
            alt={location.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground/20">
            <span className="text-4xl leading-none">{categoryEmoji}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div
          className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onEdit} className="w-6 h-6 rounded-md bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors">
            <Pencil className="h-3 w-3 text-white" />
          </button>
          <button onClick={onDelete} className="w-6 h-6 rounded-md bg-black/60 hover:bg-red-600/80 flex items-center justify-center transition-colors">
            <Trash2 className="h-3 w-3 text-white" />
          </button>
        </div>

        {location.source_url && (
          <div className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[9px] bg-black/60 text-white/80 px-1 py-0.5 rounded">
              {(() => { try { return new URL(location.source_url).hostname.replace('www.', '') } catch { return '' } })()}
            </span>
          </div>
        )}
      </div>

      <div className="px-2 py-2">
        <p className="text-xs font-medium leading-tight truncate">{location.name}</p>
        {location.location_type ? (
          <p className="text-[10px] text-teal-500/80 truncate mt-0.5">
            {LOCATION_TYPES.find(t => t.key === location.location_type)?.emoji}{' '}
            {LOCATION_TYPES.find(t => t.key === location.location_type)?.label}
          </p>
        ) : location.tags.length > 0 ? (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
            {location.tags.slice(0, 3).join(' · ')}
          </p>
        ) : null}
      </div>
    </button>
  )
}

// ── Sortable image card (variant viewer) ──────────────────────────────────────

function SortableVariantImage({
  image, isCover, onSetCover, onDelete, onOpen,
}: {
  image: LocationImage
  isCover: boolean
  onSetCover: () => void
  onDelete: () => void
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const src = useCappedImageSrc(image.url)

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={cn('relative rounded-md', isDragging && 'opacity-50 z-50')}>
      <div className="relative aspect-[4/3] rounded-md overflow-hidden border border-white/10 bg-black group">
        <img src={src} alt="" className="w-full h-full object-cover" />

        {/* pointer-events-none until hovered, so these invisible hit-areas don't block native image drag-out */}
        <div {...listeners} className="absolute top-1 left-1 cursor-grab active:cursor-grabbing p-1 bg-black/50 rounded z-10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
          <GripVertical className="h-3 w-3 text-white" />
        </div>

        {/* pointer-events-none so the underlying <img> stays draggable */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[5]" />

        <button type="button" onClick={onOpen} title="Vergrößern"
          className="absolute bottom-1 right-7 p-1 rounded bg-black/50 hover:bg-black/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10">
          <ZoomIn className="h-3.5 w-3.5 text-white" />
        </button>
        <button type="button" onClick={onDelete} title="Löschen"
          className="absolute bottom-1 right-1 p-1 rounded bg-black/50 hover:bg-red-600/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10">
          <Trash2 className="h-3 w-3 text-white" />
        </button>

        {isCover ? (
          <div className="absolute top-1 right-1 flex items-center gap-0.5 text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-semibold z-10 pointer-events-none">
            <Crown className="h-2.5 w-2.5" />Titelbild
          </div>
        ) : (
          <button type="button" onClick={onSetCover} title="Als Titelbild setzen"
            className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-amber-500 rounded z-10 opacity-30 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
            <Crown className="h-3 w-3 text-white" />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const { locations, loading, createLocation, updateLocation, deleteLocation, patchLocationCover, refetch: refetchLocations } = useLocations()
  const { categories: customCategories, createCategory: createCustomCategory, deleteCategory: deleteCustomCategory } = useCustomCategories('location')

  const [selectedCategory, setSelectedCategory] = useState<LocationCategory>('stadt')
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)

  const allCategories = useMemo(() => [
    ...LOCATION_CATEGORIES.map(c => ({ ...c, id: undefined as string | undefined })),
    ...customCategories.map(c => ({ key: c.key, label: c.label, emoji: c.emoji, id: c.id as string | undefined })),
  ], [customCategories])

  const [formOpen, setFormOpen]           = useState(false)
  const [importWizardOpen, setImportWizardOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null)

  const {
    location, variants, loading: detailLoading, uploading,
    createVariant, updateVariant, deleteVariant, reorderVariants,
    uploadImages, addImageUrl, deleteImage, reorderImages, updateLocationCover,
    refetch: refetchDetail,
  } = useLocationDetail(selectedLocationId)

  const [variantFormOpen, setVariantFormOpen]     = useState(false)
  const [editingVariant, setEditingVariant]       = useState<LocationVariant | null>(null)
  const [deleteVariantId, setDeleteVariantId]     = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const [sheetDialogOpen, setSheetDialogOpen] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<{
    name: string; category: LocationCategory; tags: string[]; description: string
  } | null>(null)
  const [applyFields, setApplyFields] = useState({ name: false, category: true, tags: true, description: true })
  const suggestionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (aiSuggestion) {
      setTimeout(() => suggestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    }
  }, [aiSuggestion])

  const [lightboxVariantIndex, setLightboxVariantIndex] = useState<number | null>(null)
  const variantUploadRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const l of locations) map[l.category] = (map[l.category] ?? 0) + 1
    return map
  }, [locations])

  const filteredLocations = useMemo(() =>
    locations.filter(l =>
      l.category === selectedCategory &&
      // PROJ-46: wortweise und über Name, Beschreibung, Kategorie und
      // Schlagworte. Die Kategorie steht hier weiter als eigene Spalte links —
      // sie ist schon da und zeigt mehr als eine Chipzeile.
      passtZurSuche(l, search)
    ), [locations, selectedCategory, search])

  async function handleLocationSave(input: LocationInput, coverFile?: File | null) {
    if (editingLocation) {
      const ok = await updateLocation(editingLocation.id, input)
      return ok
    }
    const l = await createLocation(input, coverFile)
    if (l) { setSelectedCategory(l.category); setSelectedLocationId(l.id) }
    return l
  }

  async function handleVariantSave(input: LocationVariantInput, files: File[]) {
    if (editingVariant) return updateVariant(editingVariant.id, input)
    const v = await createVariant(input)
    if (v) {
      setSelectedVariantId(v.id)
      if (files.length > 0) await uploadImages(v.id, files)
    }
    return v
  }

  function handleVariantImageDragEnd(event: DragEndEvent) {
    if (!selectedVariant) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const imgs = selectedVariant.images
    const oldIdx = imgs.findIndex(i => i.id === active.id)
    const newIdx = imgs.findIndex(i => i.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    reorderImages(selectedVariant.id, arrayMove(imgs, oldIdx, newIdx).map(i => i.id))
  }

  function handleVariantDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = variants.findIndex(v => v.id === active.id)
    const newIndex = variants.findIndex(v => v.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = [...variants]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)
    reorderVariants(newOrder.map(v => v.id))
  }

  async function handleAnalyzeLocation() {
    if (!location?.cover_image_url) return
    setAiAnalyzing(true)
    setAiSuggestion(null)
    setAiError(null)
    try {
      let body: AnalyseBild
      try {
        const imgRes = await fetch(location.cover_image_url)
        if (!imgRes.ok) throw new Error('fetch failed')
        const blob = await imgRes.blob()
        // DEN TYP ABLESEN, NICHT GLAUBEN — und was die Analyse nicht
        // versteht (AVIF, HEIC, BMP) vorher nach PNG umwandeln. Hier stand
        // `blob.type || 'image/jpeg'`, und daran ist Mark am 04.09.2026
        // gescheitert: „Image format image/jpeg not supported".
        body = await bildFuerAnalyse(blob)
      } catch {
        body = { imageUrl: location.cover_image_url }
      }
      // Erst Marks eigener Proxy, sonst die bezahlte Route. Welcher Weg es
      // wurde, sagt `analysiere` selbst per Hinweis — hier gibt es dadurch
      // nichts mehr zu entscheiden.
      const { ergebnis: result } = await analysiere<{ name?: string; category?: string; tags?: string[]; description?: string }>(
        'location',
        body,
        { route: '/api/analyze-location' },
      )
      const validCategories: string[] = allCategories.map(c => c.key)
      setApplyFields({ name: false, category: true, tags: true, description: true })
      setAiSuggestion({
        name:        result.name        ?? location.name,
        category:    (result.category && validCategories.includes(result.category) ? result.category : location.category),
        tags:        result.tags        ?? location.tags,
        description: result.description ?? location.description ?? '',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen'
      toast.error(msg)
      setAiError(msg)
    } finally {
      setAiAnalyzing(false)
    }
  }

  async function handleApplySuggestion() {
    if (!location || !aiSuggestion) return
    const patch: LocationInput = {
      name:        applyFields.name        ? aiSuggestion.name        : location.name,
      category:    applyFields.category    ? aiSuggestion.category    : location.category,
      tags:        applyFields.tags        ? aiSuggestion.tags        : location.tags,
      description: applyFields.description ? aiSuggestion.description : (location.description ?? undefined),
    }
    const ok = await updateLocation(location.id, patch)
    if (ok) {
      setAiSuggestion(null)
      refetchDetail()
    }
  }

  const currentCategory = allCategories.find(c => c.key === selectedCategory) ?? { key: selectedCategory, label: selectedCategory, emoji: '📦', id: undefined }
  const selectedVariant  = selectedVariantId ? variants.find(v => v.id === selectedVariantId) ?? null : null
  const detailOpen       = !!selectedLocationId

  return (
    <div className="flex h-svh min-w-0 overflow-hidden">

      {/* ── Col 1: Category nav ── */}
      <div className="w-48 shrink-0 flex flex-col border-r border-border">
        <header className="border-b shrink-0 px-3 py-3 flex items-center gap-2">
          <SidebarTrigger />
          <span className="text-sm font-semibold flex-1 truncate">Locations</span>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
            onClick={() => { setEditingLocation(null); setFormOpen(true) }} title="Neue Location">
            <Plus className="h-4 w-4" />
          </Button>
        </header>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {allCategories.map(cat => {
            const count    = categoryCounts[cat.key] ?? 0
            const isActive = selectedCategory === cat.key
            return (
              <div key={cat.key} className="group relative">
                <button
                  onClick={() => { setSelectedCategory(cat.key); setSelectedLocationId(null); setSearch('') }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                    isActive
                      ? 'bg-teal-500/10 text-teal-300 font-medium'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                  <span className="flex-1 truncate text-xs">{cat.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      'text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium',
                      isActive
                        ? 'bg-teal-500/20 text-teal-300'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
                {cat.id && (
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteCategoryId(cat.id!) }}
                    title="Kategorie löschen"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-0.5"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
          <button
            onClick={() => setCategoryDialogOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-muted-foreground/60 hover:bg-accent/50 hover:text-foreground transition-colors text-left"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate text-xs">Neue Kategorie</span>
          </button>
        </nav>
      </div>

      {/* ── Col 2: Gallery ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="border-b shrink-0 px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-sm">{currentCategory.emoji} {currentCategory.label}</span>
            <span className="text-xs text-muted-foreground/60">({filteredLocations.length})</span>
          </div>
          <div className="flex-1 min-w-0 relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Button size="sm" variant="outline" onClick={() => setImportWizardOpen(true)}>
              <Search className="mr-1.5 h-3.5 w-3.5" />Location importieren
            </Button>
            <Button size="sm" onClick={() => { setEditingLocation(null); setFormOpen(true) }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />Neue Location
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken overflow-y-auto overflow-x-hidden p-4">
            {loading ? (
              <div className={cn('grid gap-3', detailOpen ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="aspect-[3/4] rounded-xl" />
                    <Skeleton className="h-3 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 text-center">
                <span className="text-7xl opacity-10 select-none">{currentCategory.emoji}</span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {search ? 'Keine Location gefunden' : `Noch keine ${currentCategory.label}`}
                  </p>
                  {!search && (
                    <p className="text-xs text-muted-foreground/60">
                      Rechtsklick auf ein Bild im Browser → „Als Location speichern"
                    </p>
                  )}
                </div>
                {!search && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingLocation(null); setFormOpen(true) }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Manuell anlegen
                  </Button>
                )}
              </div>
            ) : (
              <div className={cn('grid gap-3', detailOpen ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
                {filteredLocations.map(l => (
                  <LocationCard
                    key={l.id}
                    location={l}
                    categoryEmoji={currentCategory.emoji}
                    isSelected={selectedLocationId === l.id}
                    onClick={() => { setSelectedLocationId(prev => prev === l.id ? null : l.id); setSelectedVariantId(null) }}
                    onEdit={() => { setEditingLocation(l); setFormOpen(true) }}
                    onDelete={() => setDeleteLocationId(l.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Col 3: Detail panel ── */}
      {detailOpen && (
        <div className="w-[500px] shrink-0 border-l border-border flex flex-col overflow-hidden">
          {detailLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="aspect-[3/4] rounded-xl w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : location ? (
            <>
              {/* Detail header */}
              <div className="border-b shrink-0 px-3 py-2.5 flex items-center gap-1.5">
                <h3 className="text-sm font-semibold flex-1 truncate min-w-0">{location.name}</h3>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] border-teal-500/40 text-teal-300 hover:bg-teal-500/10 hover:text-teal-200 shrink-0"
                  onClick={() => setSheetDialogOpen(true)}>
                  <Sparkles className="h-3 w-3" />
                  Sheet
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setEditingLocation(location); setFormOpen(true) }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleteLocationId(location.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setSelectedLocationId(null); setSelectedVariantId(null) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken overflow-y-auto overflow-x-hidden">

                  {/* Cover image */}
                  <div className="relative bg-black/20 group/cover">
                    {location.cover_image_url ? (
                      <>
                        <img src={location.cover_image_url} alt={location.name} className="w-full object-contain max-h-80" />
                        <button
                          onClick={handleAnalyzeLocation}
                          disabled={aiAnalyzing}
                          className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-teal-600/90 hover:bg-teal-500 disabled:opacity-60 text-white text-[10px] font-medium transition-colors shadow"
                        >
                          {aiAnalyzing
                            ? <span className="w-2.5 h-2.5 rounded-full border border-white border-t-transparent animate-spin" />
                            : <Sparkles className="h-2.5 w-2.5" />}
                          {aiAnalyzing ? 'Analysiere…' : 'KI-Analyse'}
                        </button>
                        {location.source_url && (
                          <a href={location.source_url} target="_blank" rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] bg-black/60 hover:bg-black/80 text-white px-2 py-1 rounded-md transition-colors">
                            <ExternalLink className="h-2.5 w-2.5" />Zum Original
                          </a>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/20 gap-2">
                        <span className="text-6xl">{currentCategory.emoji}</span>
                      </div>
                    )}
                  </div>

                  {/* AI error card */}
                  {aiError && (
                    <div className="mx-3 my-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
                      <span className="text-red-400 text-xs flex-1 leading-relaxed">{aiError}</span>
                      <button onClick={() => setAiError(null)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* AI suggestion card */}
                  {aiSuggestion && (
                    <div ref={suggestionRef} className="mx-3 my-2 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-teal-400">
                        <Sparkles className="h-3 w-3" />
                        <span className="text-[11px] font-semibold">KI-Vorschlag</span>
                        <button onClick={() => setAiSuggestion(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground/50">Markiere, welche Felder beim Übernehmen aktualisiert werden sollen.</p>
                      <div className="space-y-1.5 text-xs">
                        <label className="flex gap-2 items-start cursor-pointer">
                          <Checkbox checked={applyFields.name} onCheckedChange={v => setApplyFields(prev => ({ ...prev, name: !!v }))} className="mt-0.5 shrink-0" />
                          <span className="text-muted-foreground/60 w-16 shrink-0">Name</span>
                          <span className="font-medium text-foreground/90 leading-tight">{aiSuggestion.name}</span>
                        </label>
                        <label className="flex gap-2 items-start cursor-pointer">
                          <Checkbox checked={applyFields.category} onCheckedChange={v => setApplyFields(prev => ({ ...prev, category: !!v }))} className="mt-0.5 shrink-0" />
                          <span className="text-muted-foreground/60 w-16 shrink-0">Kategorie</span>
                          <span className="text-foreground/90">
                            {LOCATION_CATEGORIES.find(c => c.key === aiSuggestion.category)?.emoji}{' '}
                            {LOCATION_CATEGORIES.find(c => c.key === aiSuggestion.category)?.label}
                          </span>
                        </label>
                        {aiSuggestion.tags.length > 0 && (
                          <label className="flex gap-2 items-start cursor-pointer">
                            <Checkbox checked={applyFields.tags} onCheckedChange={v => setApplyFields(prev => ({ ...prev, tags: !!v }))} className="mt-0.5 shrink-0" />
                            <span className="text-muted-foreground/60 w-16 shrink-0">Tags</span>
                            <span className="text-foreground/80">{aiSuggestion.tags.join(', ')}</span>
                          </label>
                        )}
                        {aiSuggestion.description && (
                          <label className="flex gap-2 items-start cursor-pointer">
                            <Checkbox checked={applyFields.description} onCheckedChange={v => setApplyFields(prev => ({ ...prev, description: !!v }))} className="mt-0.5 shrink-0" />
                            <span className="text-muted-foreground/60 w-16 shrink-0">Beschr.</span>
                            <span className="text-foreground/80 leading-relaxed">{aiSuggestion.description}</span>
                          </label>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-7 text-[11px] flex-1 bg-teal-600 hover:bg-teal-500"
                          disabled={!applyFields.name && !applyFields.category && !applyFields.tags && !applyFields.description}
                          onClick={handleApplySuggestion}>
                          <Check className="mr-1 h-3 w-3" />Übernehmen
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setAiSuggestion(null)}>
                          Verwerfen
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="px-4 py-3 border-b border-border space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{currentCategory.emoji} {currentCategory.label}</span>
                      {location.location_type && (() => {
                        const lt = LOCATION_TYPES.find(t => t.key === location.location_type)
                        return lt ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-medium">
                            <span>{lt.emoji}</span>
                            <span>{lt.label}</span>
                          </span>
                        ) : null
                      })()}
                    </div>
                    {location.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{location.description}</p>
                    )}
                    {location.source_url && (
                      <a href={location.source_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-400 transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        {location.source_title || (() => { try { return new URL(location.source_url).hostname.replace('www.','') } catch { return location.source_url } })()}
                      </a>
                    )}
                    {location.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {location.tags.map(tag => <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>)}
                      </div>
                    )}
                  </div>

                  {/* Variants */}
                  {selectedVariant ? (
                    /* ── Variant image viewer ── */
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedVariantId(null)}
                          className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                          <ChevronLeft className="h-3.5 w-3.5" />Varianten
                        </button>
                        <span className="text-xs font-semibold truncate flex-1">{selectedVariant.name}</span>
                        {selectedVariant.description && (
                          <span className="text-[11px] text-muted-foreground/60 truncate max-w-[100px]">{selectedVariant.description}</span>
                        )}
                        <div className="flex gap-0.5 shrink-0">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingVariant(selectedVariant); setVariantFormOpen(true) }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteVariantId(selectedVariant.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {selectedVariant.images.length > 0 ? (
                        <>
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVariantImageDragEnd}>
                            <SortableContext items={selectedVariant.images.map(i => i.id)} strategy={rectSortingStrategy}>
                              <div className="grid grid-cols-2 gap-2">
                                {selectedVariant.images.map((img, idx) => (
                                  <SortableVariantImage
                                    key={img.id}
                                    image={img}
                                    isCover={location.cover_image_url === img.url}
                                    onSetCover={() => updateLocationCover(img.url, newUrl => {
                                      if (selectedLocationId) patchLocationCover(selectedLocationId, newUrl)
                                    })}
                                    onDelete={() => deleteImage(selectedVariant.id, img.id, img.storage_path)}
                                    onOpen={() => setLightboxVariantIndex(idx)}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                          {lightboxVariantIndex !== null && (
                            <ImageLightbox
                              images={selectedVariant.images}
                              initialIndex={lightboxVariantIndex}
                              onClose={() => setLightboxVariantIndex(null)}
                            />
                          )}
                        </>
                      ) : (
                        <div className="text-center py-10 space-y-3">
                          <p className="text-xs text-muted-foreground/50">Noch keine Bilder für diese Variante</p>
                          <Button size="sm" variant="outline" onClick={() => variantUploadRef.current?.click()}>
                            <Upload className="mr-1.5 h-3.5 w-3.5" />Bilder hochladen
                          </Button>
                        </div>
                      )}

                      <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => variantUploadRef.current?.click()}>
                        <Upload className="h-3 w-3" />Bilder hochladen
                      </Button>

                      <input ref={variantUploadRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden"
                        onChange={e => { uploadImages(selectedVariant.id, Array.from(e.target.files ?? [])); e.target.value = '' }} />

                      {uploading.length > 0 && (
                        <div className="space-y-1">
                          {uploading.map(u => (
                            <div key={u.id} className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground truncate flex-1">{u.file.name}</span>
                              {u.status === 'uploading' && <span className="text-muted-foreground animate-pulse">Lädt…</span>}
                              {u.status === 'done' && <span className="text-emerald-400">✓</span>}
                              {u.status === 'error' && <span className="text-destructive">Fehler</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      <details className="group">
                        <summary className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground cursor-pointer select-none list-none flex items-center gap-1">
                          <Plus className="h-3 w-3" />Bild per URL hinzufügen
                        </summary>
                        <div className="flex gap-2 mt-2">
                          <input type="url" placeholder="https://…"
                            className="flex-1 h-8 px-2 text-xs rounded-md border border-border bg-muted/20 focus:outline-none focus:border-teal-500"
                            onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { addImageUrl(selectedVariant.id, v); (e.target as HTMLInputElement).value = '' } } }} />
                          <Button size="sm" variant="outline" className="h-8 text-xs shrink-0"
                            onClick={e => { const input = e.currentTarget.previousElementSibling as HTMLInputElement; const v = input?.value?.trim(); if (v) { addImageUrl(selectedVariant.id, v); input.value = '' } }}>
                            Hinzufügen
                          </Button>
                        </div>
                      </details>
                    </div>
                  ) : (
                    /* ── Variant grid ── */
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          Varianten ({variants.length})
                        </span>
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={() => { setEditingVariant(null); setVariantFormOpen(true) }}>
                          <Plus className="mr-1 h-3 w-3" />Hinzufügen
                        </Button>
                      </div>

                      {variants.length === 0 ? (
                        <p className="text-xs text-muted-foreground/50 text-center py-4">
                          z.B. Tag, Nacht, Regen, Winter — als separate Varianten anlegen.
                        </p>
                      ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVariantDragEnd}>
                          <SortableContext items={variants.map(v => v.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-3 gap-2">
                              {variants.map(v => (
                                <OutfitVariantCard
                                  key={v.id}
                                  accent="rose"
                                  variant={v as unknown as Parameters<typeof OutfitVariantCard>[0]['variant']}
                                  isSelected={selectedVariantId === v.id}
                                  onClick={() => { setSelectedVariantId(prev => prev === v.id ? null : v.id); setLightboxVariantIndex(null) }}
                                  onEdit={() => { setEditingVariant(v); setVariantFormOpen(true) }}
                                  onDelete={() => setDeleteVariantId(v.id)}
                                  onUploadImages={files => uploadImages(v.id, files)}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── Import Wizard ── */}
      <LocationImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        categories={allCategories}
        onCreated={(locationId, category) => {
          setImportWizardOpen(false)
          refetchLocations()
          setSelectedCategory(category)
          setSelectedLocationId(locationId)
          setSelectedVariantId(null)
        }}
      />

      {/* ── Dialogs ── */}
      <LocationForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingLocation(null) }}
        location={editingLocation}
        defaultCategory={selectedCategory}
        categories={allCategories}
        onSave={handleLocationSave}
      />

      <CustomCategoryDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        onSave={async (label, emoji) => {
          const created = await createCustomCategory(label, emoji, allCategories.map(c => c.key))
          if (created) setSelectedCategory(created.key)
          return created
        }}
      />

      <AlertDialog open={!!deleteCategoryId} onOpenChange={open => !open && setDeleteCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Locations mit dieser Kategorie bleiben erhalten, zeigen die Kategorie danach aber nur noch als Text an.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteCategoryId) return
                await deleteCustomCategory(deleteCategoryId)
                if (selectedCategory === allCategories.find(c => c.id === deleteCategoryId)?.key) {
                  setSelectedCategory(LOCATION_CATEGORIES[0].key)
                }
                setDeleteCategoryId(null)
              }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {location && (
        <LocationSheetDialog
          open={sheetDialogOpen}
          onClose={() => setSheetDialogOpen(false)}
          location={location}
        />
      )}
      <LocationVariantForm
        open={variantFormOpen}
        onClose={() => { setVariantFormOpen(false); setEditingVariant(null) }}
        variant={editingVariant}
        defaultName={editingVariant ? undefined : location?.name}
        onSave={handleVariantSave}
      />

      <AlertDialog open={!!deleteLocationId} onOpenChange={open => !open && setDeleteLocationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Location löschen?</AlertDialogTitle>
            <AlertDialogDescription>Alle Varianten und Bilder werden unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteLocationId) return
                await deleteLocation(deleteLocationId)
                if (selectedLocationId === deleteLocationId) setSelectedLocationId(null)
                setDeleteLocationId(null)
              }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVariantId} onOpenChange={open => !open && setDeleteVariantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Variante löschen?</AlertDialogTitle>
            <AlertDialogDescription>Alle Bilder dieser Variante werden ebenfalls gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteVariantId) return
                await deleteVariant(deleteVariantId)
                if (selectedVariantId === deleteVariantId) setSelectedVariantId(null)
                setDeleteVariantId(null)
              }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
