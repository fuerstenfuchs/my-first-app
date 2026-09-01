'use client'

import { useState } from 'react'
import { Check, Loader2, MapPin, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { LocationCategory } from '@/hooks/use-locations'

interface ImageResult {
  url: string
  thumbnailUrl: string
  title: string
  source: string
}

interface Props {
  open: boolean
  onClose: () => void
  categories: { key: string; label: string; emoji: string }[]
  onCreated: (locationId: string, category: LocationCategory) => void
}

type Step = 1 | 2 | 3

const EXAMPLES = ['Hamburg Reeperbahn', 'Allianz Arena', 'Eiffelturm', 'Times Square', 'Mallorca Strand']

export function LocationImportWizard({ open, onClose, categories, onCreated }: Props) {
  const [step, setStep]               = useState<Step>(1)
  const [name, setName]               = useState('')
  const [results, setResults]         = useState<ImageResult[]>([])
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  const [category, setCategory]       = useState<LocationCategory>('sonstiges')
  const [searching, setSearching]     = useState(false)
  const [creating, setCreating]       = useState(false)
  const [created, setCreated]         = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  function reset() {
    setStep(1); setName(''); setResults([]); setSelectedUrls(new Set())
    setCategory('sonstiges'); setSearching(false); setCreating(false)
    setCreated(false); setSearchError(null); setCreateError(null)
  }

  function handleClose() { reset(); onClose() }

  async function handleSearch() {
    if (!name.trim()) return
    setSearching(true)
    setSearchError(null)
    setResults([])
    setSelectedUrls(new Set())
    setStep(2)
    try {
      const res = await fetch('/api/search-location-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${name.trim()} location photography` }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { results: ImageResult[] }
      setResults(data.results)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Suche fehlgeschlagen')
    } finally {
      setSearching(false)
    }
  }

  function toggleImage(url: string) {
    setSelectedUrls(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  function toggleAll() {
    if (selectedUrls.size === results.length) {
      setSelectedUrls(new Set())
    } else {
      setSelectedUrls(new Set(results.map(r => r.url)))
    }
  }

  async function handleCreate() {
    if (!name.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreateError('Nicht eingeloggt.'); return }

    setCreating(true)
    setCreateError(null)
    try {
      // 1. Create location
      const { data: loc, error: locErr } = await supabase
        .from('locations')
        .insert({ name: name.trim(), category, tags: [], user_id: user.id })
        .select()
        .single()
      if (locErr || !loc) throw new Error(locErr?.message ?? 'Location konnte nicht erstellt werden')

      const urls = Array.from(selectedUrls)

      // 2. Set first selected image as cover
      if (urls.length > 0) {
        await supabase.from('locations').update({ cover_image_url: urls[0] }).eq('id', loc.id)
      }

      // 3. Create variant + insert images (only if images selected)
      if (urls.length > 0) {
        const { data: variant, error: varErr } = await supabase
          .from('location_variants')
          .insert({ location_id: loc.id, user_id: user.id, name: 'Importierte Bilder', sort_order: 0 })
          .select()
          .single()
        if (varErr || !variant) throw new Error(varErr?.message ?? 'Variante konnte nicht erstellt werden')

        const { error: imgErr } = await supabase.from('location_images').insert(
          urls.map((url, idx) => ({
            variant_id: variant.id, user_id: user.id, url, storage_path: null, sort_order: idx,
          }))
        )
        if (imgErr) throw new Error(imgErr.message)
      }

      setCreated(true)
      setTimeout(() => {
        onCreated(loc.id, category)
        reset()
      }, 1000)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unbekannter Fehler')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header with step indicators */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-teal-400 shrink-0" />
              Location importieren
            </DialogTitle>
            <div className="flex items-center gap-1.5 ml-auto">
              {(['1', '2', '3'] as const).map((s, i) => {
                const n = i + 1
                return (
                  <div key={s} className={cn(
                    'w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center transition-colors',
                    step > n ? 'bg-teal-500 text-white' :
                    step === n ? 'bg-teal-500 text-white ring-2 ring-teal-500/30' :
                    'bg-muted text-muted-foreground'
                  )}>
                    {step > n ? <Check className="h-3 w-3" /> : s}
                  </div>
                )
              })}
            </div>
          </div>
          {/* Step labels */}
          <div className="flex text-[10px] text-muted-foreground/60 gap-1 mt-1 ml-auto pr-0.5">
            <span className={cn('w-6 text-center', step === 1 && 'text-teal-400')}>Name</span>
            <span className={cn('w-6 text-center', step === 2 && 'text-teal-400')}>Bilder</span>
            <span className={cn('w-6 text-center', step === 3 && 'text-teal-400')}>Fertig</span>
          </div>
        </DialogHeader>

        {/* Step 1 — Name */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center flex-1 p-8 gap-6 min-h-[400px]">
            <div className="text-center space-y-2 max-w-md">
              <h2 className="text-lg font-semibold">Welche Location suchst du?</h2>
              <p className="text-sm text-muted-foreground">
                Gib einen Ortsnamen ein. Das System sucht automatisch passende Referenzfotos im Web.
              </p>
            </div>
            <div className="w-full max-w-md space-y-3">
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="z.B. Hamburg Reeperbahn, Allianz Arena…"
                  className="flex-1 h-11 text-base"
                  autoFocus
                />
                <Button
                  onClick={handleSearch}
                  disabled={!name.trim()}
                  className="h-11 px-5 bg-teal-600 hover:bg-teal-500 shrink-0"
                >
                  <Search className="h-4 w-4 mr-2" />Suchen
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    onClick={() => setName(ex)}
                    className="text-xs px-3 py-1 rounded-full border border-teal-500/30 text-teal-400/80 hover:bg-teal-500/10 hover:text-teal-300 transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Image selection */}
        {step === 2 && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Sub-header */}
            <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-3 bg-muted/20">
              <button
                onClick={() => { setStep(1); setSearchError(null) }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                ← Zurück
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">„{name}"</span>
                {!searching && results.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {results.length} Bilder · {selectedUrls.size} ausgewählt
                  </span>
                )}
              </div>
              {!searching && results.length > 0 && (
                <button
                  onClick={toggleAll}
                  className="text-[11px] text-teal-400 hover:text-teal-300 shrink-0 transition-colors"
                >
                  {selectedUrls.size === results.length ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
              )}
              <Button
                size="sm"
                onClick={() => setStep(3)}
                disabled={selectedUrls.size === 0}
                className="shrink-0 bg-teal-600 hover:bg-teal-500 h-8"
              >
                Weiter →
              </Button>
            </div>

            {/* Grid / States */}
            <div className="flex-1 overflow-y-auto p-4">
              {searching ? (
                <div className="flex flex-col items-center justify-center h-56 gap-4 text-muted-foreground">
                  <Loader2 className="h-9 w-9 animate-spin text-teal-400" />
                  <p className="text-sm">Suche Bilder für „{name}"…</p>
                </div>
              ) : searchError ? (
                <div className="flex flex-col items-center justify-center h-56 gap-4 text-center px-8">
                  <p className="text-sm text-red-400 max-w-sm leading-relaxed">{searchError}</p>
                  <Button variant="outline" size="sm" onClick={() => { setStep(1); setSearchError(null) }}>
                    ← Zurück
                  </Button>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-56 gap-3 text-muted-foreground text-center">
                  <p className="text-sm">Keine Bilder gefunden.</p>
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>Anderen Namen versuchen</Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {results.map(img => {
                    const selected = selectedUrls.has(img.url)
                    return (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => toggleImage(img.url)}
                        className={cn(
                          'relative rounded-lg overflow-hidden border-2 transition-all group text-left',
                          selected
                            ? 'border-teal-500 shadow-[0_0_0_2px_rgba(20,184,166,0.25)]'
                            : 'border-transparent hover:border-teal-500/40'
                        )}
                      >
                        <ImageThumbnail thumbnailUrl={img.thumbnailUrl} fallbackUrl={img.url} alt={img.title} />
                        {/* Dark overlay on hover */}
                        <div className={cn(
                          'absolute inset-0 transition-opacity pointer-events-none',
                          selected ? 'bg-teal-500/15' : 'bg-black/0 group-hover:bg-black/10'
                        )} />
                        {/* Checkmark */}
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center shadow">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {/* Source on hover */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pt-4 pb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-[9px] text-white/80 truncate">{img.source}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — Create */}
        {step === 3 && (
          <div className="flex flex-col flex-1 overflow-y-auto p-6 gap-5 min-h-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(2)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                ← Zurück
              </button>
              <div>
                <h3 className="text-base font-semibold">Location erstellen</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedUrls.size} Bild{selectedUrls.size !== 1 ? 'er' : ''} ausgewählt
                </p>
              </div>
            </div>

            {/* Preview strip */}
            {selectedUrls.size > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {Array.from(selectedUrls).map(url => (
                  <div key={url} className="w-20 h-20 rounded-md overflow-hidden border border-border/40 bg-muted/20 shrink-0">
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0' }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} className="h-9" />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Kategorie</label>
              <div className="grid grid-cols-3 gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setCategory(cat.key)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors',
                      category === cat.key
                        ? 'bg-teal-500/10 border-teal-500/50 text-teal-300 font-medium'
                        : 'border-border/60 text-muted-foreground hover:border-teal-500/30 hover:text-foreground'
                    )}
                  >
                    <span className="text-base leading-none">{cat.emoji}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {createError && (
              <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded px-3 py-2">
                {createError}
              </p>
            )}

            <Button
              onClick={handleCreate}
              disabled={!name.trim() || creating || created}
              className={cn(
                'h-10',
                created
                  ? 'bg-emerald-600 hover:bg-emerald-600'
                  : 'bg-teal-600 hover:bg-teal-500'
              )}
            >
              {created ? (
                <><Check className="h-4 w-4 mr-2" />Location erstellt!</>
              ) : creating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Erstelle Location…</>
              ) : (
                <><MapPin className="h-4 w-4 mr-2" />Location erstellen</>
              )}
            </Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}

// ── Thumbnail with graceful fallback ─────────────────────────────────────────

function ImageThumbnail({ thumbnailUrl, fallbackUrl, alt }: {
  thumbnailUrl: string
  fallbackUrl: string
  alt: string
}) {
  return (
    <div className="aspect-[4/3] bg-muted/30 overflow-hidden">
      <img
        src={thumbnailUrl}
        alt={alt}
        className="w-full h-full object-cover"
        onError={e => {
          const img = e.target as HTMLImageElement
          if (img.src !== fallbackUrl) img.src = fallbackUrl
        }}
      />
    </div>
  )
}
