# PROJ-52: Archetypen in die Hauptbereiche zusammenlegen

## Status: In Review
**Created:** 2026-09-03

## Warum

Mark am 03.09.2026:

> „Wir haben hier Fashion, Outfit und Outfit-Archetypen. Das wird zukünftig
> alles ein Punkt sein. Auch bei Charakteren bitte. Die Archetypen kommen zu
> den normalen Charakteren. Sozusagen ist das alles zu kompliziert. Auch bei
> Locations gibt es Archetypen. Die sollen auch zusammengelegt werden."

Übrig bleiben sollen: **Charaktere, Outfits, Locations** — dazu unverändert
Posen, Kamera & Licht und Look & Grading.

## Nachgemessen, bevor entschieden wurde

Die Archetypen sind praktisch ungenutzt. Insgesamt **vier Einträge, acht
Bilder**:

| Tabelle | Einträge | Bilder |
|---|---|---|
| `character_archetypes` | 1 — „Lucy Gaggeli" | 2 |
| `outfit_archetypes` | 1 — „Schlager Outfit Für Frauen" | 3 |
| `location_archetypes` | 2 — „Bar", „strand thailand" | 3 |

Das ist der eigentliche Befund: Das Konzept wurde gebaut (PROJ-32, PROJ-35),
kostet an vielen Stellen Komplexität — und wird nicht benutzt. „Lucy Gaggeli"
ist schlicht ein Charakter, „Bar" schlicht eine Location.

Ebenfalls geprüft: Das einzige gespeicherte Scene-Preset („Calvanize Studio")
verweist auf **keinen** Archetyp. Es gibt also keine Presets zu reparieren.

## Entscheidung: ersatzlos

Mark am 03.09.2026 auf die ausdrückliche Rückfrage, ob die Sonderfähigkeit der
Archetypen (eine rein textliche Beschreibung OHNE eigenes Bild in den Prompt
einbringen) wegfallen darf: **„Ja, ersatzlos weg."**

Damit entfällt auch die Dreifall-Logik in `buildCharacterSection`,
`buildOutfitSection` und `buildLocationSection` (echtes Objekt / Archetyp mit
Bild / Archetyp ohne Bild). Beschreibungstexte bleiben am jeweiligen Eintrag
erhalten, sie werden nur nicht mehr gesondert behandelt.

**Günstiger Zeitpunkt:** `src/lib/szene-prompt.ts` wurde am selben Tag mit 44
Tests aus dem Scene Builder herausgelöst (PROJ-51) — darunter acht wörtliche
Grundlinien und die drei Archetyp-Fälle. Genau diese Tests sind das
Sicherheitsnetz für den Rückbau: Was sich am Prompt ändern DARF, ist damit
vorher schriftlich festgelegt.

## Umfang

**Datenumzug** (4 Einträge, 8 Bilder): Archetypen werden zu normalen Einträgen
in `characters`, `outfits`, `locations`; ihre Bilder wandern in je eine
Variante mit. Beschreibung und Prompt-Text bleiben erhalten.

**Entfällt danach:**
- Seiten `character-archetypes`, `outfit-archetypes`, `location-archetypes`
- Hooks `use-character-archetypes`, `use-outfit-archetypes`, `use-location-archetypes`
- Formulare und Sheet-Dialoge der drei Archetyp-Bereiche
- API-Routen `generate-character-archetype`, `generate-outfit-archetype`,
  `generate-location-archetype`
- Die drei Archetyp-Slots im Scene Builder samt `*_archetype_id` und
  `refs.*_archetype` in `ScenePresetConfig`
- Einträge in Seitenleiste, `library-tabs`, `bausteine`, `reference-images`

**Nicht betroffen:** die Chrome-Erweiterung — sie kennt keine Archetypen.

## Reihenfolge im Gesamtumbau

1. **PROJ-52 (dies)** — Archetypen zusammenlegen. Kleinste Datenmenge, größte
   Vereinfachung; alles Folgende wird dadurch einfacher.
2. **PROJ-53** — Fashion in Outfits zusammenlegen, mit Kategorie am Eintrag
   (19 Kleidungsstücke treffen auf 16 Outfits). Marks Wahl:
   „Kategorie am Eintrag."
3. **PROJ-54** — Outfit-Referenzkette: vorne freigestellt, Rückseite,
   Detail-Nahaufnahmen und ein Kombi-Referenzsheet.

## Umzug durchgeführt (03.09.2026)

Der Datenumzug lief **additiv**: nur `insert`, kein `update`, kein `delete`.
Die alten Archetyp-Tabellen stehen unverändert als Sicherheitsnetz.

| Nach | Eintrag | Bilder |
|---|---|---|
| `characters` | Lucy Gaggeli | 2 |
| `outfits` | Schlager Outfit Für Frauen | 3 |
| `locations` | Bar | 2 |
| `locations` | strand thailand | 1 |

Acht Bilder — genau die Zahl, die vorher in den drei Archetyp-Bildtabellen
stand. Jeder Eintrag behielt Beschreibung, Tags (je fünf), Titelbild und
Kategorie; `prompt` und `short_description` sind in `metadata` erhalten, dazu
`herkunft: 'archetyp-umzug'` und die alte `archetyp_id`. Über diese Kennung
ist der Umzug jederzeit nachvollziehbar und rückgängig zu machen.

Die Bilder hängen je an einer neuen Variante **„Sonstige"**. Die übrigen
Standard-Varianten (PROJ-50) fehlen dort — die Referenzkette legt sie bei
Bedarf selbst an (`varianteHolen` sucht und erstellt).

Der Umzug ist **wiederholbar ohne Schaden**: Jedes Statement überspringt, was
über `metadata->>'archetyp_id'` schon vorhanden ist.

### Nachgemessen statt geglaubt

Die acht wörtlichen Grundlinien-Prompts wurden nach dem Rückbau Zeichen für
Zeichen gegen den Stand davor verglichen (Skript, nicht Augenmaß):
**vier der fünf archetypfreien Grundlinien sind identisch**, die fünfte
unterscheidet sich nur in der Schreibweise in der Quelldatei (`Lächeln` steht
jetzt als `Lächeln`) — nach dem Einlesen dieselbe Zeichenkette. Der
Scene Builder erzeugt für Szenen ohne Archetypen also unverändert denselben
Prompt.
