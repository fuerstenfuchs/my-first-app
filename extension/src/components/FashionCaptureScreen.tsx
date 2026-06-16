import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { analyzeAsset } from '../lib/analyzeAsset'
import { CropTool } from './CropTool'
import type { PendingFashionCapture } from '../types'

const CATEGORIES = [
  { key: 'oberteile',       label: 'Oberteile',       emoji: '👕' },
  { key: 'unterteile',      label: 'Unterteile',      emoji: '👖' },
  { key: 'kleider',         label: 'Kleider',         emoji: '👗' },
  { key: 'jacken',          label: 'Jacken',          emoji: '🧥' },
  { key: 'schuhe',          label: 'Schuhe',          emoji: '👞' },
  { key: 'accessoires',     label: 'Accessoires',     emoji: '🕶️' },
  { key: 'kopfbedeckungen', label: 'Kopfbedeck.',     emoji: '🎩' },
  { key: 'sonstiges',       label: 'Sonstiges',       emoji: '🛍️' },
] as const

type Category = typeof CATEGORIES[number]['key']
type AnalysisStatus = 'pending' | 'completed' | 'outdated'

interface Props {
  capture: PendingFashionCapture
  onSaved: () => void
  onBack: () => void
}

export function FashionCaptureScreen({ capture, onSaved, onBack }: Props) {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<Category>('sonstiges')
  const [tags, setTags]               = useState('')
  const [imageError, setImageError]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [analyzing, setAnalyzing]     = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('pending')
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null)
  const [showCrop, setShowCrop]       = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const hasImage = !!capture.imageUrl && !imageError

  const sourceDomain = (() => {
    try { return new URL(capture.sourceUrl).hostname.replace('www.', '') }
    catch { return capture.sourceUrl }
  })()

  useEffect(() => {
    if (capture.sourceTitle) setName(capture.sourceTitle.slice(0, 60).trim())
    nameRef.current?.focus()
  }, [capture.sourceTitle])

  async function handleAnalyze() {
    if (!capture.imageUrl) return
    setAnalyzing(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const appUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '')
      if (!appUrl) { setError('App-URL nicht konfiguriert (VITE_APP_URL).'); return }
      const result = await analyzeAsset(capture.imageUrl, 'fashion', session?.access_token ?? null, appUrl, croppedDataUrl ?? undefined)
      if (result.name) setName(result.name)
      if (result.category && CATEGORIES.some(c => c.key === result.category)) setCategory(result.category as Category)
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
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Nicht eingeloggt.')
      setSaving(false)
      return
    }

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean)

    const { error: insertError } = await supabase
      .from('fashion_assets')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        category,
        tags: parsedTags,
        cover_image_url: hasImage ? capture.imageUrl : null,
        crop_image_url: croppedDataUrl ?? null,
        source_url: capture.sourceUrl || null,
        source_title: capture.sourceTitle || null,
      })

    if (insertError) {
      setError(`Speichern fehlgeschlagen: ${insertError.message}`)
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => onSaved(), 800)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-700 shrink-0">
        <button onClick={onBack} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Zurück
        </button>
        <span className="flex-1 text-xs font-medium text-rose-300 text-center">
          🛍️ Fashion Asset speichern
        </span>
      </div>

      {/* Image preview / Crop tool */}
      {capture.imageUrl && (
        <div className="shrink-0 bg-zinc-900 border-b border-zinc-700">
          {showCrop ? (
            <CropTool
              imageUrl={capture.imageUrl}
              onApply={(dataUrl) => {
                setCroppedDataUrl(dataUrl)
                setShowCrop(false)
                if (analysisStatus === 'completed') setAnalysisStatus('outdated')
              }}
              onCancel={() => setShowCrop(false)}
            />
          ) : !imageError ? (
            <div className="relative">
              <img
                src={croppedDataUrl ?? capture.imageUrl}
                alt=""
                className="w-full max-h-36 object-contain"
                onError={() => { if (!croppedDataUrl) setImageError(true) }}
              />
              {croppedDataUrl && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/70 rounded-md px-1.5 py-0.5">
                  <span className="text-[10px] text-zinc-300">✂ Crop</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCroppedDataUrl(null)
                      if (analysisStatus === 'completed') setAnalysisStatus('outdated')
                    }}
                    className="text-[10px] text-zinc-400 hover:text-white ml-0.5"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="absolute bottom-1.5 right-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowCrop(true)}
                  disabled={analyzing || saving}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-700/90 hover:bg-zinc-600 disabled:opacity-50 text-white text-[10px] font-medium transition-colors"
                >
                  ✂ {croppedDataUrl ? 'Neu' : 'Zuschneiden'}
                </button>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyzing || saving}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 disabled:opacity-50 text-white text-[10px] font-medium transition-colors"
                >
                  {analyzing
                    ? <><span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />Analysiere…</>
                    : analysisStatus === 'pending' ? '✨ Analysieren' : '🔄 Neu analysieren'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-16 text-xs text-zinc-500">
              Bild konnte nicht geladen werden
            </div>
          )}
        </div>
      )}

      {/* Source info */}
      {(capture.sourceUrl || capture.sourceTitle) && (
        <div className="shrink-0 px-3 py-1.5 border-b border-zinc-700/60 bg-zinc-900/40 flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 shrink-0">Quelle:</span>
          <span className="text-[10px] text-rose-400 truncate">{sourceDomain}</span>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {/* Category */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-1 block">Kategorie</label>
          <div className="grid grid-cols-4 gap-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={`flex flex-col items-center py-1.5 rounded-lg border text-[10px] transition-colors ${
                  category === cat.key
                    ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                }`}
              >
                <span className="text-sm leading-tight">{cat.emoji}</span>
                <span className="leading-tight mt-0.5">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Name *</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z.B. Schwarze Lederjacke"
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-rose-500 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Beschreibung</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Kurze Beschreibung…"
            rows={2}
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-rose-500 transition-colors resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="schwarz, leder, vintage"
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-rose-500 transition-colors"
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
          disabled={saving || saved || !name.trim()}
          className={`w-full py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors ${
            saved ? 'bg-emerald-600' : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >
          {saved ? '✓ Gespeichert!' : saving ? 'Speichern…' : '🛍️ Als Fashion Asset speichern'}
        </button>
      </div>
    </div>
  )
}
