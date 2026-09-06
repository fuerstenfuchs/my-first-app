import type { SpotKey } from '@/lib/shooting-spots'
import type { ShotTypeKey } from '@/lib/scene-builder-options'
import { platzImBild } from '@/lib/gruppen-referenz'
import type { Character } from '@/hooks/use-characters'

/**
 * Die Gruppen-Shooting-Kette (PROJ-84).
 *
 * MARKS AUFTRAG, wörtlich: „Ja, die Kette kannst du bauen. Also es soll auf
 * einem Bild natürlich jeder etwas anders stehen und teilweise sitzen, je
 * nachdem."
 *
 * WAS DIE EINZELKETTE HIER FALSCH MACHT: Sie schreibt eine Haltung in den
 * Prompt — „standing still, weight on one leg". Bei einem Menschen ist das die
 * Pose. Bei fünfen ist es ein Befehl an alle fünf, dasselbe zu tun, und heraus
 * kommt eine Reihe gleicher Leute: ein Klassenfoto.
 *
 * Die Gruppe braucht deshalb nicht EINE Haltung, sondern eine KONSTELLATION —
 * wie die Leute zueinander stehen — und darin je Person eine eigene Haltung.
 *
 * DIE LINKS-RECHTS-ORDNUNG BLEIBT DIE DES BLATTES. Das ist der Angelpunkt der
 * ganzen Datei: Auf dem Gruppenblatt steht Person 1 links, Person 5 rechts.
 * Bliebe diese Ordnung im Shooting nicht erhalten, müsste das Modell für jedes
 * Bild neu erraten, wer wer ist — und genau das war der Fehler, den das Blatt
 * abgeschafft hat. Die Tiefe entsteht deshalb NACH VORN UND HINTEN, nicht durch
 * Vertauschen.
 *
 * SPRACHREGELN, die aus zwei unabhängigen Prüfungen am 06.09.2026 stammen und
 * die jede Zeile hier befolgt:
 *
 *  - KEIN MALBARES SUBSTANTIV IN EINEM VERBOT. „Do not turn the group into a
 *    fence across the landscape" liefert dem Modell das Wort „fence" mit einem
 *    schwachen Nein davor. Positiv sagen, was sein soll.
 *  - KEINE BEGRÜNDUNGEN. „…or the group collapses into one black shape" ist an
 *    einen Menschen gerichtet; das Modell liest daraus nur „black shape".
 *  - KEINE GLOBALE REGEL, wo eine Personenzeile es auch sagen kann. Die
 *    PERSON-Zeilen binden am stärksten, allgemeine Sätze am schwächsten.
 *    Deshalb steht die Aufgabe jeder Hand in ihrer eigenen Haltung.
 *  - KEIN „COUNT THEM". Ein Bildmodell zählt nicht, es zeichnet. Und
 *    „not six, not four" setzt genau die falschen Zahlwörter neben das Wort
 *    „people".
 */

export const GRUPPE_TAG = 'gruppe'

/**
 * Mehr Personen kann ein Blatt nicht tragen (`GRUPPE_MAX` in
 * `gruppen-referenz.ts`), und mehr Haltungen hält diese Datei nicht vor.
 */
export const GRUPPE_HALTUNGEN_MAX = 5

export function istGruppe(c: Character | null | undefined): boolean {
  return Array.isArray(c?.tags) && c.tags.includes(GRUPPE_TAG)
}

/**
 * Wie viele Menschen die Gruppe hat — oder null, wenn es sich nicht sagen lässt.
 *
 * ZWEI QUELLEN, WEIL ES SCHON GRUPPEN GIBT. Seit PROJ-84 steht die Zahl in
 * `metadata`. Marks bereits angelegte Gruppen tragen sie nicht — die heißen
 * aber „Anna + Ben + Carla", und daraus ist sie ablesbar. Ohne den zweiten Weg
 * wären genau die Gruppen ausgeschlossen, für die das hier gebaut wurde.
 *
 * Null ist eine ehrliche Antwort, kein Fehler: Wer nicht zählen kann, kann
 * keine Haltungen verteilen. Die Kette fällt dann auf den Einzelweg zurück.
 *
 * ÜBER FÜNF WIRD GEDECKELT, NICHT ABGELEHNT. Ein Blatt mit sechs Personen kann
 * über die Oberfläche gar nicht entstehen; käme die Zahl trotzdem herein, wäre
 * sie beschädigt. Ein Rest-Umlauf (`i % laenge`) wäre der schlechtere Ausweg:
 * Person 6 bekäme wortgleich die Haltung von Person 1, und weil die Listen am
 * Umbruch nicht mehr abwechseln, stünden zwei Nachbarn auf gleicher Höhe —
 * genau das Klassenfoto, gegen das diese Datei geschrieben ist.
 */
export function gruppenGroesse(c: Character | null | undefined): number | null {
  if (!istGruppe(c)) return null
  const meta = c?.metadata as { gruppe?: { anzahl?: unknown } } | null | undefined
  const gespeichert = meta?.gruppe?.anzahl
  if (typeof gespeichert === 'number' && Number.isInteger(gespeichert) && gespeichert >= 2) {
    return Math.min(gespeichert, GRUPPE_HALTUNGEN_MAX)
  }
  const ausName = (c?.name ?? '').split('+').map(t => t.trim()).filter(t => t.length > 0)
  return ausName.length >= 2 ? Math.min(ausName.length, GRUPPE_HALTUNGEN_MAX) : null
}

/** Ausgeschriebene Zahlwörter — Ziffern werden bei Mengenangaben schwächer befolgt. */
const ZAHLWORT: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' }

function zahlwort(n: number): string {
  return ZAHLWORT[n] ?? String(n)
}

export type Hoehe = 'hoch' | 'mittel' | 'tief'
export type Haltung = { text: string; hoehe: Hoehe }

/**
 * DIE HALTUNGEN JE PLATZ, IN DER REIHENFOLGE DER PERSONEN.
 *
 * Person 1 bekommt die erste, Person 2 die zweite und so fort. Die Reihenfolge
 * ist nicht beliebig: Benachbarte Höhen sind IMMER verschieden. Zwei Köpfe auf
 * gleicher Höhe nebeneinander sind der Grund, warum Gruppenbilder wie eine
 * Belegschaftsaufnahme aussehen — und weil jeder Anfang dieser Listen
 * abwechselt, stimmt es bei zwei Personen genauso wie bei fünf.
 *
 * Das ist zugleich Marks „teils sitzend": Das Sitzen ist hier kein Einfall,
 * sondern das Mittel, mit dem die Höhen auseinandergehen.
 *
 * JEDE HALTUNG NENNT IHRE HÄNDE. Freie Hände sind bei Bildmodellen die
 * zuverlässigste Fehlerquelle. Ein allgemeiner Satz am Ende („every hand has
 * something to do") deckt das nicht: Er bindet schwächer als die Personenzeile
 * und müsste Haltungen abdecken, in denen gar keine Hand vorkommt.
 */
export const HALTUNGEN: Record<SpotKey | 'uebergang', Haltung[]> = {
  weit: [
    { hoehe: 'hoch',   text: 'standing upright, hands loose at the sides, looking out across the landscape' },
    { hoehe: 'tief',   text: 'crouched down on the heels, forearms on the knees and the hands hanging loose between them, looking out the same way' },
    { hoehe: 'mittel', text: 'standing with the weight on one leg, one hand in a pocket and the other loose at the side, head turned toward the others' },
    { hoehe: 'hoch',   text: 'standing half a step further back, arms folded across the chest, facing the camera' },
    { hoehe: 'tief',   text: 'sitting on the ground, one knee drawn up, both hands resting on that knee' },
  ],
  tiefe: [
    { hoehe: 'hoch',   text: 'nearest to the camera and largest, one shoulder turned toward the lens, hands loose at the sides' },
    { hoehe: 'tief',   text: 'further back and smaller, crouched down at the edge of that line, forearms on the knees and the hands hanging free, looking along it' },
    { hoehe: 'mittel', text: 'further back again, one shoulder leaned against the wall, railing or edge that runs along that line, one hand in a pocket, feet crossed at the ankles' },
    { hoehe: 'hoch',   text: 'further back still, standing upright and clearly smaller, facing the camera, arms folded across the chest' },
    { hoehe: 'mittel', text: 'furthest back of all, half-seated on something low, both hands braced on the thighs' },
  ],
  flaeche: [
    { hoehe: 'tief',   text: 'sitting on the ground just in front of the surface, one knee drawn up, a forearm across that knee and the other hand flat on the ground' },
    { hoehe: 'hoch',   text: 'standing with the shoulders back against the surface, both hands behind the back' },
    { hoehe: 'mittel', text: 'down on one knee in front of the surface, one forearm across the raised knee and the other hand on the thigh, shoulder almost touching the person standing alongside' },
    { hoehe: 'hoch',   text: 'standing against the surface as well, one shoulder leaned into it, arms folded across the chest' },
    { hoehe: 'mittel', text: 'half-sitting on something low in front of the surface, both hands flat on the thighs' },
  ],
  gegenlicht: [
    { hoehe: 'hoch',   text: 'standing upright with both arms held clear of the body and the hands open at the sides, so the outline reads' },
    { hoehe: 'tief',   text: 'crouched low, forearms on the knees and the hands hanging free, set well clear of the person alongside' },
    { hoehe: 'hoch',   text: 'standing with one arm raised to shade the eyes and the other hand hanging free' },
    { hoehe: 'mittel', text: 'standing half turned away, one hand in a pocket and the other arm clear of the body, shoulders in profile so the silhouette narrows' },
    { hoehe: 'hoch',   text: 'standing furthest into the light, feet apart, both hands held away from the hips' },
  ],
  uebergang: [
    { hoehe: 'mittel', text: 'a few steps ahead of the rest, half turned back over the shoulder, one hand in a jacket pocket' },
    { hoehe: 'hoch',   text: 'mid-stride, looking across at the person alongside, one hand raised in the middle of a sentence' },
    { hoehe: 'mittel', text: 'walking with both hands in the pockets, head down, a step behind' },
    { hoehe: 'hoch',   text: 'mid-stride and laughing, one arm swinging out and the other hand loose' },
    { hoehe: 'mittel', text: 'furthest behind, just stepping off, both arms swinging with the walk, eyes on the others ahead' },
  ],
}

/**
 * EINSTELLUNGSGRÖSSEN FÜR GRUPPEN — sie sind NICHT dieselben wie bei einem
 * Menschen. `null` heißt: die Größe der Einzelkette trägt auch hier.
 *
 * DER FALL, DER DIESE TABELLE ERZWUNGEN HAT: Die Einzelkette nimmt an der
 * Fläche `portrait`, und das heißt im Prompt wörtlich „portrait framing from
 * chest up". Bei einem Menschen an einer Wand ist das genau richtig. Bei einer
 * Gruppe sitzt Person 1 am Boden und Person 3 auf einem Knie — und es gibt
 * KEINEN Bildausschnitt, der „ab Brust" und „jemand sitzt am Boden" zugleich
 * erfüllt. Entweder fehlen zwei Personen in einem Bild, das ausdrücklich fünf
 * verlangt, oder die bestellte Einstellungsgröße stimmt nicht. Beides macht das
 * Bild für die Serie unbrauchbar, und beides fällt erst am bezahlten Ergebnis
 * auf.
 *
 * Auch der Übergang wächst: Verschiedene Schrittphasen brauchen Beine und Füße,
 * „three quarter" schneidet sie ab.
 */
export function gruppenGroesseJePlatz(
  key: SpotKey | 'uebergang', n: number,
): ShotTypeKey | null {
  switch (key) {
    // Zwei überlappende Schultern gehen brustaufwärts; ab drei sitzt jemand.
    case 'flaeche':   return n === 2 ? 'half_body' : 'three_quarter'
    case 'uebergang': return 'full_body'
    default:          return null
  }
}

/**
 * WIE DIE LEUTE ZUEINANDER STEHEN — je Platz, und bei manchen nach Anzahl.
 *
 * Zwei Plätze kippen bei Gruppen, wenn man sie so lässt, wie sie für einen
 * Menschen gedacht waren:
 *
 *  - GEGENLICHT lebt von der Kontur. Fünf Umrisse Schulter an Schulter
 *    verschmelzen. Deshalb steht hier, dass zwischen je zwei Personen ein
 *    Streifen hellen Hintergrunds sichtbar bleibt.
 *  - DER ÜBERGANG lebt davon, unposiert zu wirken. Fünf Leute nebeneinander im
 *    Gleichschritt sind das Gegenteil. Deshalb: lose Diagonale, verschiedene
 *    Schrittphasen.
 *
 * Und die Tiefe ist DIAGONAL, nicht hintereinander: Eine Kolonne entlang der
 * Fluchtlinie stünde nicht mehr links nach rechts, und damit wäre die Zuordnung
 * zum Blatt hin. Die Diagonale hat beides — Tiefe und Ordnung.
 */
function formation(key: SpotKey | 'uebergang', n: number): string[] {
  switch (key) {
    case 'weit':
      return [
        'The group stands together in the wide view, small in the frame, gathered as ONE cluster: some a step nearer the camera, some a step further back, so the cluster has depth.',
        ...(n >= 4 ? ['The whole group stays in one tight cluster, together filling less than a third of the width of the frame.'] : []),
      ]
    case 'tiefe':
      return [
        'The receding line of the perspective runs DIAGONALLY through the group: the leftmost person nearest to the camera and largest, each following person a little further back and a little smaller, the rightmost furthest away. Left to right stays left to right; only the distance from the camera changes.',
      ]
    case 'flaeche':
      if (n === 2) {
        return ['Both are close to the surface behind them, their shoulders overlapping, near enough that the two of them read as one shape against it.']
      }
      if (n === 3) {
        return ['A triangle against the surface: one low in front of it, two standing behind and slightly apart, their shoulders overlapping the lower one.']
      }
      return [
        'Two ranks: the standing rank has the surface at their backs, the lower rank is seated or kneeling just in front of them.',
        'Each standing person is set in the GAP between two of those in front, so that every face stays visible.',
      ]
    case 'gegenlicht':
      return [
        'Against the light the outline is everything. A hand width of bright background stays visible between every two people, from head to foot.',
        'They are staggered in depth as well, and every arm is held clear of the body beside it.',
      ]
    case 'uebergang':
      return n === 2
        ? ['Walking between two spots, caught in passing: one half a step ahead, turning back toward the other.']
        : [
            'Walking between two spots, caught in passing. NOT abreast: a loose diagonal, every person in a different phase of the stride.',
            'Every gaze goes somewhere in the scene — at each other, at the ground, ahead along the way.',
          ]
  }
}

/**
 * WAS DIE GRUPPE ZUSAMMENHÄLT — und warum das im Gegenlicht anders lautet.
 *
 * Überall sonst gilt: Die Umrisse überlappen einander leicht. Ohne das stehen
 * fünf ausgeschnittene Leute nebeneinander statt einer Gruppe.
 *
 * IM GEGENLICHT IST GENAU DAS FALSCH. Dort steht drei Zeilen weiter oben, dass
 * zwischen je zwei Personen Licht hindurchmuss. „Überlappen" und „ein Spalt
 * dazwischen" sind zwei gegenläufige Anweisungen im selben Prompt — beim
 * Erstbau standen sie beide da, aufgefallen erst beim Lesen des fertig
 * zusammengesetzten Blocks.
 */
function zusammenhalt(key: SpotKey | 'uebergang'): string {
  return key === 'gegenlicht'
    ? 'They stand close enough to read as one group, yet never touching and never overlapping: the bright background shows between any two of them.'
    : 'The silhouettes overlap slightly where they meet, so the people read as one group and not as separate cut-outs standing near each other.'
}

/**
 * DER SCHUTZ GEGEN DAS BLATT IM BILD.
 *
 * Die Einzelplatten haben denselben Absatz („ONE PHOTOGRAPH, NOT A SHEET"), und
 * hier ist die Gefahr größer: Das mitgeschickte Referenzbild IST ein Blatt —
 * zwei Reihen auf hellgrauem Studiogrund —, und der Text darüber verweist auch
 * noch darauf. Ohne diesen Absatz liefert das Modell mit einiger
 * Wahrscheinlichkeit den grauen Grund oder die Zweiteilung gleich mit.
 */
const EIN_FOTO =
  'ONE PHOTOGRAPH TAKEN AT THIS LOCATION — not a sheet, not a grid, not rows, ' +
  'and no studio backdrop. The group sheet only says who these people are and ' +
  'what they wear; nothing of its plain grey background and none of its rows ' +
  'appears in this picture.'

/**
 * Der Konstellationsblock — er ersetzt bei Gruppen den POSE-Block der
 * Einzelkette.
 *
 * Die Regeln stehen bei JEDEM Platz, nicht einmal am Anfang der Kette: Die
 * Aufträge laufen einzeln, das Modell sieht die anderen Bilder nie. Was überall
 * gelten soll, muss überall dastehen.
 */
export function gruppenKonstellation(key: SpotKey | 'uebergang', n: number): string {
  const pool = HALTUNGEN[key]
  const zeilen = Array.from({ length: n }, (_, i) =>
    `PERSON ${i + 1} (${platzImBild(i, n)}) is ${pool[i].text}.`,
  )

  return [
    `GROUP OF ${zahlwort(n).toUpperCase()} — CONSTELLATION`,
    `A group photograph of ${zahlwort(n)} people: ${zahlwort(n)} faces, ${zahlwort(n)} bodies, and nobody else in the frame.`,
    'Left to right they stand in the SAME ORDER as on the group sheet: the ' +
    'person at the far left of the sheet stands at the far left here, the ' +
    'person at the far right stands at the far right. Only their distance from ' +
    'the camera differs.',
    ...formation(key, n),
    '',
    ...zeilen,
    '',
    'Beside every standing person there is someone lower — crouching, kneeling ' +
    'or seated. Two neighbours are never at the same height.',
    zusammenhalt(key),
    EIN_FOTO,
  ].join('\n')
}

/**
 * Die Zuordnungszeile für das Gruppenblatt.
 *
 * OHNE SIE FÄLLT DIE KETTE IN GENAU DEN FEHLER ZURÜCK, GEGEN DEN PROJ-78
 * GEBAUT WURDE. Die Standardzeile für ein Charakterbild lautet wörtlich
 * „CHARACTER — take the face, hair, skin tone and body identity of THIS PERSON"
 * — Einzahl, für ein Blatt mit bis zu fünf Menschen in zwei Reihen. Das Modell
 * müsste selbst erschließen, dass es ein Blatt ist, wie viele darauf stehen,
 * dass oben die Köpfe und unten die zugehörigen Körper sind und dass links nach
 * rechts die Nummerierung ist. Vier Schlüsse für eine stillschweigende
 * Verknüpfung — das hält nicht.
 *
 * „from left to right" ist mit Absicht allgemein: Es stimmt für alle drei
 * Blattaufbauten aus PROJ-81/82/83.
 */
export function gruppenBlattZuordnung(n: number): string {
  return (
    `THE GROUP SHEET — it shows all ${zahlwort(n)} people of this group and ` +
    'nobody else. Larger heads in the upper part, the matching bodies below, ' +
    'in one fixed order from left to right: the person at the far left of the ' +
    `sheet is PERSON 1, the next PERSON 2, and so on to PERSON ${n} at the far ` +
    'right. A head belongs to the body beneath it. Take from this sheet each ' +
    'face, hair, skin tone and build, and the clothes each of them wears there.'
  )
}

/**
 * DER VORRANGSATZ FÜR GRUPPEN — und warum der übliche hier gefährlich ist.
 *
 * Der Standardsatz sagt: „Wenn der Text die Person anders beschreibt, folge dem
 * Referenzbild und ignoriere die widersprechenden Worte." Für ein einzelnes
 * Porträt ist das richtig. Hier zeigt das Bild bis zu fünf Menschen aufrecht
 * nebeneinander, frontal, gleichmäßig ausgeleuchtet — und der Text darüber
 * verlangt kauern, sitzen, gestaffelt stehen. Der Standardsatz wiese das Modell
 * an, im Zweifel dem Blatt zu folgen, also der Reihe. Die ganze Konstellation
 * wäre damit ausgehebelt.
 *
 * Deshalb wird der Vorrang eingeengt: Das Blatt entscheidet WER und WAS AN, der
 * Text entscheidet WO und WIE.
 */
export const GRUPPEN_VORRANG =
  'Follow the group sheet for WHO each person is and WHAT they wear. Where ' +
  'they stand, how they stand, and how this picture is framed and lit come ' +
  'only from the text above, never from the sheet. Follow the location ' +
  'reference for the place itself.'

/**
 * Der Kontinuitätssatz für Gruppen.
 *
 * Er sagt bewusst „the same people" statt „the same person" und bindet die
 * Kleidung ans Blatt — bei einer Gruppe kommt sie von dort und nicht aus einem
 * Outfit-Baustein, der sonst allen fünfen dasselbe Hemd anzöge.
 */
export function gruppenKontinuitaet(nr: number, gesamt: number, n: number): string {
  return [
    `CONTINUITY — this is picture ${nr} of ${gesamt} from ONE photo shoot.`,
    `The same ${zahlwort(n)} people, the same day, the same weather and the ` +
    'same quality of light in every picture of the series. Only the spot ' +
    'within the location, the framing and the constellation change.',
    'Everyone keeps exactly the clothes they wear on the group sheet.',
  ].join('\n')
}

/**
 * Den Ortsbaustein von der Einzahl in die Mehrzahl setzen.
 *
 * DIE BAUSTEINE SIND FÜR EINEN MENSCHEN GESCHRIEBEN — und sie stehen im Prompt
 * VOR der Konstellation, also an der stärkeren Stelle: „the main light comes
 * from behind THE STANDING POSITION", „filling the frame behind THE STANDING
 * POSITION". Ein Punkt, an dem einer steht. Zwei Zeilen später stehen fünf
 * Leute, teils sitzend.
 *
 * Eine eigene Fassung aller Bausteine wäre eine zweite Wahrheit, die beim
 * nächsten Feilen am Ort auseinanderliefe. Deshalb wird nur die eine Wendung
 * ersetzt, die die Einzahl trägt.
 */
export function bausteinFuerGruppe(baustein: string): string {
  return baustein.replace(
    /(T|t)he standing position/g,
    (_, gross: string) => `${gross}he group`,
  )
}

/** Ein Satz für den Knopf — nennt die Zahl, weil sie das Bild bestimmt. */
export function gruppenAnsage(n: number): string {
  return `${n} Personen, an jedem Platz anders gestellt — teils sitzend.`
}
