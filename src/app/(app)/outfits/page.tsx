'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, X, Pencil, Trash2, ExternalLink, Sparkles, Copy, Check, Link2 } from 'lucide-react'
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
import { OutfitForm } from '@/components/outfits/outfit-form'
import { OutfitVariantForm } from '@/components/outfits/outfit-variant-form'
import { OutfitVariantCard } from '@/components/outfits/outfit-variant-card'
import { OutfitMediaManager } from '@/components/outfits/outfit-media-manager'
import { FashionSheetDialog } from '@/components/outfits/fashion-sheet-dialog'
import { OutfitKetteDialog } from '@/components/outfits/outfit-kette-dialog'
import { istEigenerSpeicher } from '@/lib/outfit-kette'
import {
  useOutfits, useOutfitDetail,
  type Outfit, type OutfitVariant, type OutfitInput, type OutfitVariantInput,
} from '@/hooks/use-outfits'
import {
  OUTFIT_KATEGORIEN, alsKategorie, istKleidungsstueck, kategorieEintrag,
  type OutfitKategorie,
} from '@/lib/outfit-kategorien'
import { passtZurSuche } from '@/lib/bausteine'
import { cn } from '@/lib/utils'
import { analysiere, type AnalyseBild } from '@/hooks/use-analyse'

/**
 * Outfits — seit PROJ-53 EIN Bereich für komplette Looks UND einzelne
 * Kleidungsstücke.
 *
 * Die Unterscheidung trägt jeder Eintrag selbst, als `category`. Marks
 * Entscheidung auf ausdrückliche Rückfrage am 03.09.2026: „Kategorie am
 * Eintrag." Die Alternative — alles flach ohne Unterscheidung — hätte die acht
 * gewachsenen Kleidungsstück-Kategorien verloren.
 *
 * Diese Seite ist aus der alten Outfit-Seite und der alten Fashion-Seite
 * zusammengeführt. Aus Fashion kamen: die Kategorieleiste, die Kategoriewahl
 * beim Anlegen, die KI-Analyse mit Vorschlagskarte, der Quellen-Verweis und
 * das Sheet-Erzeugen für Kleidungsstücke. Aus Outfits blieb alles Übrige —
 * insbesondere der Bilderverwalter mit Umsortieren und Lichtkasten, der der
 * eingebauten Bildansicht der Fashion-Seite in jedem Punkt überlegen war.
 */

/** „Alle" ist kein Kategoriewert in der Datenbank, nur ein Zustand der Leiste. */
type Filterwert = OutfitKategorie | 'alle'

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
  const kat = kategorieEintrag(outfit.category)
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
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/25">
            <span className="text-4xl leading-none select-none">{kat.emoji}</span>
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

        {/* Die Kategorie am Bild — sonst sieht man in der Ansicht „Alle" nicht,
            was ein Komplett-Look ist und was ein einzelnes Stück. */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
          <span
            className="text-[11px] leading-none bg-black/60 px-1.5 py-1 rounded"
            title={kat.label}
          >
            {kat.emoji}
          </span>
          {outfit.source_url && (
            <span className="text-[9px] bg-black/60 text-white/80 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              {(() => { try { return new URL(outfit.source_url!).hostname.replace('www.', '') } catch { return '' } })()}
            </span>
          )}
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

  const [selectedCategory, setSelectedCategory] = useState<Filterwert>('alle')
  const [selectedId, setSelectedId]         = useState<string | null>(null)
  const [search, setSearch]                 = useState('')
  const [outfitFormOpen, setOutfitFormOpen] = useState(false)
  const [editingOutfit, setEditingOutfit]   = useState<Outfit | null>(null)
  const [deleteOutfitId, setDeleteOutfitId] = useState<string | null>(null)

  const {
    outfit, variants, loading: detailLoading, uploading,
    createVariant, updateVariant, deleteVariant, reorderVariants,
    uploadImages, addImageUrl, deleteImage, reorderImages, updateOutfitCover,
    refetch: refetchDetail,
  } = useOutfitDetail(selectedId)

  const [variantFormOpen, setVariantFormOpen]     = useState(false)
  const [editingVariant, setEditingVariant]       = useState<OutfitVariant | null>(null)
  const [deleteVariantId, setDeleteVariantId]     = useState<string | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [generatingSheet, setGeneratingSheet]     = useState(false)
  const [generatedSheetPrompt, setGeneratedSheetPrompt] = useState<string | null>(null)
  const [promptCopied, setPromptCopied]           = useState(false)
  const [sheetError, setSheetError]               = useState<string | null>(null)

  const [sheetDialogOpen, setSheetDialogOpen]     = useState(false)
  const [ketteDialogOpen, setKetteDialogOpen]     = useState(false)

  /**
   * Warum die Referenzkette gerade nicht geht — oder `null`, wenn sie geht.
   *
   * Als GRUND und nicht als `boolean`: Ein Knopf, der grau ist und nichts
   * sagt, ist ein Knopf, den Mark für kaputt hält. Die zweite Bedingung ist
   * dieselbe Schranke, die der Arbeiter zieht — sie hier VORHER zu prüfen
   * erspart einen Auftrag, der sicher scheitert.
   */
  const ketteGesperrtGrund: string | null =
    !outfit?.cover_image_url
      ? 'Dieses Outfit hat kein Titelbild — die Kette braucht ein Ausgangsbild.'
      : !istEigenerSpeicher(outfit.cover_image_url)
        ? 'Das Titelbild liegt nicht im eigenen Speicher — der Arbeiter würde es als Referenz ablehnen. Erst sichern.'
        : null

  const [aiAnalyzing, setAiAnalyzing]   = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    name: string; category: OutfitKategorie; tags: string[]; description: string
  } | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const o of outfits) map[o.category] = (map[o.category] ?? 0) + 1
    return map
  }, [outfits])

  const filtered = useMemo(() =>
    outfits.filter(o =>
      (selectedCategory === 'alle' || o.category === selectedCategory) &&
      passtZurSuche(o, search)
    ), [outfits, selectedCategory, search])

  /**
   * Das Ghost-Mannequin-Sheet einer Variante.
   *
   * Bleibt unverändert aus der alten Outfit-Seite: eine Vorderansicht und eine
   * Rückansicht der getragenen Kleidung OHNE Person. Es arbeitet über die
   * Bilder der Variante und braucht deshalb keine Kategorie.
   */
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

  /**
   * KI-Analyse des Titelbildes.
   *
   * WELCHE ANALYSE: Ein Kleidungsstück wird mit `fashion` untersucht — nur die
   * liefert eine Kategorie zurück. Ein Komplett-Look mit `outfit`; die
   * beschreibt den ganzen Look statt eines Einzelteils und liefert bewusst
   * KEINE Kategorie, weshalb `komplett` dabei stehen bleibt. Beide Prompts
   * standen schon vor PROJ-53 nebeneinander in `analyse-prompts.ts` — hier
   * werden sie nur passend gewählt statt einer von beiden gestrichen.
   */
  async function handleAnalyze() {
    if (!outfit?.cover_image_url) return
    const istStueck = istKleidungsstueck(outfit.category)
    setAiAnalyzing(true)
    setAiSuggestion(null)
    try {
      let body: AnalyseBild
      try {
        const imgRes = await fetch(outfit.cover_image_url)
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
        body = { imageUrl: outfit.cover_image_url }
      }

      // Erst Marks eigener Proxy, sonst die bezahlte Route. Welcher Weg es
      // wurde, sagt `analysiere` selbst per Hinweis.
      const { ergebnis: result } = await analysiere<{
        name?: string; category?: string; tags?: string[]; description?: string
      }>(
        istStueck ? 'fashion' : 'outfit',
        body,
        { route: istStueck ? '/api/analyze-fashion' : '/api/analyze-outfit' },
      )

      setAiSuggestion({
        name:        result.name ?? outfit.name,
        // Die Outfit-Analyse liefert keine Kategorie — dann bleibt die
        // vorhandene stehen, statt sie stillschweigend auf die Vorgabe zu
        // ziehen.
        category:    result.category ? alsKategorie(result.category) : outfit.category,
        tags:        result.tags ?? outfit.tags,
        description: result.description ?? outfit.description ?? '',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen')
    } finally {
      setAiAnalyzing(false)
    }
  }

  async function handleApplySuggestion() {
    if (!outfit || !aiSuggestion) return
    const ok = await updateOutfit(outfit.id, {
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

  const detailOpen      = !!selectedId
  const selectedVariant = selectedVariantId ? variants.find(v => v.id === selectedVariantId) ?? null : null
  const aktuelleKat     = selectedCategory === 'alle' ? null : kategorieEintrag(selectedCategory)

  async function handleOutfitSave(input: OutfitInput): Promise<boolean | Outfit | null> {
    if (editingOutfit) return updateOutfit(editingOutfit.id, input)
    const o = await createOutfitWithSlots(input, [])
    if (o) { setSelectedCategory(o.category); setSelectedId(o.id) }
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

      {/* ── Spalte 1: Kategorien ─────────────────────────────────────── */}
      <div className="w-48 shrink-0 flex flex-col border-r border-border">
        <header className="border-b shrink-0 px-3 py-3 flex items-center gap-2">
          <SidebarTrigger />
          <span className="text-sm font-semibold flex-1 truncate">Outfits</span>
          <Button
            size="icon" variant="ghost" className="h-7 w-7 shrink-0"
            onClick={() => { setEditingOutfit(null); setOutfitFormOpen(true) }}
            title="Neuer Eintrag"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </header>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* „Alle" zuerst — sonst versteckt der Filter beim Öffnen der Seite
              acht Neuntel des Bestands, und man sucht, was man gerade noch
              gesehen hat. */}
          <button
            onClick={() => { setSelectedCategory('alle'); setSelectedId(null) }}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
              selectedCategory === 'alle'
                ? 'bg-orange-500/10 text-orange-300 font-medium'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <span className="text-base leading-none shrink-0">🗂️</span>
            <span className="flex-1 truncate text-xs">Alle</span>
            {outfits.length > 0 && (
              <span className={cn(
                'text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium',
                selectedCategory === 'alle' ? 'bg-orange-500/20 text-orange-300' : 'bg-muted text-muted-foreground'
              )}>
                {outfits.length}
              </span>
            )}
          </button>

          <div className="h-px bg-border/60 my-1.5" />

          {OUTFIT_KATEGORIEN.map(cat => {
            const count    = categoryCounts[cat.key] ?? 0
            const isActive = selectedCategory === cat.key
            return (
              <button
                key={cat.key}
                onClick={() => { setSelectedCategory(cat.key); setSelectedId(null) }}
                className={cn(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                  isActive
                    ? 'bg-orange-500/10 text-orange-300 font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <span className="text-base leading-none shrink-0">{cat.emoji}</span>
                <span className="flex-1 truncate text-xs">{cat.label}</span>
                {count > 0 && (
                  <span className={cn(
                    'text-[11px] tabular-nums shrink-0 px-1.5 py-0.5 rounded-full font-medium',
                    isActive ? 'bg-orange-500/20 text-orange-300' : 'bg-muted text-muted-foreground'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Spalte 2: Galerie ────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="border-b shrink-0 px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-semibold text-sm">
              {aktuelleKat ? `${aktuelleKat.emoji} ${aktuelleKat.label}` : '🗂️ Alle'}
            </span>
            <span className="text-xs text-muted-foreground/60">({filtered.length})</span>
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
          <Button size="sm" className="shrink-0 ml-auto" onClick={() => { setEditingOutfit(null); setOutfitFormOpen(true) }}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Neuer Eintrag
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
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 text-center">
                <span className="text-7xl opacity-10 select-none">{aktuelleKat?.emoji ?? '🗂️'}</span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {search
                      ? 'Nichts gefunden'
                      : aktuelleKat ? `Noch keine ${aktuelleKat.label}` : 'Noch keine Einträge'}
                  </p>
                  {!search && (
                    <p className="text-xs text-muted-foreground/60">
                      Rechtsklick auf ein Bild im Browser → „Als Outfit speichern"
                      oder „Als Kleidungsstück speichern"
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
                    onClick={() => {
                      setSelectedId(prev => prev === o.id ? null : o.id)
                      setSelectedVariantId(null)
                      setAiSuggestion(null)
                      // Auch den erzeugten Sheet-Prompt zuruecksetzen: Er blieb
                      // sonst mitsamt Kopieren-Knopf unter dem NAECHSTEN Eintrag
                      // stehen — man kopierte den Prompt eines anderen
                      // Kleidungsstuecks und merkte es erst am erzeugten Bild.
                      setGeneratedSheetPrompt(null)
                      setSheetError(null)
                    }}
                    onEdit={() => { setEditingOutfit(o); setOutfitFormOpen(true) }}
                    onDelete={() => setDeleteOutfitId(o.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Spalte 3: Detail ─────────────────────────────────────────── */}
      {detailOpen && (
        <div className="w-[500px] shrink-0 border-l border-border flex flex-col overflow-hidden">
          {detailLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="aspect-[3/4] rounded-xl w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : outfit ? (
            <>
              <div className="border-b shrink-0 px-3 py-2.5 flex items-center gap-1.5">
                <h3 className="text-sm font-semibold flex-1 truncate min-w-0">{outfit.name}</h3>
                {/* Sheet-Erzeugen für Kleidungsstücke — hängt an der Kategorie
                    und ist genau der Grund, warum es die Kategorien gibt. Ein
                    Komplett-Look bekommt stattdessen das Ghost-Mannequin-Sheet
                    je Variante, weiter unten. */}
                {istKleidungsstueck(outfit.category) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 shrink-0 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 text-[11px] font-medium gap-1"
                    onClick={() => setSheetDialogOpen(true)}
                  >
                    <Sparkles className="h-3 w-3" />
                    Sheet
                  </Button>
                )}
                {/* Die Referenzkette (PROJ-54) — vier Blätter ohne Person,
                    jedes die Vorlage der folgenden. Anders als „Sheet" hängt
                    sie NICHT an der Kategorie: Ein Komplett-Look braucht seine
                    Ansichten genauso wie ein einzelnes Kleidungsstück.
                    Der Grund fürs Sperren steht im `title` — ein grauer Knopf
                    ohne Erklärung sieht aus wie ein kaputter. */}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={ketteGesperrtGrund !== null}
                  title={ketteGesperrtGrund ?? 'Vorne freigestellt, Rückseite, Details und Referenzsheet nacheinander erzeugen'}
                  className="h-7 px-2 shrink-0 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 disabled:opacity-40 text-[11px] font-medium gap-1"
                  onClick={() => setKetteDialogOpen(true)}
                >
                  <Link2 className="h-3 w-3" />
                  Referenzkette
                </Button>
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

              <div className="flex-1 overflow-hidden relative">
                <div className="absolute inset-y-0 left-0 overflow-y-auto overflow-x-hidden" style={{ right: '-17px' }}>

                  {/* Titelbild */}
                  <div className="relative bg-black/20">
                    {outfit.cover_image_url ? (
                      <>
                        <img
                          src={outfit.cover_image_url}
                          alt={outfit.name}
                          className="w-full object-contain max-h-80"
                        />
                        <button
                          onClick={handleAnalyze}
                          disabled={aiAnalyzing}
                          className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-600/90 hover:bg-orange-500 disabled:opacity-60 text-white text-[10px] font-medium transition-colors shadow"
                        >
                          {aiAnalyzing ? (
                            <span className="w-2.5 h-2.5 rounded-full border border-white border-t-transparent animate-spin" />
                          ) : (
                            <Sparkles className="h-2.5 w-2.5" />
                          )}
                          {aiAnalyzing ? 'Analysiere…' : 'KI-Analyse'}
                        </button>
                        {outfit.source_url && (
                          <a
                            href={outfit.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] bg-black/60 hover:bg-black/80 text-white px-2 py-1 rounded-md transition-colors"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            Zum Original
                          </a>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/20 gap-2">
                        <span className="text-6xl select-none">{kategorieEintrag(outfit.category).emoji}</span>
                        <p className="text-[10px] text-muted-foreground/40">Kein Titelbild</p>
                      </div>
                    )}
                  </div>

                  {/* KI-Vorschlag */}
                  {aiSuggestion && (
                    <div className="mx-3 my-2 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-orange-400">
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
                            {kategorieEintrag(aiSuggestion.category).emoji}{' '}
                            {kategorieEintrag(aiSuggestion.category).label}
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
                        <Button
                          size="sm"
                          className="h-7 text-[11px] flex-1 bg-orange-600 hover:bg-orange-500"
                          onClick={handleApplySuggestion}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Übernehmen
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
                      <span className="text-xs text-muted-foreground">
                        {kategorieEintrag(outfit.category).emoji} {kategorieEintrag(outfit.category).label}
                      </span>
                    </div>
                    {outfit.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{outfit.description}</p>
                    )}
                    {outfit.source_url && (
                      <a
                        href={outfit.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-orange-400 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {outfit.source_title || (() => { try { return new URL(outfit.source_url!).hostname.replace('www.','') } catch { return outfit.source_url } })()}
                      </a>
                    )}
                    {outfit.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {outfit.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Varianten */}
                  {selectedVariant ? (
                    <div className="p-4 space-y-4">
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

      {/* ── Dialoge ──────────────────────────────────────────────────── */}
      {outfit && (
        <FashionSheetDialog
          open={sheetDialogOpen}
          onClose={() => setSheetDialogOpen(false)}
          asset={outfit}
        />
      )}

      {outfit && (
        <OutfitKetteDialog
          offen={ketteDialogOpen}
          onClose={() => setKetteDialogOpen(false)}
          outfit={outfit}
          // Die Kette legt Varianten und Bilder an — ohne das Nachladen stünde
          // die Detailspalte weiter auf dem Stand von vor dem Lauf.
          onAenderung={() => { void refetchDetail() }}
        />
      )}

      <OutfitForm
        open={outfitFormOpen}
        onClose={() => { setOutfitFormOpen(false); setEditingOutfit(null) }}
        outfit={editingOutfit}
        defaultCategory={selectedCategory === 'alle' ? undefined : selectedCategory}
        onSave={handleOutfitSave}
      />

      <OutfitVariantForm
        open={variantFormOpen}
        onClose={() => { setVariantFormOpen(false); setEditingVariant(null) }}
        variant={editingVariant}
        defaultName={editingVariant ? undefined : outfit?.name}
        onSave={handleVariantSave}
      />

      <AlertDialog open={!!deleteOutfitId} onOpenChange={open => !open && setDeleteOutfitId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
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
