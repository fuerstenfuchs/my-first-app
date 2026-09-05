'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, Search, X, Pencil, Trash2, Lock, Upload } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
/*
  Ohne diese Einfuhr gibt es die Klassen `lt`, `lt-kopf`, `lt-feld` und
  `lt-haupt` auf dieser Seite gar nicht — sie stuenden im Markup und taeten
  nichts. Genau das ist bei der Charakterseite am 05.09.2026 passiert: Die
  Seite blieb schwarz, obwohl alle Klassen gesetzt waren.
*/
import '../bildstudio/lichttisch.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LookGradingForm } from '@/components/look-grading/look-grading-form'
import { useLookGrading, type LookGradingItem, type LookGradingType, type LookGradingInput } from '@/hooks/use-look-grading'
import { cn } from '@/lib/utils'
import { passtZurSuche } from '@/lib/bausteine'

// ── Gallery card ──────────────────────────────────────────────────────────────

function LookGradingCard({
  item, emoji, isSelected, onClick, onEdit, onDelete,
}: {
  item: LookGradingItem; emoji: string; isSelected: boolean
  onClick: () => void; onEdit: () => void; onDelete: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'lt-platte relative overflow-hidden border-2 transition-all text-left group',
        isSelected
          ? 'border-primary ring-2 ring-primary/20 shadow-lg shadow-primary/10'
          : 'border-border/40 hover:border-primary/40'
      )}
    >
      <div className="aspect-[3/4] bg-muted/30 relative overflow-hidden">
        {item.cover_image_url ? (
          <img src={item.cover_image_url} alt={item.name}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground/20">
            <span className="text-4xl leading-none">{emoji}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {item.isStandard ? (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 text-[9px] bg-black/60 text-white/70 px-1.5 py-0.5 rounded font-medium">
            <Lock className="h-2.5 w-2.5" />Standard
          </div>
        ) : (
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="w-6 h-6 rounded-md bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors">
              <Pencil className="h-3 w-3 text-white" />
            </button>
            <button onClick={onDelete} className="w-6 h-6 rounded-md bg-black/60 hover:bg-red-600/80 flex items-center justify-center transition-colors">
              <Trash2 className="h-3 w-3 text-white" />
            </button>
          </div>
        )}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LookGradingPage() {
  const { styles, gradings, loading, createItem, updateItem, deleteItem, uploadItemCover, uploadStandardCover } = useLookGrading()
  const coverUploadRef = useRef<HTMLInputElement>(null)

  const [activeType, setActiveType] = useState<LookGradingType>('style')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LookGradingItem | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  const items = activeType === 'style' ? styles : gradings
  const emoji = activeType === 'style' ? '🎥' : '🎨'
  const label = activeType === 'style' ? 'Stil' : 'Grading'

  const filteredItems = useMemo(() =>
    // PROJ-46: wortweise und über Name und Schlagworte. Stile und Gradings
    // haben keine Kategorie — `LookGradingItem` führt keine.
    items.filter(i => passtZurSuche(i, search)),
    [items, search]
  )

  const selectedItem = selectedItemId ? items.find(i => i.id === selectedItemId) ?? null : null
  const detailOpen    = !!selectedItemId

  function openForm() {
    setEditingItem(null)
    setFormOpen(true)
  }

  async function handleSave(input: LookGradingInput, coverFile?: File | null) {
    if (editingItem) {
      const ok = await updateItem(editingItem.id, input)
      if (ok && coverFile) await uploadItemCover(editingItem.id, coverFile)
      return ok
    }
    const item = await createItem(activeType, input, coverFile)
    if (item) setSelectedItemId(item.id)
    return item
  }

  async function handleCoverUpload(file: File) {
    if (!selectedItem) return
    if (selectedItem.isStandard) {
      if (selectedItem.presetKey) await uploadStandardCover(activeType, selectedItem.presetKey, file)
    } else {
      await uploadItemCover(selectedItem.id, file)
    }
  }

  return (
    <div className="lt flex h-svh min-w-0 overflow-hidden">

      {/* ── Col 1: Type nav ── */}
      <div className="w-48 shrink-0 flex flex-col border-r border-border overflow-y-auto">
        <header className="lt-kopf shrink-0 px-3 py-3 flex items-center gap-2">
          <SidebarTrigger />
          <span className="flex-1 truncate text-[17px] font-bold">Look & Grading</span>
        </header>

        <nav className="flex-1 p-2 space-y-1">
          <button
            onClick={() => { setActiveType('style'); setSelectedItemId(null); setSearch('') }}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors text-left',
              activeType === 'style' ? 'bg-primary/10 text-[#ffb066] font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <span className="text-base leading-none shrink-0">🎥</span>
            <span className="flex-1 truncate text-xs">Stil</span>
            <span className={cn('text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium',
              activeType === 'style' ? 'bg-primary/20 text-[#ffb066]' : 'bg-muted text-muted-foreground')}>
              {styles.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveType('grading'); setSelectedItemId(null); setSearch('') }}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors text-left',
              activeType === 'grading' ? 'bg-primary/10 text-[#ffb066] font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <span className="text-base leading-none shrink-0">🎨</span>
            <span className="flex-1 truncate text-xs">Grading</span>
            <span className={cn('text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium',
              activeType === 'grading' ? 'bg-primary/20 text-[#ffb066]' : 'bg-muted text-muted-foreground')}>
              {gradings.length}
            </span>
          </button>
        </nav>
      </div>

      {/* ── Col 2: Gallery ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="lt-kopf shrink-0 px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[17px] font-bold">{emoji} {label}</span>
            <span className="text-xs text-muted-foreground/60">({filteredItems.length})</span>
          </div>
          <div className="flex-1 min-w-0 relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" className="lt-feld h-10 border-0 pl-9 text-[15px]" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button size="sm" className="shrink-0 ml-auto bg-primary text-primary-foreground hover:bg-primary/90" onClick={openForm}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {activeType === 'style' ? 'Neuer Stil' : 'Neues Grading'}
          </Button>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken overflow-y-auto overflow-x-hidden p-4">
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
                <span className="text-7xl opacity-10 select-none">{emoji}</span>
                <p className="text-sm font-medium text-muted-foreground">Kein {label} gefunden</p>
              </div>
            ) : (
              <div className={cn('grid gap-3', detailOpen ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
                {filteredItems.map(i => (
                  <LookGradingCard
                    key={i.id}
                    item={i}
                    emoji={emoji}
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
          <div className="shrink-0 border-b border-[rgba(150,185,220,0.12)] px-3 py-2.5 flex items-center gap-1.5">
            <h3 className="text-sm font-semibold flex-1 truncate min-w-0">{selectedItem.name}</h3>
            {!selectedItem.isStandard && (
              <>
                <Button size="icon" variant="ghost" className="lt-feld h-9 w-9 shrink-0 border-0"
                  onClick={() => { setEditingItem(selectedItem); setFormOpen(true) }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteItemId(selectedItem.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button size="icon" variant="ghost" className="lt-feld h-9 w-9 shrink-0 border-0"
              onClick={() => setSelectedItemId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken overflow-y-auto overflow-x-hidden">

              <div className="relative bg-black/20 group/cover">
                {selectedItem.cover_image_url ? (
                  <>
                    <img src={selectedItem.cover_image_url} alt={selectedItem.name} className="w-full object-contain max-h-72" />
                    <button
                      onClick={() => coverUploadRef.current?.click()}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-xs text-white"
                    >
                      <Upload className="h-3.5 w-3.5" />Bild ersetzen
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => coverUploadRef.current?.click()}
                    className="w-full h-32 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 hover:text-primary transition-colors"
                  >
                    <span className="text-4xl">{emoji}</span>
                    <span className="text-xs flex items-center gap-1"><Upload className="h-3 w-3" />Beispielbild hinzufügen</span>
                  </button>
                )}
                <input ref={coverUploadRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = '' }} />
              </div>

              <div className="px-4 py-3 space-y-3">
                {selectedItem.isStandard && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                    <Lock className="h-3 w-3" />Standard-{label} — fest hinterlegt
                  </div>
                )}
                {selectedItem.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{selectedItem.description}</p>
                )}
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Prompt</p>
                  <pre className="text-[11px] bg-muted/30 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
                    {selectedItem.prompt}
                  </pre>
                </div>
                {selectedItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Dialog ── */}
      <LookGradingForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingItem(null) }}
        type={activeType}
        item={editingItem}
        onSave={handleSave}
      />

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!deleteItemId} onOpenChange={open => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label} löschen?</AlertDialogTitle>
            <AlertDialogDescription>Der Eintrag wird unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteItemId) return
                await deleteItem(deleteItemId)
                if (selectedItemId === deleteItemId) setSelectedItemId(null)
                setDeleteItemId(null)
              }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
