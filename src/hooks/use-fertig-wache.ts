'use client'

import { useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import {
  neuFertige, standMerken, fertigTitel, meldung,
  type JobStand, type WachJob,
} from '@/lib/fertig-melden'

/**
 * Der Wächter, der Bescheid sagt, wenn ein Bild fertig ist. (PROJ-58)
 *
 * WARUM ER IM LAYOUT HÄNGT UND NICHT AUF EINER SEITE: Die Seiten, auf denen
 * Mark Bilder STARTET — Scene Builder, freie Erzeugung, Prompt→Bild — rufen
 * `useImageJobs(false)` und fragen den Stand gar nicht ab. Nur `/queue` und
 * `/bildstudio` schauen nach. Wer im Scene Builder eine Reihe einreiht und
 * dort bleibt, hätte also nie erfahren, dass etwas fertig ist. Genau das war
 * Marks Beschwerde. Ein Wächter auf einer Seite wäre derselbe Fehler noch
 * einmal.
 *
 * VIER WEGE, ABSICHTLICH GESTAFFELT:
 *  1. Reiter-Titel — braucht keine Erlaubnis, wirkt auch im Hintergrundreiter.
 *  2. Einblendung mit Vorschaubild — für den, der gerade hinschaut.
 *  3. Betriebssystem-Meldung — nur nach ausdrücklicher Erlaubnis.
 *  4. Ton — nur, wenn eingeschaltet.
 * Die ersten beiden sind immer an, weil sie niemanden stören. Die letzten
 * beiden schaltet Mark in den Einstellungen selbst frei.
 */

const BUCKET = 'generated-images'
const TAKT_MS = 5_000

export const MELDUNG_SCHLUESSEL = 'fertig-benachrichtigung'
export const TON_SCHLUESSEL     = 'fertig-ton'

/** Liest einen Schalter aus dem lokalen Speicher — im privaten Fenster gesperrt. */
export function schalterLesen(schluessel: string): boolean {
  try { return localStorage.getItem(schluessel) === 'an' } catch { return false }
}

export function schalterSchreiben(schluessel: string, an: boolean): boolean {
  try { localStorage.setItem(schluessel, an ? 'an' : 'aus'); return true } catch { return false }
}

/**
 * Ein kurzer Doppelton, erzeugt statt abgespielt.
 *
 * WARUM KEINE TONDATEI: Eine Datei wäre ein weiteres Stück im Auslieferpaket,
 * das geladen werden muss, bevor es klingeln kann — ausgerechnet dann, wenn
 * die Verbindung schlecht ist. Zwei Sinustöne kosten nichts und sind sofort da.
 */
function pling() {
  try {
    const Kontext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Kontext()
    const jetzt = ctx.currentTime
    for (const [i, hz] of [880, 1320].entries()) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = hz
      o.type = 'sine'
      g.gain.setValueAtTime(0.0001, jetzt + i * 0.13)
      g.gain.exponentialRampToValueAtTime(0.16, jetzt + i * 0.13 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, jetzt + i * 0.13 + 0.12)
      o.connect(g); g.connect(ctx.destination)
      o.start(jetzt + i * 0.13); o.stop(jetzt + i * 0.13 + 0.14)
    }
    setTimeout(() => void ctx.close(), 800)
  } catch {
    // Ohne Ton ist die Meldung immer noch da. Kein Grund, irgendetwas zu melden.
  }
}

export function useFertigWache() {
  const supabase = createClient()
  /** Was wir beim letzten Blick gesehen haben. Leer = Grundlinie noch offen. */
  const stand = useRef<Map<string, JobStand>>(new Map())
  /** Wie viele fertige Bilder Mark noch nicht angesehen hat. */
  const ungesehen = useRef(0)
  const basisTitel = useRef('Prompt Trésor')

  const titelSetzen = useCallback(() => {
    document.title = fertigTitel(ungesehen.current, basisTitel.current)
  }, [])

  const pruefen = useCallback(async () => {
    const { data, error } = await supabase
      .from('image_jobs')
      .select('id, status, result_paths')
      .order('created_at', { ascending: false })
      .limit(60)

    // Ein Netzaussetzer ist keine Nachricht. Vor allem: den Stand NICHT
    // zurücksetzen, sonst gilt beim nächsten Mal alles als „erstmals gesehen"
    // und die Grundlinie beginnt von vorn.
    if (error || !data) return

    const jobs = data as WachJob[]
    const fertige = neuFertige(stand.current, jobs)
    stand.current = standMerken(jobs)
    if (fertige.length === 0) return

    const m = meldung(fertige)
    if (!m) return

    // 1. Reiter-Titel — nur, wenn Mark gerade woanders ist. Wer hinschaut,
    //    braucht keinen Zähler, der sofort wieder verschwindet.
    if (document.visibilityState === 'hidden') {
      ungesehen.current += fertige.filter(j => j.status === 'done').length
      titelSetzen()
    }

    // 2. Einblendung, mit Vorschaubild wenn eines da ist.
    const bildUrl = m.bild
      ? supabase.storage.from(BUCKET).getPublicUrl(m.bild).data.publicUrl
      : null
    const zeigen = m.fehler ? toast.error : toast.success
    zeigen(m.titel, {
      description: m.text,
      duration: 12_000,   // länger als üblich: Es geht um bezahlte Bilder.
      action: { label: 'Ansehen', onClick: () => { window.location.href = '/queue' } },
      ...(bildUrl ? { icon: undefined } : {}),
    })

    // 3. Betriebssystem-Meldung — erreicht Mark auch bei kleinem Fenster.
    if (schalterLesen(MELDUNG_SCHLUESSEL)
        && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(m.titel, {
          body: m.text,
          icon: bildUrl ?? '/logo.png',
          tag: 'prompt-tresor-fertig',   // ersetzt die vorige statt zu stapeln
        })
        n.onclick = () => { window.focus(); window.location.href = '/queue' }
      } catch { /* manche Browser verbieten den Aufruf ausserhalb eines Service Workers */ }
    }

    // 4. Ton.
    if (schalterLesen(TON_SCHLUESSEL)) pling()
  }, [supabase, titelSetzen])

  useEffect(() => {
    // Den Titel der Seite als Grundlage merken, bevor wir ihn anfassen.
    basisTitel.current = document.title.replace(/^\(\d+\)\s.*?·\s/, '') || 'Prompt Trésor'

    void pruefen()
    const takt = setInterval(() => { void pruefen() }, TAKT_MS)

    // Zurück im Reiter: Der Zähler hat seinen Zweck erfüllt.
    const beiRueckkehr = () => {
      if (document.visibilityState === 'visible' && ungesehen.current > 0) {
        ungesehen.current = 0
        titelSetzen()
      }
    }
    document.addEventListener('visibilitychange', beiRueckkehr)

    return () => {
      clearInterval(takt)
      document.removeEventListener('visibilitychange', beiRueckkehr)
    }
  }, [pruefen, titelSetzen])
}

/**
 * Die Erlaubnis für Betriebssystem-Meldungen erfragen.
 *
 * MUSS AUS EINEM KLICK HERAUS AUFGERUFEN WERDEN — Browser lehnen die Frage
 * sonst ab. Deshalb steht sie am Schalter in den Einstellungen und nicht im
 * Wächter.
 */
export async function meldungErlaubnisHolen(): Promise<'granted' | 'denied' | 'default' | 'nicht-unterstuetzt'> {
  if (typeof Notification === 'undefined') return 'nicht-unterstuetzt'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try { return await Notification.requestPermission() } catch { return 'denied' }
}
