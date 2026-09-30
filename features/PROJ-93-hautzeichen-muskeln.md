# PROJ-93 — Hautzeichen, Muskeldefinition, Männer-Wortlaut

**Status:** In Review
**Erstellt:** 2026-09-30

## Auftrag

Mark am 30.09.2026: Manchmal hat jemand ein Tattoo, das auf den Originalbildern
nicht zu sehen ist (lange Hose, Tattoo am Oberschenkel). Auf dem Referenzbild
mit kurzer Hose soll es trotzdem erscheinen. Dazu: einstellbare Muskeldefinition
für alle Körperteile mit Muskeln („gar nicht sichtbar" bis „extrem"), und der
Bauch soll bei Männern anders beschrieben werden als bei Frauen.

## Umsetzung

- **Hautzeichen** (Tattoo, Narbe, Muttermal): je Person, Körperstelle (20 Stellen)
  plus Beschreibung, gespeichert in `characters.metadata.hautzeichen` (keine
  Migration). Der Prompt-Block „SKIN MARKS" geht in jeden Kettenschritt, in
  jedes Einzelsheet und in alle Personenbilder. Er sagt: zeigen, wenn die Stelle
  frei und sichtbar ist — auch wenn die Referenzfotos sie bedeckt zeigen; ist
  sie bedeckt, verdeckt lassen und nicht an andere Stellen setzen.
- **Geschlecht** (Mann/Frau/nicht gesetzt) je Person in `metadata.geschlecht`.
  Ändert nur den Wortlaut: Bauch („Bierbauch" statt „sehr weich"), Oberweite
  wird zu „Brustkorb". Gleiche Stufen, gleiche Presets.
- **Muskeldefinition:** neun Felder (`muskel` gesamt, Schultern, Brust, Rücken,
  Arme, Bauch, Gesäß, Oberschenkel, Waden), je sechs Stufen. Eigene Karte
  „Muskeln" (Punkte 1–9) neben der Formkarte. Gesäß hat kein MPFB-Muskelziel und
  daher kein Blender-Preset.
- **16 neue Blender-Presets** (acht Gruppen × nicht sichtbar / extrem) aus
  `werkzeuge/blender/koerperform.py` (`$muskeln`), Speicher `koerper-presets/`.
- Bearbeiten: `PersonMerkmale` im Sheet-Dialog, im Ketten-Dialog und im Reiter
  Körper der Seite Personenbilder.

## Bekannte Grenzen

- Das Bildmodell hält ein Tattoo nicht garantiert pixelgenau; der Text
  beschreibt es, ein Referenzfoto der Stelle gibt es nicht.
- Bestehende Wortlaute für `kraeftig`/`sportlich` erwähnen schon „muscular";
  die Muskelzeilen kommen danach und sind konkreter.
