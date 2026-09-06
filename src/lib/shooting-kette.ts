import { SHOOTING_SPOTS, type ShootingSpot, type SpotKey } from '@/lib/shooting-spots'
import type { ShotTypeKey } from '@/lib/scene-builder-options'
import { buildPrompt, type Scene } from '@/lib/szene-prompt'
import {
  gruppenKonstellation, gruppenKontinuitaet, gruppenGroesseJePlatz,
  bausteinFuerGruppe,
} from '@/lib/gruppen-shooting'
import type { Outfit } from '@/hooks/use-outfits'

/**
 * Die Shooting-Kette (PROJ-75) — ein ganzes Shooting an einem Ort.
 *
 * MARKS IDEE, wörtlich: „Charakter X hat ein Shooting an diesem Strand. Dann
 * nimmt man das als Referenzbild und es kommen vier Bilder raus an diesem
 * Strand fotografiert, aber an diesen verschiedenen Orten eben … dass ein
 * Shooting praktisch zum nächsten Spot weitergeht, dort noch mal ein Foto
 * macht und so weiter. Also ein ganzes Shooting simulieren."
 *
 * WARUM DAS DIE ALTE KETTE WIEDERBELEBT: PROJ-44 baute genau diesen Motor —
 * N Aufträge aus einer Szene, gemeinsame `reihe_id` — und wurde zurückgestellt
 * mit dem Vermerk „Achse falsch, Motor bleibt". Die Achse war damals die
 * Einstellungsgröße, also Filmschnitt. Marks Achse ist der ORT, und die trägt:
 * gleicher Mensch, gleiches Licht, gleiches Outfit, vier Plätze — das IST ein
 * Shooting.
 *
 * Die alte Achse ist nicht verworfen, sondern eingebaut: Jeder Platz bekommt
 * die Einstellungsgröße, die zu ihm passt (siehe PAARUNG).
 */

/**
 * PAARUNG VON PLATZ UND EINSTELLUNGSGRÖSSE.
 *
 * Vier gleichwertige Bilder sehen aus wie vier Versuche. Mit wechselnder
 * Einstellungsgröße sieht die Serie aus wie geschnitten — und die Größe folgt
 * dabei nicht dem Zufall, sondern dem Platz:
 *
 *   weit       → die Weite IST das Motiv, also die weiteste Einstellung
 *   tiefe      → die Fluchtlinie braucht Umgebung, sonst sieht man sie nicht
 *   flaeche    → eine Materialfläche trägt nur nah, sonst ist sie eine Wand
 *   gegenlicht → Kontur braucht die ganze Figur
 */
const GROESSE_JE_PLATZ: Record<SpotKey, ShotTypeKey> = {
  weit:       'wide_shot',
  tiefe:      'environmental_portrait',
  flaeche:    'portrait',
  gegenlicht: 'full_body',
}

/**
 * EINE HALTUNG JE PLATZ.
 *
 * Ohne das steht dieselbe Pose viermal an vier Orten — der sicherste Weg, aus
 * einem Shooting einen Katalog zu machen. Die Haltungen sind bewusst schlicht
 * gehalten: Sie sollen die Person bewegen, nicht die Szene übernehmen, die im
 * Scene Builder schon steht.
 */
const HALTUNG_JE_PLATZ: Record<SpotKey, string> = {
  weit:       'standing still, weight on one leg, looking off to the side, ' +
              'arms relaxed — small in the frame, letting the place speak',
  tiefe:      'standing in the line of the perspective, one shoulder turned ' +
              'toward the camera, head following, as if just stopped walking',
  flaeche:    'close to the surface behind, leaning back against it lightly, ' +
              'chin slightly raised, looking straight into the lens',
  gegenlicht: 'standing upright and centred against the light, arms away from ' +
              'the body so the outline reads clearly, face turned into the frame',
}

/** Der Übergang zwischen zwei Plätzen — Marks „Weg dazwischen". */
const UEBERGANG = {
  key: 'uebergang' as const,
  label: 'Übergang',
  shot_type: 'three_quarter' as ShotTypeKey,
  baustein:
    'The walk between two of these spots, caught in passing: the location ' +
    'opens up along the way, neither spot fully in frame. This is the ' +
    'in-between moment of a shoot, not a posed picture.',
  haltung:
    'mid-stride, half turned away from the camera and glancing back over the ' +
    'shoulder, unposed, as if the shutter caught a moment nobody set up',
}

export type ShootingSchritt = {
  /** Kennung des Platzes, oder 'uebergang'. Wandert in `scene_meta`. */
  key: SpotKey | 'uebergang'
  label: string
  shot_type: ShotTypeKey
  nr: number
  gesamt: number
  /** Welches Outfit dieser Schritt trägt — für die Referenzbilder. */
  outfit: Outfit | null
  prompt: string
}

export type KettenOptionen = {
  /**
   * Der Übergang zwischen Platz 2 und 3. Marks Idee: „ein fünftes Bild
   * zwischen zwei Plätzen macht aus vier Bildern eine Geschichte."
   */
  mitUebergang: boolean
  /**
   * Zweites Outfit ab dem Platz NACH dem Übergang. Manche Shootings wechseln
   * nach der Hälfte; null heißt, es bleibt bei einem.
   */
  zweitesOutfit: Outfit | null
  /**
   * Personenzahl, wenn der „Charakter" eine Gruppe ist (PROJ-84). null heißt
   * ein Mensch — dann bleibt alles wie zuvor.
   *
   * Ist sie gesetzt, tritt an die Stelle der Haltung eine Konstellation, und
   * ein zweites Outfit wird NICHT angewendet: Bei einer Gruppe kommt die
   * Kleidung aus dem Referenzblatt. Ein Outfit-Baustein zöge allen fünfen
   * dasselbe Hemd an.
   */
  gruppe: number | null
}

export const KETTE_VORGABE: KettenOptionen = {
  mitUebergang: true,
  zweitesOutfit: null,
  gruppe: null,
}

/**
 * WAS ALLE SCHRITTE ZUSAMMENHÄLT.
 *
 * Ohne diesen Block sind es vier Bilder an einem Ort. Mit ihm ist es ein
 * Shooting: derselbe Tag, dasselbe Licht, dieselbe Person. Das Modell sieht
 * die vier Aufträge NICHT nebeneinander — jeder läuft für sich —, also muss
 * die Kontinuität in jedem einzelnen Prompt stehen.
 */
function kontinuitaet(nr: number, gesamt: number, outfitWechsel: boolean): string {
  return [
    `CONTINUITY — this is picture ${nr} of ${gesamt} from ONE photo shoot.`,
    'Same person, same day, same weather and the same quality of light in ' +
    'every picture of the series. Only the spot within the location, the ' +
    'framing and the pose change.',
    outfitWechsel
      ? 'The outfit changes here: this is after the wardrobe change, later the ' +
        'same day.'
      : 'The outfit stays exactly the same throughout.',
  ].join('\n')
}

/** Baut den Prompt eines einzelnen Schrittes. */
function schrittPrompt(
  scene: Scene, shotType: ShotTypeKey, haltung: string, ortsBaustein: string,
  nr: number, gesamt: number, outfitWechsel: boolean,
  key: SpotKey | 'uebergang', gruppe: number | null,
): string {
  /*
    DREI DINGE MUESSEN FUER EINE GRUPPE AUS DER SZENE HERAUS, BEVOR DER
    BASISPROMPT GEBAUT WIRD.

    `buildPrompt` weiss nichts von Gruppen. Es schreibt aus der Szene heraus
    Saetze, die bei einem Menschen richtig sind und bei fuenfen den ganzen
    Konstellationsblock aushebeln — und zwar VOR ihm, also an der staerkeren
    Stelle:

      outfit     → „Use the provided outfit reference." Das Bild dazu wird bei
                   Gruppen gar nicht mitgeschickt (die Kleidung steht im Blatt).
                   Das Modell suchte sich das gemeinte Bild dann unter dem, was
                   da ist — und da ist nur das Gruppenblatt. Wahrscheinlichste
                   Folge: alle tragen die Kleidung EINER Person daraus.
      pose       → „The character is in a X pose." Eine Einzelpose fuer alle,
                   kurz und konkret, und damit leichter zu befolgen als fuenf
                   ausformulierte Haltungen. Genau das Klassenfoto.
      expression → derselbe Gesichtsausdruck fuer alle. Milder als die Pose,
                   aber aus demselben Grund falsch.

    Beim Erstbau stand nur die Haltung unter Verschluss; diese drei liefen
    durch die andere Tuer wieder herein.
  */
  const fuerBasis = gruppe !== null
    // `character` faellt mit heraus: Es erzeugt nur „Use the provided character
    // reference." — Einzahl, und im Prompt VOR der Konstellation. Wofuer das
    // Blatt da ist, sagt die Zuordnungszeile ohnehin genauer, als dieser Satz
    // es koennte.
    ? { ...scene, shot_type: shotType, outfit: null, pose: null, expression: null, character: null }
    : { ...scene, shot_type: shotType }

  // Die Szene liefert Licht, Wetter, Kamera, Stil und die Bausteine. Die
  // Einstellungsgröße wird je Schritt überschrieben — genau wie bei der alten
  // Einstellungsreihe, aus demselben Grund: sie steckt als Textbaustein im
  // Prompt und kann nicht über `variants` variiert werden.
  const basis = buildPrompt(fuerBasis)

  // BEI EINER GRUPPE TRITT DIE KONSTELLATION AN DIE STELLE DER HALTUNG — nicht
  // zusätzlich zu ihr. Beides nebeneinander hieße „alle fünf stehen mit dem
  // Gewicht auf einem Bein" UND „jeder steht anders": zwei gegenläufige
  // Anweisungen im selben Prompt, und die Konstellation verlöre.
  const koerper = gruppe !== null
    ? gruppenKonstellation(key, gruppe)
    : ['POSE', `The subject is ${haltung}.`].join('\n')

  /*
    DIE ANZAHL GANZ NACH VORN.

    Bis zum Konstellationsblock sind acht bis zehn Saetze durchgelaufen, die
    alle in der Einzahl sprechen — „the subject", „character reference". Die
    ersten Zeilen bestimmen die Gesamtkomposition am staerksten, und die
    Personenzahl ist die fragilste Eigenschaft ueberhaupt. Sie erst am Ende zu
    nennen heisst, gegen den eigenen Promptanfang anzuschreiben.
  */
  return [
    ...(gruppe !== null
      ? [
          `A GROUP PHOTOGRAPH OF ${gruppe} PEOPLE — all ${gruppe} of them fully in the frame.`,
          'Use the provided group sheet as the reference for who these people are.',
          '',
        ]
      : []),
    basis,
    '',
    'SHOOTING SPOT AT THIS LOCATION',
    gruppe !== null ? bausteinFuerGruppe(ortsBaustein) : ortsBaustein,
    '',
    koerper,
    '',
    gruppe !== null
      ? gruppenKontinuitaet(nr, gesamt, gruppe)
      : kontinuitaet(nr, gesamt, outfitWechsel),
  ].join('\n')
}

/**
 * Baut die ganze Kette.
 *
 * Reihenfolge ist Absicht: weit → mit Tiefe → (Übergang) → Fläche →
 * Gegenlicht. Das ist der Bogen eines echten Shootings — erst der Ort, dann
 * hinein, dann nah, zuletzt das Licht.
 */
export function baueShooting(
  scene: Scene,
  optionen: KettenOptionen = KETTE_VORGABE,
  spots: ShootingSpot[] = SHOOTING_SPOTS,
): ShootingSchritt[] {
  const vorher = spots.slice(0, 2)
  const nachher = spots.slice(2)
  const gesamt = spots.length + (optionen.mitUebergang ? 1 : 0)

  /*
    BEI EINER GRUPPE GIBT ES KEINEN OUTFITWECHSEL.

    Die Kleidung einer Gruppe steht im Referenzblatt, eine Person je Garnitur.
    Ein zweites Outfit ist EIN Kleidungsstueck — es wuerde allen dasselbe
    anziehen und damit genau die Zuordnung zerstoeren, fuer die das Blatt
    gebaut wurde. Wer eine Gruppe umziehen will, braucht ein zweites Blatt.

    Der Knopf blendet die Auswahl bei Gruppen aus; hier steht sie trotzdem,
    damit sie auch dann nicht durchkommt, wenn ein Aufrufer sie doch setzt.
  */
  const zweitesOutfit = optionen.gruppe !== null ? null : optionen.zweitesOutfit

  const schritte: Omit<ShootingSchritt, 'nr' | 'gesamt' | 'prompt'>[] = []

  for (const spot of vorher) {
    schritte.push({
      key: spot.key, label: spot.label,
      shot_type: GROESSE_JE_PLATZ[spot.key],
      outfit: scene.outfit,
    })
  }

  if (optionen.mitUebergang) {
    schritte.push({
      key: UEBERGANG.key, label: UEBERGANG.label,
      shot_type: UEBERGANG.shot_type,
      // Der Übergang trägt noch das erste Outfit — er ist der Weg DORTHIN,
      // nicht die Zeit danach.
      outfit: scene.outfit,
    })
  }

  for (const spot of nachher) {
    schritte.push({
      key: spot.key, label: spot.label,
      shot_type: GROESSE_JE_PLATZ[spot.key],
      outfit: zweitesOutfit ?? scene.outfit,
    })
  }

  return schritte.map((s, i) => {
    const nr = i + 1
    const wechsel = !!zweitesOutfit && s.outfit === zweitesOutfit
    const baustein = s.key === 'uebergang'
      ? UEBERGANG.baustein
      : spots.find(sp => sp.key === s.key)!.baustein
    const haltung = s.key === 'uebergang'
      ? UEBERGANG.haltung
      : HALTUNG_JE_PLATZ[s.key as SpotKey]

    /*
      BEI EINER GRUPPE KANN DIE EINSTELLUNGSGROESSE EINE ANDERE SEIN.

      An der Flaeche nimmt die Einzelkette `portrait` — „from chest up". Das
      passt zu einem Menschen an einer Wand und ist bei einer Gruppe
      unerfuellbar, weil dort jemand am Boden sitzt. Kein Ausschnitt erfuellt
      beides.
    */
    const groesse = (optionen.gruppe !== null
      ? gruppenGroesseJePlatz(s.key, optionen.gruppe)
      : null) ?? s.shot_type

    return {
      ...s,
      shot_type: groesse,
      nr,
      gesamt,
      prompt: schrittPrompt(
        { ...scene, outfit: s.outfit },
        groesse, haltung, baustein, nr, gesamt, wechsel,
        s.key, optionen.gruppe,
      ),
    }
  })
}

/** Ein Satz für den Knopf — keine Zahl ohne Einheit. */
export function kettenAnsage(anzahl: number): string {
  return anzahl === 1
    ? 'Ein Bild wird erzeugt.'
    : `${anzahl} Bilder werden erzeugt — ein ganzes Shooting.`
}
