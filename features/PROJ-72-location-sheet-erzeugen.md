# PROJ-72 — Location-Sheet direkt erzeugen, Prompts geprüft

**Status:** In Review
**Erstellt:** 2026-09-06

## Was Mark gesagt hat

> „Allerdings wenn ich jetzt eins erstellen will, dann kann ich die nur
> kopieren, aber nicht automatisch das Bild erstellen, wie zum Beispiel bei
> Charakter. Also immer mit dem Referenzbild, das schon besteht."

Und: „kannst Du diese prompts auch noch mal überprüfen, ob die so passen …
Sollte an der Physik passen, aber schauen noch mal drüber."

## Der Erzeugen-Knopf

Der Charakter-Sheet-Dialog hatte ihn seit PROJ-28, der Location-Dialog nicht.
`PromptToImageDialog` kann jetzt auch eine Location vorauswählen
(`vorauswahlLocation`, spiegelbildlich zu `vorauswahlCharakter`).

**Ohne Titelbild erscheint der Knopf nicht.** Alle drei Prompts beginnen mit
„Analyze the uploaded image" — ohne Foto erfände das Modell einen Ort. Statt
des Knopfes steht dort, warum, und was zu tun ist.

**Nur die Rolle `location`.** Ein Charakterfoto würde „Image 2 = CHARACTER" in
den Auftrag schreiben und eine bestimmte Person in ein Ortsblatt bauen.

## Vier Fehler in den Prompts, alle an der Datei nachgemessen

1. **Physik, der einzige echte.** Die acht Gebäudeansichten sagten zum Licht
   nichts, verlangten aber „Maintain identical architecture across every view".
   Das Modell übernimmt dann die Lichtstimmung des Referenzfotos in alle acht —
   Vorderfassade mit Sonne von vorn UND Rückfassade mit Sonne von vorn. Das
   gibt es nicht, und ein Blatt, das es behauptet, lehrt allem, was daraus
   entsteht, ein unmögliches Licht. Jetzt gleichmäßiges Oberlicht für die
   Ansichten, gerichtete Sonne nur im Hero und in den Tageszeiten. Dazu
   Kamerahöhe und Brennweite, damit die Proportionen nicht je Feld auseinander
   laufen.
2. **„3. Left Elevation"** ist eine Parallelprojektion — genau die technische
   Zeichnung, die derselbe Prompt drei Zeilen weiter verbietet („No CAD
   drawings.").
3. **„Best establishing-shot positions"** gegen **„No camera maps"**: Eine
   Position zeigt man auf einem Grundriss mit Kamerasymbolen. Verboten. Das
   Modell hatte keinen Weg, das zu erfüllen. Jetzt wird die Einstellung selbst
   verlangt, nicht ihre Position.
4. **„Approach path" und „Exit path"** sind an den meisten Orten derselbe Weg.

## Der Ort stand in der App und nicht im Prompt

`getPrompt(type)` kannte die Location nicht. `name`, `description` und
`location_type` lagen daneben und wurden nie benutzt — während
RESEARCH_ENRICHMENT das Modell aufforderte, den Ort zu **erraten** („identify
… if it is recognizable").

Jetzt steht er als Tatsache oben im Prompt. Ein genannter Ort steuert ein
Bildmodell sehr wohl; eine Aufforderung zum Recherchieren tut es nicht.

Nachgebessert nach dem ersten Blick im Browser: Dort stand „type: sonstiges" —
ein interner Schlüssel. Jetzt das Wort, und `sonstiges` fällt weg: Es heißt
„keine Angabe", und es einzusetzen wäre schlechter als es wegzulassen.

## Dateien

| Datei | Was |
|-------|-----|
| `src/components/prompts/prompt-to-image-dialog.tsx` | `vorauswahlLocation` |
| `src/components/locations/location-sheet-dialog.tsx` | Erzeugen-Knopf, vier Promptfehler, `ortsAngabe` |
