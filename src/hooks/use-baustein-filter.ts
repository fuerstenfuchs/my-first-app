'use client'

import { useMemo, useState } from 'react'
import { chipListe, passtZurSuche, type SuchbarerEintrag } from '@/lib/bausteine'

/**
 * Suchfeld und Kategorie-Chips über einer Baustein-Liste (PROJ-46).
 *
 * WARUM ALS HOOK UND NICHT IN JEDER SEITE NEU: Der Zustand ist dreimal
 * derselbe — Suchtext, angeklickte Kategorie, und das Zurücksetzen beim
 * Bereichswechsel. Genau das Zurücksetzen ist die Stelle, an der eine Kopie
 * schiefgeht: Bleibt „natur" beim Wechsel zu den Posen stehen, ist die Liste
 * leer und niemand sieht warum. Die REINE Rechnerei (`passtZurSuche`,
 * `chipListe`) liegt weiterhin in `@/lib/bausteine` und ist dort ohne React
 * prüfbar; hier steht nur, was ohne React nicht geht.
 */
export function useBausteinFilter<T extends SuchbarerEintrag>(
  eintraege: T[],
  /**
   * Der aktuelle Bereich — Reiter im Scene Builder, Baustein im Dialog.
   *
   * Ändert er sich, fallen Suche und Kategorie zurück. Das geschieht WÄHREND
   * des Renderns und nicht in einem `useEffect`: Ein Effekt liefe erst nach
   * dem Zeichnen, und für einen Wimpernschlag stünde die Liste des neuen
   * Reiters unter dem Filter des alten. Das ist Reacts eigenes Muster zum
   * Zurücksetzen von Zustand bei geänderter Eingabe.
   */
  bereich: string,
) {
  const [suche, setSuche] = useState('')
  const [kategorie, setKategorie] = useState<string | null>(null)
  const [letzterBereich, setLetzterBereich] = useState(bereich)

  if (bereich !== letzterBereich) {
    setLetzterBereich(bereich)
    setSuche('')
    setKategorie(null)
  }

  // Erst die Wörter, dann die Kategorie — beides greift zusammen. Die
  // Zwischenstufe `gesucht` wird gebraucht: Aus ihr kommen die Zahlen auf den
  // Chips, aus `eintraege` deren Auswahl (siehe `chipListe`).
  const gesucht = useMemo(
    () => eintraege.filter(e => passtZurSuche(e, suche)),
    [eintraege, suche],
  )

  const gefiltert = useMemo(
    () => (kategorie ? gesucht.filter(e => e.category === kategorie) : gesucht),
    [gesucht, kategorie],
  )

  const chips = useMemo(() => chipListe(eintraege, gesucht), [eintraege, gesucht])

  return { suche, setSuche, kategorie, setKategorie, gesucht, gefiltert, chips }
}
