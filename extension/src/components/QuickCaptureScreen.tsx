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
  const titleRef = useRef<HTMLInputElement>(null)

  const isDirty =
    title !== capture.title ||
    content !== capture.content ||
    tags !== '' ||
    sourceUrl !== capture.source_url

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!captureRestored) return
    const timer = setTimeout(() => setShowRestoredNotice(false), 3000)
    return () => clearTimeout(timer)
  }, [captureRestored])

  // BUG-2 fix: ESC key dirty-state check
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
        title: title.trim(),
        content: content.trim() || null,
        source_url: sourceUrl.trim() || null,
        tags: parsedTags.length > 0 ? parsedTags : null,
        user_id: user.id,
      })

    setSaving(false)
    if (insertError) {
      setError('Speichern fehlgeschlagen. Bitte erneut versuchen.')
    } else {
      await chrome.storage.local.remove('pendingCapture')
      setSaved(true)
      setTimeout(() => onSaved(), 800)
    }
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

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {/* Restored notice */}
        {showRestoredNotice && (
          <div className="text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-700/40 rounded-lg px-3 py-2">
            ✓ Capture wiederhergestellt
          </div>
        )}

        {/* Empty content notice */}
        {!content && (
          <div className="text-xs text-zinc-500 bg-zinc-800/60 rounded-lg px-3 py-2 border border-zinc-700">
            Kein Text ausgewählt. Inhalt manuell eingeben oder Seite als Referenz speichern.
          </div>
        )}

        {/* Title */}
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

        {/* Content */}
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

        {/* Tags */}
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

        {/* Source URL */}
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
          disabled={saving || saved || !title.trim()}
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
