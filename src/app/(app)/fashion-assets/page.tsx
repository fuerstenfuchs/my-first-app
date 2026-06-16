'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, X, Pencil, Trash2, ChevronRight, ShoppingBag, ExternalLink } from 'lucide-react'
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
import { FashionAssetForm } from '@/components/fashion-assets/fashion-asset-form'
import { FashionAssetVariantForm } from '@/components/fashion-assets/fashion-asset-variant-form'
import { FashionAssetVariantCard } from '@/components/fashion-assets/fashion-asset-variant-card'
import { FashionAssetMediaManager } from '@/components/fashion-assets/fashion-asset-media-manager'
import {
  FASHION_CATEGORIES,
  useFashionAssets, useFashionAssetDetail,
  type FashionAsset, type FashionAssetVariant,
  type FashionAssetInput, type FashionAssetVariantInput, type FashionCategory,
} from '@/hooks/use-fashion-assets'
import { cn } from '@/lib/utils'

export default function FashionAssetsPage() {
  const { assets, loading, createAsset, updateAsset, deleteAsset, patchAssetCover } = useFashionAssets()

  const [selectedCategory, setSelectedCategory] = useState<FashionCategory>('oberteile')
  const [selectedAssetId, setSelectedAssetId]   = useState<string | null>(null)
  const [search, setSearch]                     = useState('')

  const [assetFormOpen, setAssetFormOpen]   = useState(false)
  const [editingAsset, setEditingAsset]     = useState<FashionAsset | null>(null)
  const [deleteAssetId, setDeleteAssetId]   = useState<string | null>(null)

  const {
    asset, variants, loading: detailLoading, uploading,
    createVariant, updateVariant, deleteVariant, reorderVariants,
    uploadImages, addImageUrl, deleteImage, reorderImages, updateAssetCover,
  } = useFashionAssetDetail(selectedAssetId)

  const [variantFormOpen, setVariantFormOpen]   = useState(false)
  const [editingVariant, setEditingVariant]     = useState<FashionAssetVariant | null>(null)
  const [deleteVariantId, setDeleteVariantId]   = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Count per category
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of assets) map[a.category] = (map[a.category] ?? 0) + 1
    return map
  }, [assets])

  // Filtered assets for selected category
  const filteredAssets = useMemo(() =>
    assets.filter(a =>
      a.category === selectedCategory &&
      (!search.trim() || a.name.toLowerCase().includes(search.toLowerCase()))
    ), [assets, selectedCategory, search])

  async function handleAssetSave(input: FashionAssetInput, coverFile?: File | null): Promise<boolean | FashionAsset | null> {
    if (editingAsset) return updateAsset(editingAsset.id, input)
    const a = await createAsset(input, coverFile)
    if (a) { setSelectedCategory(a.category); setSelectedAssetId(a.id) }
    return a
  }

  async function handleVariantSave(input: FashionAssetVariantInput, files: File[]): Promise<boolean | FashionAssetVariant | null> {
    if (editingVariant) return updateVariant(editingVariant.id, input)
    const v = await createVariant(input)
    if (v) {
      setSelectedVariantId(v.id)
      if (files.length > 0) await uploadImages(v.id, files)
    }
    return v
  }

  async function handleDeleteAsset() {
    if (!deleteAssetId) return
    await deleteAsset(deleteAssetId)
    if (selectedAssetId === deleteAssetId) setSelectedAssetId(null)
    setDeleteAssetId(null)
  }

  async function handleDeleteVariant() {
    if (!deleteVariantId) return
    await deleteVariant(deleteVariantId)
    if (selectedVariantId === deleteVariantId) setSelectedVariantId(null)
    setDeleteVariantId(null)
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

  const selectedVariant = selectedVariantId ? variants.find(v => v.id === selectedVariantId) ?? null : null
  const currentCategory = FASHION_CATEGORIES.find(c => c.key === selectedCategory)!

  return (
    <div className="flex h-svh min-w-0">

      {/* ── Left panel: categories + asset list ─────────────────────── */}
      <div className="flex flex-col w-72 shrink-0 border-r border-border">
        <header className="border-b shrink-0 px-4 py-3 flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="text-base font-semibold flex-1 truncate">Fashion Assets</h1>
          <Button
            size="icon" variant="ghost" className="h-8 w-8 shrink-0"
            onClick={() => { setEditingAsset(null); setAssetFormOpen(true) }}
            title="Neues Asset"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </header>

        {/* Category list */}
        <div className="border-b shrink-0">
          <nav className="p-1.5 space-y-0.5">
            {FASHION_CATEGORIES.map(cat => {
              const count = categoryCounts[cat.key] ?? 0
              const isActive = selectedCategory === cat.key
              return (
                <button
                  key={cat.key}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-left transition-colors',
                    isActive ? 'bg-rose-500/10 text-rose-300 font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                  onClick={() => { setSelectedCategory(cat.key); setSelectedAssetId(null); setSearch('') }}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="flex-1 truncate">{cat.label}</span>
                  {count > 0 && (
                    <span className={cn('text-xs tabular-nums', isActive ? 'text-rose-400' : 'text-muted-foreground/50')}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Asset search + list */}
        <div className="px-3 py-2 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`In ${currentCategory.label} suchen…`}
              className="pl-8 h-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden" style={{ right: '-17px' }}>
            {loading ? (
              <div className="p-2 space-y-1">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[120px] gap-2 text-center px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  {search ? 'Kein Asset gefunden' : `Noch keine ${currentCategory.label}`}
                </p>
                {!search && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingAsset(null); setAssetFormOpen(true) }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Hinzufügen
                  </Button>
                )}
              </div>
            ) : (
              <ul className="p-2 space-y-0.5">
                {filteredAssets.map(a => (
                  <li key={a.id}>
                    <button
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors group',
                        selectedAssetId === a.id ? 'bg-rose-500/10 text-rose-300' : 'hover:bg-accent/60'
                      )}
                      onClick={() => { setSelectedAssetId(a.id); setSelectedVariantId(null) }}
                    >
                      <div className="shrink-0 w-9 h-9 rounded-md overflow-hidden bg-muted border border-border/50">
                        {a.cover_image_url ? (
                          <img src={a.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-base leading-none">
                            {currentCategory.emoji}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{a.name}</p>
                        {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
                      </div>
                      <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-opacity', selectedAssetId === a.id ? 'opacity-100 text-rose-400' : 'opacity-0 group-hover:opacity-40')} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: asset detail ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedAssetId ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Fashion Assets</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Wähle ein Asset aus der Liste oder lege ein neues an.
                Jedes Asset enthält Varianten mit Referenzbildern.
              </p>
            </div>
            <Button onClick={() => { setEditingAsset(null); setAssetFormOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Neues Asset
            </Button>
          </div>

        ) : detailLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-3 gap-3 mt-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
            </div>
          </div>

        ) : asset ? (
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-w-0">

            {/* ── Left column: image + meta ──────────────────────────── */}
            <div className="lg:w-[45%] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border overflow-hidden">

              {/* Large cover image */}
              <div className="relative flex-1 min-h-0 bg-black/20 flex items-center justify-center overflow-hidden">
                {asset.cover_image_url ? (
                  <>
                    <img
                      src={asset.cover_image_url}
                      alt={asset.name}
                      className="max-w-full max-h-full object-contain"
                      style={{ maxHeight: '60vh' }}
                    />
                    {asset.source_url && (
                      <a
                        href={asset.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] bg-black/60 hover:bg-black/80 text-white px-2 py-1 rounded-md transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Zum Original
                      </a>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
                    <span className="text-6xl leading-none">{currentCategory.emoji}</span>
                    <span className="text-xs">Kein Bild</span>
                  </div>
                )}
              </div>

              {/* Asset meta below image */}
              <div className="shrink-0 border-t border-border px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs text-muted-foreground">{currentCategory.emoji} {currentCategory.label}</span>
                    </div>
                    <h2 className="text-base font-semibold leading-tight truncate">{asset.name}</h2>
                    {asset.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{asset.description}</p>}
                    {asset.source_url && (
                      <a
                        href={asset.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-rose-400 transition-colors mt-0.5"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {asset.source_title || (() => { try { return new URL(asset.source_url).hostname.replace('www.','') } catch { return asset.source_url } })()}
                      </a>
                    )}
                    {asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {asset.tags.map(tag => <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingAsset(asset); setAssetFormOpen(true) }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteAssetId(asset.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right column: variants ─────────────────────────────── */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {selectedVariant ? (
                /* Variant detail */
                <div className="h-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-5" style={{ right: '-20px' }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{selectedVariant.name}</h4>
                        {selectedVariant.description && <p className="text-sm text-muted-foreground">{selectedVariant.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingVariant(selectedVariant); setVariantFormOpen(true) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSelectedVariantId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Referenzbilder</p>
                    <FashionAssetMediaManager
                      variantId={selectedVariant.id}
                      images={selectedVariant.images}
                      uploading={uploading}
                      assetCoverUrl={asset?.cover_image_url}
                      onUpload={files => uploadImages(selectedVariant.id, files)}
                      onAddUrl={url => addImageUrl(selectedVariant.id, url)}
                      onDelete={(imgId, path) => deleteImage(selectedVariant.id, imgId, path)}
                      onReorder={orderedIds => reorderImages(selectedVariant.id, orderedIds)}
                      onSetAssetCover={url =>
                        updateAssetCover(url, newUrl => selectedAssetId && patchAssetCover(selectedAssetId, newUrl))
                      }
                    />
                  </div>
                </div>
              ) : (
                /* Variant grid */
                <div className="h-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-4" style={{ right: '-20px' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Varianten ({variants.length})
                      </h3>
                      <Button size="sm" variant="outline" onClick={() => { setEditingVariant(null); setVariantFormOpen(true) }}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Neue Variante
                      </Button>
                    </div>

                    {variants.length === 0 ? (
                      <div className="flex flex-col items-center justify-center min-h-[160px] gap-2 text-center text-muted-foreground/50">
                        <p className="text-xs">Keine Varianten — das Bild links ist das Hauptbild.</p>
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setEditingVariant(null); setVariantFormOpen(true) }}>
                          <Plus className="mr-1 h-3 w-3" />
                          Variante hinzufügen
                        </Button>
                      </div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVariantDragEnd}>
                        <SortableContext items={variants.map(v => v.id)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-3 gap-3">
                            {variants.map(v => (
                              <FashionAssetVariantCard
                                key={v.id}
                                variant={v}
                                isSelected={selectedVariantId === v.id}
                                onClick={() => setSelectedVariantId(prev => prev === v.id ? null : v.id)}
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
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      <FashionAssetForm
        open={assetFormOpen}
        onClose={() => { setAssetFormOpen(false); setEditingAsset(null) }}
        asset={editingAsset}
        defaultCategory={selectedCategory}
        onSave={handleAssetSave}
      />
      <FashionAssetVariantForm
        open={variantFormOpen}
        onClose={() => { setVariantFormOpen(false); setEditingVariant(null) }}
        variant={editingVariant}
        onSave={handleVariantSave}
      />

      <AlertDialog open={!!deleteAssetId} onOpenChange={open => !open && setDeleteAssetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asset löschen?</AlertDialogTitle>
            <AlertDialogDescription>Alle Varianten und Bilder werden unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAsset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
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
            <AlertDialogAction onClick={handleDeleteVariant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
