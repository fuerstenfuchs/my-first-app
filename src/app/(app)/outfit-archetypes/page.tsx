'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, Search, X, Pencil, Trash2, Upload, ImageOff, ZoomIn, Sparkles } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ImageLightbox } from '@/components/image-lightbox'
import { CopyButton } from '@/components/copy-button'
import { OutfitArchetypeForm } from '@/components/outfit-archetypes/outfit-archetype-form'
import { OutfitArchetypeSheetDialog } from '@/components/outfit-archetypes/outfit-archetype-sheet-dialog'
import {
  useOutfitArchetypes, useOutfitArchetypeImages,
  type OutfitArchetype, type OutfitArchetypeInput, type OutfitArchetypeAttributes,
} from '@/hooks/use-outfit-archetypes'
import { cn } from '@/lib/utils'

const EMOJI = '👕'

const ATTRIBUTE_LABELS: Record<keyof OutfitArchetypeAttributes, string> = {
  kategorie: 'Kategorie', farben: 'Farben', material: 'Material', muster: 'Muster',
  accessoires: 'Accessoires', schuhe: 'Schuhe', saison: 'Saison', formalitaet: 'Formalität',
  land: 'Land', region: 'Region', epoche: 'Epoche',
}

// ── Gallery card ──────────────────────────────────────────────────────────────

function ArchetypeCard({
  item, isSelected, onClick, onEdit, onDelete,
}: {
  item: OutfitArchetype; isSelected: boolean
  onClick: () => void; onEdit: () => void; onDelete: () => void
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
        {item.cover_image_url ? (
          <img src={item.cover_image_url} alt={item.name}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground/20">
            <span className="text-4xl leading-none">{EMOJI}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="w-6 h-6 rounded-md bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors">
            <Pencil className="h-3 w-3 text-white" />
          </button>
          <button onClick={onDelete} className="w-6 h-6 rounded-md bg-black/60 hover:bg-red-600/80 flex items-center justify-center transition-colors">
            <Trash2 className="h-3 w-3 text-white" />
          </button>
        </div>
      </div>
      <div className="px-2 py-2">
        <p className="text-xs font-medium leading-tight truncate">{item.name}</p>
        {item.tags.length > 0 && (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
            {item.tags.slice(0, 3).join(' · ')}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Detail panel image grid ───────────────────────────────────────────────────

function ImageGrid({ archetypeId, onCoverSynced }: { archetypeId: string; onCoverSynced: (id: string, url: string | null) => void }) {
  const { images, loading, uploading, uploadImages, deleteImage } = useOutfitArchetypeImages(archetypeId, onCoverSynced)
  const fileRef = useRef<HTMLInputElement>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Referenzbilder <span className="font-normal">(optional)</span>
        </p>
        <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-3 w-3" />Hinzufügen
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) uploadImages(files); e.target.value = '' }} />
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
        </div>
      ) : images.length === 0 && uploading.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-center border border-dashed border-border/40 rounded-lg">
          <ImageOff className="h-4 w-4 text-muted-foreground/30" />
          <p className="text-[10px] text-muted-foreground/40">Keine Referenzbilder — der Archetyp funktioniert auch ohne.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {images.map((img, idx) => (
            <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-border/40 bg-muted/30 group">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setLightboxIndex(idx)}
                title="Vergrößern"
                className="absolute bottom-1 left-1 p-1 rounded bg-black/60 hover:bg-black/80 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
              >
                <ZoomIn className="h-3 w-3 text-white" />
              </button>
              <button
                onClick={() => deleteImage(img.id, img.storage_path)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          {uploading.map(u => (
            <div key={u.id} className="aspect-square rounded-lg border border-dashed border-border/40 flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground/40">{u.status === 'uploading' ? '…' : u.status === 'error' ? '✕' : '✓'}</span>
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox images={images} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OutfitArchetypesPage() {
  const { archetypes, loading, createArchetype, updateArchetype, deleteArchetype, patchCover } = useOutfitArchetypes()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<OutfitArchetype | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false)

  const filteredItems = useMemo(() =>
    archetypes.filter(i => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase())),
    [archetypes, search]
  )

  const selectedItem = selectedItemId ? archetypes.find(i => i.id === selectedItemId) ?? null : null
  const detailOpen    = !!selectedItemId

  function openForm() {
    setEditingItem(null)
    setFormOpen(true)
  }

  async function handleSave(input: OutfitArchetypeInput) {
    if (editingItem) {
      return updateArchetype(editingItem.id, input)
    }
    const item = await createArchetype(input)
    if (item) setSelectedItemId(item.id)
    return item
  }

  const attributeEntries = selectedItem
    ? (Object.entries(selectedItem.attributes) as [keyof OutfitArchetypeAttributes, string][]).filter(([, v]) => v?.trim())
    : []

  return (
    <div className="flex h-svh min-w-0 overflow-hidden">

      {/* ── Col 1: Gallery ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="border-b shrink-0 px-4 py-2.5 flex items-center gap-3">
          <SidebarTrigger />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-sm">{EMOJI} Outfit Archetypes</span>
            <span className="text-xs text-muted-foreground/60">({filteredItems.length})</span>
          </div>
          <div className="flex-1 min-w-0 relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" className="pl-8 h-8 text-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" className="shrink-0 ml-auto bg-teal-600 hover:bg-teal-500" onClick={openForm}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Neuer Archetyp
          </Button>
        </header>

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
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 text-center">
                <span className="text-7xl opacity-10 select-none">{EMOJI}</span>
                <p className="text-sm font-medium text-muted-foreground">
                  {search ? 'Kein Archetyp gefunden' : 'Noch kein Outfit Archetype'}
                </p>
                <p className="text-xs text-muted-foreground/60 max-w-xs">
                  Lege universelle Outfit-Typen wie „Schlager Outfit", „Business Look" oder „Bayerische Tracht" an —
                  sie funktionieren auch ohne Referenzbild, allein über ihre KI-Beschreibung.
                </p>
              </div>
            ) : (
              <div className={cn('grid gap-3', detailOpen ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
                {filteredItems.map(i => (
                  <ArchetypeCard
                    key={i.id}
                    item={i}
                    isSelected={selectedItemId === i.id}
                    onClick={() => setSelectedItemId(prev => prev === i.id ? null : i.id)}
                    onEdit={() => { setEditingItem(i); setFormOpen(true) }}
                    onDelete={() => setDeleteItemId(i.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Col 2: Detail panel ── */}
      {detailOpen && selectedItem && (
        <div className="w-[400px] shrink-0 border-l border-border flex flex-col overflow-hidden">
          <div className="border-b shrink-0 px-3 py-2.5 flex items-center gap-1.5">
            <h3 className="text-sm font-semibold flex-1 truncate min-w-0">{selectedItem.name}</h3>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] border-teal-500/40 text-teal-300 hover:bg-teal-500/10 hover:text-teal-200 shrink-0"
              onClick={() => setSheetDialogOpen(true)}>
              <Sparkles className="h-3 w-3" />Sheet
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
              onClick={() => { setEditingItem(selectedItem); setFormOpen(true) }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
              onClick={() => setDeleteItemId(selectedItem.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
              onClick={() => setSelectedItemId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden" style={{ right: '-17px' }}>

              <div className="px-4 py-3 space-y-3">
                {selectedItem.short_description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{selectedItem.short_description}</p>
                )}
                {attributeEntries.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {attributeEntries.map(([key, value]) => (
                      <Badge key={key} variant="outline" className="text-[10px] px-1.5 py-0">
                        {ATTRIBUTE_LABELS[key]}: {value}
                      </Badge>
                    ))}
                  </div>
                )}
                {selectedItem.long_description && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Beschreibung</p>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedItem.long_description}</p>
                  </div>
                )}
                {selectedItem.prompt && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Prompt</p>
                      <CopyButton text={selectedItem.prompt} />
                    </div>
                    <pre className="text-[11px] bg-muted/30 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedItem.prompt}
                    </pre>
                  </div>
                )}
                {selectedItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                )}

                <ImageGrid archetypeId={selectedItem.id} onCoverSynced={patchCover} />
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <OutfitArchetypeSheetDialog
          open={sheetDialogOpen}
          onClose={() => setSheetDialogOpen(false)}
          item={selectedItem}
        />
      )}

      {/* ── Form Dialog ── */}
      <OutfitArchetypeForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingItem(null) }}
        item={editingItem}
        onSave={handleSave}
      />

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!deleteItemId} onOpenChange={open => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archetyp löschen?</AlertDialogTitle>
            <AlertDialogDescription>Der Eintrag und seine Referenzbilder werden unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteItemId) return
                await deleteArchetype(deleteItemId)
                if (selectedItemId === deleteItemId) setSelectedItemId(null)
                setDeleteItemId(null)
              }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
