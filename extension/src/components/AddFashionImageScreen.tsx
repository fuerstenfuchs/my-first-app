import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { PendingFashionImageAdd } from '../types'

const CATEGORY_EMOJI: Record<string, string> = {
  oberteile: '👕', unterteile: '👖', kleider: '👗', jacken: '🧥',
  schuhe: '👞', accessoires: '🕶️', kopfbedeckungen: '🎩', sonstiges: '🛍️',
}

interface FashionAsset {
  id: string
  name: string
  category: string
  cover_image_url: string | null
  tags: string[]
}

interface Props {
  capture: PendingFashionImageAdd
  onSaved: () => void
  onBack: () => void
}

export function AddFashionImageScreen({ capture, onSaved, onBack }: Props) {
  const [assets, setAssets]     = useState<FashionAsset[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    supabase
      .from('fashion_assets')
      .select('id, name, category, cover_image_url, tags')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data) setAssets(data)
        setLoading(false)
      })
  }, [])

  const filtered = assets.filter(a =>
    !search.trim() ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  async function handleSave() {
    if (!selectedId) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Nicht eingeloggt.'); setSaving(false); return }

      // Get or create first variant
      const { data: variants } = await supabase
        .from('fashion_asset_variants')
        .select('id')
        .eq('asset_id', selectedId)
        .order('sort_order')
        .limit(1)

      let variantId: string
      if (variants && variants.length > 0) {
        variantId = variants[0].id
      } else {
        const { data: newVariant, error: varErr } = await supabase
          .from('fashion_asset_variants')
          .insert({ asset_id: selectedId, user_id: user.id, name: 'Standard-Ansicht', sort_order: 0 })
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
        .from('fashion_asset_images')
        .select('*', { count: 'exact', head: true })
        .eq('variant_id', variantId)

      const { error: imgErr } = await supabase.from('fashion_asset_images').insert({
        variant_id: variantId,
        user_id: user.id,
        url: capture.imageUrl,
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
      setTimeout(() => onSaved(), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-700 shrink-0">
        <button onClick={onBack} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          ← Zurück
        </button>
        <span className="flex-1 text-xs font-medium text-rose-300 text-center">
          👕 Zu Kleidungsstück hinzufügen
        </span>
      </div>

      {/* Image preview */}
      {capture.imageUrl && !imageError && (
        <div className="shrink-0 bg-zinc-900 border-b border-zinc-700">
          <img
            src={capture.imageUrl}
            alt=""
            className="w-full max-h-28 object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {/* Search */}
      <div className="shrink-0 px-3 py-2 border-b border-zinc-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Kleidungsstück suchen…"
          autoFocus
          className="w-full px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-rose-500 transition-colors"
        />
      </div>

      {/* Asset list */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6">
            {search ? 'Keine Treffer' : 'Noch keine Kleidungsstücke vorhanden'}
          </p>
        ) : (
          filtered.map(asset => (
            <button
              key={asset.id}
              onClick={() => setSelectedId(prev => prev === asset.id ? null : asset.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-colors ${
                selectedId === asset.id
                  ? 'border-rose-500 bg-rose-500/10 text-zinc-100'
                  : 'border-zinc-700 hover:border-zinc-500 text-zinc-300'
              }`}
            >
              <div className="w-9 h-9 rounded-md overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                {asset.cover_image_url
                  ? <img src={asset.cover_image_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-lg leading-none">{CATEGORY_EMOJI[asset.category] ?? '👕'}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{asset.name}</p>
                {(asset.tags ?? []).length > 0 && (
                  <p className="text-[10px] text-zinc-500 truncate">{asset.tags.slice(0, 3).join(' · ')}</p>
                )}
              </div>
              {selectedId === asset.id && <span className="text-rose-400 text-sm shrink-0">✓</span>}
            </button>
          ))
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border-t border-red-900/50 px-3 py-1.5 shrink-0">{error}</p>
      )}

      {/* Save */}
      <div className="px-2 pb-2 pt-1 border-t border-zinc-700 shrink-0">
        <button
          onClick={handleSave}
          disabled={!selectedId || saving || saved}
          className={`w-full py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors ${
            saved ? 'bg-emerald-600' : 'bg-rose-600 hover:bg-rose-500'
          }`}
        >
          {saved ? '✓ Hinzugefügt!' : saving ? 'Speichern…' : selectedId ? 'Bild hinzufügen' : 'Kleidungsstück auswählen'}
        </button>
      </div>
    </div>
  )
}
