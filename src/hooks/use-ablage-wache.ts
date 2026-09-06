'use client'

import { useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useBildUebernehmen } from '@/hooks/use-bild-uebernehmen'
import {
  zuAblegen, abgelegtMarke, ablageMeldung, freizugeben, type AblageJob,
} from '@/lib/ablage-auftrag'

const BUCKET = 'generated-images'

/**
 * Legt fertige Bilder von selbst dort ab, wo sie hingehören (PROJ-76).
 *
 * Mark: „Ich musste jetzt alle Bilder einzeln dorthin verschieben. Ist
 * natürlich, wenn man wirklich mal mehrere hat, nicht so hilfreich."
 *
 * WARUM IM BROWSER UND NICHT IM ARBEITER: Das Kopieren in einen
 * Charakterordner ist mehr als eine Datei verschieben — Größenprüfung,
 * Ablagepfad, Datenbankzeile, Sortierung. Das steht alles in
 * `useBildUebernehmen` und ist dort geprüft. Der Arbeiter kennt weder
 * Charaktere noch Varianten; ihm das beizubringen hieße, dieselbe Logik ein
 * zweites Mal zu schreiben — und beim nächsten Umbau liefe eine der beiden
 * Fassungen der anderen hinterher.
 *
 * DER PREIS, EHRLICH: Es geschieht nur, solange die App offen ist. Wer den
 * Rechner zuklappt, während das Shooting läuft, findet die Bilder beim
 * nächsten Öffnen — dann werden sie nachgeholt, denn die Marke steht am
 * Auftrag und nicht in der Erinnerung des Wächters.
 */
export function useAblageWache() {
  const { uebernehmen } = useBildUebernehmen()

  /*
    EIN CLIENT FUERS GANZE LEBEN DES BAUTEILS.

    `createClient()` liefert bei jedem Aufruf ein neues Objekt. Stand es direkt
    im Rumpf, war es bei jedem Rendern neu — damit auch `ablegen`, damit auch
    `pruefen` im Meldewaechter, und dessen Effekt baute sich bei jedem Rendern
    ab und wieder auf. Der Effekt ruft beim Aufbau sofort `pruefen()`. Aus
    einem Takt von fuenf Sekunden wurde so ein Takt von „jedes Rendern".
  */
  const supabase = useMemo(() => createClient(), [])

  /**
   * WAS GERADE LÄUFT, DARF NICHT NOCH EINMAL ANFANGEN.
   *
   * Der Wächter schaut alle fünf Sekunden; ein Kopiervorgang über mehrere
   * Bilder dauert länger. Ohne diese Sperre begänne der nächste Takt dieselbe
   * Ablage ein zweites Mal — die Marke `abgelegt` steht ja erst am Ende in der
   * Datenbank. Ergebnis wären doppelte Bilder im Ordner.
   */
  const laufend = useRef<Set<string>>(new Set())

  return useCallback(async (jobs: AblageJob[]) => {
    const auftraege = zuAblegen(jobs).filter(a => !laufend.current.has(a.jobId))
    if (auftraege.length === 0) return

    for (const a of auftraege) laufend.current.add(a.jobId)
    /** Was NICHT durchkam — nur das darf beim naechsten Takt erneut ran. */
    const offen: typeof auftraege = []
    const erledigt: typeof auftraege = []

    try {
      for (const a of auftraege) {
        let alleOk = true
        for (const pfad of a.pfade) {
          const url = supabase.storage.from(BUCKET).getPublicUrl(pfad).data.publicUrl
          const ok = await uebernehmen(url, pfad, {
            baustein: a.ziel.baustein,
            parentId: a.ziel.parentId,
            parentName: a.ziel.parentName,
            variantId: a.ziel.variantId,
            // Eine Meldung je Bild wäre bei fünf Bildern fünfmal dieselbe
            // Einblendung. Der Wächter fasst am Ende einmal zusammen.
            stillLeise: true,
          })
          if (!ok) { alleOk = false; break }
        }

        /*
          DIE MARKE ERST, WENN ALLES DURCH IST. Wer sie nach dem ersten Bild
          setzt, verliert die übrigen still: Der Auftrag gilt als abgelegt,
          und niemand holt sie nach. Lieber ein zweiter Versuch beim nächsten
          Takt als vier Bilder, die nirgends ankommen.
        */
        if (!alleOk) { offen.push(a); continue }

        /*
          TITELBILD SETZEN, WENN GEWUENSCHT (PROJ-79). Eine frisch angelegte
          Gruppe hat noch kein Bild — ohne das stuende sie als leerer Kasten in
          der Charakterliste, und Mark muesste das Titelbild von Hand
          nachziehen. Genau die Handarbeit, die diese Ablage abschaffen soll.

          Schlaegt es fehl, sind die Bilder trotzdem im Ordner. Deshalb kein
          Abbruch, nur eine Meldung.
        */
        if (a.ziel.alsTitelbild && a.pfade[0]) {
          const url = supabase.storage.from(BUCKET).getPublicUrl(a.pfade[0]).data.publicUrl
          const { error: coverErr } = await supabase
            .from('characters')
            .update({ cover_image_url: url, updated_at: new Date().toISOString() })
            .eq('id', a.ziel.parentId)
          if (coverErr) toast.error('Titelbild konnte nicht gesetzt werden.')
        }

        const roh = jobs.find(j => j.id === a.jobId)?.scene_meta ?? null
        const { error } = await supabase
          .from('image_jobs')
          .update({ scene_meta: abgelegtMarke(roh) })
          .eq('id', a.jobId)

        // Schlägt die Marke fehl, sind die Bilder trotzdem im Ordner. Beim
        // nächsten Takt käme derselbe Auftrag noch einmal — deshalb bleibt er
        // in `laufend`, bis die Seite neu geladen wird. Doppelte Bilder wären
        // schlimmer als eine Ablage, die einmal nicht nachgeholt wird.
        if (error) offen.push(a)
        else erledigt.push(a)
      }
    } finally {
      /*
        NUR DIE FEHLGESCHLAGENEN FREIGEBEN — hier stand es genau andersherum,
        und das war der Fehler.

        Mark am 06.09.2026: „Das Gruppenbild wurde aber irgendwie zweimal
        abgelegt." Nachgemessen: EIN Auftrag mit EINEM Ergebnis, zwei Bilder im
        Ordner, drei Sekunden auseinander.

        So kam es dazu: Ein Takt holt die Auftragszeilen, legt ab, und schreibt
        erst danach die Marke `abgelegt`. Ein zweiter Takt, der seine Zeilen
        VOR dieser Marke geholt hat, sieht den Auftrag weiter als offen. Die
        Sperre in `laufend` haette ihn abgefangen — aber sie wurde nach dem
        Erfolg wieder aufgehoben. Damit war der einzige Schutz gegen ein
        zweites Ablegen genau in dem Moment weg, in dem er gebraucht wurde.

        Richtig ist das Gegenteil: Was abgelegt IST, bleibt fuer diese Sitzung
        gesperrt — die Marke in der Datenbank uebernimmt danach. Was NICHT
        durchkam, wird freigegeben und beim naechsten Takt erneut versucht.
      */
      const frei = freizugeben([
        ...erledigt.map(a => ({ jobId: a.jobId, ok: true })),
        ...offen.map(a => ({ jobId: a.jobId, ok: false })),
      ])
      for (const id of frei) laufend.current.delete(id)
    }

    const text = ablageMeldung(erledigt)
    if (text) toast.success(text, { duration: 8_000 })
  }, [supabase, uebernehmen])
}
