'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useImageJobs, ergebnisUrl } from '@/hooks/use-image-jobs'
import { useBildUebernehmen } from '@/hooks/use-bild-uebernehmen'
import { type Character } from '@/hooks/use-characters'
import { GROESSE_VORGABE, type JobStatus } from '@/lib/image-generation'
import {
  KOPF_PROMPT, KOERPER_PROMPT, REFERENZSHEET_PROMPT,
} from '@/components/characters/character-sheet-dialog'
import {
  QUELLEN, SCHRITT_LABEL, VARIANTEN_NAME,
  istEigenerSpeicher, kettenPrompt, naechsterSchritt, offeneSchritte,
  type KettenSchritt,
} from '@/lib/referenzkette'

/**
 * Die Referenzkette ausführen (PROJ-48).
 *
 * Drei Sheets nacheinander, jedes das Referenzbild des nächsten, mit EINEM
 * Halt: Nach dem Kopf sieht Mark das Ergebnis an und nimmt es oder verwirft es.
 * Seine Antwort 1 vom 03.09.2026 — und die richtige Stelle dafür, denn ein
 * misslungener Kopf pflanzt sich sonst in beide folgenden Bilder fort.
 *
 * WARUM DER ABLAUF IM BROWSER LEBT UND NICHT AUF DEM SERVER: Der Arbeiter
 * läuft auf Marks PC und wird über die Auftragstabelle beauftragt; niemand
 * sonst könnte auf sein Ergebnis warten. Der Preis ist, dass ein geschlossener
 * Tab die Kette anhält. Deshalb ist der Fortschritt NICHT im Kopf dieses Hooks
 * gespeichert, sondern in dem, was tatsächlich in der Datenbank liegt — beim
 * nächsten Öffnen wird nachgesehen und dort weitergemacht, wo es stehen blieb.
 */

const BASIS_PROMPT: Record<KettenSchritt, string> = {
  kopf:          KOPF_PROMPT,
  koerper:       KOERPER_PROMPT,
  referenzsheet: REFERENZSHEET_PROMPT,
}

/** Wie oft nachgesehen wird, ob der Auftrag fertig ist. */
const TAKT_MS = 4000

/**
 * Ab wann ein Hinweis erscheint, dass etwas nicht stimmen könnte.
 *
 * KEIN Abbruch, nur ein Hinweis: Ein Auftrag kann echt lange dauern, wenn
 * mehrere in der Warteschlange vor ihm liegen. Ein harter Zeitablauf würde
 * genau dann abbrechen, wenn alles in Ordnung ist — das ist der Wächter, der
 * bei normaler Arbeit rot wird, und der wird binnen zwei Tagen ignoriert.
 */
export const HINWEIS_NACH_MS = 4 * 60 * 1000

export type Phase =
  | { art: 'bereit' }
  | { art: 'wartet';     schritt: KettenSchritt; seit: number }
  | { art: 'pruefen';    bildUrl: string; bildPfad: string }
  | { art: 'legt_ab';    schritt: KettenSchritt }
  | { art: 'fertig' }
  | { art: 'fehler';     schritt: KettenSchritt; grund: string }

/** Interner Abbruch — kein Fehler, sondern Marks Entscheidung. */
class Abgebrochen extends Error {}

function schlafe(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

type Stand = {
  /** Welche der drei Varianten schon ein Bild haben. */
  vorhanden: Record<KettenSchritt, boolean>
  /** Das jeweils jüngste Bild — die Vorlage für den nächsten Schritt. */
  urls: Partial<Record<KettenSchritt, string>>
}

const LEERER_STAND: Stand = {
  vorhanden: { kopf: false, koerper: false, referenzsheet: false },
  urls: {},
}

export function useReferenzkette(
  character: Character,
  offen: boolean,
  /** Wird nach jeder Änderung gerufen, damit die Seite ihre Varianten nachlädt. */
  onAenderung?: () => void,
) {
  const supabase = createClient()
  // Die Warteschlange wird hier NICHT mitgeladen: `anlegen` ist alles, was
  // gebraucht wird, und ein zweiter Abruf von hundert Aufträgen samt Fünf-
  // Sekunden-Takt wäre reine Last.
  const { anlegen } = useImageJobs(false)
  const { uebernehmen } = useBildUebernehmen()

  const [phase, setPhase] = useState<Phase>({ art: 'bereit' })
  const [stand, setStand] = useState<Stand>(LEERER_STAND)
  const [standGeladen, setStandGeladen] = useState(false)
  const abbruch = useRef(false)

  const titelbild = character.cover_image_url
  const titelbildLiegtEigen = istEigenerSpeicher(titelbild)

  // ── Stand ermitteln ────────────────────────────────────────────────────────

  /**
   * Was tatsächlich in der Datenbank liegt.
   *
   * Absichtlich eine eigene Abfrage und nicht der Zustand aus
   * `useCharacterDetail`: Der Stand entscheidet, welche Aufträge eingereiht
   * werden. Eine veraltete Liste ließe die Kette einen Schritt doppelt
   * erzeugen — und beim Wiederaufnehmen ist gerade das der Fall, für den es
   * die Funktion überhaupt gibt.
   */
  const standErmitteln = useCallback(async (): Promise<Stand> => {
    const { data, error } = await supabase
      .from('character_variants')
      .select('id, name, images:character_images(url, sort_order)')
      .eq('character_id', character.id)

    if (error) throw new Error(`Varianten konnten nicht gelesen werden: ${error.message}`)

    const neu: Stand = {
      vorhanden: { kopf: false, koerper: false, referenzsheet: false },
      urls: {},
    }
    for (const schritt of Object.keys(VARIANTEN_NAME) as KettenSchritt[]) {
      const soll = VARIANTEN_NAME[schritt].toLowerCase()
      const v = (data ?? []).find(
        x => String(x.name ?? '').trim().toLowerCase() === soll,
      )
      const bilder = (v?.images ?? []) as { url: string; sort_order: number }[]
      if (bilder.length === 0) continue
      const juengstes = [...bilder].sort((a, b) => b.sort_order - a.sort_order)[0]
      neu.vorhanden[schritt] = true
      neu.urls[schritt] = juengstes.url
    }
    return neu
  }, [supabase, character.id])

  // Beim Öffnen einmal nachsehen, wo es weitergeht.
  useEffect(() => {
    if (!offen) return
    let abgemeldet = false
    setStandGeladen(false)
    standErmitteln()
      .then(s => { if (!abgemeldet) { setStand(s); setStandGeladen(true) } })
      .catch((e: Error) => {
        if (abgemeldet) return
        toast.error(e.message)
        setStandGeladen(true)
      })
    return () => { abgemeldet = true }
  }, [offen, standErmitteln])

  // Zumachen heißt abbrechen. Ohne das liefe die Warteschleife weiter und
  // schriebe in einen Dialog, den niemand mehr sieht.
  useEffect(() => {
    if (offen) { abbruch.current = false; return }
    abbruch.current = true
    setPhase({ art: 'bereit' })
  }, [offen])

  useEffect(() => () => { abbruch.current = true }, [])

  // ── Bausteine des Ablaufs ──────────────────────────────────────────────────

  /** Auf das Ergebnis eines Auftrags warten. Wirft bei Fehlschlag. */
  const warteAufJob = useCallback(async (
    jobId: string,
  ): Promise<{ url: string; pfad: string }> => {
    for (;;) {
      if (abbruch.current) throw new Abgebrochen()

      const { data, error } = await supabase
        .from('image_jobs')
        .select('status, error, result_paths')
        .eq('id', jobId)
        .single()

      if (error) throw new Error(`Auftrag konnte nicht abgefragt werden: ${error.message}`)

      const status = data.status as JobStatus
      if (status === 'failed') {
        throw new Error(data.error || 'Der Arbeiter hat den Auftrag als fehlgeschlagen gemeldet.')
      }
      if (status === 'done') {
        // NICHT annehmen, dass „fertig" auch „Bild da" heißt. Ein leeres
        // Ergebnis würde sonst als leere Referenz in den nächsten Schritt
        // wandern, und der scheiterte dann an einer ganz anderen Stelle.
        const pfad = ((data.result_paths as string[] | null) ?? [])[0]
        if (!pfad) throw new Error('Der Auftrag ist fertig, hat aber kein Bild geliefert.')
        return { pfad, url: ergebnisUrl(pfad) }
      }

      await schlafe(TAKT_MS)
    }
  }, [supabase])

  /** Einen Schritt einreihen und auf sein Bild warten. */
  const erzeuge = useCallback(async (
    schritt: KettenSchritt, urls: Partial<Record<KettenSchritt, string>>,
  ): Promise<{ url: string; pfad: string }> => {
    const referenzen = QUELLEN[schritt].map(q => q === 'titelbild' ? titelbild : urls[q])
    if (referenzen.some(u => !u)) {
      // Darf nicht vorkommen — die Schritte laufen in fester Reihenfolge. Wenn
      // doch, dann lieber laut als mit einer leeren Referenz weiter.
      throw new Error(`Für ${SCHRITT_LABEL[schritt]} fehlt ein Referenzbild.`)
    }

    const job = await anlegen({
      prompt:          kettenPrompt(schritt, BASIS_PROMPT[schritt]),
      model:           'gpt-image-2',
      size:            GROESSE_VORGABE,
      aspect_ratio:    null,
      variants:        1,
      reference_urls:  referenzen as string[],
      // Die Rollenliste bleibt leer: Was welches Bild bedeutet, steht schon im
      // Prompt (`kettenPrompt`). Zusätzlich die allgemeine Charakter-Zuordnung
      // mitzuschicken hieße, dem Modell dieselbe Frage zweimal verschieden zu
      // beantworten.
      reference_roles: [],
      scene_meta: {
        name:     `${character.name} — ${SCHRITT_LABEL[schritt]}`,
        herkunft: 'referenzkette',
        schritt,
      },
    })
    if (!job) throw new Error('Auftrag konnte nicht eingereiht werden.')

    setPhase({ art: 'wartet', schritt, seit: Date.now() })
    return warteAufJob(job.id)
  }, [anlegen, character.name, titelbild, warteAufJob])

  /** Die Variante zu einem Schritt — die vorhandene, sonst eine neue. */
  const varianteHolen = useCallback(async (schritt: KettenSchritt): Promise<string> => {
    const name = VARIANTEN_NAME[schritt]
    const { data, error } = await supabase
      .from('character_variants')
      .select('id, name')
      .eq('character_id', character.id)
    if (error) throw new Error(`Varianten konnten nicht gelesen werden: ${error.message}`)

    const treffer = (data ?? []).find(
      v => String(v.name ?? '').trim().toLowerCase() === name.toLowerCase(),
    )
    if (treffer) return treffer.id as string

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Nicht angemeldet.')

    const { data: neu, error: anlegeFehler } = await supabase
      .from('character_variants')
      .insert({
        character_id: character.id,
        user_id:      user.id,
        name,
        description:  'Von der Referenzkette angelegt (PROJ-48).',
        sort_order:   (data ?? []).length,
      })
      .select('id')
      .single()
    if (anlegeFehler || !neu) {
      throw new Error(`Variante „${name}" konnte nicht angelegt werden: ${anlegeFehler?.message ?? 'unbekannt'}`)
    }
    return neu.id as string
  }, [supabase, character.id])

  /**
   * Ein Ergebnisbild in seine Variante legen — und die Adresse zurückgeben,
   * unter der es dort liegt.
   *
   * Die Adresse des ABGELEGTEN Bildes, nicht die des Auftrags: Wird der Auftrag
   * später aus der Warteschlange gelöscht, verschwindet seine Datei mit. Die
   * Kette benutzt deshalb dasselbe Exemplar, das auch beim Charakter bleibt —
   * dann ist die Vorlage des nächsten Schrittes dieselbe, die Mark sieht.
   */
  const ablegen = useCallback(async (
    schritt: KettenSchritt, ergebnis: { url: string; pfad: string },
  ): Promise<string> => {
    setPhase({ art: 'legt_ab', schritt })
    const variantId = await varianteHolen(schritt)

    const ok = await uebernehmen(ergebnis.url, ergebnis.pfad, {
      baustein:   'charaktere',
      parentId:   character.id,
      parentName: character.name,
      variantId,
    })
    // `uebernehmen` meldet den Grund selbst als Toast — hier zählt nur, dass
    // die Kette NICHT weiterläuft. Der nächste Schritt bräuchte dieses Bild.
    if (!ok) throw new Error(`Das Bild konnte nicht in die Variante „${VARIANTEN_NAME[schritt]}" gelegt werden.`)

    const { data, error } = await supabase
      .from('character_images')
      .select('url')
      .eq('variant_id', variantId)
      .order('sort_order', { ascending: false })
      .limit(1)
    if (error || !data?.[0]?.url) {
      throw new Error(`Das abgelegte Bild von ${SCHRITT_LABEL[schritt]} war nicht wiederzufinden.`)
    }
    const url = data[0].url as string

    // Nachgemessen statt angenommen: Läge das Exemplar wider Erwarten nicht im
    // eigenen Speicher, lehnte der Arbeiter den nächsten Auftrag ab — und der
    // Fehler stünde dann beim falschen Schritt.
    if (!istEigenerSpeicher(url)) {
      throw new Error(`Das abgelegte Bild von ${SCHRITT_LABEL[schritt]} liegt nicht im eigenen Speicher.`)
    }
    return url
  }, [supabase, uebernehmen, varianteHolen, character.id, character.name])

  // ── Der Ablauf ─────────────────────────────────────────────────────────────

  /** Die restlichen Schritte ohne weiteres Zutun. */
  const laufe = useCallback(async (
    schritte: KettenSchritt[], urls: Partial<Record<KettenSchritt, string>>,
  ) => {
    const bekannt = { ...urls }
    for (const schritt of schritte) {
      const ergebnis = await erzeuge(schritt, bekannt)
      bekannt[schritt] = await ablegen(schritt, ergebnis)
    }
    return bekannt
  }, [erzeuge, ablegen])

  /** Nach jedem Lauf: Stand neu messen, Seite und Dialog nachziehen. */
  const nachfuehren = useCallback(async () => {
    try {
      setStand(await standErmitteln())
    } catch {
      // Nur die Anzeige — der eigentliche Lauf ist davon unberührt.
    }
    onAenderung?.()
  }, [standErmitteln, onAenderung])

  const fehlerMelden = useCallback((schritt: KettenSchritt, e: unknown) => {
    if (e instanceof Abgebrochen) { setPhase({ art: 'bereit' }); return }
    const grund = (e as Error).message || 'Unbekannter Fehler'
    setPhase({ art: 'fehler', schritt, grund })
    // Ausdrücklich MIT Schrittnamen: „Fehlgeschlagen" allein sagt nicht, ob
    // noch etwas fehlt oder ob alles schon liegt.
    toast.error(`Kette abgebrochen bei ${SCHRITT_LABEL[schritt]}`, { description: grund })
  }, [])

  /** Startet die Kette dort, wo sie steht. */
  const starte = useCallback(async () => {
    abbruch.current = false

    if (!titelbildLiegtEigen) {
      toast.error('Das Titelbild liegt nicht im eigenen Speicher', {
        description: 'Es muss erst gesichert werden — sonst lehnt der Arbeiter es als Referenz ab.',
      })
      return
    }

    let aktuell: Stand
    try {
      aktuell = await standErmitteln()
      setStand(aktuell)
    } catch (e) {
      toast.error((e as Error).message)
      return
    }

    const offene = offeneSchritte(aktuell.vorhanden)
    if (offene.length === 0) {
      setPhase({ art: 'fertig' })
      toast.info('Alle drei Blätter liegen schon vor.')
      return
    }

    // Der Halt ist nur fällig, wenn der Kopf tatsächlich neu entsteht. Wird
    // mittendrin wieder aufgenommen, läuft der Rest ohne Rückfrage durch.
    if (offene[0] === 'kopf') {
      try {
        const ergebnis = await erzeuge('kopf', aktuell.urls)
        setPhase({ art: 'pruefen', bildUrl: ergebnis.url, bildPfad: ergebnis.pfad })
      } catch (e) {
        fehlerMelden('kopf', e)
      }
      return
    }

    try {
      await laufe(offene, aktuell.urls)
      setPhase({ art: 'fertig' })
      toast.success('Referenzkette fertig')
    } catch (e) {
      fehlerMelden(offene[0], e)
    } finally {
      void nachfuehren()
    }
  }, [titelbildLiegtEigen, standErmitteln, erzeuge, laufe, fehlerMelden, nachfuehren])

  /** „Nehmen und weiter" — Kopf ablegen, dann Körper und Referenzsheet. */
  const kopfNehmen = useCallback(async () => {
    if (phase.art !== 'pruefen') return
    const ergebnis = { url: phase.bildUrl, pfad: phase.bildPfad }
    let schritt: KettenSchritt = 'kopf'
    try {
      const kopfUrl = await ablegen('kopf', ergebnis)
      const aktuell = await standErmitteln()
      const rest = offeneSchritte(aktuell.vorhanden)
      if (rest.length > 0) schritt = rest[0]
      await laufe(rest, { ...aktuell.urls, kopf: kopfUrl })
      setPhase({ art: 'fertig' })
      toast.success('Referenzkette fertig')
    } catch (e) {
      fehlerMelden(schritt, e)
    } finally {
      void nachfuehren()
    }
  }, [phase, ablegen, standErmitteln, laufe, fehlerMelden, nachfuehren])

  /**
   * „Neu erzeugen" — noch ein Kopf-Auftrag.
   *
   * Das verworfene Bild bleibt in der Warteschlange liegen und wird NICHT
   * gelöscht: Ein Bild wegzuwerfen, das Mark vielleicht doch noch ansehen will,
   * wäre die teurere Fehlentscheidung.
   */
  const kopfVerwerfen = useCallback(async () => {
    try {
      const aktuell = await standErmitteln()
      const ergebnis = await erzeuge('kopf', aktuell.urls)
      setPhase({ art: 'pruefen', bildUrl: ergebnis.url, bildPfad: ergebnis.pfad })
    } catch (e) {
      fehlerMelden('kopf', e)
    }
  }, [standErmitteln, erzeuge, fehlerMelden])

  /** Warten aufgeben. Der Auftrag selbst bleibt in der Warteschlange. */
  const abbrechen = useCallback(() => {
    abbruch.current = true
    setPhase({ art: 'bereit' })
    void nachfuehren()
  }, [nachfuehren])

  return {
    phase,
    stand,
    standGeladen,
    titelbild,
    titelbildLiegtEigen,
    naechster: naechsterSchritt(stand.vorhanden),
    starte,
    kopfNehmen,
    kopfVerwerfen,
    abbrechen,
  }
}
