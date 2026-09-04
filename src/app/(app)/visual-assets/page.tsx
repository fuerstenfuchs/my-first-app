'use client'

import { useState, useMemo, useRef } from 'react'
import { Plus, Search, X, Pencil, Trash2, ExternalLink, Sparkles, Check, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { VisualAssetForm } from '@/components/visual-assets/visual-asset-form'
import {
  CAMERA_CATEGORIES, LIGHTING_CATEGORIES, EXPRESSION_CATEGORIES,
  useVisualAssets,
  type VisualAsset, type VisualAssetInput, type AssetType, type VisualCategory,
} from '@/hooks/use-visual-assets'
import { cn } from '@/lib/utils'
import { analysiere, type AnalyseBild } from '@/hooks/use-analyse'
import { passtZurSuche } from '@/lib/bausteine'
import { bildFuerAnalyse } from '@/lib/bild-fuer-analyse'

// ── Gallery card ──────────────────────────────────────────────────────────────

function AssetCard({
  asset, emoji, isSelected, onClick, onEdit, onDelete,
}: {
  asset: VisualAsset; emoji: string; isSelected: boolean
  onClick: () => void; onEdit: () => void; onDelete: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative rounded-xl overflow-hidden border-2 transition-all text-left group bg-card/60',
        isSelected
          ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-lg shadow-sky-500/10'
          : 'border-border/40 hover:border-sky-500/40'
      )}
    >
      <div className="aspect-[3/4] bg-muted/30 relative overflow-hidden">
        {asset.cover_image_url ? (
          <img src={asset.cover_image_url} alt={asset.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground/20">
            <span className="text-4xl leading-none">{emoji}</span>
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
        <p className="text-xs font-medium leading-tight truncate">{asset.name}</p>
        {asset.tags.length > 0 && (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
            {asset.tags.slice(0, 3).join(' · ')}
          </p>
        )}
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ActiveSection = { type: AssetType; category: VisualCategory }

export default function VisualAssetsPage() {
  const { assets, loading, createAsset, updateAsset, deleteAsset, patchCover, uploadCover } = useVisualAssets()

  const [active, setActive] = useState<ActiveSection>({ type: 'camera', category: 'nah' })
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen]       = useState(false)
  const [formType, setFormType]       = useState<AssetType>('camera')
  const [editingAsset, setEditingAsset] = useState<VisualAsset | null>(null)
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)

  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    name: string; category: VisualCategory; tags: string[]; description: string
  } | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const coverUploadRef = useRef<HTMLInputElement>(null)

  // Category counts per type
  const cameraCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of assets) if (a.asset_type === 'camera') map[a.category] = (map[a.category] ?? 0) + 1
    return map
  }, [assets])

  const lightingCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of assets) if (a.asset_type === 'lighting') map[a.category] = (map[a.category] ?? 0) + 1
    return map
  }, [assets])

  const expressionCount = useMemo(() =>
    assets.filter(a => a.asset_type === 'expression').length, [assets])

  const filteredAssets = useMemo(() =>
    assets.filter(a =>
      a.asset_type === active.type &&
      a.category   === active.category &&
      // PROJ-46: wortweise und über Name, Beschreibung, Kategorie und
      // Schlagworte.
      passtZurSuche(a, search)
    ), [assets, active, search])

  const selectedAsset = selectedAssetId ? assets.find(a => a.id === selectedAssetId) ?? null : null
  const detailOpen    = !!selectedAssetId

  const currentCategories = active.type === 'camera' ? CAMERA_CATEGORIES : active.type === 'lighting' ? LIGHTING_CATEGORIES : EXPRESSION_CATEGORIES
  const currentCategory   = currentCategories.find(c => c.key === active.category)!

  function openForm(type: AssetType) {
    setFormType(type)
    setEditingAsset(null)
    setFormOpen(true)
  }

  async function handleSave(input: VisualAssetInput, coverFile?: File | null) {
    if (editingAsset) {
      const ok = await updateAsset(editingAsset.id, input)
      if (ok && coverFile) await uploadCover(editingAsset.id, coverFile)
      return ok
    }
    const asset = await createAsset(input, coverFile)
    if (asset) {
      setActive({ type: asset.asset_type, category: asset.category })
      setSelectedAssetId(asset.id)
    }
    return asset
  }

  async function handleAnalyze() {
    if (!selectedAsset?.cover_image_url) return
    setAiAnalyzing(true)
    setAiSuggestion(null)
    setAiError(null)
    try {
      let body: AnalyseBild
      try {
        const imgRes = await fetch(selectedAsset.cover_image_url)
        if (!imgRes.ok) throw new Error('fetch failed')
        const blob = await imgRes.blob()
        // DEN TYP ABLESEN, NICHT GLAUBEN — und was die Analyse nicht
        // versteht (AVIF, HEIC, BMP) vorher nach PNG umwandeln. Hier stand
        // `blob.type || 'image/jpeg'`, und daran ist Mark am 04.09.2026
        // gescheitert: „Image format image/jpeg not supported".
        body = await bildFuerAnalyse(blob)
      } catch {
        body = { imageUrl: selectedAsset.cover_image_url }
      }
      // Erst Marks eigener Proxy, sonst die bezahlte Route. `assetType`
      // entscheidet dabei ueber den Prompt — dieselbe Weiche, die die Route
      // intern schon immer hatte, hier nur sichtbar gemacht.
      const { ergebnis: result } = await analysiere<{ name?: string; category?: string; tags?: string[]; description?: string }>(
        selectedAsset.asset_type === 'lighting' ? 'licht' : 'kamera',
        body,
        { route: '/api/analyze-visual-asset', zusatz: { assetType: selectedAsset.asset_type } },
      )
      const validCats = currentCategories.map(c => c.key) as string[]
      setAiSuggestion({
        name:        result.name        ?? selectedAsset.name,
        category:    (validCats.includes(result.category ?? '') ? result.category : selectedAsset.category) as VisualCategory,
        tags:        result.tags        ?? selectedAsset.tags,
        description: result.description ?? selectedAsset.description ?? '',
      })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen')
    } finally {
      setAiAnalyzing(false)
    }
  }

  async function handleApplySuggestion() {
    if (!selectedAsset || !aiSuggestion) return
    const ok = await updateAsset(selectedAsset.id, {
      name: aiSuggestion.name, category: aiSuggestion.category,
      tags: aiSuggestion.tags, description: aiSuggestion.description,
    })
    if (ok) setAiSuggestion(null)
  }

  async function handleCoverUpload(file: File) {
    if (!selectedAssetId) return
    await uploadCover(selectedAssetId, file)
  }

  return (
    <div className="flex h-svh min-w-0 overflow-hidden">

      {/* ── Col 1: Category nav ── */}
      <div className="w-48 shrink-0 flex flex-col border-r border-border overflow-y-auto">
        <header className="border-b shrink-0 px-3 py-3 flex items-center gap-2">
          <SidebarTrigger />
          <span className="text-sm font-semibold flex-1 truncate">Kamera, Licht & Mimik</span>
        </header>

        <nav className="flex-1 p-2 space-y-3">
          {/* Camera section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">📷 Kamera</span>
              <button onClick={() => openForm('camera')} title="Neuer Kamera-Shot"
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {CAMERA_CATEGORIES.map(cat => {
                const count    = cameraCounts[cat.key] ?? 0
                const isActive = active.type === 'camera' && active.category === cat.key
                return (
                  <button key={cat.key}
                    onClick={() => { setActive({ type: 'camera', category: cat.key }); setSelectedAssetId(null); setSearch('') }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                      isActive ? 'bg-sky-500/10 text-sky-300 font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                    <span className="flex-1 truncate text-xs">{cat.label}</span>
                    {count > 0 && (
                      <span className={cn('text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium',
                        isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-muted text-muted-foreground')}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Lighting section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">💡 Licht</span>
              <button onClick={() => openForm('lighting')} title="Neuer Licht-Stil"
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {LIGHTING_CATEGORIES.map(cat => {
                const count    = lightingCounts[cat.key] ?? 0
                const isActive = active.type === 'lighting' && active.category === cat.key
                return (
                  <button key={cat.key}
                    onClick={() => { setActive({ type: 'lighting', category: cat.key }); setSelectedAssetId(null); setSearch('') }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                      isActive ? 'bg-sky-500/10 text-sky-300 font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                    <span className="flex-1 truncate text-xs">{cat.label}</span>
                    {count > 0 && (
                      <span className={cn('text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium',
                        isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-muted text-muted-foreground')}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Expression section */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">😊 Mimik</span>
              <button onClick={() => openForm('expression')} title="Neuer Gesichtsausdruck"
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/60 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {(() => {
                const isActive = active.type === 'expression'
                return (
                  <button
                    onClick={() => { setActive({ type: 'expression', category: 'alle' }); setSelectedAssetId(null); setSearch('') }}
                    className={cn(
                      'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                      isActive ? 'bg-sky-500/10 text-sky-300 font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                  >
                    <span className="text-base leading-none shrink-0">😊</span>
                    <span className="flex-1 truncate text-xs">Alle Ausdrücke</span>
                    {expressionCount > 0 && (
                      <span className={cn('text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium',
                        isActive ? 'bg-sky-500/20 text-sky-300' : 'bg-muted text-muted-foreground')}>
                        {expressionCount}
                      </span>
                    )}
                  </button>
                )
              })()}
            </div>
          </div>
        </nav>
      </div>

      {/* ── Col 2: Gallery ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="border-b shrink-0 px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-sm">{currentCategory.emoji} {currentCategory.label}</span>
            <span className="text-xs text-muted-foreground/60">({filteredAssets.length})</span>
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
          <Button size="sm" className="shrink-0 ml-auto bg-sky-600 hover:bg-sky-500"
            onClick={() => openForm(active.type)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {active.type === 'camera' ? 'Neuer Shot' : active.type === 'lighting' ? 'Neues Licht' : 'Neuer Ausdruck'}
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
            ) : filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 text-center">
                <span className="text-7xl opacity-10 select-none">{currentCategory.emoji}</span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {search ? 'Kein Asset gefunden' : `Noch keine ${currentCategory.label}`}
                  </p>
                </div>
                {!search && (
                  <Button size="sm" variant="outline" onClick={() => openForm(active.type)}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Manuell anlegen
                  </Button>
                )}
              </div>
            ) : (
              <div className={cn('grid gap-3', detailOpen ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5')}>
                {filteredAssets.map(a => (
                  <AssetCard
                    key={a.id}
                    asset={a}
                    emoji={currentCategory.emoji}
                    isSelected={selectedAssetId === a.id}
                    onClick={() => setSelectedAssetId(prev => prev === a.id ? null : a.id)}
                    onEdit={() => { setEditingAsset(a); setFormType(a.asset_type); setFormOpen(true) }}
                    onDelete={() => setDeleteAssetId(a.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Col 3: Detail panel ── */}
      {detailOpen && (
        <div className="w-[440px] shrink-0 border-l border-border flex flex-col overflow-hidden">
          {!selectedAsset ? (
            <div className="p-4 space-y-3">
              <Skeleton className="aspect-[3/4] rounded-xl w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <>
              <div className="border-b shrink-0 px-3 py-2.5 flex items-center gap-1.5">
                <h3 className="text-sm font-semibold flex-1 truncate min-w-0">{selectedAsset.name}</h3>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                  onClick={() => { setEditingAsset(selectedAsset); setFormType(selectedAsset.asset_type); setFormOpen(true) }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteAssetId(selectedAsset.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                  onClick={() => setSelectedAssetId(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 right-0 ohne-rollbalken overflow-y-auto overflow-x-hidden">

                  {/* Cover image */}
                  <div className="relative bg-black/20 group/cover">
                    {selectedAsset.cover_image_url ? (
                      <>
                        <img src={selectedAsset.cover_image_url} alt={selectedAsset.name} className="w-full object-contain max-h-80" />
                        {selectedAsset.asset_type !== 'expression' && (
                          <button
                            onClick={handleAnalyze}
                            disabled={aiAnalyzing}
                            className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-sky-600/90 hover:bg-sky-500 disabled:opacity-60 text-white text-[10px] font-medium transition-colors shadow"
                          >
                            {aiAnalyzing
                              ? <span className="w-2.5 h-2.5 rounded-full border border-white border-t-transparent animate-spin" />
                              : <Sparkles className="h-2.5 w-2.5" />}
                            {aiAnalyzing ? 'Analysiere…' : 'KI analysieren'}
                          </button>
                        )}
                        {selectedAsset.source_url && (
                          <a href={selectedAsset.source_url} target="_blank" rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] bg-black/60 hover:bg-black/80 text-white px-2 py-1 rounded-md transition-colors">
                            <ExternalLink className="h-2.5 w-2.5" />Zum Original
                          </a>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => coverUploadRef.current?.click()}
                        className="w-full h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 hover:text-sky-400 transition-colors"
                      >
                        <span className="text-5xl">{currentCategory.emoji}</span>
                        <span className="text-xs flex items-center gap-1"><Upload className="h-3 w-3" />Bild hochladen</span>
                      </button>
                    )}
                    <input ref={coverUploadRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = '' }} />
                  </div>

                  {/* AI error */}
                  {aiError && (
                    <div className="mx-3 my-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                      <span className="text-xs text-destructive flex-1">{aiError}</span>
                      <button onClick={() => setAiError(null)} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-3 w-3" /></button>
                    </div>
                  )}

                  {/* AI suggestion card */}
                  {aiSuggestion && (
                    <div className="mx-3 my-2 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-sky-400">
                        <Sparkles className="h-3 w-3" />
                        <span className="text-[11px] font-semibold">KI-Vorschlag</span>
                        <button onClick={() => setAiSuggestion(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground/60 w-16 shrink-0">Name</span>
                          <span className="font-medium text-foreground/90 leading-tight">{aiSuggestion.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground/60 w-16 shrink-0">Kategorie</span>
                          <span className="text-foreground/90">
                            {currentCategories.find(c => c.key === aiSuggestion.category)?.emoji}{' '}
                            {currentCategories.find(c => c.key === aiSuggestion.category)?.label}
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
                        <Button size="sm" className="h-7 text-[11px] flex-1 bg-sky-600 hover:bg-sky-500" onClick={handleApplySuggestion}>
                          <Check className="mr-1 h-3 w-3" />Übernehmen
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setAiSuggestion(null)}>
                          Verwerfen
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {currentCategory.emoji} {currentCategory.label} ·{' '}
                        {selectedAsset.asset_type === 'camera' ? '📷 Kamera' : selectedAsset.asset_type === 'lighting' ? '💡 Licht' : '😊 Mimik'}
                      </span>
                    </div>
                    {selectedAsset.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{selectedAsset.description}</p>
                    )}
                    {selectedAsset.source_url && (
                      <a href={selectedAsset.source_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-sky-400 transition-colors">
                        <ExternalLink className="h-3 w-3" />
                        {selectedAsset.source_title || (() => { try { return new URL(selectedAsset.source_url).hostname.replace('www.','') } catch { return selectedAsset.source_url } })()}
                      </a>
                    )}
                    {selectedAsset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedAsset.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                      </div>
                    )}
                    {selectedAsset.cover_image_url && (
                      <button onClick={() => coverUploadRef.current?.click()}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-sky-400 transition-colors mt-1">
                        <Upload className="h-3 w-3" />Bild ersetzen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Form Dialog ── */}
      <VisualAssetForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingAsset(null) }}
        asset={editingAsset}
        assetType={formType}
        defaultCategory={active.type === formType ? active.category : undefined}
        onSave={handleSave}
      />

      {/* ── Delete Dialog ── */}
      <AlertDialog open={!!deleteAssetId} onOpenChange={open => !open && setDeleteAssetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asset löschen?</AlertDialogTitle>
            <AlertDialogDescription>Das Asset wird unwiderruflich gelöscht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteAssetId) return
                await deleteAsset(deleteAssetId)
                if (selectedAssetId === deleteAssetId) setSelectedAssetId(null)
                setDeleteAssetId(null)
              }}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
