'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import {
  bereinigeGeschlecht, bereinigeHautzeichen, lesePersonMerkmale,
  type Geschlecht, type Hautzeichen,
} from '@/lib/person-merkmale'

/**
 * Geschlecht und Hautzeichen einer Person (siehe `person-merkmale.ts`).
 *
 * LIEST FRISCH AUS DER DATENBANK, statt sich auf `character.metadata` des
 * Aufrufers zu verlassen: `useCharacters()` hat in jedem Bauteil seinen eigenen
 * Zustand. Was im Sheet-Dialog gespeichert wird, stünde sonst auf der Seite
 * „Personenbilder" nicht — bis zum Neuladen. `anfang` füllt die Anzeige, bis die
 * Antwort da ist.
 *
 * DREI SICHERUNGEN (Critic, 30.09.2026):
 *  - Die Werte gehören zu einer PERSON (`stand.id`). Wechselt die Person, gilt
 *    sofort „lädt" und es werden leere Werte geliefert — nie die der vorigen.
 *    Sonst ginge As Tattoo in Bs Prompt oder in Bs Datensatz.
 *  - Ein Lesefehler ergibt `fehler`, keine leere Liste. Bei `fehler` wird nichts
 *    geschrieben: Eine leere Liste sähe aus wie „keine Tattoos" und das nächste
 *    Speichern löschte die echten.
 *  - Schreibvorgänge laufen NACHEINANDER und je als Lesen-Ändern-Schreiben auf
 *    `metadata` (dort liegen auch andere Angaben, z. B. `gruppe`).
 */
type Stand = { id: string | null; hautzeichen: Hautzeichen[]; geschlecht: Geschlecht | null; fehler: boolean; fertig: boolean }

export function usePersonMerkmale(personId: string | null, anfang?: unknown) {
  const [stand, setStand] = useState<Stand>(() => ({ id: personId, ...lesePersonMerkmale(anfang), fehler: false, fertig: false }))
  const aktuell = useRef(personId)
  aktuell.current = personId
  const reihe = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (!personId) { setStand({ id: null, hautzeichen: [], geschlecht: null, fehler: false, fertig: true }); return }
    let abgebrochen = false
    setStand({ id: personId, ...lesePersonMerkmale(anfang), fehler: false, fertig: false })
    createClient().from('characters').select('metadata').eq('id', personId).single()
      .then(({ data, error }) => {
        if (abgebrochen) return
        if (error || !data) { setStand(s => ({ ...s, id: personId, fehler: true, fertig: true })); return }
        setStand({ id: personId, ...lesePersonMerkmale(data.metadata), fehler: false, fertig: true })
      }, () => { if (!abgebrochen) setStand(s => ({ ...s, id: personId, fehler: true, fertig: true })) })
    return () => { abgebrochen = true }
    // `anfang` nur beim Wechsel der Person auslesen — sonst überschriebe jede neue Objektkennung die Eingabe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId])

  // Werte einer anderen Person sind für den Aufrufer nicht sichtbar.
  const gilt = stand.id === personId
  const laedt = !gilt || !stand.fertig
  const fehler = gilt && stand.fehler
  const gesperrt = laedt || fehler || !personId

  const schreibe = useCallback((id: string, patch: Record<string, unknown>): Promise<boolean> => {
    const lauf = reihe.current.then(async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from('characters').select('metadata').eq('id', id).single()
      if (error || !data) { toast.error('Speichern fehlgeschlagen'); return false }
      const alt = data.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : {}
      const { error: e2 } = await supabase.from('characters').update({ metadata: { ...alt, ...patch } }).eq('id', id)
      if (e2) { toast.error('Speichern fehlgeschlagen'); return false }
      return true
    })
    reihe.current = lauf.catch(() => false)
    return lauf
  }, [])

  const speichereHautzeichen = useCallback(async (neu: Hautzeichen[]) => {
    const id = aktuell.current
    if (!id || gesperrt) return
    const sauber = bereinigeHautzeichen(neu)
    setStand(s => s.id === id ? { ...s, hautzeichen: sauber } : s)
    if (!(await schreibe(id, { hautzeichen: sauber }))) {
      // Nicht auf einen alten Stand zurückspringen (ein zweiter Vorgang könnte gelungen sein): neu lesen.
      const { data } = await createClient().from('characters').select('metadata').eq('id', id).single()
      if (data && aktuell.current === id) setStand(s => s.id === id ? { ...s, hautzeichen: lesePersonMerkmale(data.metadata).hautzeichen } : s)
    }
  }, [gesperrt, schreibe])

  const speichereGeschlecht = useCallback(async (neu: Geschlecht | null) => {
    const id = aktuell.current
    if (!id || gesperrt) return
    const g = bereinigeGeschlecht(neu)
    setStand(s => s.id === id ? { ...s, geschlecht: g } : s)
    if (!(await schreibe(id, { geschlecht: g }))) {
      const { data } = await createClient().from('characters').select('metadata').eq('id', id).single()
      if (data && aktuell.current === id) setStand(s => s.id === id ? { ...s, geschlecht: lesePersonMerkmale(data.metadata).geschlecht } : s)
    }
  }, [gesperrt, schreibe])

  return {
    hautzeichen: gilt ? stand.hautzeichen : [],
    geschlecht: gilt ? stand.geschlecht : null,
    laedt, fehler, gesperrt,
    speichereHautzeichen, speichereGeschlecht,
  }
}
