# PROJ-44: Einstellungsreihe — Kontinuität über mehrere Einstellungen

## Status: In Review
**Created:** 2026-09-03

## Warum

Mark baut heute jede Szene einzeln. Was fehlt, ist die **Sequenz**: mehrere
Einstellungen desselben Moments — gleicher Charakter, gleiche Location,
gleiches Licht, gleiches Outfit — bei denen sich nur Kamera und Bildausschnitt
ändern. Das ist genau die Arbeit, die er sonst acht Mal von Hand durchklickt,
obwohl alle Bausteine schon beieinander liegen.

Mark am 03.09.2026 auf den Vorschlag: „Machen wir auf jeden Fall."

## Was gebaut werden soll

Ein Knopf im Scene Builder, der aus einer fertigen Szene eine Reihe erzeugt.
Vorschlag für die Auflösungen, angelehnt an das, was im Schnitt gebraucht wird:

- Totale (establishing)
- Halbtotale
- Halbnah
- Nah
- Detail
- Schulterblick
- Gegenschuss

Auswählbar, nicht alle zwangsweise. Alle Bausteine bleiben gebunden, nur
Kameraeinstellung und Bildausschnitt variieren.

## Die offenen Fragen, beantwortet (04.09.2026)

**1. Ein Auftrag mit N Durchläufen oder N Aufträge? → N Aufträge.**
Das ist keine Vorliebe, sondern von der Bauart entschieden: `anlegen()` nimmt
EINEN Prompt und erzeugt ihn `variants`-mal. Jede Einstellung braucht aber
einen ANDEREN Prompt — die Einstellungsgröße steckt als Textbaustein darin
(`SHOT_TYPES[].prompt`, z.B. „close-up portrait framing" gegen „wide shot with
strong environmental context"). Ein Auftrag mit sieben Durchläufen erzeugte
also siebenmal dieselbe Einstellung. Nebeneffekt, der ohnehin gewollt ist:
Eine misslungene Einstellung lässt sich einzeln wiederholen.

**2. Eigene Kennung für den Lichttisch? → Ja, in `scene_meta`.**
Das Feld ist `jsonb`. Eine `reihe_id` plus `reihe_nr` kostet keine
Schemaänderung.

*Nachtrag 04.09.2026:* Hier stand zuerst, `scene_meta` trage „schon `name`,
`herkunft` und `schritt`". Nachgemessen stimmt das für diesen Weg nicht — aus
dem Scene Builder kommen die flachen Felder der `ScenePresetConfig` plus
`name`; `herkunft` wird auf anderen Wegen gesetzt, `schritt` kommt in `src/`
überhaupt nicht als `scene_meta`-Feld vor. Ohne Wirkung auf den Code, aber es
war eine Behauptung über Daten, die niemand geprüft hatte. Ob der Lichttisch sie
zusammenhängend ANZEIGT, ist ein eigener Schritt — aber ohne die Kennung wäre
er später gar nicht möglich, und sie jetzt mitzuschreiben ist umsonst.

**3. Wechselndes Format ist unzuverlässig? → Die Frage stellt sich nicht.**
Eine Einstellungsreihe ist genau dann eine Reihe, wenn das Format GLEICH
bleibt — was sich ändert, ist der Bildausschnitt, nicht das Seitenverhältnis.
Kein Schnitt wechselt mitten in der Szene von 16:9 auf hochkant. Damit
entfällt das gemessene Problem von selbst: ein Format für die ganze Reihe,
aus der Szene übernommen.

## Die Einstellungen — aus dem, was der Scene Builder schon kann

Der ursprüngliche Vorschlag nannte Totale, Halbtotale, Halbnah, Nah, Detail,
Schulterblick und Gegenschuss. Fünf davon gibt es bereits als `SHOT_TYPES`,
mitsamt erprobtem Prompt-Baustein:

| Vorschlag | Vorhanden als |
|---|---|
| Totale | `establishing_shot` / `wide_shot` |
| Halbtotale | `full_body` / `three_quarter` |
| Halbnah | `half_body` |
| Nah | `closeup` |
| Detail | `extreme_closeup` |
| **Schulterblick** | **fehlt** |
| **Gegenschuss** | **fehlt** |

Die Reihe baut auf den zehn vorhandenen Einstellungsgrößen auf — sie sind im
Prompt-Bau verdrahtet und Mark kennt sie aus dem Scene Builder.

**Schulterblick und Gegenschuss sind bewusst ausgeklammert.** Sie sind keine
Einstellungsgrößen, sondern Kamerapositionen in Bezug auf ein Gegenüber — sie
setzen eine zweite Person voraus, die es in der Szene bisher nicht gibt. Das
ist ein eigener Baustein, kein Auswahlpunkt.

## Was gebaut wurde (04.09.2026)

**`src/lib/einstellungsreihe.ts`** — die ganze Logik, ohne React, mit Tests
daneben (`einstellungsreihe.test.ts`).

- `REIHEN_ORDNUNG` wird aus `SHOT_TYPES` **abgeleitet** (`.map().reverse()`),
  nicht danebengeschrieben. Kommt eine elfte Einstellungsgröße dazu, steht sie
  ohne Zutun in der Reihe.
- `sortiereEinstellungen()` bringt die Auswahl in Schnittfolge — weit nach nah,
  nicht in der Reihenfolge, in der Mark die Knöpfe gedrückt hat.
- `baueReihe()` ist der Kern der Kontinuität. Er ruft für jede Einstellung
  `buildPrompt({ ...scene, shot_type })` auf — genau **ein** Feld wechselt,
  alles andere ist dieselbe Szene.

  **Das allein reichte nicht, und der erste Stand dieser Zeile war zu
  selbstsicher.** Ein Feld zu tauschen genügt nur, wenn `buildPrompt` in
  diesem Feld örtlich ist — und das war es nicht. Siehe unten,
  „Der Fehler, den die Prüfung gefunden hat".
- `reiheMeta()` schreibt `reihe_id`, `reihe_nr` und `reihe_gesamt` in
  `scene_meta`. Der Lichttisch zeigt die Reihe noch nicht gruppiert; ohne die
  Kennung wäre das aber später gar nicht mehr möglich, und sie jetzt
  mitzuschreiben kostet nichts.

**`src/components/scene-builder/reihe-button.tsx`** — ein Kasten unter dem
Auftragsknopf. Mehrfachauswahl der Einstellungsgrößen, Vorbelegung mit dem
Vorschlag aus dem Schnitt, **die Bildzahl steht vor dem Klick im Knopf**. Modell
und Größenklasse werden oben im Auftragsknopf einmal gewählt und gelten für
beide Wege.

**`queue-button.tsx`** nimmt die Szene jetzt optional entgegen und zeigt den
Reihen-Kasten nur, wenn sie da ist — ohne sie arbeitet der Auftragsknopf
unverändert weiter.

### Nebenbei erledigt

Die Doppelklick-Sperre beider Knöpfe liegt jetzt in einem `useRef` statt im
State. `setLaeuft(true)` wirkt erst beim nächsten Rendern; zwei schnelle Klicks
kamen vorher beide durch die Prüfung und legten zwei bezahlte Aufträge an. Das
war Punkt 2 in `features/OFFEN.md`. Beide Sperren stehen in `try/finally` —
`anlegen()` fängt Datenbankfehler selbst ab, aber das `auth.getUser()` darin
kann bei abgerissener Verbindung werfen, und ohne `finally` bliebe der Knopf
dann bis zum Neuladen gesperrt.

### Geprüft

508 Tests in 32 Dateien grün (vorher 484 in 31), `tsc` sauber bis auf die zwei
bekannten Altlasten, Build übersetzt.

Zwei Mutationsproben, weil grüne Tests allein nichts über ihre Schärfe sagen:

1. Sortierung auf Klickreihenfolge umgestellt → **7 Tests rot**.
2. `lens: '50mm'` in `baueReihe` eingeschmuggelt → **genau 1 Test rot**, und
   zwar der Kontinuitätswächter.

**„Er trifft, was er treffen soll, und nichts sonst" stand hier zuerst — das
war falsch.** Er traf `lens`, weil `lens` in der Testszene gesetzt war. Für die
halbe Szene war er blind, und zwar aus einem Grund, der von außen nicht zu
sehen ist: Die Testszene war INNEN und hatte Charakter, Outfit, Location,
Tageszeit und Wetter auf `null`. Ein Fehler, der genau diese Felder
unterschlägt, wäre grün durchgelaufen — weil in der Testszene ohnehin nichts
drinstand. Der Wächter selbst war zudem tautologisch: Er verglich `baueReihe`
mit demselben Ausdruck, den `baueReihe` rechnet.

Behoben am 04.09.2026: eine zweite Testszene (`AUSSEN_SZENE`), draußen, jedes
Feld belegt, auf 135mm. Dazu drei Tests, die am ERGEBNIS messen statt an der
Rechenvorschrift — Kamerawinkel, Tiefenschärfe, Format, Charakter, Outfit,
Location, Tageszeit, Jahreszeit und Wetter müssen in **jedem** Bild der Reihe
wörtlich dieselben sein. Erst diese Tests fanden den Fehler unten.

### Der Fehler, den die Prüfung gefunden hat (BLOCKER, behoben)

`buildCameraSentence` in `szene-prompt.ts` kannte zwei Sonderfälle:
`closeup + 135mm` und `full_body + 24mm`. Für diese beiden Paarungen gab es
einen fertig formulierten Satz — und die Funktion kehrte damit **sofort
zurück**. Kamerawinkel, Tiefenschärfe und Formatsatz fielen weg.

Bei einem Einzelbild war das bloß ungenau. In einer Reihe bricht es die
Zusicherung des ganzen Features, und zwar auf dem Standardweg: `closeup` und
`full_body` stehen **beide in der Vorbelegung**, 24mm und 135mm sind reguläre
Auswahlpunkte. Eine Szene aus tiefer Kameraposition mit durchgehender Schärfe
hätte vier Bilder wie bestellt geliefert und das fünfte ohne Winkelangabe und
mit erzwungen offener Blende. Genau der Sprung, den eine Reihe verhindern soll.

Behoben: Der Sonderfall ersetzt jetzt **nur Einstellungsgröße und Objektiv**,
alles Übrige hängt sich normal an. Die eingebaute Blende des Nah-Sonderfalls
greift nur noch, wenn die Szene selbst keine wählt — Marks ausdrückliche Wahl
gewinnt immer.

Zwei aufgezeichnete Prompts in `szene-prompt.test.ts` wurden dadurch rot. Das
war gewollt: Der Kopf dieser Tabelle verlangt, dass eine absichtliche Änderung
bestätigt wird. Beide sind mit Begründung neu aufgezeichnet. Ein Test, der das
alte Verwerfen ausdrücklich festschrieb („nimmt den fertigen Satz und verwirft
die übrigen Angaben"), ist ersetzt.

**Die Änderung wirkt über PROJ-44 hinaus** — auch ein einzelnes Bild mit
135mm-Nahaufnahme trägt jetzt den gewählten Winkel und das gewählte Format.
Das ist eine Verbesserung, aber es ist eine Verhaltensänderung, und sie steht
deshalb hier und nicht nur im Quelltext.

### Bewusst offen

- **Der Lichttisch gruppiert die Reihe noch nicht.** Die Kennung liegt in der
  Datenbank, das Anzeigen ist ein eigener Schritt (gehört zu PROJ-45).
- **Ein Fehlschlag hält die Reihe an**, statt die restlichen Einstellungen
  trotzdem einzureihen. Bei bezahlten Erzeugungen ist Anhalten die
  vorsichtigere Richtung — der Grund steht schon in der Meldung, und neun
  gleichlautende hinterher wären nur Lärm.
- **Im Browser nicht nachgemessen.** Der Scene Builder liegt hinter der
  Anmeldung; die Prüfung liegt deshalb in den Tests der Logik.
