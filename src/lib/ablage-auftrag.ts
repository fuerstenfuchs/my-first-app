/**
 * Wohin ein fertiges Bild von selbst wandern soll (PROJ-76).
 *
 * MARKS BESCHWERDE: „Was jetzt natürlich noch gut ist, weil ich ja dann immer
 * mehrere Bilder von jemandem habe, dass diese auch direkt bei dem Charakter
 * landen im Ordner Sonstiges. Ich musste jetzt alle Bilder einzeln dorthin
 * verschieben. Ist natürlich, wenn man wirklich mal mehrere hat, nicht so
 * hilfreich."
 *
 * Fünf Bilder je Shooting, jedes von Hand in denselben Ordner geschoben — das
 * ist genau die Arbeit, die eine Kette einsparen soll und die sie stattdessen
 * erzeugt hat.
 *
 * DIE ABLAGE STEHT IM AUFTRAG, NICHT IM BILD. Wer beim Erzeugen weiß, wohin es
 * soll, schreibt es in `scene_meta`. Der Wächter liest es später aus. So
 * braucht niemand zu raten, woher ein Bild kam.
 */

export type AblageZiel = {
  /** Heute nur Charaktere — andere Bausteine wären eine eigene Entscheidung. */
  baustein: 'charaktere'
  parentId: string
  parentName: string
  /** Der Ordner darin. null wäre „direkt am Charakter", gibt es hier nicht. */
  variantId: string | null
  variantName: string
  /**
   * Das abgelegte Bild zusätzlich als Titelbild setzen (PROJ-79).
   *
   * Gedacht für frisch angelegte Einträge: Eine Gruppe entsteht in dem Moment,
   * in dem das Blatt beauftragt wird — sie hat also noch gar kein Bild und
   * steht bis dahin als leerer Kasten in der Liste. Wer hier `true` setzt,
   * bekommt das erste Ergebnis als Titelbild und damit einen Eintrag, den man
   * wiedererkennt.
   */
  alsTitelbild?: boolean
}

/** Was der Wächter von einem Auftrag sehen muss. */
export type AblageJob = {
  id: string
  status: string
  result_paths: string[] | null
  scene_meta: Record<string, unknown> | null
}

export type AblageAuftrag = {
  jobId: string
  pfade: string[]
  ziel: AblageZiel
}

function istZiel(v: unknown): v is AblageZiel {
  if (!v || typeof v !== 'object') return false
  const z = v as Record<string, unknown>
  return z.baustein === 'charaktere'
      && typeof z.parentId === 'string' && z.parentId.length > 0
      && typeof z.parentName === 'string'
      && typeof z.variantName === 'string'
      && (z.variantId === null || typeof z.variantId === 'string')
}

/**
 * Welche Aufträge jetzt abzulegen sind.
 *
 * NICHT „was ist gerade fertig geworden", sondern „was ist fertig und noch
 * nicht abgelegt". Der Unterschied entscheidet:
 *
 * Der Meldewächter arbeitet mit einer Grundlinie — er meldet nur, was sich
 * seit dem letzten Blick GEÄNDERT hat. Nach einem Neuladen der Seite gilt
 * alles Vorhandene als „schon gesehen". Für eine Meldung ist das richtig
 * (niemand will beim Öffnen zwanzig alte Hinweise), fürs Ablegen wäre es
 * fatal: Wer das Fenster schließt, während das letzte Bild läuft, fände es
 * danach nie im Ordner.
 *
 * Deshalb wird hier über ALLE geholten Aufträge gelesen, und das Merkmal ist
 * die Marke `abgelegt` am Auftrag selbst — nicht die Erinnerung des Wächters.
 */
export function zuAblegen(jobs: AblageJob[]): AblageAuftrag[] {
  const raus: AblageAuftrag[] = []
  for (const j of jobs) {
    if (j.status !== 'done') continue
    const meta = j.scene_meta
    if (!meta) continue
    if (meta.abgelegt === true) continue
    if (!istZiel(meta.ablage)) continue
    const pfade = (j.result_paths ?? []).filter(p => typeof p === 'string' && p.length > 0)
    if (pfade.length === 0) continue
    raus.push({ jobId: j.id, pfade, ziel: meta.ablage })
  }
  return raus
}

/**
 * Die Marke, die einen Auftrag als abgelegt kennzeichnet.
 *
 * WARUM GEMISCHT UND NICHT ERSETZT: `scene_meta` trägt die ganze Szene — Licht,
 * Kamera, Bausteine, die Kettenkennung. Wer hier `{ abgelegt: true }` schreibt,
 * löscht das alles. Der Lichttisch und die Warteschlange lesen daraus.
 */
export function abgelegtMarke(
  meta: Record<string, unknown> | null,
): Record<string, unknown> {
  return { ...(meta ?? {}), abgelegt: true }
}

/** Ein Satz für die Meldung — nennt Ordner und Zahl, nicht nur „fertig". */
export function ablageMeldung(auftraege: AblageAuftrag[]): string | null {
  if (auftraege.length === 0) return null
  const bilder = auftraege.reduce((n, a) => n + a.pfade.length, 0)
  const ordner = new Set(auftraege.map(a => `${a.ziel.parentName} › ${a.ziel.variantName}`))
  const wohin = ordner.size === 1
    ? [...ordner][0]
    : `${ordner.size} Ordner`
  return bilder === 1
    ? `Ein Bild wurde bei ${wohin} abgelegt.`
    : `${bilder} Bilder wurden bei ${wohin} abgelegt.`
}
