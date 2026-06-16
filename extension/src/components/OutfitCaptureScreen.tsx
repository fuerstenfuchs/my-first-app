import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { analyzeAsset } from '../lib/analyzeAsset'
import type { PendingOutfitCapture, OutfitImage } from '../types'

interface Props {
  capture: PendingOutfitCapture
  onSaved: () => void
  onBack: () => void
}

export function OutfitCaptureScreen({ capture, onSaved, onBack }: Props) {
  const [images, setImages]           = useState<OutfitImage[]>(capture.images)
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags]               = useState('')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [analyzing, setAnalyzing]     = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<'pending' | 'completed'>('pending')
  const [error, setError]             = useState<string | null>(null)
  const [imgErrors, setImgErrors]     = useState<Set<number>>(new Set())
  const nameRef = useRef<HTMLInputElement>(null)

  // Listen for additional images added via right-click while popup is open
  useEffect(() => {
    function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>) {
      if (!('pendingOutfitCapture' in changes)) return
      const newVal = changes.pendingOutfitCapture.newValue as PendingOutfitCapture | undefined
      if (newVal?.images) setImages(newVal.images)
    }
    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => chrome.storage.onChanged.removeListener(onStorageChanged)
  }, [])

  useEffect(() => { nameRef.current?.focus() }, [])

  async function handleAnalyze() {
    const firstImg = images[0]
    if (!firstImg) return
    setAnalyzing(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const appUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '')
      if (!appUrl) { setError('App-URL nicht konfiguriert (VITE_APP_URL).'); return }
      const result = await analyzeAsset(firstImg.imageUrl, 'outfit', session?.access_token ?? null, appUrl)
      if (result.name) setName(result.name)
      if (result.tags?.length) setTags(result.tags.join(', '))
      if (result.description) setDescription(result.description)
      setAnalysisStatus('completed')
    } catch (err) {
      setError(`Analyse fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    if (!name.trim() || images.length === 0) return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Nicht eingeloggt.'); setSaving(false); return }

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean)
    const firstImageUrl = images[0]?.imageUrl ?? null

    // 1. Create outfit
    const { data: outfit, error: outfitErr } = await supabase
      .from('outfits')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        tags: parsedTags,
        cover_image_url: firstImageUrl,
      })
      .select()
      .single()

    if (outfitErr || !outfit) {
      setError(`Outfit konnte nicht erstellt werden: ${outfitErr?.message ?? ''}`)
      setSaving(false)
      return
    }

    // 2. Create default variant
    const { data: variant, error: variantErr } = await supabase
      .from('outfit_variants')
      .insert({
        outfit_id: outfit.id,
        user_id: user.id,
        name: images.length > 1 ? 'Alle Ansichten' : 'Standard-Ansicht',
        sort_order: 0,
      })
      .select()
      .single()

    if (variantErr || !variant) {
      setError(`Variante konnte nicht erstellt werden: ${variantErr?.message ?? ''}`)
      setSaving(false)
      return
    }

    // 3. Add all images
    for (let i = 0; i < images.length; i++) {
      await supabase.from('outfit_images').insert({
        variant_id: variant.id,
        user_id: user.id,
        url: images[i].imageUrl,
        storage_path: null,
        sort_order: i,
      })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => onSaved(), 800)
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImgErrors(prev => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-700 shrink-0">
        <button onClick={onBack} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Zurück
        </button>
        <span className="flex-1 text-xs font-medium text-orange-300 text-center">
          🧥 Outfit speichern
        </span>
      </div>

      {/* Image thumbnails */}
      <div className="shrink-0 bg-zinc-900 border-b border-zinc-700">
        <div className="flex gap-2 p-2 overflow-x-auto">
          {images.map((img, i) => (
            <div key={i} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
              {!imgErrors.has(i) ? (
                <img
                  src={img.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setImgErrors(prev => new Set(prev).add(i))}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[10px]">?</div>
              )}
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-zinc-300 hover:text-white flex items-center justify-center text-[10px] leading-none"
                >
                  ×
                </button>
              )}
              {i === 0 && images.length > 1 && (
                <div className="absolute bottom-0.5 left-0.5 text-[8px] bg-orange-500/80 text-white px-1 rounded">Cover</div>
              )}
            </div>
          ))}

          {/* Hint for adding more images */}
          <div className="shrink-0 w-16 h-16 rounded-lg border border-dashed border-zinc-700 flex flex-col items-center justify-center gap-0.5 text-zinc-600 cursor-default">
            <span className="text-lg leading-none">+</span>
            <span className="text-[8px] text-center leading-tight px-1">Rechtsklick auf Bild</span>
          </div>
        </div>
        {images.length > 1 && (
          <p className="text-[10px] text-zinc-600 text-center pb-1.5">
            {images.length} Bilder — werden in einer Variante gespeichert
          </p>
        )}
        {images.length === 1 && (
          <p className="text-[10px] text-zinc-600 text-center pb-1.5">
            Weitere Ansichten: Rechtsklick auf Bild → "Als Outfit speichern"
          </p>
        )}
      </div>

      {/* Analyze button */}
      {images.length > 0 && (
        <div className="shrink-0 px-2 pt-2">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || saving}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-orange-600/90 hover:bg-orange-500 disabled:opacity-50 text-white text-[11px] font-medium transition-colors"
          >
            {analyzing
              ? <><span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />Analysiere…</>
              : analysisStatus === 'completed' ? '🔄 Neu analysieren' : '✨ Outfit per KI analysieren'}
          </button>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {/* Name */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Outfit-Name *</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z.B. Lässiger Streetwear-Look"
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Beschreibung</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Stil, Anlass, Farbpalette…"
            rows={3}
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-orange-500 transition-colors resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="casual, sommer, boho, beige"
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded px-2 py-1">{error}</p>
        )}
      </div>

      {/* Save */}
      <div className="px-2 pb-2 pt-1 border-t border-zinc-700 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving || saved || !name.trim() || images.length === 0}
          className={`w-full py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors ${
            saved ? 'bg-emerald-600' : 'bg-orange-600 hover:bg-orange-500'
          }`}
        >
          {saved ? '✓ Outfit gespeichert!' : saving ? 'Speichern…' : `🧥 Als Outfit speichern (${images.length} Bild${images.length !== 1 ? 'er' : ''})`}
        </button>
      </div>
    </div>
  )
}
