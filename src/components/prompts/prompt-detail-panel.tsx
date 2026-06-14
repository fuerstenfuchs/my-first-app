'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Copy, ExternalLink, Heart, Pencil, Trash2, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { tagColorClass } from '@/lib/tag-colors'
import { StarRating } from '@/components/prompts/star-rating'
import { MediaGallery } from '@/components/prompts/media-gallery'
import { createClient } from '@/lib/supabase'
import { usePromptMedia } from '@/hooks/use-prompt-media'
import type { Prompt, PromptVariant } from '@/hooks/use-prompts'

interface PromptDetailPanelProps {
  prompt: Prompt
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  onSetRating: (rating: number | null) => void
}

export function PromptDetailPanel({
  prompt,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
  onSetRating,
}: PromptDetailPanelProps) {
  const [variants, setVariants] = useState<PromptVariant[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const { media, fetchMedia } = usePromptMedia()

  useEffect(() => {
    fetchMedia(prompt.id)
    setVariants([])
    setActiveVariantId(null)
    if (prompt.variant_count > 0) {
      loadVariants()
    }
  }, [prompt.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadVariants() {
    setVariantsLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('prompt_variants')
      .select('id, prompt_id, name, content, sort_order, created_at')
      .eq('prompt_id', prompt.id)
      .order('sort_order', { ascending: true })
    if (!error && data && data.length > 0) {
      setVariants(data as PromptVariant[])
      setActiveVariantId(data[0].id)
    }
    setVariantsLoading(false)
  }

  const activeVariant = variants.find(v => v.id === activeVariantId) ?? null
  const hasVariants = variants.length >= 2
  const displayContent = hasVariants && activeVariant ? activeVariant.content : prompt.content

  const allMedia = media.length > 0
    ? media
    : prompt.cover_image_url
      ? [{ id: 'cover', prompt_id: prompt.id, user_id: '', type: 'image' as const, url: prompt.cover_image_url, sort_order: 0, created_at: '' }]
      : []

  async function handleCopy() {
    await navigator.clipboard.writeText(displayContent)
    toast.success('Prompt kopiert!')
  }

  const date = new Date(prompt.created_at).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  // Inject webkit scrollbar hiding — cannot be done with inline styles
  useEffect(() => {
    const id = 'panel-scrollbar-hide'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = '.detail-panel-scroll::-webkit-scrollbar{display:none}'
      document.head.appendChild(s)
    }
  }, [])

  return (
    <>
      {/* Animated width wrapper — clips inner panel during slide-in */}
      <motion.div
        className="shrink-0 border-l border-border overflow-hidden h-full"
        initial={{ width: 0 }}
        animate={{ width: 500 }}
        exit={{ width: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        style={{ minWidth: 0 }}
      >
        {/* Inner fixed-width content — gradient lives here so framer-motion can't interfere */}
        <div
          className="w-[500px] flex flex-col h-full overflow-hidden"
          style={{ background: 'linear-gradient(160deg, hsl(142,75%,22%) 0%, hsl(130,25%,9%) 50%, hsl(25,60%,14%) 100%)' }}
        >

          {/* Panel header */}
          <div className="flex items-center gap-1 px-3 py-2.5 border-b border-border shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Schließen"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Schließen</span>
            </button>
            <div className="flex-1" />
            <Button
              size="icon"
              variant="ghost"
              className={`h-8 w-8 ${prompt.is_favorite ? 'text-rose-500' : 'text-muted-foreground'}`}
              onClick={onToggleFavorite}
              title="Favorit"
            >
              <Heart className={`h-4 w-4 ${prompt.is_favorite ? 'fill-rose-500' : ''}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={onEdit}
              title="Bearbeiten"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              title="Löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable body — scrollbar hidden via injected style (webkit) + inline (firefox) */}
          <div
            className="detail-panel-scroll flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >

            {/* Cover image / media (16:9) */}
            {allMedia.length > 0 && (
              <div
                className="relative cursor-zoom-in overflow-hidden bg-black"
                style={{ paddingBottom: '56.25%' }}
                onClick={() => setGalleryIndex(0)}
              >
                {allMedia[0].type === 'video' ? (
                  <video
                    src={allMedia[0].url}
                    className="absolute inset-0 w-full h-full object-contain"
                    muted
                  />
                ) : (
                  <img
                    src={allMedia[0].url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                )}
                {allMedia.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                    +{allMedia.length - 1} weitere
                  </div>
                )}
              </div>
            )}

            <div className="p-4 space-y-4">

              {/* Title + star rating */}
              <div>
                <h2 className="text-lg font-semibold leading-snug">{prompt.title}</h2>
                <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                  <StarRating value={prompt.rating} onChange={onSetRating} size="md" />
                </div>
              </div>

              {/* Tags */}
              {prompt.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {prompt.tags.map(tag => (
                    <span
                      key={tag}
                      className={`text-xs px-2 py-0.5 rounded font-mono ${tagColorClass(tag)}`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {prompt.description && (
                <p className="text-sm text-muted-foreground">{prompt.description}</p>
              )}

              {/* Variant tabs */}
              {variantsLoading && (
                <div className="h-8 rounded-md bg-muted animate-pulse" />
              )}
              {!variantsLoading && hasVariants && (
                variants.length <= 5 ? (
                  <Tabs value={activeVariantId ?? ''} onValueChange={setActiveVariantId}>
                    <TabsList className="w-full justify-start h-8">
                      {variants.map(v => (
                        <TabsTrigger key={v.id} value={v.id} className="text-xs h-7 px-3">
                          {v.name ?? `V${v.sort_order}`}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                ) : (
                  <Select value={activeVariantId ?? ''} onValueChange={setActiveVariantId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map(v => (
                        <SelectItem key={v.id} value={v.id} className="text-xs">
                          {v.name ?? `Variante ${v.sort_order}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              )}

              {/* Prompt text */}
              <div className="relative rounded-lg bg-black/30 border border-border p-3">
                <pre className="text-sm font-mono whitespace-pre-wrap leading-relaxed break-words">
                  {displayContent}
                </pre>
              </div>

              {/* Source URL */}
              {prompt.source_url && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Quelle</p>
                  <a
                    href={prompt.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-green-400 hover:text-green-300 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[300px]">
                      {(() => { try { return new URL(prompt.source_url).hostname } catch { return prompt.source_url } })()}
                    </span>
                  </a>
                </div>
              )}

              {/* Meta */}
              <div className="text-xs text-muted-foreground flex items-center gap-3 pb-2">
                <span>{date}</span>
                {prompt.usage_count > 0 && <span>{prompt.usage_count}× kopiert</span>}
              </div>

            </div>
          </div>

          {/* Footer — large copy button */}
          <div className="p-3 border-t border-border shrink-0">
            <Button
              className="w-full h-11 text-sm font-semibold gap-2"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
              Prompt kopieren
            </Button>
          </div>

        </div>
      </motion.div>

      {/* Fullscreen gallery */}
      {galleryIndex !== null && allMedia.length > 0 && (
        <MediaGallery
          items={allMedia}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </>
  )
}
