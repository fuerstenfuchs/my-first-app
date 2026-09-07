# PROJ-86 — Der Einzelweg kann, was die Kette kann

**Status:** In Review
**Erstellt:** 2026-09-07
**Schließt Lücken aus:** PROJ-48 (Referenzkette), PROJ-85 (zwei Bildplätze)

---

## Der Auftrag

Mark am 07.09.2026, auf zwei offene Punkte meiner To-do-Liste:

> **Punkt zwei** kannst Du noch einbauen, genau, damit man das auch manuell
> machen könnte, falls man kein Referenzbild hat für den Körper.

> **Punkt vier.** Könnte man auch da ablegen, wo sie herkommen beim Charakter?

Beides betrifft dieselbe Sache: Die Kette konnte etwas, der Einzelweg nicht.
PROJ-85 hat die zwei Bildplätze nachgezogen — hier kommen die letzten beiden
Unterschiede dazu.

---

## 1. Die Körpermerkmale

`koerperMerkmaleText()` hängt an den Körper-Prompt Zeilen wie „slim build",
„large bust", „long legs relative to torso". Die Kette tut das seit dem
03.09.2026; der Sheet-Knopf kannte die Auswahl gar nicht.

**Warum das gerade in Marks Fall zählt:** Er nennt ihn selbst — „falls man kein
Referenzbild hat für den Körper". Zeigt keins der beiden Bilder wirklich einen
Körper (ein reines Kopffoto, kein eigenes Körperfoto), sind diese Zeilen die
**einzige** Quelle für den Körperbau. Ohne sie erfindet das Modell ihn und
greift dabei zu etwas Ähnlichem — genau Marks ursprüngliche Beobachtung vom
03.09.: „dass der Körper irgendwie immer gleich aussieht."

Die Felder standen bisher inline im Ketten-Dialog. Sie sind jetzt ein eigenes
Bauteil (`koerper-merkmale.tsx`), das beide Wege benutzen — samt des
Typ-Kunstgriffs aus dem Critic-Befund vom 03.09., der einen Tippfehler in einem
Optionswert zum **Kompilierfehler** macht statt zu einer Zeile „- undefined"
im Prompt.

**Die Merkmale gehen in den ANGEZEIGTEN Prompt**, nicht erst beim Abschicken:
Was Mark kopiert, muss dasselbe sein wie das, was erzeugt wird.

---

## 2. Die Ablage beim Charakter

Ein einzeln erzeugtes Blatt landete in der Warteschlange und wurde von Hand
einsortiert. Die Ketten legen ihre Ergebnisse dagegen selbst ins richtige Fach.

Jetzt gibt der Sheet-Knopf ein Ablageziel mit, und der Wächter aus PROJ-76 legt
ab — dieselbe Mechanik wie bei der Shooting-Kette.

| Blatt | Fach |
|---|---|
| Kopf-Sheet | `Kopf` |
| Körper-Sheet | `Körper` |
| Referenzsheet | `Referenzsheet` |
| Ausdrücke | `Ausdrücke` |
| Gesichtsdetails | `Gesichtsdetails` (wird bei Bedarf angelegt) |

**Die ersten vier Namen sind nicht neu getippt**, sondern kommen aus
`VARIANTEN_NAME` bzw. den Standard-Varianten (PROJ-50). Zwei Zeichenketten für
dasselbe Fach liefen auseinander, und dann legte die Kette ein zweites daneben
an.

**Gesucht wird mit `findeVariante()`** — ohne Rücksicht auf Leerzeichen und
Groß-/Kleinschreibung, genau wie `varianteHolen` in der Kette. Ein genauerer
Vergleich legte neben „ Körper " ein zweites Fach „Körper" an, und danach lägen
die Blätter desselben Charakters in zwei Fächern, ohne dass etwas meldet.

**Aufgelöst wird erst beim Abschicken.** Beim Öffnen des Dialogs wäre es zu
früh: Wer es sich anders überlegt, ließe ein leeres Fach am Charakter zurück.

Scheitert das Anlegen, wird **trotzdem erzeugt** — das Bild bleibt dann in der
Warteschlange, mit einer Meldung. Eine bezahlte Erzeugung an einem
fehlgeschlagenen Ordner scheitern zu lassen, wäre die teurere Reaktion.

---

## Geändert

| Datei | Was |
|---|---|
| `src/components/characters/koerper-merkmale.tsx` | **neu** — die fünf Felder, aus dem Ketten-Dialog herausgezogen |
| `src/components/characters/referenzkette-dialog.tsx` | benutzt das Bauteil statt der eigenen Fassung |
| `src/components/characters/character-sheet-dialog.tsx` | Merkmale beim Körper-Sheet, Ablageziel für alle fünf Blätter |
| `src/lib/charakter-varianten.ts` | `findeVariante()` — derselbe Namensvergleich wie in der Kette |
| `src/lib/charakter-varianten.test.ts` | 5 Tests dafür |
| `src/components/prompts/prompt-to-image-dialog.tsx` | Eigenschaft `ablage`, Auflösung beim Abschicken |

---

## Offen

- **Location-Sheets legen weiterhin nichts ab.** `AblageZiel.baustein` kennt
  nur `'charaktere'`; der Wächter schreibt in `character_images`. Für Orte
  wäre das ein eigener Zweig — nicht beauftragt.
- **Die Merkmale gelten nur beim Körper-Sheet**, wie in der Kette auch. Beim
  Referenzsheet wären sie ebenso denkbar; dort steht der Körperbau aber schon
  im mitgegebenen Körperblatt.
