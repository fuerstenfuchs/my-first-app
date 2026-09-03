'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useImageJobs, ergebnisUrl } from '@/hooks/use-image-jobs'
import { useBildUebernehmen } from '@/hooks/use-bild-uebernehmen'
import type { Outfit } from '@/hooks/use-outfits'
import { GROESSE_VORGABE, type JobStatus } from '@/lib/image-generation'
import {
  OUTFIT_SCHRITT_LABEL, OUTFIT_VARIANTEN_NAME,
  istEigenerSpeicher, outfitKettenPrompt, quellenFuer,
  naechsterSchritt, offeneSchritte,
  type OutfitSchritt,
} from '@/lib/outfit-kette'
import {
  OUTFIT_VORNE_PROMPT, OUTFIT_RUECKSEITE_PROMPT,
  OUTFIT_DETAILS_PROMPT, OUTFIT_REFERENZSHEET_PROMPT,
} from '@/lib/outfit-kette-prompts'

/**
 * Die Outfit-Referenzkette ausführen (PROJ-54).
 *
 * Vier Blätter nacheinander, mit EINEM Halt: Nach dem freigestellten
 * Vorne-Blatt sieht Mark das Ergebnis an und nimmt es oder verwirft es. Der
 * Halt sitzt genau dort, weil alle drei folgenden Blätter darauf aufbauen —
 * ein misslungenes Vorne-Blatt pflanzt sich sonst dreifach fort.
 *
 * WARUM DER ABLAUF IM BROWSER LEBT UND NICHT AUF DEM SERVER: Der Arbeiter
 * läuft auf Marks PC und wird über die Auftragstabelle beauftragt; niemand
 * sonst könnte auf sein Ergebnis warten. Der Preis ist, dass ein geschlossener
 * Tab die Kette anhält. Deshalb ist der Fortschritt NICHT im Kopf dieses Hooks
 * gespeichert, sondern in dem, was tatsächlich in der Datenbank liegt — beim
 * nächsten Öffnen wird nachgesehen und dort weitergemacht, wo es stehen blieb.
 *
 * DIE KETTE LÄUFT NUR AUF KLICK. Keine Automatik beim Öffnen des Dialogs, kein
 * Nachstarten im Hintergrund: Jeder Schritt ist eine kostenpflichtige
 * Bilderzeugung, und der Klick ist die Freigabe.
 */

const BASIS_PROMPT: Record<OutfitSchritt, string> = {
  vorne:         OUTFIT_VORNE_PROMPT,
  rueckseite:    OUTFIT_RUECKSEITE_PROMPT,
  details:       OUTFIT_DETAILS_PROMPT,
  referenzsheet: OUTFIT_REFERENZSHEET_PROMPT,
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

export type OutfitPhase =
  | { art: 'bereit' }
  | { art: 'wartet';  schritt: OutfitSchritt; seit: number }
  | { art: 'pruefen'; bildUrl: string; bildPfad: string }
  | { art: 'legt_ab'; schritt: OutfitSchritt }
  | { art: 'fertig' }
  | { art: 'fehler';  schritt: OutfitSchritt; grund: string }

/** Interner Abbruch — kein Fehler, sondern Marks Entscheidung. */
class Abgebrochen extends Error {}

function schlafe(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

type Stand = {
  /** Welche der vier Varianten schon ein Bild haben. */
  vorhanden: Record<OutfitSchritt, boolean>
  /** Das jeweils jüngste Bild — die Vorlage für die folgenden Schritte. */
  urls: Partial<Record<OutfitSchritt, string>>
}

const LEERER_STAND: Stand = {
  vorhanden: { vorne: false, rueckseite: false, details: false, referenzsheet: false },
  urls: {},
}

export function useOutfitKette(
  outfit: Outfit | null,
  offen: boolean,
  /** Wird nach jeder Änderung gerufen, damit die Seite ihre Varianten nachlädt. */
  onAenderung?: () => void,
) {
  const supabase = createClient()
  // Die Warteschlange wird hier NICHT mitgeladen: `anlegen` ist alles, was
  // gebraucht wird, und ein zweiter Abruf von hundert Aufträgen samt
  // Fünf-Sekunden-Takt wäre reine Last.
  const { anlegen } = useImageJobs(false)
  const { uebernehmen } = useBildUebernehmen()

  const [phase, setPhase] = useState<OutfitPhase>({ art: 'bereit' })
  const [stand, setStand] = useState<Stand>(LEERER_STAND)
  const [standGeladen, setStandGeladen] = useState(false)

  /**
   * Laufnummer statt eines Ja/Nein-Abbruchmerkers.
   *
   * Ein einzelnes `abbruch = true/false` kann nicht zugleich „der ALTE Lauf ist
   * abgebrochen" und „ein NEUER Lauf hat begonnen" ausdrücken. Genau daran hing
   * ein Fehler in PROJ-51: „Warten aufgeben" drücken und binnen des
   * Abfragetakts neu starten setzte den Merker wieder auf `false` — der alte
   * Wartelauf sah beim nächsten Blick „nicht abgebrochen" und lief weiter.
   * Danach legten ZWEI Läufe je ein Bild ab. Mit einer Laufnummer erkennt jeder
   * Lauf, ob er noch der aktuelle ist.
   */
  const laufNr = useRef(0)

  const outfitId = outfit?.id ?? null
  const titelbild = outfit?.cover_image_url ?? null
  const titelbildLiegtEigen = istEigenerSpeicher(titelbild)

  // ── Stand ermitteln ────────────────────────────────────────────────────────

  /**
   * Was tatsächlich in der Datenbank liegt.
   *
   * Absichtlich eine eigene Abfrage und nicht die Variantenliste aus
   * `useOutfitDetail`: Der Stand entscheidet, welche Aufträge eingereiht
   * werden. Eine veraltete Liste ließe die Kette einen Schritt doppelt
   * erzeugen — und beim Wiederaufnehmen ist gerade das der Fall, für den es die
   * Funktion überhaupt gibt.
   */
  const standErmitteln = useCallback(async (): Promise<Stand> => {
    if (!outfitId) return LEERER_STAND

    const { data, error } = await supabase
      .from('outfit_variants')
      .select('id, name, images:outfit_images(url, sort_order)')
      .eq('outfit_id', outfitId)

    if (error) throw new Error(`Varianten konnten nicht gelesen werden: ${error.message}`)

    /** Das jüngste Bild einer Variante, nach Namen gesucht — oder `null`. */
    const juengstesBild = (name: string): string | null => {
      const v = (data ?? []).find(
        x => String(x.name ?? '').trim().toLowerCase() === name.trim().toLowerCase(),
      )
      const bilder = (v?.images ?? []) as { url: string; sort_order: number }[]
      if (bilder.length === 0) return null
      return [...bilder].sort((a, b) => b.sort_order - a.sort_order)[0]!.url
    }

    const neu: Stand = {
      vorhanden: { vorne: false, rueckseite: false, details: false, referenzsheet: false },
      urls: {},
    }
    for (const schritt of Object.keys(OUTFIT_VARIANTEN_NAME) as OutfitSchritt[]) {
      const url = juengstesBild(OUTFIT_VARIANTEN_NAME[schritt])
      if (!url) continue
      neu.vorhanden[schritt] = true
      neu.urls[schritt] = url
    }
    return neu
  }, [supabase, outfitId])

  // Beim Öffnen einmal nachsehen, wo es weitergeht.
  useEffect(() => {
    if (!offen || !outfitId) return
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
  }, [offen, outfitId, standErmitteln])

  // Zumachen heißt abbrechen. Ohne das liefe die Warteschleife weiter und
  // schriebe in einen Dialog, den niemand mehr sieht.
  useEffect(() => {
    if (offen) return
    laufNr.current++
    setPhase({ art: 'bereit' })
  }, [offen])

  // Wechselt Mark das Outfit, gehört der alte Zustand nicht mehr dazu.
  useEffect(() => {
    laufNr.current++
    setPhase({ art: 'bereit' })
    setStand(LEERER_STAND)
  }, [outfitId])

  useEffect(() => () => { laufNr.current++ }, [])

  // ── Bausteine des Ablaufs ──────────────────────────────────────────────────

  /** Auf das Ergebnis eines Auftrags warten. Wirft bei Fehlschlag. */
  const warteAufJob = useCallback(async (
    jobId: string, lauf: number,
  ): Promise<{ url: string; pfad: string }> => {
    for (;;) {
      if (lauf !== laufNr.current) throw new Abgebrochen()

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
    schritt: OutfitSchritt,
    urls: Partial<Record<OutfitSchritt, string>>,
    lauf: number,
  ): Promise<{ url: string; pfad: string }> => {
    if (!outfit) throw new Error('Kein Outfit gewählt.')

    const quellen = quellenFuer(schritt)
    const referenzen = quellen.map(q => (q.bild === 'titelbild' ? titelbild : urls[q.bild]))
    if (referenzen.some(u => !u)) {
      // Darf nicht vorkommen — die Schritte laufen in fester Reihenfolge. Wenn
      // doch, dann lieber laut als mit einer leeren Referenz weiter.
      throw new Error(`Für „${OUTFIT_SCHRITT_LABEL[schritt]}" fehlt ein Referenzbild.`)
    }

    const job = await anlegen({
      prompt:          outfitKettenPrompt(schritt, BASIS_PROMPT[schritt]),
      model:           'gpt-image-2',
      size:            GROESSE_VORGABE,
      aspect_ratio:    null,
      variants:        1,
      reference_urls:  referenzen as string[],
      // Die Rollenliste bleibt leer: Was welches Bild bedeutet, steht schon im
      // Prompt (`outfitKettenPrompt`). Zusätzlich eine allgemeine Zuordnung
      // mitzuschicken hieße, dem Modell dieselbe Frage zweimal verschieden zu
      // beantworten.
      reference_roles: [],
      scene_meta: {
        name:     `${outfit.name} — ${OUTFIT_SCHRITT_LABEL[schritt]}`,
        herkunft: 'outfit-referenzkette',
        schritt,
      },
    })
    if (!job) throw new Error('Auftrag konnte nicht eingereiht werden.')

    setPhase({ art: 'wartet', schritt, seit: Date.now() })
    return warteAufJob(job.id, lauf)
  }, [anlegen, outfit, titelbild, warteAufJob])

  /**
   * Eine Variante über ihren NAMEN — die vorhandene, sonst eine neue.
   *
   * Der Vergleich ist getrimmt und ohne Groß-/Kleinschreibung. Genau darauf
   * ist `OUTFIT_VARIANTEN_NAME` abgestimmt: Keiner der vier Kettennamen darf
   * so mit einem Slot des Outfit-Formulars („Vorne", „Seite", „Hinten",
   * „Detail") zusammenfallen — sonst legte die Kette ihr Ergebnis in Marks
   * eigenes Fach, und ein Foto darin ließe sie einen Schritt überspringen.
   */
  const varianteHolen = useCallback(async (name: string): Promise<string> => {
    if (!outfitId) throw new Error('Kein Outfit gewählt.')

    const { data, error } = await supabase
      .from('outfit_variants')
      .select('id, name')
      .eq('outfit_id', outfitId)
    if (error) throw new Error(`Varianten konnten nicht gelesen werden: ${error.message}`)

    const treffer = (data ?? []).find(
      v => String(v.name ?? '').trim().toLowerCase() === name.trim().toLowerCase(),
    )
    if (treffer) return treffer.id as string

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Nicht angemeldet.')

    const { data: neu, error: anlegeFehler } = await supabase
      .from('outfit_variants')
      .insert({
        outfit_id:   outfitId,
        user_id:     user.id,
        name,
        description: 'Von der Outfit-Referenzkette angelegt (PROJ-54).',
        sort_order:  (data ?? []).length,
      })
      .select('id')
      .single()
    if (anlegeFehler || !neu) {
      throw new Error(`Variante „${name}" konnte nicht angelegt werden: ${anlegeFehler?.message ?? 'unbekannt'}`)
    }
    return neu.id as string
  }, [supabase, outfitId])

  /**
   * Ein Ergebnisbild in seine Variante legen — und die Adresse zurückgeben,
   * unter der es DORT liegt.
   *
   * Die Adresse des ABGELEGTEN Bildes, nicht die des Auftrags: Wird der Auftrag
   * später aus der Warteschlange gelöscht, verschwindet seine Datei mit. Die
   * Kette benutzt deshalb dasselbe Exemplar, das auch beim Outfit bleibt —
   * dann ist die Vorlage des nächsten Schrittes dieselbe, die Mark sieht.
   */
  const ablegen = useCallback(async (
    schritt: OutfitSchritt, ergebnis: { url: string; pfad: string },
  ): Promise<string> => {
    if (!outfit) throw new Error('Kein Outfit gewählt.')
    setPhase({ art: 'legt_ab', schritt })

    const name = OUTFIT_VARIANTEN_NAME[schritt]
    const variantId = await varianteHolen(name)

    const ok = await uebernehmen(ergebnis.url, ergebnis.pfad, {
      baustein:   'outfits',
      parentId:   outfit.id,
      parentName: outfit.name,
      variantId,
      // Die Kette fasst am Ende selbst zusammen. Ohne das stünde nach jedem
      // der vier Blätter dieselbe Übernahme-Meldung — vier Toasts für einen
      // Vorgang, den Mark als einen wahrnimmt.
      stillLeise: true,
    })
    // `uebernehmen` meldet den Grund selbst als Toast — hier zählt nur, dass
    // die Kette NICHT weiterläuft. Die folgenden Schritte bräuchten dieses Bild.
    if (!ok) throw new Error(`Das Bild konnte nicht in die Variante „${name}" gelegt werden.`)

    const { data, error } = await supabase
      .from('outfit_images')
      .select('url')
      .eq('variant_id', variantId)
      .order('sort_order', { ascending: false })
      .limit(1)
    if (error || !data?.[0]?.url) {
      throw new Error(`Das abgelegte Bild von „${OUTFIT_SCHRITT_LABEL[schritt]}" war nicht wiederzufinden.`)
    }
    const url = data[0].url as string

    // Nachgemessen statt angenommen: Läge das Exemplar wider Erwarten nicht im
    // eigenen Speicher, lehnte der Arbeiter den nächsten Auftrag ab — und der
    // Fehler stünde dann beim falschen Schritt.
    if (!istEigenerSpeicher(url)) {
      throw new Error(`Das abgelegte Bild von „${OUTFIT_SCHRITT_LABEL[schritt]}" liegt nicht im eigenen Speicher.`)
    }
    return url
  }, [supabase, uebernehmen, varianteHolen, outfit])

  // ── Der Ablauf ─────────────────────────────────────────────────────────────

  /** Die restlichen Schritte ohne weiteres Zutun. */
  const laufe = useCallback(async (
    schritte: OutfitSchritt[],
    urls: Partial<Record<OutfitSchritt, string>>,
    lauf: number,
  ) => {
    const bekannt = { ...urls }
    for (const schritt of schritte) {
      const ergebnis = await erzeuge(schritt, bekannt, lauf)
      if (lauf !== laufNr.current) throw new Abgebrochen()
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

  const fehlerMelden = useCallback((schritt: OutfitSchritt, e: unknown) => {
    if (e instanceof Abgebrochen) { setPhase({ art: 'bereit' }); return }
    const grund = (e as Error).message || 'Unbekannter Fehler'
    setPhase({ art: 'fehler', schritt, grund })
    // Ausdrücklich MIT Schrittnamen: „Fehlgeschlagen" allein sagt nicht, ob
    // noch etwas fehlt oder ob alles schon liegt.
    toast.error(`Kette abgebrochen bei „${OUTFIT_SCHRITT_LABEL[schritt]}"`, { description: grund })
  }, [])

  /** Startet die Kette dort, wo sie steht. */
  const starte = useCallback(async () => {
    if (!outfit) return
    const lauf = ++laufNr.current

    if (!titelbildLiegtEigen) {
      toast.error('Das Titelbild liegt nicht im eigenen Speicher', {
        description: 'Es muss erst gesichert werden — sonst lehnt der Arbeiter es als Referenz ab.',
      })
      return
    }

    let aktuell: Stand
    try {
      aktuell = await standErmitteln()
      if (lauf !== laufNr.current) return
      setStand(aktuell)
    } catch (e) {
      toast.error((e as Error).message)
      return
    }

    const offene = offeneSchritte(aktuell.vorhanden)
    if (offene.length === 0) {
      setPhase({ art: 'fertig' })
      toast.info('Alle vier Blätter liegen schon vor.')
      return
    }

    // Der Halt ist nur fällig, wenn das Vorne-Blatt tatsächlich neu entsteht.
    // Wird mittendrin wieder aufgenommen, läuft der Rest ohne Rückfrage durch —
    // das Vorne-Blatt, auf dem alles aufbaut, hat Mark dann ja schon gesehen.
    if (offene[0] === 'vorne') {
      try {
        const ergebnis = await erzeuge('vorne', aktuell.urls, lauf)
        if (lauf !== laufNr.current) return
        setPhase({ art: 'pruefen', bildUrl: ergebnis.url, bildPfad: ergebnis.pfad })
      } catch (e) {
        fehlerMelden('vorne', e)
      }
      return
    }

    try {
      await laufe(offene, aktuell.urls, lauf)
      setPhase({ art: 'fertig' })
      toast.success('Outfit-Referenzkette fertig')
    } catch (e) {
      fehlerMelden(offene[0], e)
    } finally {
      void nachfuehren()
    }
  }, [outfit, titelbildLiegtEigen, standErmitteln, erzeuge, laufe, fehlerMelden, nachfuehren])

  /** „Nehmen und weiter" — Vorne-Blatt ablegen, dann die drei übrigen. */
  const vorneNehmen = useCallback(async () => {
    if (phase.art !== 'pruefen') return
    const lauf = ++laufNr.current
    const ergebnis = { url: phase.bildUrl, pfad: phase.bildPfad }
    let schritt: OutfitSchritt = 'vorne'
    try {
      const vorneUrl = await ablegen('vorne', ergebnis)
      const aktuell = await standErmitteln()
      if (lauf !== laufNr.current) return
      const rest = offeneSchritte(aktuell.vorhanden)
      if (rest.length > 0) schritt = rest[0]
      await laufe(rest, { ...aktuell.urls, vorne: vorneUrl }, lauf)
      setPhase({ art: 'fertig' })
      toast.success('Outfit-Referenzkette fertig')
    } catch (e) {
      fehlerMelden(schritt, e)
    } finally {
      void nachfuehren()
    }
  }, [phase, ablegen, standErmitteln, laufe, fehlerMelden, nachfuehren])

  /**
   * „Neu erzeugen" — noch ein Vorne-Auftrag.
   *
   * Das verworfene Bild bleibt in der Warteschlange liegen und wird NICHT
   * gelöscht: Ein Bild wegzuwerfen, das Mark vielleicht doch noch ansehen will,
   * wäre die teurere Fehlentscheidung.
   */
  const vorneVerwerfen = useCallback(async () => {
    const lauf = ++laufNr.current
    try {
      const aktuell = await standErmitteln()
      if (lauf !== laufNr.current) return
      const ergebnis = await erzeuge('vorne', aktuell.urls, lauf)
      if (lauf !== laufNr.current) return
      setPhase({ art: 'pruefen', bildUrl: ergebnis.url, bildPfad: ergebnis.pfad })
    } catch (e) {
      fehlerMelden('vorne', e)
    }
  }, [standErmitteln, erzeuge, fehlerMelden])

  /**
   * Warten aufgeben.
   *
   * Der Auftrag selbst bleibt in der Warteschlange und wird vom Arbeiter zu
   * Ende erzeugt — nur legt ihn niemand mehr ab. Sein Bild ist danach über die
   * Warteschlange erreichbar, es geht also nichts verloren.
   */
  const abbrechen = useCallback(() => {
    laufNr.current++
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
    vorneNehmen,
    vorneVerwerfen,
    abbrechen,
  }
}
