'use client'

import { useEffect, useState } from 'react'
import { FolderDown } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { AblageZiel } from '@/lib/ablage-auftrag'
import type { Character } from '@/hooks/use-characters'

/**
 * Wohin die fertigen Bilder eines Shootings wandern (PROJ-76).
 *
 * MARK HAT BEIDE WEGE GENANNT: „Wenn man weiß, wo der Charakter herkommt, dann
 * kann man es ja da auch wieder reinverschieben. Oder man kann vorher wirklich
 * den Ordner einmalig angeben, bei Shooting, wo die Bilder danach abgelegt
 * werden sollen."
 *
 * Hier sind es beide — und zwar so, dass er im Normalfall nichts tut: Der
 * Charakter steht ohnehin in der Szene, der Ordner ist vorbelegt, und wer
 * einen anderen will, wählt ihn aus derselben Zeile.
 *
 * WARUM EIN NEUER ORDNER MIT DEM NAMEN DES ORTES DIE VORGABE IST — und nicht
 * „Sonstiges", das Mark genannt hat: Fünf Bilder aus einem Shooting gehören
 * zusammen. In „Sonstiges" liegen sie nach dem dritten Shooting zu fünfzehnt
 * ohne erkennbare Grenze, und die Arbeit des Sortierens ist nur verschoben,
 * nicht erspart. „Speicherstadt" sagt beim Hinsehen, was drin ist. Wer es
 * anders will, wählt „Sonstiges" — es steht in derselben Liste.
 */
export function AblageWaehler({
  charakter, vorschlag, ziel, onZiel,
}: {
  charakter: Character | null
  /** Name für einen neuen Ordner — üblicherweise der Ort des Shootings. */
  vorschlag: string
  ziel: AblageZiel | null
  onZiel: (z: AblageZiel | null) => void
}) {
  const [ordner, setOrdner] = useState<{ id: string; name: string }[]>([])
  const supabase = createClient()

  useEffect(() => {
    let abgebrochen = false
    if (!charakter) { setOrdner([]); onZiel(null); return }

    ;(async () => {
      const { data } = await supabase
        .from('character_variants')
        .select('id, name')
        .eq('character_id', charakter.id)
        .order('sort_order', { ascending: true })
      if (abgebrochen) return
      setOrdner((data ?? []) as { id: string; name: string }[])

      // Vorbelegen: ein NEUER Ordner mit dem Namen des Ortes. `variantId: null`
      // heißt „muss noch angelegt werden" — das geschieht erst beim Erzeugen,
      // damit kein leerer Ordner zurückbleibt, wenn Mark es sich anders
      // überlegt.
      onZiel({
        baustein: 'charaktere',
        parentId: charakter.id,
        parentName: charakter.name,
        variantId: null,
        variantName: vorschlag,
      })
    })()

    return () => { abgebrochen = true }
    // `onZiel` bewusst nicht in den Abhängigkeiten: Die Aufrufer geben eine
    // frische Funktion je Rendern, das wäre eine Endlosschleife.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charakter?.id, vorschlag])

  if (!charakter) return null

  const wert = ziel?.variantId ?? '__neu__'

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[13px] font-medium">
        <FolderDown className="h-3.5 w-3.5" />
        Fertige Bilder ablegen bei {charakter.name}
      </label>
      <select
        className="h-9 w-full rounded-lg border border-border/60 bg-background px-2 text-[13px]"
        value={wert}
        onChange={e => {
          const v = e.target.value
          if (v === '__keine__') { onZiel(null); return }
          const gewaehlt = ordner.find(o => o.id === v)
          onZiel({
            baustein: 'charaktere',
            parentId: charakter.id,
            parentName: charakter.name,
            variantId: gewaehlt ? gewaehlt.id : null,
            variantName: gewaehlt ? gewaehlt.name : vorschlag,
          })
        }}
      >
        <option value="__neu__">Neuer Ordner: {vorschlag}</option>
        {ordner.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        <option value="__keine__">Nicht ablegen — nur in der Warteschlange</option>
      </select>
      <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
        {ziel
          ? 'Die Bilder wandern von selbst dorthin, sobald sie fertig sind — ' +
            'solange die App offen ist. Sonst beim nächsten Öffnen.'
          : 'Die Bilder bleiben in der Warteschlange und im Bildstudio.'}
      </p>
    </div>
  )
}
