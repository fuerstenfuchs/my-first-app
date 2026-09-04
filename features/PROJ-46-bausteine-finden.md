# PROJ-46: Bausteine finden statt scrollen

## Status: In Review
**Created:** 2026-09-03

## Warum

Mark am 03.09.2026:

> „Bausteine zu finden ist schon allein schwierig, wenn ich ein Bild vom
> Lichttisch in einen Prompt-Baustein übergeben will und da schon ewig
> scrollen muss, damit ich den wieder finde. Das wird bei anderen Dingen bald
> genauso sein, wenn es viele werden."

## Was gemessen wurde (03.09.2026)

Die erste Fassung dieser Spezifikation lag falsch. Sie schlug „zuerst ein
Suchfeld im Übernehmen-Dialog" vor — **das gibt es bereits**
(`bild-uebernehmen-dialog.tsx`, Zustand `suche`, gefiltert in `gefiltert`).
Die Ursache ist eine andere.

**Der Bestand:**

| Baustein | Anzahl |
|---|---|
| Prompts | 80 |
| Locations | 46 |
| Posen | 33 |
| Fashion | 19 |
| Outfits | 16 |
| Charaktere | 14 |

**Befund 1 — die Suche ist zu wörtlich.** Sie prüft, ob der eingetippte Text
als zusammenhängende Zeichenkette im NAMEN vorkommt. Marks Bausteine heißen
aber beschreibend: „Arme verschränkt, Blick nach unten, sitzend". Wer „sitzend
arme" eintippt, findet nichts — die Wörter stehen in anderer Reihenfolge.

**Befund 2 — die Suche sieht nur den Namen.** Der Dialog lädt genau drei
Spalten: `id`, `name`, `cover_image_url`. Vorhanden sind aber auch
`description`, `tags` und `category`. Die Suche ist für all das blind.

**Befund 3 — die Kategorie ist der größte Hebel, und sie wird nicht benutzt.**
Sie ist überall gefüllt und trennt scharf:

```
locations       stadien_deutschland  31    natur 10    stadt 2    rest 3
pose_actions    stehend 16   sitzen 12   liegen 3   tanzen 1   gestik 1
fashion_assets  kleider 8    oberteile 6   unterteile 2   rest 3
```

Ein Klick auf „natur" macht aus 46 Locations zehn. Genau das ist das Scrollen,
von dem Mark spricht: Er sucht eine Naturkulisse und blättert an 31 Stadien
vorbei.

**Befund 4 — „zuletzt benutzt" gibt es nicht, und `updated_at` taugt nicht als
Ersatz.** Nachgemessen: Von 46 Locations wurde **keine einzige** nach dem
Anlegen je geändert. Nach `updated_at` zu sortieren wäre also dasselbe wie nach
Anlagedatum. Ein echtes Signal müsste erst geschrieben werden.

## Was gebaut wird

**Jetzt:**

1. **Kategorie-Filter als Chips** über der Liste, für die Bausteine, die eine
   Kategorie haben. Mit Anzahl daneben („natur 10"), damit man sieht, was
   dahinter steckt, bevor man klickt.
2. **Wortweise Suche statt Teilzeichenkette.** „sitzend arme" muss „Arme
   verschränkt, Blick nach unten, sitzend" finden. Alle eingetippten Wörter
   müssen vorkommen, die Reihenfolge ist egal.
3. **Suche über Name, Beschreibung, Kategorie und Schlagworte**, nicht nur
   über den Namen. Dafür müssen die Spalten mitgeladen werden.

**Danach zu entscheiden:**

4. **„Zuletzt benutzt zuerst".** Braucht eine eigene Spalte, die beim
   Übernehmen und beim Einsatz im Scene Builder gesetzt wird — `updated_at`
   taugt nachweislich nicht. Erst bauen, wenn 1–3 im Gebrauch sind: Vielleicht
   löst die Kategorie das Problem schon.
5. **Semantische Suche über Bausteine.** Die Maschinerie gibt es seit PROJ-14
   für Prompts. Damit fände „das Stadion in Gladbach" den BORUSSIA-PARK, ohne
   dass der Name das Wort Stadion enthält. Der eigentliche Zukunftsschritt —
   aber teurer als die drei Punkte oben, und der Nutzen zeigt sich erst, wenn
   die einfachen Wege ausgereizt sind.

## Umgesetzt am 03.09.2026 (Punkte 1–3, nur Übernehmen-Dialog)

**Dateien:** `src/lib/bausteine.ts`, `src/lib/bausteine.test.ts` (neu),
`src/hooks/use-bild-uebernehmen.ts`, `src/components/bild-uebernehmen-dialog.tsx`.

- **Spalten als Datum, nicht als `if`.** Neues Feld `suchFelder` je Baustein
  plus `auswahlSpalten(b)`. Nachgemessen an den Typen der Hooks: Die
  Archetypen haben KEINE Spalte `description`, sondern `short_description` —
  sie wird per Alias umbenannt. `character_archetypes` und `outfit_archetypes`
  haben zudem keine `category`, `prompts` auch nicht. Eine fehlende Spalte
  hätte die ganze Abfrage scheitern lassen.
- **`passtZurSuche()`** als reine Funktion: alle Wörter müssen vorkommen,
  Reihenfolge und Groß/Klein egal, Teiltreffer innerhalb eines Wortes bleiben.
  Gesucht wird über Name, Beschreibung, Kategorie und Schlagworte. Umlaute
  werden auf ae/oe/ue/ss gebracht, damit „moenchengladbach" trifft.
- **Kategorie-Chips** über der Liste, nur wo es Kategorien gibt und mehr als
  eine vorkommt. Die Chip-LISTE kommt aus allen Einträgen, die ANZAHL aus den
  gerade gesuchten — sonst spränge ein Knopf beim Tippen weg und eine gesetzte
  Kategorie ließe sich nicht mehr abwählen. Anzeige über `kategorieLabel()`;
  die Werte in der Datenbank bleiben unverändert.

**Gegenprobe:** Die Suche wurde versuchsweise wieder auf Teilzeichenkette
umgestellt — zwei Tests wurden rot, darunter der Prüfstein „sitzend arme".
Zurückgestellt, wieder grün.

**Noch nicht nachgezogen:** Scene Builder und die Baustein-Seiten.

## Wo überall

Der Übernehmen-Dialog ist die Stelle, an der es Mark aufgefallen ist. Dieselben
Listen stehen aber auch im Scene Builder und auf den Baustein-Seiten. Was hier
entsteht, sollte dorthin nachgezogen werden — als eigener Schritt, damit dieser
hier klein und prüfbar bleibt.

> **Nachtrag 03.09.2026:** Die `short_description`-Alias-Regel galt den Archetyp-Tabellen. Die sind mit PROJ-52 entfallen; der Alias-Weg in `auswahlSpalten` bleibt bestehen, hat aber derzeit keinen Nutzer.

## Nachgezogen am 04.09.2026 — Punkte 1–3 jetzt überall

Am 03.09. waren Suche und Kategorie-Chips nur im Übernehmen-Dialog gebaut. Die
Schlusszeile „Noch nicht nachgezogen: Scene Builder und die Baustein-Seiten"
ist damit erledigt.

**Dringlicher geworden:** Durch PROJ-53 stehen im Outfit-Fach des Scene
Builders 36 Einträge statt 17, bei Locations 46 mit 31 Stadien in einer
Kategorie. Ein Prüfdurchgang hatte das eigens gemeldet.

**Geteilt statt sechsmal kopiert:**
- `chipListe(alle, gesucht)` in `bausteine.ts` — rein und testbar, trägt die
  Regel „Auswahl aus ALLEN, Zahl aus den GESUCHTEN". Ohne sie verschwände ein
  Chip beim Tippen und ließe sich nicht mehr abwählen.
- `use-baustein-filter.ts` — nur der Zustand und das Zurücksetzen beim
  Bereichswechsel.
- `baustein-filter.tsx` — Suchfeld und Chips, an drei Stellen im Einsatz.

**Der eigentliche Fehler im Scene Builder war ein anderer als vermutet:** Die
Abfragen holten `select('*')`, die Felder waren also da — verloren gingen sie
erst beim Mappen auf die Kacheln, die nur `id`, `name` und `imageUrl` trugen.
Die Suche konnte deshalb gar nichts anderes als den Namen sehen.

**Eine Quelle für die Beschriftung.** `kategorieLabel(wert, labels?)` nimmt
jetzt optional die gepflegte Liste des Bereichs; `OUTFIT_KATEGORIE_LABELS`
wird aus `OUTFIT_KATEGORIEN` **abgeleitet**, nicht danebengetippt. Damit heißt
`komplett` überall „Komplett-Look" statt in drei Schreibweisen.

**Bewusst nicht angefasst:** die Kategoriespalten auf den Seiten `outfits`,
`locations`, `pose-actions` und `visual-assets`. Die können mehr als Chips
(Emoji, Kategorien anlegen und löschen, `defaultCategory` fürs Formular, bei
Locations die Verwaltung aus PROJ-34) — sie durch Chips zu ersetzen wäre ein
Umbau, kein Nachziehen.

**Gegenproben:** drei Wächter absichtlich gebrochen (Chip-Auswahl aus den
gesuchten statt allen; gepflegte Beschriftung ignoriert; Zurücksetzen beim
Bereichswechsel abgeschaltet) — 3, 1 und 1 Test rot, alle zurückgedreht.
484 Tests grün.

**Offen bleiben die Punkte 4 und 5** der Spezifikation: „zuletzt benutzt
zuerst" (braucht eine eigene Spalte, `updated_at` taugt nachweislich nicht)
und die semantische Suche. Beide erst, wenn 1–3 im Gebrauch sind.

**Noch nicht im Browser gesehen:** Die Chipzeile im Scene Builder sitzt in
einer schmaleren Spalte als im Dialog. Sie bricht um und ist in der Höhe
gedeckelt — geprüft an der Auszeichnung, nicht am Bildschirm.
