/**
 * Vorgefertigte Körperform-Presets (PROJ-91) — Bild + passende Körpermerkmale
 * in einem Klick.
 *
 * Mark am 29.09.2026: „Bevor man immer alles neu einstellen müsste, ver-
 * schiedene Presets generieren … noch besser wäre es, wenn es dann auch
 * direkt mit einem Referenzbild verbunden wäre … Ich müsste dann eigentlich
 * nur noch so ein Preset auswählen können. Aber natürlich auch die Möglich-
 * keit weiterhin haben, das manuell zu machen."
 *
 * WARUM EINE STATISCHE LISTE UND KEINE DATENBANKTABELLE: Diese 24 Presets
 * sind eine feste, kuratierte Reihe (aus `werkzeuge/blender/koerperform.py`
 * im Fuchsbau-Repo gerendert, siehe dort) — kein Nutzer legt hier eigene an,
 * keine RLS, keine Migration nötig. Eine Tabelle für Daten, die sich nie zur
 * Laufzeit ändern, wäre eine Fuge ohne Nutzen. Kommen später kombinierte
 * Presets (mehrere Merkmale gleichzeitig) dazu, werden sie hier ergänzt.
 *
 * WARUM DIE BILDER TROTZDEM IM TRÉSOR-SPEICHER LIEGEN (nicht nur lokal bei
 * Mark): `istEigenerSpeicher()` in referenzkette.ts lässt als Referenzbild
 * nur zu, was unter Marks eigener Supabase-URL liegt — genau die Schranke,
 * die auch der Arbeiter zieht. Ein Pfad auf seiner Festplatte wäre hier
 * nutzlos. Hochgeladen mit `presets_hochladen.mjs` (einmalig, nicht Teil
 * dieses Repos) nach `prompt-media/<uid>/koerper-presets/<key>.png`.
 *
 * GEMEINSAM FÜR ALLE CHARAKTERE, nicht je Charakter: Mark ausdrücklich auf
 * Nachfrage — ein Preset einmal anlegen und überall wählen können ist der
 * ganze Sinn von „Preset" gegenüber einem einzelnen Upload.
 */
import type { KoerperAuswahl } from './referenzkette'

export type KoerperPreset = {
  key: string
  /** Anzeigename in der Auswahl. */
  label: string
  bildUrl: string
  /** Wird beim Wählen in die bestehende Auswahl EINGEMISCHT (nicht ersetzt) —
   *  Mark: „auch die Möglichkeit weiterhin haben, das manuell zu machen."
   *  Ein Preset setzt nur sein eigenes Feld; alles, was er sonst schon
   *  eingestellt hat, bleibt stehen. */
  merkmale: KoerperAuswahl
}

const BASIS =
  'https://gsfrbxdesarlhfijmguu.supabase.co/storage/v1/object/public/prompt-media/' +
  '9df10e22-9b6f-477e-9000-bd99097eb198/koerper-presets/'

function preset(key: string, label: string, merkmale: KoerperAuswahl): KoerperPreset {
  return { key, label, bildUrl: `${BASIS}${key}.png`, merkmale }
}

export const KOERPER_PRESETS: KoerperPreset[] = [
  preset('becken-sehr-schmal', 'Becken · sehr schmal', { becken: 'sehr_schmal' }),
  preset('becken-sehr-ausladend', 'Becken · sehr ausladend', { becken: 'sehr_ausladend' }),
  preset('oberschenkel-sehr-duenn', 'Oberschenkel · sehr dünn', { oberschenkel: 'sehr_duenn' }),
  preset('oberschenkel-sehr-kraeftig', 'Oberschenkel · sehr kräftig', { oberschenkel: 'sehr_kraeftig' }),
  preset('wade-sehr-duenn', 'Wade · sehr dünn', { wade: 'sehr_duenn' }),
  preset('wade-sehr-kraeftig', 'Wade · sehr kräftig', { wade: 'sehr_kraeftig' }),
  preset('oberweite-sehr-klein', 'Oberweite · sehr klein', { oberweite: 'sehr_klein' }),
  preset('oberweite-sehr-gross', 'Oberweite · sehr groß', { oberweite: 'sehr_gross' }),
  preset('beinlaenge-sehr-kurz', 'Beinlänge · sehr kurz', { beinlaenge: 'sehr_kurz' }),
  preset('beinlaenge-sehr-lang', 'Beinlänge · sehr lang', { beinlaenge: 'sehr_lang' }),
  preset('bau-sehr-schlank', 'Körperbau · sehr schlank', { bau: 'sehr_schlank' }),
  preset('bau-sehr-kraeftig', 'Körperbau · sehr kräftig', { bau: 'sehr_kraeftig' }),
  preset('groesse-sehr-klein', 'Größe · sehr klein', { groesse: 'sehr_klein' }),
  preset('groesse-sehr-gross', 'Größe · sehr groß', { groesse: 'sehr_gross' }),
  preset('gesaess-sehr-flach', 'Gesäß · sehr flach', { gesaess: 'sehr_flach' }),
  preset('gesaess-sehr-ausgepraegt', 'Gesäß · sehr ausgeprägt', { gesaess: 'sehr_ausgepraegt' }),
  preset('bauch-sehr-flach', 'Bauch · sehr flach', { bauch: 'sehr_flach' }),
  preset('bauch-sehr-weich', 'Bauch · sehr weich', { bauch: 'sehr_weich' }),
  preset('taille-sehr-schmal', 'Taille · sehr schmal', { taille: 'sehr_schmal' }),
  preset('taille-sehr-gerade', 'Taille · sehr gerade', { taille: 'sehr_gerade' }),
  preset('schultern-sehr-schmal', 'Schultern · sehr schmal', { schultern: 'sehr_schmal' }),
  preset('schultern-sehr-breit', 'Schultern · sehr breit', { schultern: 'sehr_breit' }),
  preset('arme-sehr-duenn', 'Arme · sehr dünn', { arme: 'sehr_duenn' }),
  preset('arme-sehr-kraeftig', 'Arme · sehr kräftig', { arme: 'sehr_kraeftig' }),
  // Muskeldefinition (30.09.2026): nur die beiden Enden je Gruppe; Gesäß hat in MPFB kein Muskelziel.
  preset('muskel-gesamt-nicht-sichtbar', 'Muskeln gesamt · nicht sichtbar', { muskel: 'nicht_sichtbar' }),
  preset('muskel-gesamt-extrem', 'Muskeln gesamt · extrem', { muskel: 'extrem' }),
  preset('muskel-schultern-nicht-sichtbar', 'Schultermuskeln · nicht sichtbar', { muskel_schultern: 'nicht_sichtbar' }),
  preset('muskel-schultern-extrem', 'Schultermuskeln · extrem', { muskel_schultern: 'extrem' }),
  preset('muskel-brust-nicht-sichtbar', 'Brustmuskeln · nicht sichtbar', { muskel_brust: 'nicht_sichtbar' }),
  preset('muskel-brust-extrem', 'Brustmuskeln · extrem', { muskel_brust: 'extrem' }),
  preset('muskel-ruecken-nicht-sichtbar', 'Rückenmuskeln · nicht sichtbar', { muskel_ruecken: 'nicht_sichtbar' }),
  preset('muskel-ruecken-extrem', 'Rückenmuskeln · extrem', { muskel_ruecken: 'extrem' }),
  preset('muskel-arme-nicht-sichtbar', 'Armmuskeln · nicht sichtbar', { muskel_arme: 'nicht_sichtbar' }),
  preset('muskel-arme-extrem', 'Armmuskeln · extrem', { muskel_arme: 'extrem' }),
  preset('muskel-bauch-nicht-sichtbar', 'Bauchmuskeln · nicht sichtbar', { muskel_bauch: 'nicht_sichtbar' }),
  preset('muskel-bauch-extrem', 'Bauchmuskeln · extrem', { muskel_bauch: 'extrem' }),
  preset('muskel-oberschenkel-nicht-sichtbar', 'Oberschenkelmuskeln · nicht sichtbar', { muskel_oberschenkel: 'nicht_sichtbar' }),
  preset('muskel-oberschenkel-extrem', 'Oberschenkelmuskeln · extrem', { muskel_oberschenkel: 'extrem' }),
  preset('muskel-waden-nicht-sichtbar', 'Wadenmuskeln · nicht sichtbar', { muskel_waden: 'nicht_sichtbar' }),
  preset('muskel-waden-extrem', 'Wadenmuskeln · extrem', { muskel_waden: 'extrem' }),
]
