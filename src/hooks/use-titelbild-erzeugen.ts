'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { useImageJobs, ergebnisUrl } from '@/hooks/use-image-jobs'
import { useBildUebernehmen } from '@/hooks/use-bild-uebernehmen'
import { useVisualAssets } from '@/hooks/use-visual-assets'
import { useLookGrading } from '@/hooks/use-look-grading'
import { usePoseActions } from '@/hooks/use-pose-actions'
import type { Character } from '@/hooks/use-characters'
import {
  groesseFuerFormat, promptFuerAuftrag, type JobStatus,
} from '@/lib/image-generation'
import type { AspectRatioKey } from '@/lib/scene-builder-options'
import { buildPrompt } from '@/lib/szene-prompt'
import { istEigenerSpeicher, VARIANTEN_NAME } from '@/lib/referenzkette'
import { EMPTY_PRESET_CONFIG, type ScenePresetConfig } from '@/lib/scene-preset-types'
import {
  TITELBILD_PRESET_NAME, TITELBILD_VARIANTE, titelbildSzene, referenzsheetBild,
  type VarianteMitBildern,
} from '@/lib/titelbild-preset'

/**
 * Titelbild aus dem Preset „Calvanize Studio" (PROJ-51).
 *
 * Mark: „Ein Knopf dafür reicht mir auch schon aus." Der Knopf ersetzt fünf
 * Handgriffe — Preset laden, Referenzsheet einsetzen, erzeugen, warten,
 * Ergebnis von Hand als Titelbild setzen.
 *
 * NICHTS DAVON LÄUFT VON SELBST. Es gibt genau einen Auslöser: `starte()`, und
 * die einzige Stelle, die `starte()` ruft, ist Marks Klick. Das ist eine
 * kostenpflichtige gpt-image-2-Erzeugung; sie an eine Charaktererzeugung oder
 * an das Ende der Referenzkette zu hängen, wäre eine Ausgabe ohne Entscheidung.
 * Umgekehrt wird auch NICHT nochmal nach den Kosten gefragt: Der Klick IST die
 * Freigabe.
 *
 * WARUM DER ABLAUF IM BROWSER LEBT: wie bei der Referenzkette — der Arbeiter
 * läuft auf Marks PC und wird über die Auftragstabelle beauftragt; niemand
 * sonst könnte auf sein Ergebnis warten. Der Preis ist, dass ein geschlossener
 * Tab den Ablauf anhält. Der Auftrag selbst läuft dann trotzdem zu Ende und
 * liegt in der Warteschlange; nur das Ablegen und das Setzen des Titelbildes
 * unterbleiben.
 */

/** Wie oft nachgesehen wird, ob der Auftrag fertig ist. */
const TAKT_MS = 4000

/**
 * Ab wann ein Hinweis erscheint, dass etwas nicht stimmen könnte.
 *
 * KEIN Abbruch, nur ein Hinweis — dieselbe Überlegung wie in
 * `use-referenzkette.ts`: Ein Auftrag kann echt lange dauern, wenn mehrere vor
 * ihm in der Warteschlange liegen. Ein harter Zeitablauf bräche genau dann ab,
 * wenn alles in Ordnung ist. Ein Wächter, der bei normaler Arbeit rot wird,
 * wird binnen zwei Tagen ignoriert.
 */
export const HINWEIS_NACH_MS = 4 * 60 * 1000

export type TitelbildPhase =
  | { art: 'bereit' }
  | { art: 'reiht_ein' }
  | { art: 'wartet';  seit: number }
  | { art: 'legt_ab' }
  | { art: 'fertig';  bildUrl: string }
  | { art: 'fehler';  grund: string }

/** Interner Abbruch — kein Fehler, sondern Marks Entscheidung. */
class Abgebrochen extends Error {}

function schlafe(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export function useTitelbildErzeugen(
  character: Character | null,
  /** Die Varianten des Charakters, wie die Seite sie ohnehin schon geladen hat. */
  varianten: readonly VarianteMitBildern[],
  optionen: {
    /**
     * Setzt das Titelbild. Bewusst hereingereicht statt hier gebaut: Die Seite
     * hat `updateCharacterCover` aus `useCharacterDetail` schon und zieht damit
     * zugleich ihre Liste nach (`patchCharacterCover`). Ein zweiter Weg zum
     * selben Datensatz wäre genau die Doppelung, die später auseinanderläuft.
     */
    titelbildSetzen: (url: string) => Promise<boolean>
    /** Damit die Seite ihre Varianten nachlädt, wenn ein Bild dazugekommen ist. */
    onAenderung?: () => void
  },
) {
  const supabase = createClient()
  // Die Warteschlange wird NICHT mitgeladen: `anlegen` ist alles, was gebraucht
  // wird, und ein zweiter Abruf von hundert Aufträgen samt Fünf-Sekunden-Takt
  // wäre reine Last.
  const { anlegen } = useImageJobs(false)
  const { uebernehmen } = useBildUebernehmen()
  // Dieselben Listen, gegen die auch der Scene Builder ein Preset auflöst
  // (`applyPresetConfig`). Die Posen sind heute leer in Marks Preset — sie
  // trotzdem zu laden ist die billigere Entscheidung als ein Feld, das
  // stillschweigend verschwindet, sobald er dem Preset einmal eine Pose gibt.
  const { assets: visualAssets } = useVisualAssets()
  const { styles, gradings } = useLookGrading()
  const { poseActions } = usePoseActions()

  const [phase, setPhase] = useState<TitelbildPhase>({ art: 'bereit' })
  /**
   * Laufnummer statt eines Ja/Nein-Abbruchmerkers.
   *
   * Ein einzelnes `abbruch = true/false` kann nicht zugleich „der ALTE Lauf ist
   * abgebrochen" und „ein NEUER Lauf hat begonnen" ausdrücken. Genau daran
   * hing ein Fehler: „Warten aufgeben" drücken und binnen vier Sekunden (dem
   * Abfragetakt) neu starten setzte den Merker wieder auf `false` — der alte
   * Wartelauf sah beim nächsten Blick „nicht abgebrochen" und lief weiter.
   * Danach legten ZWEI Läufe je ein Bild ab und setzten je ein Titelbild;
   * welches gewann, entschied die Reihenfolge des Eintreffens. Mit einer
   * Laufnummer erkennt jeder Lauf, ob er noch der aktuelle ist.
   */
  const laufNr = useRef(0)

  const { titelbildSetzen, onAenderung } = optionen

  useEffect(() => () => { laufNr.current++ }, [])

  // Wechselt Mark den Charakter, gehört der alte Zustand nicht mehr dazu.
  useEffect(() => {
    laufNr.current++
    setPhase({ art: 'bereit' })
  }, [character?.id])

  // ── Voraussetzungen ────────────────────────────────────────────────────────

  /**
   * Das Referenzsheet, so wie die Seite es gerade kennt.
   *
   * Nur für die Anzeige (Knopf gesperrt oder nicht). Beim Start wird es NOCH
   * EINMAL frisch gemessen — was hier steht, kann Minuten alt sein, und der
   * Auftrag soll auf dem laufen, was wirklich in der Datenbank liegt.
   */
  const referenzsheetUrl = useMemo(() => referenzsheetBild(varianten), [varianten])
  const sheetLiegtEigen = istEigenerSpeicher(referenzsheetUrl)

  /** Warum der Knopf gesperrt ist — oder `null`, wenn er es nicht ist. */
  const hindernis: string | null =
    !character ? 'Kein Charakter gewählt.'
      : !referenzsheetUrl
        ? `Dieser Charakter hat noch kein Referenzsheet — erst die Referenzkette laufen lassen.`
        : !sheetLiegtEigen
          ? 'Das Referenzsheet liegt nicht im eigenen Speicher. Der Arbeiter nimmt nur eigene Adressen als Referenz an — sichere es zuerst.'
          : null

  // ── Bausteine des Ablaufs ──────────────────────────────────────────────────

  /** Marks gespeichertes Preset, über seinen Namen. */
  const presetHolen = useCallback(async (userId: string): Promise<ScenePresetConfig> => {
    const { data, error } = await supabase
      .from('scene_presets')
      .select('id, name, config')
      .eq('user_id', userId)
      // `ilike` ohne Platzhalter heißt: derselbe Name, Groß-/Kleinschreibung egal.
      .ilike('name', TITELBILD_PRESET_NAME)
      .limit(1)

    if (error) throw new Error(`Das Preset konnte nicht geladen werden: ${error.message}`)

    const treffer = (data ?? [])[0]
    if (!treffer) {
      // Der gesuchte Name steht wörtlich in der Meldung: Wird das Preset
      // umbenannt, findet der Knopf es nicht mehr — und dann soll sofort
      // dastehen, wonach er gesucht hat, statt „Preset nicht gefunden".
      throw new Error(
        `Es gibt kein Preset mit dem Namen „${TITELBILD_PRESET_NAME}". ` +
        'Der Knopf hängt genau an diesem Namen — wurde es umbenannt oder gelöscht, ' +
        'muss es im Scene Builder wieder unter diesem Namen gespeichert werden.',
      )
    }

    // Wie `normalize` in `use-scene-presets.ts`: Ein altes Preset kennt nicht
    // zwingend jedes Feld. Ohne die Vorgabe darunter wäre `light_modifiers`
    // dann `undefined` und der Prompt-Bau liefe darauf auf.
    return { ...EMPTY_PRESET_CONFIG, ...(treffer.config as Partial<ScenePresetConfig> ?? {}) }
  }, [supabase])

  /**
   * Das Referenzsheet frisch aus der Datenbank.
   *
   * Nachgemessen statt aus der Anzeige übernommen: Der Auftrag kostet Geld, und
   * eine veraltete Liste hieße, das FALSCHE Sheet als Referenz mitzugeben —
   * ohne Fehler, nur mit einem Bild, das nicht ganz stimmt.
   */
  const sheetErmitteln = useCallback(async (characterId: string): Promise<string> => {
    const { data, error } = await supabase
      .from('character_variants')
      .select('name, images:character_images(url, sort_order)')
      .eq('character_id', characterId)

    if (error) throw new Error(`Varianten konnten nicht gelesen werden: ${error.message}`)

    const url = referenzsheetBild((data ?? []) as VarianteMitBildern[])
    if (!url) {
      throw new Error(
        `Der Charakter hat noch kein Referenzsheet — erst die Referenzkette laufen lassen. ` +
        `Gesucht wurde die Variante „${VARIANTEN_NAME.referenzsheet}".`,
      )
    }
    // Vor dem Einreihen, nicht danach: Der Arbeiter lehnt fremde Adressen ab —
    // und zwar erst, nachdem der Auftrag in der Warteschlange stand.
    if (!istEigenerSpeicher(url)) {
      throw new Error('Das Referenzsheet liegt nicht im eigenen Speicher — der Arbeiter würde es als Referenz ablehnen.')
    }
    return url
  }, [supabase])

  /** Auf das Ergebnis eines Auftrags warten. Wirft bei Fehlschlag. */
  const warteAufJob = useCallback(async (
    jobId: string,
    /** Die Nummer DIESES Laufs — stimmt sie nicht mehr, gehört das Warten nicht mehr dazu. */
    lauf: number,
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
        // NICHT annehmen, dass „fertig" auch „Bild da" heißt — sonst wanderte
        // eine leere Adresse weiter und scheiterte an ganz anderer Stelle.
        const pfad = ((data.result_paths as string[] | null) ?? [])[0]
        if (!pfad) throw new Error('Der Auftrag ist fertig, hat aber kein Bild geliefert.')
        return { pfad, url: ergebnisUrl(pfad) }
      }

      await schlafe(TAKT_MS)
    }
  }, [supabase])

  /**
   * Die Variante „Calvanize" — die vorhandene, sonst eine neue.
   *
   * Seit PROJ-50 steht sie bei jedem NEUEN Charakter schon bereit. Ältere
   * Charaktere haben sie nicht; für die wird sie hier angelegt. Der
   * Namensvergleich ignoriert Groß-/Kleinschreibung, genau wie
   * `varianteHolen` in `use-referenzkette.ts` — sonst entstünde ein zweites,
   * gleichnamiges Fach.
   */
  const varianteHolen = useCallback(async (
    characterId: string, userId: string,
  ): Promise<string> => {
    const { data, error } = await supabase
      .from('character_variants')
      .select('id, name')
      .eq('character_id', characterId)
    if (error) throw new Error(`Varianten konnten nicht gelesen werden: ${error.message}`)

    const treffer = (data ?? []).find(
      v => String(v.name ?? '').trim().toLowerCase() === TITELBILD_VARIANTE.toLowerCase(),
    )
    if (treffer) return treffer.id as string

    const { data: neu, error: anlegeFehler } = await supabase
      .from('character_variants')
      .insert({
        character_id: characterId,
        user_id:      userId,
        name:         TITELBILD_VARIANTE,
        description:  `Titelbilder aus dem Preset „${TITELBILD_PRESET_NAME}" (PROJ-51).`,
        sort_order:   (data ?? []).length,
      })
      .select('id')
      .single()
    if (anlegeFehler || !neu) {
      throw new Error(`Variante „${TITELBILD_VARIANTE}" konnte nicht angelegt werden: ${anlegeFehler?.message ?? 'unbekannt'}`)
    }
    return neu.id as string
  }, [supabase])

  /**
   * Das Ergebnisbild in die Variante legen — und die Adresse zurückgeben, unter
   * der es DORT liegt.
   *
   * Nicht die Adresse des Auftrags: Wird der Auftrag später aus der
   * Warteschlange gelöscht, verschwindet seine Datei mit — und das Titelbild
   * wäre ein kaputtes Kästchen, ohne Fehlermeldung, vielleicht erst Wochen
   * später bemerkt. Dieselbe Überlegung wie in `ablegen()` der Referenzkette.
   */
  const ablegen = useCallback(async (
    characterId: string, characterName: string, userId: string,
    ergebnis: { url: string; pfad: string },
  ): Promise<string> => {
    const variantId = await varianteHolen(characterId, userId)

    const ok = await uebernehmen(ergebnis.url, ergebnis.pfad, {
      baustein:   'charaktere',
      parentId:   characterId,
      parentName: characterName,
      variantId,
      // `uebernehmen` meldet sonst „das Titelbild bleibt unverändert" — und
      // zwei Sekunden später meldet dieser Ablauf, dass es ersetzt wurde. Beide
      // Sätze stimmen für sich, zusammen widersprechen sie sich. Hier fasst der
      // Ablauf am Ende selbst zusammen.
      stillLeise: true,
    })
    // `uebernehmen` meldet den Grund selbst als Toast — hier zählt nur, dass
    // NICHT weitergemacht wird. Ein Titelbild, das auf die Auftragsdatei zeigt,
    // wäre schlechter als gar keines.
    if (!ok) throw new Error(`Das Bild konnte nicht in die Variante „${TITELBILD_VARIANTE}" gelegt werden.`)

    const { data, error } = await supabase
      .from('character_images')
      .select('url')
      .eq('variant_id', variantId)
      .order('sort_order', { ascending: false })
      .limit(1)
    if (error || !data?.[0]?.url) {
      throw new Error('Das abgelegte Titelbild war nicht wiederzufinden.')
    }
    return data[0].url as string
  }, [supabase, uebernehmen, varianteHolen])

  // ── Der Ablauf ─────────────────────────────────────────────────────────────

  /**
   * Der eine Auslöser. Wird ausschließlich vom Knopf gerufen.
   */
  const starte = useCallback(async () => {
    if (!character) return
    if (phase.art === 'reiht_ein' || phase.art === 'wartet' || phase.art === 'legt_ab') return

    const lauf = ++laufNr.current
    setPhase({ art: 'reiht_ein' })

    /** Gesetzt, sobald das erzeugte Bild sicher in der Variante liegt. */
    let bildLiegt: string | null = null

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet.')

      const [config, sheetUrl] = await Promise.all([
        presetHolen(user.id),
        sheetErmitteln(character.id),
      ])

      const { scene, sceneRefs } = titelbildSzene(
        config,
        {
          poseActions,
          expressions: visualAssets.filter(a => a.asset_type === 'expression'),
          cameras:     visualAssets.filter(a => a.asset_type === 'camera'),
          styles,
          gradings,
        },
        { character, referenzsheetUrl: sheetUrl },
      )

      const aspectRatio = scene.aspect_ratio as AspectRatioKey | null
      const rollen = ['character' as const]

      const job = await anlegen({
        prompt:          promptFuerAuftrag(buildPrompt(scene, sceneRefs), aspectRatio, rollen),
        model:           'gpt-image-2',
        size:            groesseFuerFormat(aspectRatio).size,
        aspect_ratio:    aspectRatio,
        variants:        1,
        reference_urls:  [sheetUrl],
        reference_roles: rollen,
        scene_meta: {
          name:     `${character.name} — Titelbild`,
          herkunft: 'titelbild-preset',
          preset:   TITELBILD_PRESET_NAME,
        },
      })
      if (!job) throw new Error('Auftrag konnte nicht eingereiht werden.')

      setPhase({ art: 'wartet', seit: Date.now() })
      const ergebnis = await warteAufJob(job.id, lauf)

      // Auch hier prüfen, nicht nur in der Warteschleife: Zwischen dem letzten
      // Blick und jetzt kann abgebrochen oder der Charakter gewechselt worden
      // sein — und ab der nächsten Zeile wird geschrieben.
      if (lauf !== laufNr.current) throw new Abgebrochen()

      setPhase({ art: 'legt_ab' })
      const abgelegt = await ablegen(character.id, character.name, user.id, ergebnis)
      // Ab hier ist das Bild bezahlt UND sicher abgelegt. Scheitert danach noch
      // etwas, darf die Fehlermeldung nicht so klingen, als sei alles umsonst
      // gewesen — sonst drückt Mark den Knopf ein zweites Mal und zahlt für ein
      // Bild, das längst in der Variante liegt.
      bildLiegt = abgelegt

      // Das Titelbild wird AUSDRÜCKLICH gesetzt — anders als `uebernehmen`
      // allein, das Titelbilder absichtlich nie anfasst (Mark am 02.09.2026:
      // „Da habe ich mühsam schon eigene Titelbilder erstellt"). Hier ist genau
      // das der Auftrag, und deshalb wird es auch gesagt statt stillschweigend
      // getan.
      // GEMESSEN, nicht angenommen: `updateCharacterCover` meldete einen
      // Fehler früher nur als Toast und kehrte normal zurück — ein `await`
      // darauf konnte Erfolg und Misserfolg nicht unterscheiden. Dann stand
      // hier „Titelbild gesetzt", während daneben rot stand, dass genau das
      // nicht ging. Seit dem 03.09.2026 liefert die Funktion `boolean`.
      const gesetzt = await titelbildSetzen(abgelegt)
      if (!gesetzt) {
        throw new Error('Das Bild wurde erzeugt und abgelegt, aber das Titelbild konnte nicht gesetzt werden.')
      }

      setPhase({ art: 'fertig', bildUrl: abgelegt })
      toast.success('Titelbild gesetzt', {
        description: `Das neue Bild liegt zusätzlich in der Variante „${TITELBILD_VARIANTE}". Das bisherige Titelbild wurde ersetzt.`,
      })
    } catch (e) {
      if (e instanceof Abgebrochen) { setPhase({ art: 'bereit' }); return }
      const roh = (e as Error).message || 'Unbekannter Fehler'
      // Liegt das Bild schon, ist nur der letzte Handgriff schiefgegangen. Das
      // gehört in die Meldung: Ein zweiter Lauf würde ein zweites Mal Geld
      // kosten, obwohl das Bild da ist und nur noch gesetzt werden muss.
      const grund = bildLiegt
        ? `${roh} — Das erzeugte Bild liegt aber bereits in der Variante „${TITELBILD_VARIANTE}". Es muss nur noch von Hand als Titelbild gesetzt werden; ein zweiter Lauf würde erneut Geld kosten.`
        : roh
      setPhase({ art: 'fehler', grund })
      toast.error(
        bildLiegt ? 'Bild erzeugt, aber Titelbild nicht gesetzt' : 'Titelbild fehlgeschlagen',
        { description: grund },
      )
    } finally {
      // NUR nachladen, wenn tatsächlich etwas dazugekommen ist, und nur wenn
      // dieser Lauf noch der aktuelle ist. `onAenderung` hält den Nachlader aus
      // dem Render des Klicks fest — wurde inzwischen der Charakter gewechselt,
      // schriebe er den ALTEN Charakter in die Detailansicht, während in der
      // Liste der neue ausgewählt ist. (`finally` läuft auch bei `return` aus
      // dem `catch`, deshalb steht die Bedingung hier und nicht dort.)
      if (bildLiegt && lauf === laufNr.current) onAenderung?.()
    }
  }, [
    character, phase.art, supabase, presetHolen, sheetErmitteln, visualAssets,
    styles, gradings, poseActions, anlegen, warteAufJob, ablegen,
    titelbildSetzen, onAenderung,
  ])

  /**
   * Warten aufgeben.
   *
   * Der Auftrag bleibt in der Warteschlange und läuft zu Ende — er ist bezahlt.
   * Nur das Zusehen hört auf; das Bild kann später von Hand übernommen werden.
   */
  const abbrechen = useCallback(() => {
    // Laufnummer hochzählen statt einen Merker setzen: So ist der laufende
    // Lauf dauerhaft ungültig — auch dann noch, wenn gleich darauf ein neuer
    // startet (siehe Kommentar bei `laufNr`).
    laufNr.current++
    setPhase({ art: 'bereit' })
  }, [])

  return {
    phase,
    /** Das Referenzsheet, wie die Seite es kennt — für die Anzeige. */
    referenzsheetUrl,
    /** Warum der Knopf gesperrt ist, oder null. */
    hindernis,
    laeuft: phase.art === 'reiht_ein' || phase.art === 'wartet' || phase.art === 'legt_ab',
    starte,
    abbrechen,
  }
}
