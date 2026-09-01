'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, Search, X, Pencil, Trash2, Upload, ImageOff, ZoomIn } from 'lucide-react'
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
import { CustomCategoryDialog } from '@/components/categories/custom-category-dialog'
import { LocationArchetypeForm } from '@/components/location-archetypes/location-archetype-form'
import {
  useLocationArchetypes, useLocationArchetypeImages,
  type LocationArchetype, type LocationArchetypeInput,
} from '@/hooks/use-location-archetypes'
import { useCustomCategories } from '@/hooks/use-custom-categories'
import { ARCHETYPE_CATEGORIES } from '@/lib/location-archetype-categories'
import { cn } from '@/lib/utils'

const EMOJI = '🏛️'

// ── Gallery card ──────────────────────────────────────────────────────────────

function ArchetypeCard({
  item, isSelected, onClick, onEdit, onDelete,
}: {
  item: LocationArchetype; isSelected: boolean
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
  const { images, loading, uploading, uploadImages, deleteImage } = useLocationArchetypeImages(archetypeId, onCoverSynced)
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

export default function LocationArchetypesPage() {
  const { archetypes, loading, createArchetype, updateArchetype, deleteArchetype, patchCover } = useLocationArchetypes()
  const { categories: customCategories, createCategory: createCustomCategory, deleteCategory: deleteCustomCategory } = useCustomCategories('location_archetype')

  const allCategories = useMemo(() => [
    ...ARCHETYPE_CATEGORIES.map(c => ({ ...c, id: undefined as string | undefined })),
    ...customCategories.map(c => ({ key: c.key, label: c.label, emoji: c.emoji, id: c.id as string | undefined })),
  ], [customCategories])

  const [selectedCategory, setSelectedCategory] = useState<string>(ARCHETYPE_CATEGORIES[0].key)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LocationArchetype | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of archetypes) map[a.category] = (map[a.category] ?? 0) + 1
    return map
  }, [archetypes])

  const filteredItems = useMemo(() =>
    archetypes.filter(i =>
      i.category === selectedCategory &&
      (!search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))
    ), [archetypes, selectedCategory, search]
  )

  const currentCategory = allCategories.find(c => c.key === selectedCategory) ?? { key: selectedCategory, label: selectedCategory, emoji: EMOJI, id: undefined }
  const selectedItem = selectedItemId ? archetypes.find(i => i.id === selectedItemId) ?? null : null
  const detailOpen    = !!selectedItemId

  function openForm() {
    setEditingItem(null)
    setFormOpen(true)
  }

  async function handleSave(input: LocationArchetypeInput) {
    if (editingItem) {
      return updateArchetype(editingItem.id, input)
    }
    const item = await createArchetype(input)
    if (item) { setSelectedCategory(item.category); setSelectedItemId(item.id) }
    return item
  }

  return (
    <div className="flex h-svh min-w-0 overflow-hidden">

      {/* ── Col 1: Category nav ── */}
      <div className="w-48 shrink-0 flex flex-col border-r border-border">
        <header className="border-b shrink-0 px-3 py-3 flex items-center gap-2">
          <SidebarTrigger />
          <span className="text-sm font-semibold flex-1 truncate">Archetypes</span>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={openForm} title="Neuer Archetyp">
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
                  onClick={() => { setSelectedCategory(cat.key); setSelectedItemId(null); setSearch('') }}
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
                <span className="text-7xl opacity-10 select-none">{currentCategory.emoji}</span>
                <p className="text-sm font-medium text-muted-foreground">
                  {search ? 'Kein Archetyp gefunden' : `Noch kein Archetyp in „${currentCategory.label}"`}
                </p>
                <p className="text-xs text-muted-foreground/60 max-w-xs">
                  Lege universelle Ortskonzepte wie „Bar", „Rooftop" oder „Luxusvilla" an —
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

      {/* ── Col 3: Detail panel ── */}
      {detailOpen && selectedItem && (
        <div className="w-[400px] shrink-0 border-l border-border flex flex-col overflow-hidden">
          <div className="border-b shrink-0 px-3 py-2.5 flex items-center gap-1.5">
            <h3 className="text-sm font-semibold flex-1 truncate min-w-0">{selectedItem.name}</h3>
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
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                  {allCategories.find(c => c.key === selectedItem.category)?.emoji ?? EMOJI}{' '}
                  {allCategories.find(c => c.key === selectedItem.category)?.label ?? selectedItem.category}
                </div>
                {selectedItem.short_description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{selectedItem.short_description}</p>
                )}
                {selectedItem.long_description && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Beschreibung</p>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedItem.long_description}</p>
                  </div>
                )}
                {selectedItem.prompt && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Prompt</p>
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

      {/* ── Form Dialog ── */}
      <LocationArchetypeForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingItem(null) }}
        item={editingItem}
        categories={allCategories}
        defaultCategory={selectedCategory}
        onSave={handleSave}
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

      {/* ── Delete Dialogs ── */}
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

      <AlertDialog open={!!deleteCategoryId} onOpenChange={open => !open && setDeleteCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kategorie löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Archetypes mit dieser Kategorie bleiben erhalten, zeigen die Kategorie danach aber nur noch als Text an.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteCategoryId) return
                await deleteCustomCategory(deleteCategoryId)
                if (selectedCategory === allCategories.find(c => c.id === deleteCategoryId)?.key) {
                  setSelectedCategory(ARCHETYPE_CATEGORIES[0].key)
                }
                setDeleteCategoryId(null)
              }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
