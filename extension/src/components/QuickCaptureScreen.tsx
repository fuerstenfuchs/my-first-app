import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PendingCapture } from '../types'

interface Props {
  capture: PendingCapture
  captureRestored: boolean
  onSaved: () => void
  onBack: () => void
  onDiscard: () => void
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const ANALYZE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  { id: 'gpt-4.1-mini',              label: 'GPT-4.1 mini' },
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6' },
  { id: 'gpt-4o',                    label: 'GPT-4o' },
] as const

type AnalyzeModelId = typeof ANALYZE_MODELS[number]['id']

export function QuickCaptureScreen({ capture, captureRestored, onSaved, onBack, onDiscard }: Props) {
  const [title, setTitle] = useState(capture.title)
  const [content, setContent] = useState(capture.content)
  const [tags, setTags] = useState('')
  const [sourceUrl, setSourceUrl] = useState(capture.source_url)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const [showRestoredNotice, setShowRestoredNotice] = useState(captureRestored)
  const [draftId] = useState(() => crypto.randomUUID())
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [personPlaceholder, setPersonPlaceholder] = useState(false)
  const [selectedModel, setSelectedModel] = useState<AnalyzeModelId>(
    () => (localStorage.getItem('pdb:analyze-model') as AnalyzeModelId | null) ?? 'claude-haiku-4-5-20251001'
  )
  const [isDragOver, setIsDragOver] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDirty =
    title !== capture.title ||
    content !== capture.content ||
    tags !== '' ||
    sourceUrl !== capture.source_url ||
    coverImageUrl !== null

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!captureRestored) return
    const timer = setTimeout(() => setShowRestoredNotice(false), 3000)
    return () => clearTimeout(timer)
  }, [captureRestored])

  // ESC key dirty-state check
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (isDirty) {
        setShowDiscardDialog(true)
      } else {
        onBack()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isDirty, onBack])

  async function uploadImage(file: File) {
    if (!IMAGE_TYPES.includes(file.type)) return
    setImageUploading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setImageUploading(false); return }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/${draftId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('prompt-media')
      .upload(path, file)

    if (uploadError) {
      setImageUploading(false)
      setError('Bild-Upload fehlgeschlagen.')
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('prompt-media')
      .getPublicUrl(path)

    setCoverImageUrl(publicUrl)
    setImageUploading(false)
  }

  async function handleAnalyzeImage() {
    if (!coverImageUrl) return
    setAnalyzing(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const appUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '')
      if (!appUrl) {
        setError('App-URL nicht konfiguriert. Bitte VITE_APP_URL in der Extension-.env setzen.')
        return
      }
      const res = await fetch(`${appUrl}/api/analyze-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ imageUrl: coverImageUrl, model: selectedModel, personPlaceholder }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(`${body.error ?? `HTTP ${res.status}`} (${appUrl})`)
      }
      const { prompt } = await res.json() as { prompt: string }
      setContent(prompt)
      if (!title.trim() || title === capture.title) {
        setTitle(prompt.trim().slice(0, 55).trimEnd())
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(`Bildanalyse fehlgeschlagen: ${msg}`)
    } finally {
      setAnalyzing(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => IMAGE_TYPES.includes(f.type))
    if (files[0]) uploadImage(files[0])
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Nicht eingeloggt. Bitte Popup schließen und neu anmelden.')
      setSaving(false)
      return
    }

    const parsedTags = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const { error: insertError } = await supabase
      .from('prompts')
      .insert({
        id: draftId,
        title: title.trim(),
        content: content.trim() || null,
        source_url: sourceUrl.trim() || null,
        tags: parsedTags.length > 0 ? parsedTags : null,
        user_id: user.id,
        cover_image_url: coverImageUrl,
      })

    if (insertError) {
      setSaving(false)
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
      return
    }

    // Link uploaded image to prompt_media now that the prompt row exists
    if (coverImageUrl) {
      await supabase.from('prompt_media').insert({
        prompt_id: draftId,
        user_id: user.id,
        type: 'image',
        url: coverImageUrl,
        sort_order: 0,
      })
    }

    await chrome.storage.local.remove('pendingCapture')
    setSaving(false)
    setSaved(true)
    setTimeout(() => onSaved(), 800)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Discard confirm dialog */}
      {showDiscardDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="mx-4 bg-zinc-800 rounded-xl border border-zinc-700 p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Capture verwerfen?</h2>
              <p className="text-xs text-zinc-400 mt-1">Dieser Capture wurde noch nicht gespeichert.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 py-2 rounded-lg border border-zinc-600 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Weiter bearbeiten
              </button>
              <button
                onClick={onDiscard}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs text-white font-medium transition-colors"
              >
                Capture verwerfen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-700 shrink-0">
        <button
          onClick={onBack}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Zurück
        </button>
        <span className="flex-1 text-xs font-medium text-zinc-300 text-center">Capture speichern</span>
        <button
          onClick={() => setShowDiscardDialog(true)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Verwerfen
        </button>
      </div>

      {/* Bild-Preview — fixiert zwischen Header und scrollbarer Form, scrollt nicht weg */}
      {coverImageUrl ? (
        <div className="shrink-0 border-b border-zinc-700">
          <div className="relative">
            <img src={coverImageUrl} alt="Cover" className="w-full max-h-44 object-contain bg-zinc-900" />
            <button
              type="button"
              onClick={() => setCoverImageUrl(null)}
              className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"
            >
              ×
            </button>
            <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-semibold">
              Cover
            </span>
          </div>
          <div className="px-3 py-2 flex flex-col gap-2">
            <div className="flex gap-1 flex-wrap">
              {ANALYZE_MODELS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedModel(m.id)
                    localStorage.setItem('pdb:analyze-model', m.id)
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                    selectedModel === m.id
                      ? 'bg-violet-600 border-violet-600 text-white'
                      : 'border-zinc-600 text-zinc-400 hover:border-zinc-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={personPlaceholder}
                  onChange={e => setPersonPlaceholder(e.target.checked)}
                  className="rounded"
                />
                <span className="text-[10px] text-zinc-400">
                  Person als <code className="bg-zinc-700 px-1 rounded text-zinc-300">[Person]</code> ersetzen
                </span>
              </label>
              <button
                type="button"
                onClick={handleAnalyzeImage}
                disabled={analyzing || saving}
                className="ml-auto shrink-0 px-2.5 py-1 rounded-lg border border-zinc-600 text-[10px] text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                {analyzing ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
                    Analysiert…
                  </>
                ) : (
                  '✨ Generieren'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="shrink-0 px-3 pt-3">
          <div
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-lg border-2 border-dashed cursor-pointer transition-colors flex items-center justify-center gap-2 py-3 ${
              isDragOver
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-zinc-700 hover:border-zinc-500'
            }`}
          >
            {imageUploading ? (
              <span className="text-xs text-zinc-400">Lädt hoch…</span>
            ) : (
              <>
                <span className="text-zinc-500 text-sm">🖼</span>
                <span className="text-xs text-zinc-500">Bild ablegen oder auswählen</span>
              </>
            )}
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); e.target.value = '' }}
      />

      {/* Form — scrollbar, ohne Bild-Preview */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">

        {!content && (
          <div className="text-xs text-zinc-500 bg-zinc-800/60 rounded-lg px-3 py-2 border border-zinc-700">
            Kein Text ausgewählt. Inhalt manuell eingeben oder Seite als Referenz speichern.
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Titel *</label>
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Titel eingeben…"
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Inhalt</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Prompt-Inhalt…"
            rows={5}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="tag1, tag2, tag3"
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-400">Quell-Link</label>
          <input
            type="url"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://…"
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Save button */}
      <div className="p-3 border-t border-zinc-700 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving || saved || !title.trim() || imageUploading}
          className={`w-full py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors ${
            saved ? 'bg-emerald-600' : 'bg-violet-600 hover:bg-violet-500'
          }`}
        >
          {saved ? '✓ Gespeichert!' : saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}
