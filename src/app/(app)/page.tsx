'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Plus, Search, X, LayoutGrid, List, Heart, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PromptCardGrid, cardVariants } from '@/components/prompts/prompt-card-grid'
import { PromptListRow, rowVariants } from '@/components/prompts/prompt-list-row'
import { PromptModal } from '@/components/prompts/prompt-modal'
import { DeleteDialog } from '@/components/prompts/delete-dialog'
import { TagFilterBar } from '@/components/prompts/tag-filter-bar'
import { AddToCollectionDialog } from '@/components/collections/add-to-collection-dialog'
import { toast } from 'sonner'
import { usePrompts, type Prompt, type PromptInput } from '@/hooks/use-prompts'
import { useCollections } from '@/hooks/use-collections'
import { useViewMode } from '@/hooks/use-view-mode'
import { useSemanticSearch } from '@/hooks/use-semantic-search'

type ModalMode = 'view' | 'edit' | 'create'

const gridContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}

const listContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.025 } },
}

export default function PromptsPage() {
  const { prompts, loading, createPrompt, updatePrompt, deletePrompt, copyPrompt, toggleFavorite, setRating, prependPrompt, setPromptVariantCount } = usePrompts()
  const { collections } = useCollections()
  const { viewMode, setMode } = useViewMode()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalPrompt, setModalPrompt] = useState<Prompt | null>(null)
  const [modalMode, setModalMode] = useState<ModalMode>('create')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [addToCollectionId, setAddToCollectionId] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    prompts.forEach(p => p.tags.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [prompts])

  const filteredPrompts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return prompts.filter(prompt => {
      const matchesSearch = !query ||
        prompt.title.toLowerCase().includes(query) ||
        (prompt.description?.toLowerCase().includes(query) ?? false) ||
        prompt.tags.some(t => t.toLowerCase().includes(query))
      const matchesTag = !activeTag || prompt.tags.includes(activeTag)
      const matchesFavorite = !favoritesOnly || prompt.is_favorite
      return matchesSearch && matchesTag && matchesFavorite
    })
  }, [prompts, searchQuery, activeTag, favoritesOnly])

  // Lookup map for prompts within tag/favorites scope (excludes keyword filter)
  // Used to resolve semantic IDs that may not match the keyword but are contextually relevant
  const tagFilteredById = useMemo(() => {
    const map = new Map<string, Prompt>()
    prompts.forEach(p => {
      if ((!activeTag || p.tags.includes(activeTag)) && (!favoritesOnly || p.is_favorite)) {
        map.set(p.id, p)
      }
    })
    return map
  }, [prompts, activeTag, favoritesOnly])

  const { semanticIds, isSearching, isEnhanced, forceSearch } = useSemanticSearch(
    searchQuery,
    activeTag,
    favoritesOnly,
  )

  // Semantic-enhanced display: semantic-ranked items first, then keyword-only matches
  const displayedPrompts = useMemo(() => {
    if (!isEnhanced || semanticIds.length === 0) return filteredPrompts
    const semanticItems = semanticIds.flatMap(id => {
      const p = tagFilteredById.get(id)
      return p ? [p] : []
    })
    const semanticIdSet = new Set(semanticIds)
    const keywordOnlyItems = filteredPrompts.filter(p => !semanticIdSet.has(p.id))
    return [...semanticItems, ...keywordOnlyItems]
  }, [filteredPrompts, tagFilteredById, semanticIds, isEnhanced])

  const hasActiveFilter = searchQuery.trim() !== '' || activeTag !== null || favoritesOnly

  function resetFilters() {
    setSearchQuery('')
    setActiveTag(null)
    setFavoritesOnly(false)
  }

  function openCreate() {
    setModalPrompt(null)
    setModalMode('create')
    setModalOpen(true)
  }

  const openView = useCallback((prompt: Prompt) => {
    setModalPrompt(prompt)
    setModalMode('view')
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((prompt: Prompt) => {
    setModalPrompt(prompt)
    setModalMode('edit')
    setModalOpen(true)
  }, [])

  // Open Quick Capture with shared content when redirected from /share or /api/share
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('from') !== 'share') return

    window.history.replaceState(null, '', '/')

    ;(async () => {
      // Primary path: SW intercepted the share POST and cached payload + images
      if ('serviceWorker' in navigator) {
        try {
          const payloadRes = await fetch('/__share-payload')
          if (payloadRes.ok) {
            const swData = await payloadRes.json() as {
              content: string
              source_url: string | null
              title: string | null
              image_count: number
            }

            // Read image blobs from SW cache and turn them into File objects
            const pendingFiles: File[] = []
            for (let i = 0; i < swData.image_count; i++) {
              const imgRes = await fetch(`/__share-image-${i}`)
              if (imgRes.ok) {
                const blob = await imgRes.blob()
                const filename = imgRes.headers.get('X-Filename') ?? `image-${i}.jpg`
                pendingFiles.push(new File([blob], filename, { type: blob.type || 'image/jpeg' }))
              }
            }

            const detail = {
              content:       swData.content,
              source_url:    swData.source_url,
              title:         swData.title,
              pending_files: pendingFiles.length > 0 ? pendingFiles : undefined,
            }
            // setTimeout ensures useQuickCapture listener in parent layout is registered
            // (child effects run before parent effects in React)
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('quick-capture:open-share', { detail }))
            }, 0)
            return
          }
        } catch { /* SW cache miss — fall through */ }
      }

      // Fallback A: server-side route handler stored payload in a cookie
      const cookieMatch = document.cookie.split('; ').find(r => r.startsWith('pending_share='))
      if (cookieMatch) {
        try {
          const p = JSON.parse(decodeURIComponent(cookieMatch.split('=').slice(1).join('=')))
          document.cookie = 'pending_share=; Max-Age=0; path=/'
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('quick-capture:open-share', { detail: p }))
          }, 0)
          return
        } catch { /* corrupt cookie */ }
      }

      // Fallback B: old GET-based share (text/URL only via share-handler.tsx)
      const stored = sessionStorage.getItem('pending_share_payload')
      sessionStorage.removeItem('pending_share_payload')
      if (!stored) return
      try {
        const p = JSON.parse(stored)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('quick-capture:open-share', { detail: p }))
        }, 0)
      } catch { /* corrupt entry */ }
    })()
  }, [])

  useEffect(() => {
    function handleQuickCaptureSaved(e: Event) {
      const prompt = (e as CustomEvent<Prompt>).detail
      prependPrompt(prompt)
      toast.success('Prompt gespeichert', {
        action: {
          label: 'Im Editor öffnen',
          onClick: () => openEdit(prompt),
        },
        cancel: {
          label: 'Prompt ansehen',
          onClick: () => openView(prompt),
        },
      })
    }
    window.addEventListener('quick-capture:saved', handleQuickCaptureSaved)
    return () => window.removeEventListener('quick-capture:saved', handleQuickCaptureSaved)
  }, [prependPrompt, openEdit, openView])

  async function handleSave(input: PromptInput, promptId?: string): Promise<boolean> {
    if (modalPrompt?.id) {
      return updatePrompt(modalPrompt.id, input)
    }
    return createPrompt(input, promptId)
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    await deletePrompt(deleteId)
    setDeleteId(null)
  }

  const sharedCardProps = (prompt: Prompt) => ({
    prompt,
    onClick: () => openView(prompt),
    onCopy: () => copyPrompt(prompt),
    onEdit: () => openEdit(prompt),
    onDelete: () => setDeleteId(prompt.id),
    onAddToCollection: () => setAddToCollectionId(prompt.id),
    onToggleFavorite: () => toggleFavorite(prompt),
    onSetRating: (rating: number | null) => setRating(prompt, rating),
  })

  return (
    <div className="flex flex-col h-svh min-w-0">
      <header className="border-b shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <SidebarTrigger />
          <h1 className="text-lg font-semibold shrink-0">Alle Prompts</h1>
          {!loading && (
            <span className="text-sm text-muted-foreground shrink-0">
              ({hasActiveFilter
                ? `${displayedPrompts.length} / ${prompts.length}`
                : prompts.length})
            </span>
          )}
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && forceSearch()}
              placeholder="Suchen…"
              className={`pl-9 h-9 ${searchQuery && (isSearching || isEnhanced) ? 'pr-16' : 'pr-8'}`}
            />
            {searchQuery && (isSearching || isEnhanced) && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
                <Sparkles className={`h-3.5 w-3.5 ${isSearching ? 'text-violet-400 animate-pulse' : 'text-violet-500'}`} />
              </div>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Suche leeren</span>
              </button>
            )}
          </div>

          {/* Favorites toggle */}
          <Button
            variant={favoritesOnly ? 'secondary' : 'ghost'}
            size="icon"
            className={`h-9 w-9 shrink-0 ${favoritesOnly ? 'text-rose-500' : ''}`}
            onClick={() => setFavoritesOnly(v => !v)}
            title="Nur Favoriten"
          >
            <Heart className={`h-4 w-4 ${favoritesOnly ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span className="sr-only">Nur Favoriten</span>
          </Button>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 shrink-0 border border-border rounded-md p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setMode('grid')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="sr-only">Kachelansicht</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setMode('list')}
            >
              <List className="h-3.5 w-3.5" />
              <span className="sr-only">Listenansicht</span>
            </Button>
          </div>

          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" />
            Neuer Prompt
          </Button>
        </div>

        {!loading && allTags.length > 0 && (
          <TagFilterBar
            tags={allTags}
            activeTag={activeTag}
            onTagClick={tag => setActiveTag(prev => prev === tag ? null : tag)}
          />
        )}
        {isEnhanced && searchQuery && (
          <div className="px-4 py-1 flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400 bg-violet-50/60 dark:bg-violet-950/25 border-t border-violet-100 dark:border-violet-900/40">
            <Sparkles className="h-3 w-3" />
            Erweiterte Ergebnisse
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="rounded-xl" style={{ paddingBottom: '90%' }} />
            ))}
          </div>
        ) : prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-4 px-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Noch keine Prompts</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Leg deinen ersten Prompt an und fang an, deine KI-Workflows zu organisieren.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Ersten Prompt anlegen
            </Button>
          </div>
        ) : displayedPrompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center gap-4 px-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Keine Prompts gefunden</h2>
              <p className="text-sm text-muted-foreground">
                {searchQuery && activeTag
                  ? `Kein Treffer für „${searchQuery}" mit Tag „${activeTag}"`
                  : searchQuery
                  ? `Kein Treffer für „${searchQuery}"`
                  : `Keine Prompts mit Tag „${activeTag}"`}
              </p>
            </div>
            <Button variant="outline" onClick={resetFilters}>Filter zurücksetzen</Button>
          </div>
        ) : viewMode === 'grid' ? (
          <motion.div
            key="grid"
            className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            variants={gridContainer}
            initial="hidden"
            animate="visible"
          >
            {displayedPrompts.map(prompt => (
              <PromptCardGrid key={prompt.id} {...sharedCardProps(prompt)} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            className="divide-y divide-border"
            variants={listContainer}
            initial="hidden"
            animate="visible"
          >
            {displayedPrompts.map(prompt => (
              <PromptListRow key={prompt.id} {...sharedCardProps(prompt)} />
            ))}
          </motion.div>
        )}
      </main>

      <PromptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prompt={modalPrompt}
        mode={modalMode}
        onSave={handleSave}
        onCopy={modalPrompt ? () => copyPrompt(modalPrompt) : undefined}
        onToggleFavorite={modalPrompt ? () => toggleFavorite(modalPrompt) : undefined}
        onSetRating={modalPrompt ? (r) => setRating(modalPrompt, r) : undefined}
        onVariantCountChange={setPromptVariantCount}
      />

      <DeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDeleteConfirm}
      />

      <AddToCollectionDialog
        promptId={addToCollectionId ?? ''}
        open={!!addToCollectionId}
        onOpenChange={open => !open && setAddToCollectionId(null)}
        collections={collections}
      />
    </div>
  )
}
