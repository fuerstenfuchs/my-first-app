/**
 * „Dein Bild ist fertig." (PROJ-58)
 *
 * WAS VORHER FEHLTE — und zwar vollständig: Die Seiten, auf denen Mark Bilder
 * STARTET (Scene Builder, freie Erzeugung, Prompt→Bild), rufen
 * `useImageJobs(false)`, fragen den Stand also gar nicht ab. Nur `/queue` und
 * `/bildstudio` schauen alle fünf Sekunden nach — und auch die melden nichts,
 * wenn ein Auftrag fertig wird, sie zeichnen nur neu. Es gab schlicht nichts,
 * was hätte Bescheid sagen können. Mark: „bekomme ich leider nirgendwo eine
 * Meldung, dass das Bild fertig ist."
 *
 * Hier steht die Entscheidung, WAS gemeldet wird. Das WIE (Reiter-Titel,
 * Einblendung, Benachrichtigung, Ton) liegt in `use-fertig-wache.ts`.
 */

export type JobStand = 'queued' | 'running' | 'done' | 'failed'

export interface WachJob {
  id: string
  status: JobStand
  /** Für das Vorschaubild in der Einblendung. */
  result_paths?: string[] | null
}

/** Endzustände. Alles andere ist noch unterwegs. */
export function istFertig(stand: JobStand): boolean {
  return stand === 'done' || stand === 'failed'
}

/**
 * Welche Aufträge sind SEIT DEM LETZTEN BLICK fertig geworden?
 *
 * DER SPRINGENDE PUNKT IST DAS WORT „GEWORDEN". Wer beim Öffnen der Seite
 * einfach alle fertigen Aufträge meldet, überschüttet Mark bei jedem Laden mit
 * Meldungen über Bilder von gestern. Gemeldet wird deshalb nur ein
 * ÜBERGANG — ein Auftrag, den wir vorher in Arbeit gesehen haben und der jetzt
 * fertig ist.
 *
 * Ein Auftrag, den wir zum ersten Mal sehen und der schon fertig ist, wird
 * still übernommen: Er ist die Grundlinie, keine Neuigkeit.
 */
export function neuFertige(vorher: Map<string, JobStand>, jetzt: WachJob[]): WachJob[] {
  return jetzt.filter(j => {
    const alt = vorher.get(j.id)
    if (alt === undefined) return false      // erstmals gesehen → Grundlinie
    if (istFertig(alt)) return false         // war schon fertig → nichts Neues
    return istFertig(j.status)
  })
}

/** Den Stand für den nächsten Vergleich festhalten. */
export function standMerken(jobs: WachJob[]): Map<string, JobStand> {
  return new Map(jobs.map(j => [j.id, j.status]))
}

/**
 * Der Reiter-Titel.
 *
 * WARUM DER TITEL UND NICHT NUR EINE EINBLENDUNG: Eine Einblendung sieht nur,
 * wer gerade hinschaut. Ein Bild braucht ein bis drei Minuten — in der Zeit ist
 * Mark in einem anderen Reiter. Der Titel steht auch dann in der Reiterleiste
 * und braucht keine Erlaubnis.
 */
export function fertigTitel(anzahl: number, basis = 'Prompt Trésor'): string {
  if (anzahl <= 0) return basis
  return `(${anzahl}) ${anzahl === 1 ? 'Bild fertig' : 'Bilder fertig'} · ${basis}`
}

export interface Meldung {
  titel: string
  text: string
  /** Erstes Ergebnisbild, für die Vorschau in der Einblendung. */
  bild: string | null
  /** Ob mindestens einer fehlgeschlagen ist — dann rot statt grün. */
  fehler: boolean
}

/**
 * Der Text der Meldung.
 *
 * Fehlschläge werden MITGEMELDET und nicht verschwiegen: Ein Auftrag, der
 * scheitert, ist genau der Fall, in dem Mark am längsten vergeblich wartet.
 */
export function meldung(fertige: WachJob[]): Meldung | null {
  if (fertige.length === 0) return null

  const gut  = fertige.filter(j => j.status === 'done')
  const weg  = fertige.filter(j => j.status === 'failed')
  const bild = gut.find(j => j.result_paths?.length)?.result_paths?.[0] ?? null

  if (weg.length === 0) {
    return {
      titel: gut.length === 1 ? 'Bild fertig' : `${gut.length} Bilder fertig`,
      text: 'In der Warteschlange ansehen.',
      bild,
      fehler: false,
    }
  }
  if (gut.length === 0) {
    return {
      titel: weg.length === 1 ? 'Ein Auftrag ist gescheitert' : `${weg.length} Aufträge sind gescheitert`,
      text: 'Der Grund steht in der Warteschlange.',
      bild: null,
      fehler: true,
    }
  }
  return {
    titel: `${gut.length} fertig, ${weg.length} gescheitert`,
    text: 'Der Grund für die gescheiterten steht in der Warteschlange.',
    bild,
    fehler: true,
  }
}
