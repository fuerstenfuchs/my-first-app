import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { analyzeAsset } from '../lib/analyzeAsset'
import type { PendingPoseCapture } from '../types'

const CATEGORIES = [
  { key: 'stehend',     label: 'Stehend',    emoji: '🧍' },
  { key: 'gehen',       label: 'Gehen',       emoji: '🚶' },
  { key: 'rennen',      label: 'Rennen',      emoji: '🏃' },
  { key: 'tanzen',      label: 'Tanzen',      emoji: '💃' },
  { key: 'sitzen',      label: 'Sitzen',      emoji: '🪑' },
  { key: 'liegen',      label: 'Liegen',      emoji: '🛏️' },
  { key: 'gestik',      label: 'Gestik',      emoji: '🙌' },
  { key: 'interaktion', label: 'Interaktion', emoji: '🤝' },
  { key: 'emotion',     label: 'Emotion',     emoji: '🎭' },
  { key: 'sonstiges',   label: 'Sonstiges',   emoji: '📦' },
] as const

type Category = typeof CATEGORIES[number]['key']

interface Props {
  capture: PendingPoseCapture
  onSaved: () => void
  onBack: () => void
}

export function PoseCaptureScreen({ capture, onSaved, onBack }: Props) {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory]       = useState<Category>('sonstiges')
  const [tags, setTags]               = useState('')
  const [imageError, setImageError]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [analyzing, setAnalyzing]     = useState(false)
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

  // Auto-analyse on mount when image is available
  useEffect(() => {
    if (capture.imageUrl) handleAnalyze()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAnalyze() {
    if (!capture.imageUrl) return
    setAnalyzing(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const appUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '')
      if (!appUrl) { setError('App-URL nicht konfiguriert (VITE_APP_URL).'); return }
      const result = await analyzeAsset(capture.imageUrl, 'pose', session?.access_token ?? null, appUrl)
      if (result.name) setName(result.name)
      if (result.category && CATEGORIES.some(c => c.key === result.category)) setCategory(result.category as Category)
      if (result.tags?.length) setTags(result.tags.join(', '))
      if (result.description) setDescription(result.description)
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
    if (!user) { setError('Nicht eingeloggt.'); setSaving(false); return }

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean)

    const { error: insertError } = await supabase
      .from('pose_actions')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        category,
        tags: parsedTags,
        cover_image_url: hasImage ? capture.imageUrl : null,
        source_url: capture.sourceUrl || null,
        source_title: capture.sourceTitle || null,
      })

    if (insertError) { setError('Speichern fehlgeschlagen.'); setSaving(false); return }

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
        <span className="flex-1 text-xs font-medium text-purple-300 text-center flex items-center justify-center gap-1.5">
          {analyzing && <span className="w-2.5 h-2.5 rounded-full border border-purple-400 border-t-transparent animate-spin shrink-0" />}
          🎭 Pose / Aktion speichern
        </span>
      </div>

      {/* Image preview */}
      {capture.imageUrl && (
        <div className="shrink-0 relative bg-zinc-900 border-b border-zinc-700">
          {!imageError ? (
            <div className="relative">
              <img src={capture.imageUrl} alt="" className="w-full max-h-36 object-contain" onError={() => setImageError(true)} />
              <div className="absolute bottom-1.5 right-1.5">
                <button type="button" onClick={handleAnalyze} disabled={analyzing || saving}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-600/90 hover:bg-purple-500 disabled:opacity-50 text-white text-[10px] font-medium transition-colors">
                  {analyzing
                    ? <><span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />Analysiere…</>
                    : '✨ KI-Analyse'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-16 text-xs text-zinc-500">Bild konnte nicht geladen werden</div>
          )}
        </div>
      )}

      {/* Source info */}
      {(capture.sourceUrl || capture.sourceTitle) && (
        <div className="shrink-0 px-3 py-1.5 border-b border-zinc-700/60 bg-zinc-900/40 flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-500 shrink-0">Quelle:</span>
          <span className="text-[10px] text-purple-400 truncate">{sourceDomain}</span>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {/* Category — 5 columns for 10 categories */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-1 block">Kategorie</label>
          <div className="grid grid-cols-5 gap-1">
            {CATEGORIES.map(cat => (
              <button key={cat.key} type="button" onClick={() => setCategory(cat.key)}
                className={`flex flex-col items-center py-1.5 rounded-lg border text-[10px] transition-colors ${
                  category === cat.key
                    ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                }`}>
                <span className="text-sm leading-tight">{cat.emoji}</span>
                <span className="leading-tight mt-0.5 truncate w-full text-center">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Name *</label>
          <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="z.B. Lässig an Wand lehnen"
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
        </div>

        {/* Prompt-Baustein */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">
            Prompt-Baustein
            <span className="ml-1 text-zinc-600 font-normal">(Englisch)</span>
          </label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Person standing sideways against a wall, one hand in pocket, relaxed posture…"
            rows={3}
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-purple-500 transition-colors resize-none font-mono" />
        </div>

        {/* Tags */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Tags</label>
          <input type="text" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="lässig, cool, selbstbewusst, dynamisch"
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-purple-500 transition-colors" />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded px-2 py-1">{error}</p>
        )}
      </div>

      {/* Save */}
      <div className="px-2 pb-2 pt-1 border-t border-zinc-700 shrink-0">
        <button onClick={handleSave} disabled={saving || saved || !name.trim()}
          className={`w-full py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors ${
            saved ? 'bg-emerald-600' : 'bg-purple-600 hover:bg-purple-500'
          }`}>
          {saved ? '✓ Gespeichert!' : saving ? 'Speichern…' : '🎭 Als Pose / Aktion speichern'}
        </button>
      </div>
    </div>
  )
}
