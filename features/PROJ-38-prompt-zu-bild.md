# PROJ-38: Gespeicherte Prompts erzeugen lassen, Referenz-Zuordnung, Download

## Status: In Review
**Created:** 2026-09-01
**Grundlage:** Drei Rückmeldungen von Mark am 01.09.2026 nach dem ersten echten Einsatz

## 1. Wer ist was — die Referenzbilder bekommen eine Rolle

**Befund am eigenen Ergebnis:** Bei Charakter + Outfit übernahm gpt-image-2 die
Person aus dem OUTFIT-Bild statt aus dem Charakterbild.

**Ursache — nicht der Prompt, sondern die fehlende Zuordnung.** Die Bilder gingen
unbeschriftet als `image[]` mit, benannt `referenz-0.png`, `referenz-1.png`. Der
Prompt sagte zwar „Use the provided character reference." und „…outfit
reference.", aber nichts verband Satz und Bild. Das Modell hat geraten.

**Behoben:**
- Neue Spalte `reference_roles text[]`, gleiche Reihenfolge wie `reference_urls`
- Der Prompt bekommt einen Zuordnungsblock, positiv formuliert:
  `Image 1 = CHARACTER — take the face, hair, skin tone and body identity…`
  `Image 2 = OUTFIT — take only the garments… The person wearing them in this
  image is a mannequin for the clothes, not the subject.`
- Die Dateinamen ans Modell heißen jetzt `1-character.png`, `2-outfit.png`
- Der Scene Builder zeigt die Zuordnung an, bevor abgeschickt wird
- `/queue` beschriftet jedes Referenzbild mit seiner Rolle

**Nachgemessen** (Auftrag `9e85fae8`): Referenz 1 Mann mit Glatze, Referenz 2
Ghost-Mannequin mit buntem Hemd. Ergebnis: derselbe Mann in genau diesem Outfit.

## 2. Download-Knopf an jedem Ergebnis

Knopf auf jeder Bildkachel in `/queue`.

**Warum nicht `<a download>`:** Das Attribut wirkt nur bei gleicher Herkunft. Die
Bilder liegen bei Supabase, also auf einer anderen Domain — der Browser
ignoriert `download` und öffnet stattdessen einen Tab. Deshalb wird die Datei
geholt und als Blob verlinkt (`src/lib/bild-download.ts`).

**Wohin gespeichert wird, entscheidet der Browser**, nicht die Seite: in den
eingestellten Download-Ordner, ohne Nachfrage, solange „Vor dem Download fragen"
in den Browser-Einstellungen aus ist.

Dateiname mit Zeitstempel und Szenenname statt `0.png`.

## 3. Gespeicherte Prompts erzeugen lassen

**Die Lücke:** Der Scene Builder baut Prompts, aber wer schon einen hatte — aus
der Bibliothek, aus einem Sheet — konnte ihn nur kopieren. Es gab keinen Weg
zurück in die Erzeugung. Der Charakter-Sheet-Dialog riet wörtlich, den Prompt
„zusammen mit den Referenzbildern in dein Bildgenerator-Tool" zu ziehen.

**Neu:** `src/components/prompts/prompt-to-image-dialog.tsx`
- Zeigt den Prompt unverändert
- Referenzbilder frei wählbar: Charakter, Outfit, Location — je mit Suche,
  und bei gewähltem Eintrag eine Bilderleiste für das konkrete Bild
  (genau das „Charaktersheet-Bild dazu")
- Modell, Bildformat, Durchläufe
- Zeigt die Zuordnung und die Zusätze im Prompt vor dem Abschicken

**Zwei Einstiege:**
- Prompt-Detailfenster: Knopf „Bild daraus erzeugen" unter „Prompt kopieren"
- Charakter-Sheets: derselbe Knopf, Charakter bereits vorausgewählt

## Aufgeräumt

`loadRefImages` und `loadArchetypeRefImages` lagen im Scene Builder und werden
jetzt von beiden Oberflächen gebraucht. Ausgelagert nach
`src/lib/reference-images.ts` statt kopiert.

## Offen

- In der laufenden App abgenommen ist nur die Referenz-Zuordnung (an einem echten
  Auftrag). Download-Knopf und Prompt-Dialog sind gebaut, typgeprüft und gebaut,
  aber niemand hat sie angeklickt — das braucht Marks Zugang.
- Der Dialog bietet nur echte Assets, keine Archetypen. Bewusst: Archetypen haben
  meist kein Bild, und der Weg über den Scene Builder deckt sie ab.
