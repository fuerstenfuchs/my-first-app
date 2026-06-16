'use client'

import { useState } from 'react'
import { Plus, Search, Shirt, Pencil, Trash2, X, Sparkles, Copy, Check } from 'lucide-react'
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
  type Outfit, type OutfitVariant, type OutfitInput, type OutfitVariantInput,
} from '@/hooks/use-outfits'
import { cn } from '@/lib/utils'

// ── Gallery card ─────────────────────────────────────────────────────────────

function OutfitCard({
  outfit, isSelected, onClick, onEdit, onDelete,
}: {
  outfit: Outfit
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
          ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-lg shadow-orange-500/10'
          : 'border-border/40 hover:border-orange-500/40'
      )}
    >
      <div className="aspect-[3/4] bg-muted/30 relative overflow-hidden">
        {outfit.cover_image_url ? (
          <img
            src={outfit.cover_image_url}
            alt={outfit.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/20">
            <Shirt className="h-10 w-10" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div
          className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onEdit}
            className="w-6 h-6 rounded-md bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
          >
            <Pencil className="h-3 w-3 text-white" />
          </button>
          <button
            onClick={onDelete}
            className="w-6 h-6 rounded-md bg-black/60 hover:bg-red-600/80 flex items-center justify-center transition-colors"
          >
            <Trash2 className="h-3 w-3 text-white" />
          </button>
        </div>
      </div>

      <div className="px-2 py-2">
        <p className="text-xs font-medium leading-tight truncate">{outfit.name}</p>
        {outfit.tags.length > 0 && (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
            {outfit.tags.slice(0, 3).join(' · ')}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OutfitsPage() {
  const { outfits, loading, createOutfitWithSlots, updateOutfit, deleteOutfit, patchOutfitCover } = useOutfits()

  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [search, setSearch]               = useState('')
  const [outfitFormOpen, setOutfitFormOpen]   = useState(false)
  const [editingOutfit, setEditingOutfit]     = useState<Outfit | null>(null)
  const [deleteOutfitId, setDeleteOutfitId]   = useState<string | null>(null)

  const {
    outfit, variants, loading: detailLoading, uploading,
    createVariant, updateVariant, deleteVariant, reorderVariants,
    uploadImages, addImageUrl, deleteImage, reorderImages, updateOutfitCover,
  } = useOutfitDetail(selectedId)

  const [variantFormOpen, setVariantFormOpen]     = useState(false)
  const [editingVariant, setEditingVariant]       = useState<OutfitVariant | null>(null)
  const [deleteVariantId, setDeleteVariantId]     = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [generatingSheet, setGeneratingSheet]     = useState(false)
  const [generatedSheetPrompt, setGeneratedSheetPrompt] = useState<string | null>(null)
  const [promptCopied, setPromptCopied]           = useState(false)
  const [sheetError, setSheetError]               = useState<string | null>(null)

  async function generateSheet(variant: OutfitVariant) {
    if (!outfit) return
    setGeneratingSheet(true)
    setSheetError(null)
    setGeneratedSheetPrompt(null)
    setPromptCopied(false)
    try {
      const res = await fetch('/api/generate-outfit-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outfitName: outfit.name,
          outfitDescription: outfit.description,
          outfitTags: outfit.tags,
          imageUrls: variant.images.map(i => i.url),
        }),
      })
      const data = await res.json() as { prompt?: string; error?: string }
      if (!res.ok || !data.prompt) throw new Error(data.error ?? 'Unbekannter Fehler')
      setGeneratedSheetPrompt(data.prompt)
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Generierung fehlgeschlagen')
    } finally {
      setGeneratingSheet(false)
    }
  }

  async function copySheetPrompt() {
    if (!generatedSheetPrompt) return
    await navigator.clipboard.writeText(generatedSheetPrompt)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const filtered = outfits.filter(o =>
    !search.trim() || o.name.toLowerCase().includes(search.toLowerCase())
  )

  const detailOpen   = !!selectedId
  const selectedVariant = selectedVariantId ? variants.find(v => v.id === selectedVariantId) ?? null : null

  async function handleOutfitSave(input: OutfitInput): Promise<boolean | Outfit | null> {
    if (editingOutfit) return updateOutfit(editingOutfit.id, input)
    const o = await createOutfitWithSlots(input, [])
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

  return (
    <div className="flex h-svh min-w-0 overflow-hidden">

      {/* ── Gallery ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="border-b shrink-0 px-4 py-2.5 flex items-center gap-3">
          <SidebarTrigger />
          <span className="text-sm font-semibold shrink-0">Outfits</span>
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
          <Button size="sm" className="shrink-0 ml-auto" onClick={() => { setEditingOutfit(null); setOutfitFormOpen(true) }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Neues Outfit
          </Button>
        </header>

        {/* Gallery grid */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden p-4" style={{ right: '-17px' }}>
            {loading ? (
              <div className={cn('grid gap-3', detailOpen ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="aspect-[3/4] rounded-xl" />
                    <Skeleton className="h-3 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 text-center">
                <Shirt className="h-16 w-16 text-muted-foreground/10" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {search ? 'Kein Outfit gefunden' : 'Noch keine Outfits'}
                  </p>
                  {!search && (
                    <p className="text-xs text-muted-foreground/60">
                      Rechtsklick auf ein Bild im Browser → „Als Outfit speichern"
                    </p>
                  )}
                </div>
                {!search && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingOutfit(null); setOutfitFormOpen(true) }}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Manuell anlegen
                  </Button>
                )}
              </div>
            ) : (
              <div className={cn('grid gap-3', detailOpen ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
                {filtered.map(o => (
                  <OutfitCard
                    key={o.id}
                    outfit={o}
                    isSelected={selectedId === o.id}
                    onClick={() => { setSelectedId(prev => prev === o.id ? null : o.id); setSelectedVariantId(null) }}
                    onEdit={() => { setEditingOutfit(o); setOutfitFormOpen(true) }}
                    onDelete={() => setDeleteOutfitId(o.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────────── */}
      {detailOpen && (
        <div className="w-[480px] shrink-0 border-l border-border flex flex-col overflow-hidden">
          {detailLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="aspect-[3/4] rounded-xl w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : outfit ? (
            <>
              {/* Panel header */}
              <div className="border-b shrink-0 px-3 py-2.5 flex items-center gap-1.5">
                <h3 className="text-sm font-semibold flex-1 truncate min-w-0">{outfit.name}</h3>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setEditingOutfit(outfit); setOutfitFormOpen(true) }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleteOutfitId(outfit.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setSelectedId(null); setSelectedVariantId(null) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden" style={{ right: '-17px' }}>

                  {/* Cover image */}
                  <div className="bg-black/20">
                    {outfit.cover_image_url ? (
                      <img
                        src={outfit.cover_image_url}
                        alt={outfit.name}
                        className="w-full object-contain max-h-80"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground/15">
                        <Shirt className="h-16 w-16" />
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="px-4 py-3 border-b border-border space-y-2">
                    {outfit.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{outfit.description}</p>
                    )}
                    {outfit.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {outfit.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Variant grid or variant images */}
                  {selectedVariant ? (
                    <div className="p-4 space-y-4">
                      {/* Variant breadcrumb header */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedVariantId(null)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 shrink-0"
                        >
                          ← Varianten
                        </button>
                        <span className="text-xs font-semibold truncate flex-1">{selectedVariant.name}</span>
                        <div className="flex gap-0.5 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px] text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 gap-1"
                            disabled={generatingSheet || selectedVariant.images.length === 0}
                            onClick={() => generateSheet(selectedVariant)}
                            title="Flat-Lay Sheet ohne Person generieren"
                          >
                            {generatingSheet
                              ? <><span className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />Sheet…</>
                              : <><Sparkles className="h-3 w-3" />Sheet</>
                            }
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingVariant(selectedVariant); setVariantFormOpen(true) }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteVariantId(selectedVariant.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Sheet prompt output */}
                      {sheetError && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          {sheetError}
                        </div>
                      )}
                      {generatedSheetPrompt && (
                        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 overflow-hidden">
                          <div className="px-3 py-2 flex items-center gap-2 border-b border-orange-500/20">
                            <span className="text-xs font-medium text-orange-400 flex-1">✨ Ghost-Mannequin Prompt</span>
                            <Button
                              size="sm"
                              className={`h-6 px-2 text-[11px] gap-1 transition-colors ${promptCopied ? 'bg-green-600 hover:bg-green-500' : 'bg-orange-500 hover:bg-orange-400'} text-white`}
                              onClick={copySheetPrompt}
                            >
                              {promptCopied ? <><Check className="h-3 w-3" />Kopiert!</> : <><Copy className="h-3 w-3" />Kopieren</>}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-muted-foreground"
                              onClick={() => setGeneratedSheetPrompt(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed select-all">
                            {generatedSheetPrompt}
                          </p>
                          <div className="px-3 pb-2.5 text-[10px] text-muted-foreground/50">
                            Prompt in Midjourney, Flux, Firefly o.ä. einfügen → generiertes Bild per Rechtsklick zurück ins Outfit laden
                          </div>
                        </div>
                      )}

                      <OutfitMediaManager
                        variantId={selectedVariant.id}
                        images={selectedVariant.images}
                        uploading={uploading}
                        outfitCoverUrl={outfit.cover_image_url}
                        onUpload={files => uploadImages(selectedVariant.id, files)}
                        onAddUrl={url => addImageUrl(selectedVariant.id, url)}
                        onDelete={(imgId, path) => deleteImage(selectedVariant.id, imgId, path)}
                        onReorder={orderedIds => reorderImages(selectedVariant.id, orderedIds)}
                        onSetOutfitCover={url =>
                          updateOutfitCover(url, newUrl => selectedId && patchOutfitCover(selectedId, newUrl))
                        }
                      />
                    </div>
                  ) : (
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
                        <div className="flex flex-col items-center justify-center min-h-[120px] gap-3 text-center">
                          <p className="text-xs text-muted-foreground/50">Noch keine Varianten</p>
                          <Button size="sm" onClick={() => { setEditingVariant(null); setVariantFormOpen(true) }}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" />Erste Variante anlegen
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
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

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
            <AlertDialogDescription>Alle Varianten und Bilder werden unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteOutfitId) return
                await deleteOutfit(deleteOutfitId)
                if (selectedId === deleteOutfitId) setSelectedId(null)
                setDeleteOutfitId(null)
              }}
            >
              Löschen
            </AlertDialogAction>
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
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteVariantId) return
                await deleteVariant(deleteVariantId)
                if (selectedVariantId === deleteVariantId) setSelectedVariantId(null)
                setDeleteVariantId(null)
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
