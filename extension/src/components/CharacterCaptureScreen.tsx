import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { bildSichern, sicherungsHinweis, type Sicherungsergebnis } from '../lib/bildSichern'
import { analyzeAsset } from '../lib/analyzeAsset'
import { CropTool } from './CropTool'
import type { PendingCharacterCapture } from '../types'

type AnalysisStatus = 'pending' | 'completed' | 'outdated'

interface Props {
  capture: PendingCharacterCapture
  onSaved: () => void
  onBack: () => void
}

export function CharacterCaptureScreen({ capture, onSaved, onBack }: Props) {
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt]           = useState('')
  const [tags, setTags]               = useState('')
  const [attributes, setAttributes]   = useState<Record<string, string>>({})
  const [imageError, setImageError]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [analyzing, setAnalyzing]     = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('pending')
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null)
  // Was das Sichern gerade tut — steht sichtbar auf dem Knopf, damit das
  // Speichern nicht wie ein Haenger aussieht. Ein fremder Server laesst sich
  // Zeit, und ohne diese Zeile sieht man dem Knopf das nicht an.
  const [sicherung, setSicherung] = useState<string | null>(null)
  // Ist das Sichern misslungen, wird der Baustein trotzdem angelegt — aber
  // dann NICHT weggeblendet, sondern mit diesem Hinweis stehen gelassen.
  const [hinweis, setHinweis]     = useState<string | null>(null)
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
      const result = await analyzeAsset(capture.imageUrl, 'character', session?.access_token ?? null, appUrl, croppedDataUrl ?? undefined)
      if (result.name) setName(result.name)
      if (result.tags?.length) setTags(result.tags.join(', '))
      if (result.description) setDescription(result.description)
      if (result.prompt) setPrompt(result.prompt)
      if (result.attributes) setAttributes(result.attributes)
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
    if (!user) { setError('Nicht eingeloggt.'); setSaving(false); return }

    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean)

    // ── Bild zuerst in den eigenen Speicher holen ─────────────────────────
    // Bis PROJ-49 stand hier die fremde Adresse direkt in der Spalte. Solche
    // Verweise laufen ab (Facebook-CDN und aehnliche) — am 03.09.2026 waren
    // 28 von 431 schon tot, ohne dass je etwas gemeldet haette. Und als
    // Referenzbild taugen sie ohnehin nicht.
    const ergebnisse: Sicherungsergebnis[] = []

    let coverUrl: string | null = null
    if (hasImage && capture.imageUrl) {
      setSicherung('Bild wird gesichert …')
      const r = await bildSichern(capture.imageUrl, 'character')
      ergebnisse.push(r)
      coverUrl = r.url
    }

    // Der Zuschnitt kommt als `data:`-Adresse herein und landete bisher in
    // voller Laenge IN der Datenbankspalte. Das laedt zwar, blaeht die Zeile
    // aber um die gesamte Bilddatei auf.
    let cropUrl: string | null = null
    if (croppedDataUrl) {
      setSicherung('Zuschnitt wird gesichert …')
      const r = await bildSichern(croppedDataUrl, 'character')
      ergebnisse.push(r)
      cropUrl = r.url
    }
    setSicherung(null)

    const { error: insertError } = await supabase
      .from('characters')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        tags: parsedTags,
        cover_image_url: coverUrl,
        crop_image_url: cropUrl,
        source_url: capture.sourceUrl || null,
        source_title: capture.sourceTitle || null,
        metadata: { prompt: prompt.trim() || null, attributes },
      })

    if (insertError) { setError(`Speichern fehlgeschlagen: ${insertError.message}`); setSaving(false); return }

    setSaving(false)
    setSaved(true)

    // Nur wegblenden, wenn es nichts zu lesen gibt. Ein Hinweis, der nach
    // 800 ms verschwindet, ist kein Hinweis.
    const h = sicherungsHinweis(ergebnisse)
    if (h) setHinweis(h)
    else setTimeout(() => onSaved(), 800)
  }

  if (showCrop && capture.imageUrl) {
    return (
      <div className="flex flex-col flex-1 min-h-0 bg-zinc-950">
        <div className="shrink-0 flex items-center px-3 py-2.5 border-b border-zinc-700">
          <span className="flex-1 text-xs font-medium text-zinc-300 text-center">✂ Bereich zuschneiden</span>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <CropTool
            imageUrl={capture.imageUrl}
            onApply={(dataUrl) => {
              setCroppedDataUrl(dataUrl)
              setShowCrop(false)
              if (analysisStatus === 'completed') setAnalysisStatus('outdated')
            }}
            onCancel={() => setShowCrop(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-700 shrink-0">
        <button onClick={onBack} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Zurück
        </button>
        <span className="flex-1 text-xs font-medium text-violet-300 text-center">
          👤 Charakter speichern
        </span>
      </div>

      {/* Image preview */}
      {capture.imageUrl && (
        <div className="shrink-0 bg-zinc-900 border-b border-zinc-700">
          {!imageError ? (
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
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-600/90 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-medium transition-colors"
                >
                  {analyzing
                    ? <><span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />Analysiere…</>
                    : analysisStatus === 'pending' ? '✨ Charakter analysieren' : '🔄 Neu analysieren'}
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
          <span className="text-[10px] text-violet-400 truncate">{sourceDomain}</span>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {/* Name */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Name *</label>
          <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="z.B. Junge Frau mit langen blonden Haaren"
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
        </div>

        {/* Description */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Beschreibung</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Freundlich wirkende junge Frau mit natürlicher Ausstrahlung…"
            rows={2}
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none" />
        </div>

        {/* Prompt */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">
            Prompt
            <span className="ml-1 text-zinc-600 font-normal">(Englisch)</span>
          </label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Female adult, long blonde hair, friendly smile, natural appearance…"
            rows={3}
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none font-mono" />
        </div>

        {/* Tags */}
        <div>
          <label className="text-[11px] font-medium text-zinc-400 mb-0.5 block">Tags</label>
          <input type="text" value={tags} onChange={e => setTags(e.target.value)}
            placeholder="female, blonde, portrait, casual, friendly"
            className="w-full px-2 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors" />
        </div>

        {hinweis && (
          <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-900/50 rounded px-2 py-1.5 space-y-1.5">
            <p>{hinweis}</p>
            <button type="button" onClick={onSaved}
              className="px-2 py-1 rounded bg-amber-700/60 hover:bg-amber-600/60 text-amber-50 text-[11px] font-medium transition-colors">
              Verstanden
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded px-2 py-1">{error}</p>
        )}
      </div>

      {/* Save */}
      <div className="px-2 pb-2 pt-1 border-t border-zinc-700 shrink-0">
        <button onClick={handleSave} disabled={saving || saved || !name.trim()}
          className={`w-full py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors ${
            saved ? 'bg-emerald-600' : 'bg-violet-600 hover:bg-violet-500'
          }`}>
          {saved ? '✓ Gespeichert!' : sicherung ? sicherung : saving ? 'Speichern…' : '👤 Als Charakter speichern'}
        </button>
      </div>
    </div>
  )
}
