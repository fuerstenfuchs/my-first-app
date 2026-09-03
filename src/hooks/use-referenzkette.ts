'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useImageJobs, ergebnisUrl } from '@/hooks/use-image-jobs'
import { useBildUebernehmen } from '@/hooks/use-bild-uebernehmen'
import { type Character } from '@/hooks/use-characters'
import { GROESSE_VORGABE, type JobStatus } from '@/lib/image-generation'
import { ablagepfad, pruefeBildgroesse, BAUSTEINE } from '@/lib/bausteine'
import {
  KOPF_PROMPT, KOERPER_PROMPT, REFERENZSHEET_PROMPT,
} from '@/components/characters/character-sheet-dialog'
import {
  KOERPERFOTO_VARIANTE, SCHRITT_LABEL, VARIANTEN_NAME,
  istEigenerSpeicher, kettenPrompt, quellenFuer, naechsterSchritt, offeneSchritte,
  koerperbildKandidaten,
  type KettenSchritt, type KoerperAuswahl, type Bildgruppe,
} from '@/lib/referenzkette'
import { loadRefImages } from '@/lib/reference-images'

/** Derselbe Baustein-Eintrag, den auch `Übernehmen` für Charaktere benutzt —
 * dieselbe Eimer- und Größengrenze gilt für ein von Hand hochgeladenes
 * Körperfoto genauso wie für ein übernommenes Kettenergebnis. */
const CHARAKTER_BAUSTEIN = BAUSTEINE.find(b => b.schluessel === 'charaktere')!

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
  /**
   * Marks eigenes Körperfoto, falls er eines hochgeladen hat.
   *
   * ZÄHLT AUSDRÜCKLICH NICHT ZU `vorhanden` — das ist eine Eingabe für den
   * Körper-Schritt, kein Kettenergebnis. Läge sie mit in derselben Zählung,
   * sähe die Kette nach dem Hochladen so aus, als sei sie schon einen Schritt
   * weiter, obwohl noch kein einziges Sheet erzeugt wurde.
   */
  koerperfotoUrl: string | null
}

const LEERER_STAND: Stand = {
  vorhanden: { kopf: false, koerper: false, referenzsheet: false },
  urls: {},
  koerperfotoUrl: null,
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
  /**
   * Die frei gewählten Körpermerkmale — Marks Antwort auf „ich weiß aber
   * nicht, an was sich die KI orientiert … da bräuchte ich dann noch mehr
   * Eingriffsmöglichkeiten".
   *
   * NICHT in der Datenbank gespeichert: Es ist ein Hinweis für DIESEN Lauf,
   * kein dauerhaftes Merkmal des Charakters. Ein zweiter Lauf mit anderer
   * Auswahl soll möglich sein, ohne die vorige irgendwo aufzuräumen.
   */
  const [koerperAuswahl, setKoerperAuswahl] = useState<KoerperAuswahl>({})
  /**
   * Welcher NICHT-Kopf-Schritt gerade „aufgegeben, aber nicht gestoppt" in der
   * Luft hängt — Critic-Befund R04 vom 03.09.2026.
   *
   * „Warten aufgeben" hält nur das Zusehen an, nicht den Auftrag selbst: Der
   * Arbeiter erzeugt ihn zu Ende, aber `warteAufJob` legt das Ergebnis nie ab,
   * weil niemand mehr danach fragt. Für den Kopf ist das folgenlos — nichts
   * hängt von ihm ab, bevor Mark ihn sieht. Für Körper (oder später) heißt es:
   * Die Vorgaben, mit denen der Auftrag eingereiht wurde, sind schon
   * verbraucht. Ohne dieses Merkmal würde `stand.vorhanden.koerper` weiter
   * `false` zeigen, der Vorgaben-Abschnitt im Dialog käme zurück, und jede
   * Änderung darin sähe aus wie eine echte, obwohl sie nichts mehr bewirkt.
   */
  const [jobUnterwegsSchritt, setJobUnterwegsSchritt] = useState<KettenSchritt | null>(null)
  /**
   * Ein VORHANDENES Bild, das Mark als Körperquelle gewählt hat.
   *
   * Mark am 03.09.2026: „Oft lade ich direkt noch ein Körperbild nach durch die
   * Erweiterung. Das landet dann automatisch in Sonstige. Er kann also auch
   * direkt bleiben, nur soll man dieses Bild dann auch auswählen können."
   *
   * Deshalb NICHTS in der Datenbank: Das Bild bleibt in seiner Variante liegen,
   * hier steht nur, dass DIESER Lauf es benutzt. Es hat Vorrang vor einem
   * hochgeladenen „Körper Original" — die Auswahl ist die jüngere Aussage.
   */
  const [gewaehltesKoerperbild, setGewaehltesKoerperbild] = useState<string | null>(null)
  const [kandidaten, setKandidaten] = useState<Bildgruppe[] | null>(null)
  const [kandidatenLaden, setKandidatenLaden] = useState(false)
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

    /** Das jüngste Bild einer Variante, nach Namen gesucht — oder `null`. */
    const juengstesBild = (name: string): string | null => {
      const v = (data ?? []).find(
        x => String(x.name ?? '').trim().toLowerCase() === name.toLowerCase(),
      )
      const bilder = (v?.images ?? []) as { url: string; sort_order: number }[]
      if (bilder.length === 0) return null
      return [...bilder].sort((a, b) => b.sort_order - a.sort_order)[0]!.url
    }

    const neu: Stand = {
      vorhanden: { kopf: false, koerper: false, referenzsheet: false },
      urls: {},
      koerperfotoUrl: juengstesBild(KOERPERFOTO_VARIANTE),
    }
    for (const schritt of Object.keys(VARIANTEN_NAME) as KettenSchritt[]) {
      const url = juengstesBild(VARIANTEN_NAME[schritt])
      if (!url) continue
      neu.vorhanden[schritt] = true
      neu.urls[schritt] = url
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
    setKoerperAuswahl({})
    setJobUnterwegsSchritt(null)
    setGewaehltesKoerperbild(null)
    setKandidaten(null)
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

  /**
   * Einen Schritt einreihen und auf sein Bild warten.
   *
   * `koerper` trägt, was NUR der Körper-Schritt braucht — Marks eigenes
   * Körperfoto (falls hochgeladen) und seine Merkmalsauswahl. Bei den anderen
   * beiden Schritten bleibt es unbenutzt; `quellenFuer` liest es nur im
   * `'koerper'`-Zweig.
   */
  const erzeuge = useCallback(async (
    schritt: KettenSchritt,
    urls: Partial<Record<KettenSchritt, string>>,
    koerper: { koerperfotoUrl: string | null; koerperAuswahl: KoerperAuswahl },
  ): Promise<{ url: string; pfad: string }> => {
    const hatKoerperfoto = !!koerper.koerperfotoUrl
    const quellen = quellenFuer(schritt, { hatKoerperfoto })
    const referenzen = quellen.map(q => {
      if (q.bild === 'titelbild') return titelbild
      if (q.bild === 'koerperfoto') return koerper.koerperfotoUrl
      return urls[q.bild]
    })
    if (referenzen.some(u => !u)) {
      // Darf nicht vorkommen — die Schritte laufen in fester Reihenfolge. Wenn
      // doch, dann lieber laut als mit einer leeren Referenz weiter.
      throw new Error(`Für ${SCHRITT_LABEL[schritt]} fehlt ein Referenzbild.`)
    }

    const job = await anlegen({
      prompt:          kettenPrompt(schritt, BASIS_PROMPT[schritt], { hatKoerperfoto, koerperAuswahl: koerper.koerperAuswahl }),
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

  /**
   * Eine Variante über ihren NAMEN — die vorhandene, sonst eine neue.
   *
   * Nimmt bewusst den Namen und nicht den Kettenschritt entgegen: Das
   * Körperfoto braucht denselben Mechanismus, ist aber kein `KettenSchritt` —
   * es ist eine Eingabe, kein Kettenergebnis (siehe `Stand.koerperfotoUrl`).
   */
  const varianteHolen = useCallback(async (name: string): Promise<string> => {
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
    const variantId = await varianteHolen(VARIANTEN_NAME[schritt])

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

  /**
   * Marks eigenes Körperfoto hochladen — Antwort auf: „Ich kann dazu bewusst
   * auch ein Körperbild als Zweites mit dazuladen."
   *
   * Läuft unabhängig vom eigentlichen Kettenlauf: Mark bringt dieses Bild
   * selbst mit, es ist keine KI-Erzeugung. Dieselbe Größenprüfung wie beim
   * Übernehmen (`pruefeBildgroesse`) — kein zweiter Weg für dieselbe Regel.
   */
  const [koerperfotoLaedt, setKoerperfotoLaedt] = useState(false)
  const koerperfotoHochladen = useCallback(async (datei: File): Promise<boolean> => {
    const zuGross = pruefeBildgroesse(datei.size, CHARAKTER_BAUSTEIN)
    if (zuGross) { toast.error(zuGross); return false }

    setKoerperfotoLaedt(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Nicht angemeldet'); return false }

      const variantId = await varianteHolen(KOERPERFOTO_VARIANTE)
      const endung = (datei.name.split('.').pop() || 'jpg').toLowerCase()
      const pfad = ablagepfad(user.id, character.id, variantId, endung)

      const { error: hochErr } = await supabase.storage
        .from(CHARAKTER_BAUSTEIN.bucket)
        .upload(pfad, datei, { contentType: datei.type || 'image/jpeg', upsert: false })
      if (hochErr) { toast.error(`Körperfoto konnte nicht abgelegt werden: ${hochErr.message}`); return false }

      // `sort_order` ist in der Datenbank ein normales 4-Byte `integer`
      // (max. rund 2,1 Milliarden) — `Date.now()` liegt heute bei rund
      // 1,76 Billionen und ließ den Insert mit „out of range for type
      // integer" scheitern. Stattdessen wie überall sonst im Projekt: die
      // vorhandenen Bilder DIESER Variante zählen, das neue kommt ans Ende.
      const { count } = await supabase
        .from('character_images')
        .select('*', { count: 'exact', head: true })
        .eq('variant_id', variantId)

      const { data: { publicUrl } } = supabase.storage.from(CHARAKTER_BAUSTEIN.bucket).getPublicUrl(pfad)
      const { error: zeileErr } = await supabase.from('character_images').insert({
        variant_id: variantId,
        user_id:    user.id,
        url:        publicUrl,
        storage_path: pfad,
        sort_order: count ?? 0,
      })
      if (zeileErr) { toast.error(`Körperfoto konnte nicht eingetragen werden: ${zeileErr.message}`); return false }

      setStand(s => ({ ...s, koerperfotoUrl: publicUrl }))
      // Ein frisch hochgeladenes Bild ist die jüngste Aussage — eine vorher
      // getroffene Auswahl aus vorhandenen Bildern gilt damit nicht mehr.
      // Sonst lüde Mark ein Bild hoch, und die Kette benutzte ein anderes.
      setGewaehltesKoerperbild(null)
      toast.success('Körper Original gespeichert')
      return true
    } catch (e) {
      toast.error(`Körperfoto fehlgeschlagen: ${(e as Error).message}`)
      return false
    } finally {
      setKoerperfotoLaedt(false)
    }
  }, [supabase, varianteHolen, character.id])

  /**
   * Die vorhandenen Bilder dieses Charakters zur Auswahl holen.
   *
   * Erst auf Zuruf, nicht beim Öffnen des Dialogs: Wer nur die Kette starten
   * will, braucht diese Abfrage nie. `loadRefImages` ist dieselbe Abfrage, die
   * auch der Scene Builder und der Weg „Prompt → Bild" benutzen — eine zweite
   * Fassung davon wäre die Doppelung, die später auseinanderläuft.
   */
  const kandidatenHolen = useCallback(async () => {
    setKandidatenLaden(true)
    try {
      const bilder = await loadRefImages('character_variants', 'character_id', character.id)
      setKandidaten(koerperbildKandidaten(bilder))
    } catch (e) {
      toast.error(`Vorhandene Bilder konnten nicht geladen werden: ${(e as Error).message}`)
      setKandidaten([])
    } finally {
      setKandidatenLaden(false)
    }
  }, [character.id])

  // ── Der Ablauf ─────────────────────────────────────────────────────────────

  /** Die restlichen Schritte ohne weiteres Zutun. */
  const laufe = useCallback(async (
    schritte: KettenSchritt[],
    urls: Partial<Record<KettenSchritt, string>>,
    koerper: { koerperfotoUrl: string | null; koerperAuswahl: KoerperAuswahl },
  ) => {
    const bekannt = { ...urls }
    for (const schritt of schritte) {
      const ergebnis = await erzeuge(schritt, bekannt, koerper)
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
    // mittendrin wieder aufgenommen, läuft der Rest ohne Rückfrage durch — und
    // dann mit dem, was gerade an Körperfoto/Auswahl vorliegt.
    if (offene[0] === 'kopf') {
      try {
        const ergebnis = await erzeuge('kopf', aktuell.urls, { koerperfotoUrl: gewaehltesKoerperbild ?? aktuell.koerperfotoUrl, koerperAuswahl })
        setPhase({ art: 'pruefen', bildUrl: ergebnis.url, bildPfad: ergebnis.pfad })
      } catch (e) {
        fehlerMelden('kopf', e)
      }
      return
    }

    try {
      await laufe(offene, aktuell.urls, { koerperfotoUrl: gewaehltesKoerperbild ?? aktuell.koerperfotoUrl, koerperAuswahl })
      setPhase({ art: 'fertig' })
      toast.success('Referenzkette fertig')
    } catch (e) {
      fehlerMelden(offene[0], e)
    } finally {
      void nachfuehren()
    }
  }, [titelbildLiegtEigen, standErmitteln, erzeuge, laufe, koerperAuswahl, gewaehltesKoerperbild, fehlerMelden, nachfuehren])

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
      // Genau HIER ist Marks Halt — er hat den Kopf gerade genommen. Das
      // Körperfoto und die Merkmalsauswahl, die er bis zu diesem Klick
      // gesetzt hat, gelten jetzt für den Rest der Kette.
      await laufe(rest, { ...aktuell.urls, kopf: kopfUrl }, { koerperfotoUrl: gewaehltesKoerperbild ?? aktuell.koerperfotoUrl, koerperAuswahl })
      setPhase({ art: 'fertig' })
      toast.success('Referenzkette fertig')
    } catch (e) {
      fehlerMelden(schritt, e)
    } finally {
      void nachfuehren()
    }
  }, [phase, ablegen, standErmitteln, laufe, koerperAuswahl, gewaehltesKoerperbild, fehlerMelden, nachfuehren])

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
      const ergebnis = await erzeuge('kopf', aktuell.urls, { koerperfotoUrl: gewaehltesKoerperbild ?? aktuell.koerperfotoUrl, koerperAuswahl })
      setPhase({ art: 'pruefen', bildUrl: ergebnis.url, bildPfad: ergebnis.pfad })
    } catch (e) {
      fehlerMelden('kopf', e)
    }
  }, [standErmitteln, erzeuge, koerperAuswahl, gewaehltesKoerperbild, fehlerMelden])

  /**
   * Warten aufgeben. Der Auftrag selbst bleibt in der Warteschlange — siehe
   * `jobUnterwegsSchritt` oben. Nur beim Kopf ist das folgenlos; ab dem
   * Körper-Schritt merkt sich der Hook, dass dessen Vorgaben schon vergeben
   * sind, damit der Dialog sie nicht wieder als änderbar zeigt.
   */
  const abbrechen = useCallback(() => {
    abbruch.current = true
    if (phase.art === 'wartet' && phase.schritt !== 'kopf') {
      setJobUnterwegsSchritt(phase.schritt)
    }
    setPhase({ art: 'bereit' })
    void nachfuehren()
  }, [phase, nachfuehren])

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
    // Marks Eingriffsmöglichkeiten für den Körper-Schritt — sichtbar für den
    // Dialog, damit er sie am Halt nach dem Kopf anbieten kann.
    // Die Auswahl aus vorhandenen Bildern hat Vorrang vor dem hochgeladenen
    // „Körper Original" — sie ist die juengere Aussage.
    koerperfotoUrl: gewaehltesKoerperbild ?? stand.koerperfotoUrl,
    /** Ob die Quelle eine Auswahl ist (statt eines Uploads) — fuer die Anzeige. */
    koerperbildIstAuswahl: gewaehltesKoerperbild !== null,
    kandidaten,
    kandidatenLaden,
    kandidatenHolen,
    koerperbildWaehlen: setGewaehltesKoerperbild,
    koerperfotoLaedt,
    koerperfotoHochladen,
    koerperAuswahl,
    setKoerperAuswahl,
    /** Siehe Kommentar an der Deklaration — steuert nur, ob der Dialog die
     * Körper-Vorgaben noch als änderbar zeigen darf. */
    jobUnterwegsSchritt,
  }
}
