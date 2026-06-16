'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, Search, X, Pencil, Trash2, ExternalLink, Sparkles, Check, ChevronLeft, ChevronRight, Crown, Upload, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LocationForm } from '@/components/locations/location-form'
import { LocationVariantForm } from '@/components/locations/location-variant-form'
import { FashionAssetVariantCard } from '@/components/fashion-assets/fashion-asset-variant-card'
import {
  LOCATION_CATEGORIES,
  useLocations, useLocationDetail,
  type Location, type LocationVariant,
  type LocationInput, type LocationVariantInput, type LocationCategory,
} from '@/hooks/use-locations'
import { cn } from '@/lib/utils'

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
        {location.tags.length > 0 && (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
            {location.tags.slice(0, 3).join(' · ')}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const { locations, loading, createLocation, updateLocation, deleteLocation, patchLocationCover } = useLocations()

  const [selectedCategory, setSelectedCategory] = useState<LocationCategory>('stadt')
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen]           = useState(false)
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

  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    name: string; category: LocationCategory; tags: string[]; description: string
  } | null>(null)

  const [galleryImageIndex, setGalleryImageIndex] = useState(0)
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
      (!search.trim() || l.name.toLowerCase().includes(search.toLowerCase()))
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
    try {
      let body: Record<string, string>
      try {
        const imgRes = await fetch(location.cover_image_url)
        if (!imgRes.ok) throw new Error('fetch failed')
        const blob = await imgRes.blob()
        const mediaType = blob.type || 'image/jpeg'
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve((reader.result as string).split(',')[1] ?? '')
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        body = { imageBase64, mediaType }
      } catch {
        body = { imageUrl: location.cover_image_url }
      }
      const res = await fetch('/api/analyze-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const result = await res.json() as { name?: string; category?: string; tags?: string[]; description?: string }
      const validCategories = LOCATION_CATEGORIES.map(c => c.key)
      setAiSuggestion({
        name:        result.name        ?? location.name,
        category:    (validCategories.includes(result.category as LocationCategory) ? result.category : location.category) as LocationCategory,
        tags:        result.tags        ?? location.tags,
        description: result.description ?? location.description ?? '',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen')
    } finally {
      setAiAnalyzing(false)
    }
  }

  async function handleApplySuggestion() {
    if (!location || !aiSuggestion) return
    const ok = await updateLocation(location.id, {
      name:        aiSuggestion.name,
      category:    aiSuggestion.category,
      tags:        aiSuggestion.tags,
      description: aiSuggestion.description,
    })
    if (ok) {
      setAiSuggestion(null)
      refetchDetail()
    }
  }

  const currentCategory = LOCATION_CATEGORIES.find(c => c.key === selectedCategory)!
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
          {LOCATION_CATEGORIES.map(cat => {
            const count    = categoryCounts[cat.key] ?? 0
            const isActive = selectedCategory === cat.key
            return (
              <button
                key={cat.key}
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
                  <span className={cn('text-[11px] tabular-nums shrink-0', isActive ? 'text-teal-400' : 'text-muted-foreground/40')}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
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
          <Button size="sm" className="shrink-0 ml-auto" onClick={() => { setEditingLocation(null); setFormOpen(true) }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />Neue Location
          </Button>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-4" style={{ right: '-17px' }}>
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
                <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden" style={{ right: '-17px' }}>

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

                  {/* AI suggestion card */}
                  {aiSuggestion && (
                    <div className="mx-3 my-2 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-teal-400">
                        <Sparkles className="h-3 w-3" />
                        <span className="text-[11px] font-semibold">KI-Vorschlag</span>
                        <button onClick={() => setAiSuggestion(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground/60 w-16 shrink-0">Name</span>
                          <span className="font-medium text-foreground/90 leading-tight">{aiSuggestion.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground/60 w-16 shrink-0">Kategorie</span>
                          <span className="text-foreground/90">
                            {LOCATION_CATEGORIES.find(c => c.key === aiSuggestion.category)?.emoji}{' '}
                            {LOCATION_CATEGORIES.find(c => c.key === aiSuggestion.category)?.label}
                          </span>
                        </div>
                        {aiSuggestion.tags.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground/60 w-16 shrink-0">Tags</span>
                            <span className="text-foreground/80">{aiSuggestion.tags.join(', ')}</span>
                          </div>
                        )}
                        {aiSuggestion.description && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground/60 w-16 shrink-0">Beschr.</span>
                            <span className="text-foreground/80 leading-relaxed">{aiSuggestion.description}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="h-7 text-[11px] flex-1 bg-teal-600 hover:bg-teal-500" onClick={handleApplySuggestion}>
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{currentCategory.emoji} {currentCategory.label}</span>
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

                      {selectedVariant.images.length > 0 ? (() => {
                        const safeIdx = Math.min(galleryImageIndex, selectedVariant.images.length - 1)
                        const currentImg = selectedVariant.images[safeIdx]
                        const isCover = location.cover_image_url === currentImg.url
                        return (
                          <>
                            <div className="relative bg-black/20 rounded-xl overflow-hidden group/img">
                              <img src={currentImg.url} alt="" className="w-full object-contain max-h-80" />
                              {selectedVariant.images.length > 1 && (
                                <>
                                  <button
                                    onClick={() => setGalleryImageIndex((safeIdx - 1 + selectedVariant.images.length) % selectedVariant.images.length)}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setGalleryImageIndex((safeIdx + 1) % selectedVariant.images.length)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {isCover ? (
                                <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full font-semibold">
                                  <Crown className="h-2.5 w-2.5" />Titelbild
                                </div>
                              ) : (
                                <button
                                  onClick={() => updateLocationCover(currentImg.url, newUrl => { if (selectedLocationId) patchLocationCover(selectedLocationId, newUrl) })}
                                  className="absolute top-2 left-2 flex items-center gap-1 text-[10px] bg-black/60 hover:bg-amber-500 hover:text-black text-white/80 px-2 py-0.5 rounded-full font-medium transition-colors opacity-0 group-hover/img:opacity-100"
                                >
                                  <Crown className="h-2.5 w-2.5" />Als Titelbild
                                </button>
                              )}
                              {selectedVariant.images.length > 1 && (
                                <div className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white/80 px-1.5 py-0.5 rounded-full">
                                  {safeIdx + 1} / {selectedVariant.images.length}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                              {selectedVariant.images.map((img, idx) => (
                                <button key={img.id} onClick={() => setGalleryImageIndex(idx)}
                                  className={cn('relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all group/thumb',
                                    idx === safeIdx ? 'border-teal-500 ring-1 ring-teal-500/30' : 'border-transparent opacity-60 hover:opacity-100')}>
                                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                                  <div onClick={e => { e.stopPropagation(); deleteImage(selectedVariant.id, img.id, img.storage_path) }}
                                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                    <Trash2 className="h-3.5 w-3.5 text-white" />
                                  </div>
                                </button>
                              ))}
                              <button onClick={() => variantUploadRef.current?.click()}
                                className="shrink-0 w-14 h-14 rounded-lg border-2 border-dashed border-border/40 hover:border-teal-500/50 flex items-center justify-center text-muted-foreground/40 hover:text-teal-400 transition-colors">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        )
                      })() : (
                        <div className="text-center py-10 space-y-3">
                          <p className="text-xs text-muted-foreground/50">Noch keine Bilder für diese Variante</p>
                          <Button size="sm" variant="outline" onClick={() => variantUploadRef.current?.click()}>
                            <Upload className="mr-1.5 h-3.5 w-3.5" />Bilder hochladen
                          </Button>
                        </div>
                      )}

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
                                <FashionAssetVariantCard
                                  key={v.id}
                                  variant={v as unknown as Parameters<typeof FashionAssetVariantCard>[0]['variant']}
                                  isSelected={selectedVariantId === v.id}
                                  onClick={() => { setSelectedVariantId(prev => prev === v.id ? null : v.id); setGalleryImageIndex(0) }}
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

      {/* ── Dialogs ── */}
      <LocationForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingLocation(null) }}
        location={editingLocation}
        defaultCategory={selectedCategory}
        onSave={handleLocationSave}
      />
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
