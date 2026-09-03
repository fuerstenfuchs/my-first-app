import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bildSichern, sicherungsHinweis } from '../lib/bildSichern'
import { CropTool } from './CropTool'
import type { PendingLocationImageAdd } from '../types'

const CATEGORY_EMOJI: Record<string, string> = {
  stadt: '🌆', natur: '🌳', strand: '🏖️', innenraum: '🏠',
  gebaeude: '🏢', eventlocation: '🎭', nachtlocation: '🌃',
  filmset: '🎬', sonstiges: '📦',
}

interface LocationEntry {
  id: string
  name: string
  category: string
  cover_image_url: string | null
  tags: string[]
}

interface Props {
  capture: PendingLocationImageAdd
  onSaved: () => void
  onBack: () => void
}

export function AddLocationImageScreen({ capture, onSaved, onBack }: Props) {
  const [locations, setLocations] = useState<LocationEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null)
  // Sichtbarer Zustand waehrend das Bild kopiert wird — ein fremder Server
  // laesst sich Zeit, und ein stummer Knopf sieht dann aus wie ein Haenger.
  const [sicherung, setSicherung] = useState<string | null>(null)
  const [hinweis, setHinweis]     = useState<string | null>(null)
  const [showCrop, setShowCrop]   = useState(false)

  useEffect(() => {
    supabase
      .from('locations')
      .select('id, name, category, cover_image_url, tags')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setLocations(data)
        setLoading(false)
      })
  }, [])

  const filtered = locations.filter(l =>
    !search.trim() ||
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Nicht eingeloggt.'); setSaving(false); return }

      // ── Bild zuerst in den eigenen Speicher holen ───────────────────────
      // Hier landete bisher entweder die fremde Adresse (laeuft ab, dann ist
      // das Bild weg) oder — nach einem Zuschnitt — die vollstaendige
      // `data:`-Adresse IN der Datenbankspalte. Das laedt zwar, blaeht die
      // Zeile aber um die gesamte Bilddatei auf. Beides gehoert in den
      // Speicher; erst dann taugt das Bild auch als Referenz.
      setSicherung(croppedDataUrl ? 'Zuschnitt wird gesichert …' : 'Bild wird gesichert …')
      const gesichert = await bildSichern(croppedDataUrl ?? capture.imageUrl, 'location')
      setSicherung(null)

      // Get or create first variant
      const { data: variants } = await supabase
        .from('location_variants')
        .select('id')
        .eq('location_id', selectedId)
        .order('sort_order')
        .limit(1)

      let variantId: string
      if (variants && variants.length > 0) {
        variantId = variants[0].id
      } else {
        const { data: newVariant, error: varErr } = await supabase
          .from('location_variants')
          .insert({ location_id: selectedId, user_id: user.id, name: 'Standard-Ansicht', sort_order: 0 })
          .select('id')
          .single()
        if (varErr || !newVariant) {
          setError('Variante konnte nicht angelegt werden.')
          setSaving(false)
          return
        }
        variantId = newVariant.id
      }

      // Count existing images for sort_order
      const { count } = await supabase
        .from('location_images')
        .select('*', { count: 'exact', head: true })
        .eq('variant_id', variantId)

      const { error: imgErr } = await supabase.from('location_images').insert({
        variant_id: variantId,
        user_id: user.id,
        url: gesichert.url,
        storage_path: null,
        sort_order: count ?? 0,
      })

      if (imgErr) {
        setError(`Speichern fehlgeschlagen: ${imgErr.message}`)
        setSaving(false)
        return
      }

      setSaving(false)
      setSaved(true)

      // Nur wegblenden, wenn es nichts zu lesen gibt. Ein Hinweis, der nach
      // 800 ms verschwindet, ist kein Hinweis.
      const h = sicherungsHinweis([gesichert])
      if (h) setHinweis(h)
      else setTimeout(() => onSaved(), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setSaving(false)
    }
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
        <span className="flex-1 text-xs font-medium text-teal-300 text-center">
          📍 Zu Location hinzufügen
        </span>
      </div>

      {/* Image preview */}
      {capture.imageUrl && !imageError && (
        <div className="shrink-0 bg-zinc-900 border-b border-zinc-700 relative">
          <img
            src={croppedDataUrl ?? capture.imageUrl}
            alt=""
            className="w-full max-h-28 object-contain"
            onError={() => { if (!croppedDataUrl) setImageError(true) }}
          />
          {croppedDataUrl && (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/70 rounded-md px-1.5 py-0.5">
              <span className="text-[10px] text-zinc-300">✂ Crop</span>
              <button
                type="button"
                onClick={() => setCroppedDataUrl(null)}
                className="text-[10px] text-zinc-400 hover:text-white ml-0.5"
              >
                ×
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowCrop(true)}
            className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-700/90 hover:bg-zinc-600 text-white text-[10px] font-medium transition-colors"
          >
            ✂ {croppedDataUrl ? 'Neu zuschneiden' : 'Zuschneiden'}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="shrink-0 px-3 py-2 border-b border-zinc-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Location suchen…"
          autoFocus
          className="w-full px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-teal-500 transition-colors"
        />
      </div>

      {/* Location list */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">
            {search ? 'Keine Treffer' : 'Noch keine Locations vorhanden'}
          </p>
        ) : (
          filtered.map(loc => (
            <button
              key={loc.id}
              onClick={() => setSelectedId(prev => prev === loc.id ? null : loc.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-colors ${
                selectedId === loc.id
                  ? 'border-teal-500 bg-teal-500/10 text-zinc-100'
                  : 'border-zinc-700 hover:border-zinc-500 text-zinc-300'
              }`}
            >
              <div className="w-9 h-9 rounded-md overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                {loc.cover_image_url
                  ? <img src={loc.cover_image_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-lg leading-none">{CATEGORY_EMOJI[loc.category] ?? '📍'}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{loc.name}</p>
                {(loc.tags ?? []).length > 0 && (
                  <p className="text-[10px] text-zinc-500 truncate">{loc.tags.slice(0, 3).join(' · ')}</p>
                )}
              </div>
              {selectedId === loc.id && <span className="text-teal-400 text-sm shrink-0">✓</span>}
            </button>
          ))
        )}
      </div>

      {hinweis && (
        <div className="text-xs text-amber-300 bg-amber-950/40 border-t border-amber-900/50 px-3 py-1.5 shrink-0 space-y-1.5">
          <p>{hinweis}</p>
          <button type="button" onClick={onSaved}
            className="px-2 py-1 rounded bg-amber-700/60 hover:bg-amber-600/60 text-amber-50 text-[11px] font-medium transition-colors">
            Verstanden
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border-t border-red-900/50 px-3 py-1.5 shrink-0">{error}</p>
      )}

      {/* Save */}
      <div className="px-2 pb-2 pt-1 border-t border-zinc-700 shrink-0">
        <button
          onClick={handleSave}
          disabled={!selectedId || saving || saved}
          className={`w-full py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors ${
            saved ? 'bg-emerald-600' : 'bg-teal-600 hover:bg-teal-500'
          }`}
        >
          {saved ? '✓ Hinzugefügt!' : sicherung ? sicherung : saving ? 'Speichern…' : selectedId ? 'Bild hinzufügen' : 'Location auswählen'}
        </button>
      </div>
    </div>
  )
}
