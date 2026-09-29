# PROJ-92 — Personenbilder

**Status:** In Review (Migration eingespielt am 29.09.2026)
**Erstellt:** 2026-09-29

## Auftrag

Mark am 29.09.2026: Die kleinen Dialoge („Sheet erstellen", Referenzkette) sind
auf seinem großen Bildschirm kaum lesbar. „Ich tendiere dahin, im Prompt-Tresor
einen eigenen Reiter zu machen, so wie den Scene Builder — einen kompletten
Personenbilder-Bereich, wo man Personen, Kleidung und Körperbau miteinander
kombinieren kann. Daraus Referenzbilder erstellen, die man in Bild-Prompts und
im Scene Builder verwenden kann. Alles schön groß und übersichtlich."

## Entscheidungen (Mark, nach fünf klickbaren Richtungen)

1. **Grundlage ist Richtung A (Bausteinbogen)** — vier Randnummern oben
   (01 PER, 02 KÖR, 03 OUT, 04 FMT), darunter Auswahl · Vorschau · Auftrag.
2. **Im Reiter Körper die Körperkarte aus Richtung B:** Blender-Grundfigur mit
   zwölf nummerierten Punkten, rechts die Stufen der gewählten Region.
3. **Outfits immer mit Vorschaubild.**
4. **Alles auf einmal:** Ganzkörper vorn, vier Ansichten und Referenzsheet in
   einem Klick beauftragbar.
5. **Eigene Presets** links neben der Körperkarte: benennen, speichern, per
   Klick alles setzen; manuelles Einstellen bleibt daneben möglich.
6. **Scene Builder:** ein Personenbild steht in der Referenzliste **hinter**
   dem Referenzsheet und wird **nicht** von selbst vorgeschlagen (es trägt ein
   Outfit; als Vorgabe würde es bei jeder Szene mit anderer Kleidung das falsche
   Outfit einschleppen).

## Abhängigkeiten (an den Dateien nachgemessen)

- Ablage: `AblageZiel` mit `variantName: 'Personenbild'` genügt; die Variante
  wird vor dem Auftrag gesucht/angelegt (`src/lib/ablage-variante.ts`).
- Prompt: Der Standard-Vorrangsatz (`vorrangSatz`) würde die Körperform
  überstimmen (Charakterrolle: „body identity … follow the reference image") —
  die Seite gibt deshalb eigene `zuordnungTexte` und einen eigenen `vorrangText`.
- Körpermerkmale wurden bisher nirgends gespeichert; die Presets legen sie in
  der neuen Tabelle `koerper_presets` ab (Migration `20260929_koerper_presets.sql`).
- Referenz-Rangfolge: `personenbild` in `RANGFOLGE` mit Rang 1,5 — sortiert
  hinter Referenzsheet/Kombi, aber nicht von `standardReferenz` vorgewählt.

## Umsetzung

`src/app/(app)/personenbilder/`, `src/components/personenbilder/`,
`src/lib/personenbild.ts` (Prompts, Aufträge), `src/lib/koerper-felder.ts`
(Felder, aus dem Formular herausgelöst), `src/hooks/use-koerper-presets.ts`.

## Nach der Prüfung durch Critic (29.09.2026) behoben

- Körper-Vorrang im Prompt: gesetzte Textzeilen überstimmen das Referenzsheet nur
  dort, wo sie etwas sagen (vorher: pauschal „nimm keinen Körper" → alles Übrige
  erfunden). Das Blender-Bild ist bei gesetzten Zeilen nur Anschauung.
- Das Blender-Bild fällt weg, sobald seine Region anders gesetzt wird.
- Ganzkörper vorn: 2:3 über Prompt und Größe, keine zweite Formatansage („4:5").
- Teilabbruch: Auswahl schrumpft auf den Rest (kein doppeltes Bezahlen).
- Ladefehler der Bilder blockieren das Erzeugen, statt still das Titelbild zu nehmen.
- Modellwahl nur `gpt-image-2.5*`. Fremde Referenzbilder, die sich nicht holen lassen,
  stoppen den Durchlauf.
- Presets: „Überschreiben" bleibt nach dem Anpassen erreichbar („geändert"-Marke).

## Offen

- Outfit-Kacheln zeigen nur das Titelbild; ein Outfit ohne Titelbild, aber mit
  Varianten, zeigt „Kein Bild".
- Reiter ohne Pfeiltasten-Bedienung / `tabpanel`.

## Migration

`20260929_koerper_presets.sql` am 29.09.2026 mit Marks Freigabe als Supabase-Migration `koerper_presets` eingespielt. Vorher geprüft: Tabelle gab es nicht. Nachher: Zeilensicherheit an, vier Regeln (select/insert/update/delete je `auth.uid() = user_id`), keine Zeilen, keine Sicherheitsmeldung zur neuen Tabelle.
