'use client'

import { useState } from 'react'
import { Plus, Search, Shirt, Pencil, Trash2, X, ChevronRight } from 'lucide-react'
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
import { OutfitForm } from '@/components/outfits/outfit-form'
import { OutfitVariantForm } from '@/components/outfits/outfit-variant-form'
import { OutfitVariantCard } from '@/components/outfits/outfit-variant-card'
import { OutfitMediaManager } from '@/components/outfits/outfit-media-manager'
import {
  useOutfits, useOutfitDetail,
  type Outfit, type OutfitVariant, type OutfitInput, type OutfitVariantInput, type InitialOutfitSlot,
} from '@/hooks/use-outfits'

export default function OutfitsPage() {
  const { outfits, loading, createOutfitWithSlots, updateOutfit, deleteOutfit, patchOutfitCover } = useOutfits()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [outfitFormOpen, setOutfitFormOpen] = useState(false)
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null)
  const [deleteOutfitId, setDeleteOutfitId] = useState<string | null>(null)

  const {
    outfit, variants, loading: detailLoading, uploading,
    createVariant, updateVariant, deleteVariant, reorderVariants,
    uploadImages, addImageUrl, deleteImage, reorderImages, updateOutfitCover,
  } = useOutfitDetail(selectedId)

  const [variantFormOpen, setVariantFormOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<OutfitVariant | null>(null)
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const filtered = outfits.filter(o =>
    !search.trim() || o.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleOutfitSave(input: OutfitInput, slots: InitialOutfitSlot[]): Promise<boolean | Outfit | null> {
    if (editingOutfit) return updateOutfit(editingOutfit.id, input)
    const o = await createOutfitWithSlots(input, slots)
    if (o) setSelectedId(o.id)
    return o
  }

  async function handleVariantSave(input: OutfitVariantInput, files: File[]): Promise<boolean | OutfitVariant | null> {
    if (editingVariant) return updateVariant(editingVariant.id, input)
    const v = await createVariant(input)
    if (v) {
      setSelectedVariantId(v.id)
      if (files.length > 0) await uploadImages(v.id, files)
    }
    return v
  }

  async function handleDeleteOutfit() {
    if (!deleteOutfitId) return
    await deleteOutfit(deleteOutfitId)
    if (selectedId === deleteOutfitId) setSelectedId(null)
    setDeleteOutfitId(null)
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

  const selectedVariant = selectedVariantId
    ? variants.find(v => v.id === selectedVariantId) ?? null
    : null

  return (
    <div className="flex h-svh min-w-0">

      {/* ── Left: outfit list ────────────────────────────────────────── */}
      <div className="flex flex-col w-72 shrink-0 border-r border-border">
        <header className="border-b shrink-0 px-4 py-3 flex items-center gap-3">
          <SidebarTrigger />
          <h1 className="text-base font-semibold flex-1 truncate">Outfits</h1>
          <Button
            size="icon" variant="ghost" className="h-8 w-8 shrink-0"
            onClick={() => { setEditingOutfit(null); setOutfitFormOpen(true) }}
            title="Neues Outfit"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </header>

        <div className="px-3 py-2 border-b">
          <div className="relative">
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
        </div>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden" style={{ right: '-17px' }}>
            {loading ? (
              <div className="p-2 space-y-1">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-2 text-center px-4">
                <Shirt className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {search ? 'Kein Outfit gefunden' : 'Noch keine Outfits'}
                </p>
                {!search && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingOutfit(null); setOutfitFormOpen(true) }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Erstellen
                  </Button>
                )}
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {filtered.map(o => (
                  <li key={o.id}>
                    <button
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group ${
                        selectedId === o.id
                          ? 'bg-orange-500/10 text-orange-400'
                          : 'hover:bg-accent/60'
                      }`}
                      onClick={() => { setSelectedId(o.id); setSelectedVariantId(null) }}
                    >
                      <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border/50">
                        {o.cover_image_url ? (
                          <img src={o.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Shirt className="h-5 w-5 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{o.name}</p>
                        {o.description && (
                          <p className="text-xs text-muted-foreground truncate">{o.description}</p>
                        )}
                      </div>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-opacity ${selectedId === o.id ? 'opacity-100 text-orange-400' : 'opacity-0 group-hover:opacity-40'}`} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: outfit detail ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedId ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center">
              <Shirt className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Outfit-Bibliothek</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Wähle ein Outfit aus der Liste oder lege ein neues an.
                Jedes Outfit enthält Varianten mit Referenzbildern.
              </p>
            </div>
            <Button onClick={() => { setEditingOutfit(null); setOutfitFormOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Neues Outfit
            </Button>
          </div>

        ) : detailLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
            <div className="grid grid-cols-3 gap-3 mt-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
            </div>
          </div>

        ) : outfit ? (
          <>
            {/* Outfit header */}
            <header className="border-b shrink-0 px-6 py-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-muted border border-border/50">
                  {outfit.cover_image_url ? (
                    <img src={outfit.cover_image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Shirt className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold leading-tight">{outfit.name}</h2>
                  {outfit.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{outfit.description}</p>
                  )}
                  {outfit.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {outfit.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => { setEditingOutfit(outfit); setOutfitFormOpen(true) }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteOutfitId(outfit.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </header>

            {/* Variants + detail */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full flex flex-col lg:flex-row min-w-0">

                {/* Variant grid */}
                <div className={`flex-1 min-w-0 overflow-hidden relative ${selectedVariant ? 'lg:flex-none lg:w-[55%]' : ''}`}>
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
                      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-center">
                        <p className="text-sm text-muted-foreground">Noch keine Varianten</p>
                        <Button size="sm" onClick={() => { setEditingVariant(null); setVariantFormOpen(true) }}>
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Erste Variante anlegen
                        </Button>
                      </div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleVariantDragEnd}>
                        <SortableContext items={variants.map(v => v.id)} strategy={rectSortingStrategy}>
                          <div className="grid grid-cols-3 gap-3">
                            {variants.map(v => (
                              <OutfitVariantCard
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

                {/* Variant detail panel */}
                {selectedVariant && (
                  <div className="lg:w-[45%] shrink-0 border-t lg:border-t-0 lg:border-l border-border overflow-hidden relative">
                    <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-5" style={{ right: '-20px' }}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">{selectedVariant.name}</h4>
                          {selectedVariant.description && (
                            <p className="text-sm text-muted-foreground">{selectedVariant.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setEditingVariant(selectedVariant); setVariantFormOpen(true) }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => setSelectedVariantId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                        Referenzbilder
                      </p>
                      <OutfitMediaManager
                        variantId={selectedVariant.id}
                        images={selectedVariant.images}
                        uploading={uploading}
                        outfitCoverUrl={outfit?.cover_image_url}
                        onUpload={files => uploadImages(selectedVariant.id, files)}
                        onAddUrl={url => addImageUrl(selectedVariant.id, url)}
                        onDelete={(imgId, path) => deleteImage(selectedVariant.id, imgId, path)}
                        onReorder={orderedIds => reorderImages(selectedVariant.id, orderedIds)}
                        onSetOutfitCover={url =>
                          updateOutfitCover(url, newUrl => selectedId && patchOutfitCover(selectedId, newUrl))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      <OutfitForm
        open={outfitFormOpen}
        onClose={() => { setOutfitFormOpen(false); setEditingOutfit(null) }}
        outfit={editingOutfit}
        onSave={handleOutfitSave}
      />

      <OutfitVariantForm
        open={variantFormOpen}
        onClose={() => { setVariantFormOpen(false); setEditingVariant(null) }}
        variant={editingVariant}
        onSave={handleVariantSave}
      />

      <AlertDialog open={!!deleteOutfitId} onOpenChange={open => !open && setDeleteOutfitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Outfit löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Varianten und Bilder dieses Outfits werden unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOutfit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteVariantId} onOpenChange={open => !open && setDeleteVariantId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Variante löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Alle Bilder dieser Variante werden ebenfalls gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVariant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
