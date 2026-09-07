# PROJ-88 - Generieren-Knopf bei Outfit-Sheets

**Status:** In Review
**Erstellt:** 2026-09-07
**Schliesst eine Luecke aus:** PROJ-53 (Fashion in Outfits), PROJ-38 (Prompt -> Bild)

---

## Der Auftrag

Mark am 07.09.2026: *"Kannst Du noch mit einbauen bei Outfit? Den
Generierenknopf."*

Bei Charakteren und Locations gibt es ihn seit PROJ-38 und PROJ-72. Bei den
Outfit-Sheets stand nur: *"Kopiere diesen Prompt und fuege ihn in dein
Bildgenerator-Tool ein (z. B. Midjourney, ComfyUI, Flux)."* Der Weg zurueck in
die eigene Erzeugung fehlte.

---

## Was gebaut wurde

Der Knopf **"Bild daraus erzeugen"** unter den drei Outfit-Blaettern
(Referenz, Detail, Outfit). Der Bilddialog bekam dafuer eine
Outfit-Vorauswahl - dieselbe Sache wie bei Charakter und Ort: Ein Outfit-Sheet
ohne das Foto des Kleidungsstuecks waere ein erfundenes Kleidungsstueck.

**Nur das Outfit als Referenz**, und das aus zwei genauen Gruenden:

- Ein **Charakterbild** daneben schriebe "Image 2 = CHARACTER - take the
  person's identity from it" in den Auftrag. Das Modell baute dann eine
  bestimmte Person in ein Blatt, das die KLEIDUNG zeigen soll.
- Ein **Ort** widerspraeche den Blaettern selbst: Sie verlangen ausdruecklich
  einen neutralen Hintergrund.

Der Kopier-Knopf bleibt - er ist jetzt der zweite Weg, nicht der einzige.

---

## Geaendert

| Datei | Was |
|---|---|
| `src/components/outfits/fashion-sheet-dialog.tsx` | Knopf, Dialog, Text |
| `src/components/prompts/prompt-to-image-dialog.tsx` | `vorauswahlOutfit` |

---

## Offen

- **Die Blaetter legen sich nicht ab.** Bei Charakteren tut das seit PROJ-86
  der Waechter; fuer Outfits kennt `AblageZiel` keinen Baustein. Nicht
  beauftragt.
- **Die Outfit-Referenzkette** hat weiterhin keinen Einzelweg - ihr
  Referenzsheet braeuchte drei Bilder (vorne, Rueckseite, Details). Waehlte
  jemand hier spaeter einen Kettenschritt an, braeuchte es ein Gegenstueck zu
  `bildplaetze()` fuer Outfits; heute gibt es diesen Weg gar nicht.

---

## Was die unabhängige Prüfung gefunden hat

**`@image1` steht jetzt im Modellprompt.** Alle drei Outfit-Prompts beginnen mit
`Using @image1 as the garment reference.` Das ist Syntax aus einem anderen
Werkzeug; für gpt-image-2 ist es ein bedeutungsloses Fragment. Solange der
Prompt nur kopiert wurde, war das gleichgültig — ab jetzt geht es mit.

**Bewusst stehen gelassen, nicht übersehen.** Der Kopierknopf bleibt Marks
zweiter Weg, und dort kann `@image1` in seinem anderen Werkzeug etwas bedeuten.
Es ohne Rückfrage zu entfernen, hieße, seinen bestehenden Arbeitsweg zu ändern.
Die richtige Zuordnung steht ohnehin darunter (`Image 1 = OUTFIT — take only the
garments…`), also schadet es nicht; es ist nur überflüssig. **Marks
Entscheidung.**

**Der Vorbelegungs-Effekt hing an der Objektidentität** und hätte Marks
Handauswahl bei einem Neuladen der Outfit-Liste zurückgesetzt — bei
`rollen={['outfit']}` ist das die einzige Karte, also gut sichtbar. Er hängt
jetzt an der Kennung.

**Bestätigt:** `rollen={['outfit']}` ist richtig, kein Widerspruch zum Prompt.
Und die neue Vorauswahl ändert für die bisherigen Aufrufer nichts.
