/**
 * Die Einstellungsreihe (PROJ-44) — die Regeln, ohne Oberfläche.
 *
 * Mark baut heute jede Einstellung einzeln. Was fehlt, ist die SEQUENZ:
 * mehrere Einstellungen desselben Moments — gleicher Charakter, gleiche
 * Location, gleiches Licht, gleiches Outfit — bei denen sich NUR die
 * Einstellungsgröße ändert.
 *
 * Der ganze Punkt ist die Kontinuität. Deshalb wird hier die Szene NICHT neu
 * gebaut, sondern eine einzige Angabe ausgetauscht: `shot_type`. Kamerahöhe,
 * Objektiv, Tiefenschärfe, Licht, Format und alle Bausteine bleiben, wie sie
 * sind. Alles andere anzufassen wäre genau der Fehler, den dieses Feature
 * verhindern soll.
 *
 * Absichtlich frei von React und Supabase — nach dem Vorbild von
 * `referenzkette.ts`: Reihenfolge und Prompt-Bau sind die Stellen, an denen
 * ein Fehler teuer wäre (jede Einstellung ist eine bezahlte Erzeugung), und
 * nur als reine Funktionen sind sie ohne Anmeldung prüfbar.
 */
import { SHOT_TYPES, type ShotTypeKey } from '@/lib/scene-builder-options'
import { buildPrompt, type Scene } from '@/lib/szene-prompt'

/**
 * Die Einstellungsgrößen in FILMISCHER Reihenfolge: weit → nah.
 *
 * Abgeleitet aus `SHOT_TYPES`, das von nah nach weit sortiert ist — bewusst
 * abgeleitet und nicht abgeschrieben: Eine zweite, von Hand gepflegte Liste
 * derselben zehn Schlüssel liefe irgendwann auseinander, und zwar lautlos.
 * Kommt eine Einstellungsgröße dazu, ist sie hier automatisch dabei.
 *
 * Die Reihenfolge ist NICHT die Klickreihenfolge. Wer im Schnitt denkt, legt
 * die Totale nach vorn und arbeitet sich hinein; genau so soll die Reihe in
 * der Warteschlange stehen.
 */
export const REIHEN_ORDNUNG: ShotTypeKey[] = SHOT_TYPES.map(s => s.key).reverse()

/** Der Anzeigename einer Einstellungsgröße — aus derselben einen Quelle. */
export function einstellungLabel(key: ShotTypeKey): string {
  return SHOT_TYPES.find(s => s.key === key)?.label ?? key
}

/**
 * Was ohne Zutun angehakt ist: die fünf Größen, die Mark in der Spezifikation
 * selbst genannt hat — Totale, Halbtotale, Halbnah, Nah, Detail.
 *
 * Fünf und nicht zehn, weil ein Klick hier fünf bezahlte Erzeugungen auslöst.
 * Eine Vorbelegung, die zehn Bilder kostet, wäre eine teure Vorgabe für
 * jemanden, der den Knopf zum ersten Mal sieht.
 *
 * Die deutschen Namen dahinter sind Marks Sprache, die Schlüssel sind die des
 * Scene Builders — die beiden decken sich nicht eins zu eins. Die Spezifikation
 * bietet für „Halbtotale" `full_body` ODER `three_quarter` an; gewählt ist
 * `full_body` (Ganzfigur, Kopf bis Fuß). Das ist eine Stufe WEITER als die
 * eigentliche Halbtotale, die `three_quarter` wäre — bewusst so, weil die Reihe
 * dadurch gleichmäßiger von weit nach nah abstuft. Wer die engere Halbtotale
 * will, hakt `three_quarter` dazu an.
 */
export const REIHE_VORBELEGUNG: ShotTypeKey[] = [
  'establishing_shot', // Totale (die ganze Szene)
  'full_body',         // Ganzfigur, Kopf bis Fuß — Marks „Halbtotale"
  'half_body',         // Halbnah
  'closeup',           // Nah
  'extreme_closeup',   // Detail
]

/** Eine einzelne Einstellung der Reihe — fertig zum Einreihen. */
export type Einstellung = {
  shot_type: ShotTypeKey
  /** Anzeigename, wie im Scene Builder. */
  label: string
  /** 1-basiert, in filmischer Reihenfolge. */
  nr: number
  /** Wie viele Einstellungen die Reihe insgesamt hat. */
  gesamt: number
  /** Der Prompt dieser einen Einstellung. */
  prompt: string
}

/**
 * Auswahl in Reihenfolge bringen: doppelte raus, unbekannte raus, filmisch
 * sortiert.
 *
 * Die Oberfläche liefert die Auswahl in der Reihenfolge, in der geklickt
 * wurde. Ungeprüft übernommen stünde eine Reihe in der Warteschlange, deren
 * Nummerierung mit dem Bildinhalt nichts zu tun hat.
 */
export function sortiereEinstellungen(keys: ShotTypeKey[]): ShotTypeKey[] {
  return REIHEN_ORDNUNG.filter(k => keys.includes(k))
}

/**
 * Die fertige Reihe aus einer Szene.
 *
 * Je gewählter Einstellungsgröße geht DIESELBE Szene mit ausgetauschtem
 * `shot_type` durch `buildPrompt`. Nichts anderes wird verändert.
 */
export function baueReihe(scene: Scene, keys: ShotTypeKey[]): Einstellung[] {
  const sortiert = sortiereEinstellungen(keys)
  return sortiert.map((shot_type, i) => ({
    shot_type,
    label:  einstellungLabel(shot_type),
    nr:     i + 1,
    gesamt: sortiert.length,
    prompt: buildPrompt({ ...scene, shot_type }),
  }))
}

/**
 * Die Kennung, die jede Einstellung in `scene_meta` mitbekommt.
 *
 * WAS AUF DIESEM WEG WIRKLICH IN `basis` STEHT (nachgemessen, nicht vermutet):
 * die flachen Felder eines `ScenePresetConfig` — `scene_type`, `time_of_day`,
 * `season`, `weather`, die vier `light_*`, `shot_type`, `camera_angle`, `lens`,
 * `depth_of_field`, `aspect_ratio`, `background`, die acht `*_id` und `refs` —
 * plus `name`, den der Auftragsknopf für den Dateinamen beim Download anhängt.
 * `scene-builder/page.tsx` baut das mit `buildPresetConfigFromScene()`.
 *
 * NICHT dabei sind `herkunft` und `schritt`. `herkunft` setzen andere Wege
 * (freie Erzeugung, Prompt-Dialog, Vergrößerung); `schritt` kommt in `src/`
 * überhaupt nicht als `scene_meta`-Feld vor — die Referenzkette nennt so nur
 * eine eigene Zustandsangabe.
 *
 * `scene_meta` ist `jsonb`, drei weitere Felder kosten also keine
 * Schemaänderung. `shot_type` steht in `basis` schon (aus der Szene) und wird
 * hier bewusst ÜBERSCHRIEBEN — sonst trüge jede Einstellung der Reihe die
 * Größe der Ausgangsszene statt ihre eigene. Der Lichttisch zeigt die Reihe
 * vorerst NICHT gruppiert; ohne die Kennung wäre das später aber gar nicht
 * mehr möglich, und sie jetzt mitzuschreiben ist umsonst.
 *
 * `reihe_id` kommt von außen (eine `crypto.randomUUID()` je Reihe), damit
 * diese Funktion rein bleibt und im Test vorhersagbar ist.
 */
export function reiheMeta(
  basis: Record<string, unknown>,
  reiheId: string,
  einstellung: Einstellung,
): Record<string, unknown> {
  return {
    ...basis,
    // Die Einstellungsgröße gehört auch inhaltlich in die Szene: Ohne sie
    // stünde in der Ablage zehnmal dieselbe Szenenbeschreibung.
    shot_type:     einstellung.shot_type,
    reihe_id:      reiheId,
    reihe_nr:      einstellung.nr,
    reihe_gesamt:  einstellung.gesamt,
  }
}

/**
 * Was auf dem Knopf steht, BEVOR geklickt wird.
 *
 * Ein Klick kann bis zu zehn bezahlte Erzeugungen auslösen. Ein Knopf, der
 * einen Schritt nennt und mehrere startet, steht in diesem Projekt bereits
 * als offener Befund — deshalb ist die Zahl Teil der Logik und nicht nur
 * Beiwerk im Text.
 */
export function reihenAnsage(anzahl: number): string {
  if (anzahl === 0) return 'Keine Einstellung gewählt'
  if (anzahl === 1) return '1 Einstellung = 1 Bild'
  return `${anzahl} Einstellungen = ${anzahl} Bilder`
}
