# Offene Punkte

> Stand: 3. September 2026, Ende der Nachtsitzung.
> Diese Datei ist die **erste**, die in der nächsten Sitzung gelesen werden
> sollte. Was hier nicht steht, ist morgen vergessen.

## Als Nächstes, in dieser Reihenfolge

Mark hat am 03.09.2026 zugestimmt, dass PROJ-44 und PROJ-45 „auf jeden Fall"
gemacht werden. PROJ-46 hat er selbst als heutiges Problem benannt — deshalb
steht es zuerst.

1. ~~**PROJ-46 — Bausteine finden statt scrollen.**~~ Erledigt am 03.09.2026.
2. ~~**PROJ-44 — Einstellungsreihe.**~~ Erledigt am 04.09.2026 — Mark hat sie
   an diesem Morgen vorgezogen („Erst Projekt vierundvierzig").
3. **PROJ-45 — Lichttisch als Auswahlwerkzeug.** Zwei Bilder gegeneinander
   halten und durchschalten. **Dazu gehört jetzt auch**, die Reihe aus PROJ-44
   dort zusammenhängend zu zeigen — die Kennung (`reihe_id`, `reihe_nr`,
   `reihe_gesamt`) steht seit dem 04.09.2026 in `scene_meta`, wird aber
   nirgends gelesen.

## Der Arbeiter kann still einfrieren (04.09.2026, 19:30)

Nachgemessen, als Mark fragte, ob Proxy und Arbeiter laufen:

- **Proxy: in Ordnung.** `npm run pruefen` meldet alle acht Punkte grün,
  `gpt-image-2` steht in der Modell-Liste.
- **Arbeiter: Prozess lebt, tut aber nichts.** Letztes Lebenszeichen
  **17:40:02** — genau die Sekunde, in der er den Auftrag geholt hat. Er
  schreibt sonst alle 20 Sekunden eines. Zwei spätere Aufträge (19:23, 19:28)
  hat er nie angefasst.
- **Er hängt, er dreht nicht durch:** 2,95 Sekunden Rechenzeit in 406 Minuten
  Laufzeit. Er wartet auf etwas, das nie kommt.

Auslöser war laut Mark das erschöpfte `gpt-image-2`-Kontingent um 17:40. Ein
HTTP 429 allein erklärt es aber **nicht**: Der Proxy-Aufruf hat eine
Zeitgrenze von 300 Sekunden (`REQUEST_TIMEOUT_MS`), und die Fehlerbehandlung
in `index.ts:53-84` setzt den Auftrag danach auf „fehlgeschlagen" oder zurück
in die Warteschlange. Beides ist nicht passiert — der Auftrag blieb auf
`running` mit `attempts = 1`.

**Was das heißt: Es gibt einen Weg, auf dem der Arbeiter hängt, ohne dass eine
der eingebauten Zeitgrenzen greift.** Wo genau, ist offen. Alle `fetch`-Aufrufe
in `supabase.ts` und `proxy.ts` haben eine Frist; `netz.ts` hat mit `mitFrist`
sogar einen Helfer dafür. Verdächtig bleibt der Teil zwischen dem Holen des
Auftrags und dem ersten Netzaufruf.

**Und der eigentliche Mangel: Niemand merkt es.** Das Lebenszeichen wird
geschrieben (PROJ-41) und in der Warteschlange angezeigt, aber nichts schlägt
Alarm, wenn es zwei Stunden alt ist. Stillstand sieht genauso aus wie „keine
Aufträge da" — derselbe Fehlermodus wie beim Auftragsmappen-Wächter im FILM
STUDIO. Ein Hinweis in der Warteschlange („Arbeiter seit 1h 52min stumm")
wäre wenig Arbeit und würde die Stunden sparen.

Sofortmaßnahme am 04.09.2026: `requeue_stale_image_jobs(30, 3)` von Hand
gerufen, der hängende Auftrag ist wieder eingereiht. Der Arbeiter muss neu
gestartet werden — er kommt von selbst nicht zurück.

## Noch nie im Betrieb gesehen

- **Die Chrome-Erweiterung über den Proxy.** Gebaut, gebaut geprüft, und
  nachgemessen, dass die geteilten Prompts wirklich im Bündel stecken. Aber
  eine echte Analyse ist darüber noch nie gelaufen. Zuerst prüfen, bevor
  irgendetwas daraufgesetzt wird.
- Ob `gpt-image-2` mit **acht Referenzbildern** noch brauchbar arbeitet. Die
  Acht ist gesetzt, nicht gemessen.

## Bekannte Lücken, bewusst offen gelassen

- **Referenzbilder werden nie gelöscht.** Sie bleiben unter
  `<uid>/referenzen/` im öffentlich lesbaren Eimer liegen — auch wenn man sie
  mit dem × aus der Ablage nimmt, auch wenn der Auftrag gelöscht wird. Das war
  Absicht (eine schon eingereihte Anfrage braucht die Adresse noch), aber es
  gibt keinen Aufräumweg. Beim Free Tier von Supabase ist das keine
  theoretische Größe. Critic-Befund I8 vom 03.09.2026.
- **Der Vergleichsgriff in der Werkbank** (Maustaste halten zeigt das Original)
  gilt nur im Reiter „Anpassungen". Im Zuschnitt gehört die Geste dem Rahmen.
  Falls Mark ihn dort auch will, braucht es eine andere Geste.
- **Referenzbilder werden nicht auf ihren Inhalt geprüft**, nur auf den
  gemeldeten Typ. Ein SVG käme durch und scheiterte erst am Modell. Der
  Arbeiter hat für genau diese Frage `bildart()` über Magic Bytes — das ließe
  sich übernehmen. Critic-Befund M5.
  **Am 04.09.2026 an ALLEN DREI Stellen behoben**, nachdem Mark nacheinander
  über jede gestolpert ist:
  1. **Erweiterung** (`extension/src/lib/bildart.ts`) — `blob.type ||
     'image/jpeg'` schickte ein AVIF als JPEG los.
  2. **App** (`src/lib/bildtyp.ts`) — vier Seiten taten dasselbe, und sieben
     API-Routen benannten jeden unbekannten Typ still in „image/jpeg" um.
  3. **Arbeiter** (`worker/src/netz.ts`, `proxy.ts`) — `bildHolen` glaubte dem
     `content-type` des Speichers, also dem, was beim Hochladen behauptet
     wurde. Das Bildmodell antwortete „Invalid image data".
  Überall gilt jetzt: Signatur schlägt Etikett, und was der Dienst nicht lesen
  kann, wird vorher umgewandelt statt umbenannt.
- **Zwei Mal derselbe Schlüssel.** App und Erweiterung haben getrennte
  Einstellungen, weil eine Erweiterung nicht an den `localStorage` der Seite
  kommt. Bewusst so, aber unschön.
- **Körperfoto der Referenzkette lässt sich nicht entfernen.** Einmal
  hochgeladen (PROJ-48-Erweiterung, 03.09.2026), gibt es nur „Anderes Foto
  wählen", kein Zurücksetzen — der Rückfall aufs Titelbild als Körperquelle
  ist ab dann über den Dialog nicht mehr erreichbar. Außerdem legt der Upload
  eine vierte Charaktervariante „Körperfoto" an, ohne das im Dialog zu sagen —
  sie taucht bei den Charakter-Varianten auf, ohne dass Mark damit rechnet.
  Critic-Befund R19 vom 03.09.2026.

## Behoben am 03.09.2026, Nachtrag

- **Speichergrenzen der Baustein-Eimer waren zu knapp fürs eigene
  Vergrößern.** Mark hatte ein Referenzsheet 4× hochrechnen lassen
  (SeedVR2) — 6784×3712, 28,1 MB — und wollte es in den Charakter übernehmen.
  `character-images` liess damals nur 20 MB zu, `location-images` und
  `pose-action-images` nur 10 MB. Alle fünf „Übernehmen"-Eimer
  (character-images, outfit-images, fashion-assets, location-images,
  pose-action-images) stehen jetzt auf 50 MB. Dazu clientseitig
  `pruefeBildgroesse()` in `src/lib/bausteine.ts`: Vor dem Hochladen prüfen
  statt erst nach dem vollen Upload-Versuch eine rohe englische
  Supabase-Meldung zu zeigen.
- Beim Nachmessen aufgefallen: **Marks Speicherbelegung liegt bei rund
  1,16 GB** über alle Bild-Eimer. Nicht behoben, nur festgehalten — falls
  Supabase irgendwann eine Speichergrenze des Kontos meldet, ist das der
  erste Blick.

## Offen aus der PROJ-55-Prüfung (04.09.2026)

Der Scene Builder ist neu gestaltet und live. Die schweren Befunde sind
behoben (Kontrast der zweiten Textebene, Orange als Schriftfarbe, die
Bernsteinknöpfe im Preset-Dialog, die geratenen Haltepunkte). Offen bleibt:

### Sollte Mark sehen

- **Die Kamerawinkel heißen auf Deutsch-Englisch.** Zugeklappt steht dort
  „Kamerawinkel — Eye Level", nicht „Augenhöhe". Die Labels in
  `CAMERA_ANGLES` (`scene-builder-options.ts:126`) sind englisch, die
  Beschriftungen drumherum deutsch. Fällt erst auf, seit der Wert zugeklappt
  sichtbar ist. Betrifft auch andere Listen — eine Entscheidung für Mark, weil
  Fachbegriffe wie „Bleach Bypass" englisch bleiben sollten, „Eye Level" aber
  nicht.

### Kleinere Befunde, nicht behoben

- **Label und Emoji werden ein zweites Mal getippt.** `RefExportCard` und
  `NebenAsset` (`page.tsx:1428–1444`) schreiben „Charakter 👤", „Outfit 👗"
  usw. noch einmal hin, obwohl dieselben Werte in `SLOTS` (`page.tsx:75–84`)
  stehen. Genau die Drift, gegen die `optionLabel` eingeführt wurde.
- **`findLabel` im Preset-Dialog** (`scene-preset-dialog.tsx:64`) ist eine
  dritte eigene Fassung derselben Sache. Gehört auf `optionLabel` gezogen.
- **Ein unbekannter Schlüssel lässt die zugeklappte Gruppe lügen.** Kommt über
  `importPresetFromFile` ein Preset mit einem Wert, den es nicht mehr gibt,
  zeigt der Kopf „nicht gesetzt", obwohl ein Wert gesetzt IST. Bei einer
  zugeklappten Gruppe ist das die einzige Information. (Derselbe unbekannte
  Schlüssel lässt `buildPrompt` schon vorher hart abstürzen —
  `szene-prompt.ts:137`, `CAMERA_ANGLES.find(...)!.prompt`. Vorbestehend.)
- **Toasts und der Quick-Capture-Knopf sind noch dunkel.** Sie kommen aus
  `layout.tsx` und schweben über der hellen Seite. Bei Toasts vertretbar
  (App-Ebene), beim runden Knopf unten rechts ein Fremdkörper.
- **Unter rund 1100px Fensterbreite gibt es keine Anpassung.** Seitenleiste,
  Auswahlspalte und rechte Spalte sind zusammen 1072px fest; darunter
  schrumpft die Mitte gegen null. Die Karten selbst passen sich seit dem
  `auto-fit`-Umbau an, die drei festen Spalten nicht. Vorbestehend, aber die
  Hausregel in `.claude/rules/frontend.md` fordert 375px.
- **`--sb-k-or` wird an einer Stelle als Aktionsfarbe benutzt**
  (`page.tsx:451`, Entfernen-Knopf). Es ist die Kennfarbe der Karte
  „Bild & Schärfe". Der Hexwert ist zufällig derselbe wie `--destructive`,
  man sieht also nichts — semantisch mischt es zwei Systeme, die `papier.css`
  ausdrücklich trennt.
- **Toter `disabled`-Prop** an `Chip` (`page.tsx:124/135`), wird nie übergeben.
- Der Dateikopf von `papier.css` sagt, es gebe *einen* Geltungsbereich
  `.sb-papier` — die Klassen `.sb-blatt`, `.sb-mod`, `.sb-plate` usw. stehen
  aber global. Folgenlos, weil die Namen eindeutig sind; als Aussage falsch.

## Marks Einwand gegen PROJ-44 (04.09.2026) — die Achse ist falsch gewählt

Mark, nachdem er die fertige Einstellungsreihe gesehen hat:

> „Nur bringt mir das überhaupt nix. Wenn ich alles gleich lasse und das Ganze
> nur einmal von Nahem habe und einmal von der Ferne — das macht jetzt keinen
> Reiz aus. Sinnvoll wäre vielleicht, wenn man mehrere Presets hat, dass man
> sagt, man will jetzt mit einer bestimmten Person fünf verschiedene Fotos
> haben und nutzt dafür das und das Preset. […] Also die Technik kannst du
> schon so lassen. Aber für das, was jetzt genutzt ist, ist es sinnlos."

**Er hat recht, und der Fehler ist meiner.** Die Spezifikation stand seit dem
03.09.2026 auf „Einstellungsgrößen", und niemand — ich nicht, Nova nicht,
Critic nicht — hat gefragt, ob das die Achse ist, die für Mark einen
Unterschied macht. Geprüft wurde, ob die Reihe *tut, was sie verspricht*.
Nicht, ob das Versprechen etwas wert ist. Critic hat sogar die Dramaturgie
angemerkt (Jump Cuts, 30-Grad-Regel) — das war derselbe Befund von der
technischen Seite, und ich habe ihn als Randnotiz behandelt statt als das,
was er war.

**Der Mechanismus bleibt richtig und bleibt bestehen:** N Aufträge, alles
gepinnt bis auf eine Achse, gemeinsame `reihe_id`, einzeln wiederholbar, Zahl
vor dem Klick. Falsch ist nur, dass die Achse fest auf `shot_type` verdrahtet
ist.

**Vorgeschlagen (PROJ-55): die Achse wird wählbar.** „Reihe über …"
— Presets (Marks Idee, die stärkste), Posen, Locations, Outfits, Mimik, und
Einstellungsgrößen als das, was sie wirklich ist: eine von mehreren
Möglichkeiten, gut zum Finden des richtigen Bildausschnitts.

Die eine Entscheidung, die dabei zu treffen ist: Ein Preset trägt in
`ScenePresetConfig` AUCH `character_id`, `outfit_id` und `location_id`. Wenn
Mark „eine Person, fünf Presets" will, muss der Charakter aus der aktuellen
Szene gewinnen und das Preset den Rest liefern. Vorschlag: Charakter bleibt
immer gepinnt, alles Übrige kommt aus dem Preset, soweit es das setzt — und
Mark kann je Baustein sehen und umschalten, was gepinnt bleibt.

**Lehre fürs nächste Mal:** Bei einem Feature, das Mark noch nie in der Hand
hatte, gehört die Frage „wofür genau setzt du das ein?" VOR den Bau, nicht
hinterher. Ein Prüflauf misst Bauart gegen Spezifikation — er kann eine
Spezifikation nicht widerlegen.

## Offen aus der PROJ-44-Prüfung (04.09.2026)

Der BLOCKER (`CAMERA_COMBO_OVERRIDES` verwarf Kamerawinkel, Tiefenschärfe und
Format) ist behoben und aufgeschrieben, siehe
`features/PROJ-44-einstellungsreihe.md`. Was offen bleibt:

### Eine echte Frage an Mark, keine Aufgabe

- **Eine Reihe wechselt die Einstellungsgröße, aber nicht die Achse.** Im
  Schnitt springen zwei Einstellungen desselben Motivs aus derselben
  Kameraposition, wenn sich die Größe nicht deutlich genug ändert — das ist
  der Grund für die 30-Grad-Regel. Bei benachbarten Paaren wie Nah → Detail
  oder Halbtotale → Halbnah ist das sichtbar. **Für Auswahlmaterial ist die
  Reihe genau richtig** („welche Größe nehme ich"), für eine schnittfähige
  Folge fehlt ein leichter Winkelversatz je Einstellung. Das wäre dann mehr
  als ein Feldwechsel — deshalb Marks Entscheidung, nicht meine.

### Kleinere Befunde, nicht behoben

- **„Detail" ist an ein Gesicht gebunden.** `extreme_closeup` heißt im Prompt
  „extreme close-up shot focusing on **facial** details". Im Schnitt ist ein
  Detail aber oft eine Hand, ein Gegenstand, ein Schild. Bei einer Szene ohne
  Person liefert dieser Punkt der Vorbelegung ein Gesicht, das dort nichts zu
  suchen hat.
- **Eine neue Einstellungsgröße landet an der falschen Stelle der Reihe.**
  `REIHEN_ORDNUNG` ist `SHOT_TYPES.map().reverse()` — reine Umkehr, kein
  Merkmal am Eintrag. Wer eine elfte Größe hinten anhängt, bekommt sie als
  erste, weiteste Einstellung, unabhängig davon, was sie zeigt. Die Ableitung
  ist trotzdem besser als eine zweite handgetippte Liste; wer eine Größe
  hinzufügt, muss nur wissen, dass die Position aus der Reihenfolge in
  `SHOT_TYPES` kommt.
- **Die Sperre `!prompt` ist wirkungslos** (in `reihe-button.tsx` und
  `queue-button.tsx`). `buildPrompt` schiebt immer mindestens „Indoor scene."
  und „Photorealistic." hinein — der String ist nie leer. Die Prüfung schützt
  nichts, schadet aber auch nicht.
- **`buildPrompt` stürzt bei einem unbekannten Schlüssel ab** statt ihn zu
  überspringen (`SEASONS.find(...)!.prompt`). Aufgefallen beim Schreiben der
  Tests: ein Tippfehler im Schlüssel gibt „Cannot read properties of
  undefined" mitten im Prompt-Bau. Aus der Oberfläche heraus kann das nicht
  passieren, weil dort nur gültige Werte wählbar sind — aus einem importierten
  Preset alter Fassung aber schon.

## Behoben am 04.09.2026, Abend

- **Der rechte Rand wurde in der ganzen App abgeschnitten.** Mark hat es zum
  zweiten Mal gemeldet — an den Kacheln der Seitenleiste fehlte rechts der
  2px-Farbrand. Ursache war an **15 Stellen** dasselbe:
  `style={{ right: '-17px' }}`. Die Rollflaeche wurde 17 Pixel ueber ihren
  Rahmen hinausgeschoben, damit der Rollbalken dort im Verborgenen sitzt — was
  voraussetzt, dass er genau 17 Pixel breit ist. Chrome misst je nach Version,
  Zoomstufe und Windows-Einstellung 15, 16 oder 0 (Overlay); dann ist die
  Flaeche breiter als ihr Rahmen und der Rahmen schneidet ab.
  Ersetzt durch `.ohne-rollbalken` in `globals.css` — der Rollbalken wird
  abgeschaltet statt weggeschoben, die Flaeche liegt buendig (`right-0`).
  Nachgewiesen mit einem Bildschirmfoto beider Fassungen nebeneinander, bevor
  eine Zeile geaendert wurde.

## Kaputt, aber niemandem aufgefallen

- **`npm run lint` läuft nicht.** Das Skript ruft `next lint`, und das gibt es
  in Next 16 nicht mehr — es reicht „lint" als Verzeichnisnamen weiter und
  bricht ab. Bestand, nicht durch die Arbeit vom 02./03.09. verursacht. Es
  heißt aber: ESLint prüft hier gerade gar nichts. Der Fix ist eine Zeile in
  `package.json` (`eslint .`), aber danach ist mit einer Menge angestauter
  Meldungen zu rechnen — deshalb als eigener Punkt und nicht nebenbei.

## Kleinkram, seit Längerem offen

- `comfyui.bat`: eine Zeile von `venv` auf `venv312` ändern. Vor Tagen
  angeboten, nie gemacht.
- `~/.claude/launch.json`: nova hat für einen Browsertest den Eintrag
  `prompt-tresor` (Port 3040) angelegt. Dauerhaft und nützlich — Mark fragen,
  ob er bleiben soll.
- Status in `INDEX.md`: PROJ-37 bis PROJ-43 und PROJ-47 stehen auf „In Review".
  Was davon läuft und geprüft ist, gehört auf „Deployed".

## Was am 3. September fertig wurde

Damit morgen niemand doppelt sucht:

- Werkbank: Zoom mit dem Mausrad, Verschieben, Vorher/Nachher per gehaltener
  Maustaste. Zuschnitt ohne Zoom (mit Begründung).
- Referenzbilder für die freie Erzeugung, samt Hineinziehen von Webseiten über
  `/api/referenz-holen` mit SSRF-Wache (50 Tests).
- Löschen im Lichttisch.
- Alle sieben Analysen laufen wahlweise über Marks eigenen Proxy — in der App
  UND in der Erweiterung. Standardmodell `claude-opus-4-6`.
- PROJ-47 Prompt-Assistent, von Mark im Betrieb bestätigt.
- **`localhost` statt `127.0.0.1`**: 20 019 ms gegen 4 ms. Diese eine Zeile
  entscheidet, ob der Proxy-Weg brauchbar ist — nicht anfassen, es gibt Tests
  und einen Kommentar mit der Messung.

## Offen aus der PROJ-54-Prüfung (Nacht zum 04.09.2026)

Die Outfit-Referenzkette ist gebaut, geprüft und live — aber ein unabhängiger
Prüfdurchgang fand elf gewichtige Punkte. **Die vier Prompt-Befunde wurden
noch in derselben Nacht behoben** (reine Textarbeit, kein Verhaltensrisiko);
die Code-Befunde stehen bewusst offen, weil sie echte Änderungen und einen
Prüflauf brauchen.

**Wichtig: Drei davon stehen wörtlich auch in `use-referenzkette.ts`
(PROJ-48).** Die beiden Ketten-Hooks sind Kopien voneinander — wer einen
repariert, muss den anderen mitnehmen, sonst bleibt die ältere Kette stehen.

### Kostet Geld, deshalb zuerst

1. **Bezahlte Erzeugung nach dem Abbruch.** `erzeuge()` prüft die Laufnummer
   nicht, bevor es einen Auftrag einreiht — nur danach. Wer „Warten aufgeben"
   drückt, während gerade abgelegt wird (mehrere Sekunden: Download, Upload,
   zwei Inserts), bezahlt noch ein Bild. Auch in PROJ-48.
2. **Doppelklick = zwei Aufträge.** Der Startknopf bleibt vom Klick bis zur
   Antwort von `anlegen` klickbar — zwei Netzwerkrunden ohne Rückmeldung.
   Gilt auch für „Nehmen und weiter" und „Neu erzeugen". Auch in PROJ-48.
   **Teilweise behoben am 04.09.2026:** Im Scene Builder liegt die Sperre jetzt
   in einem `useRef` statt im State (`queue-button.tsx`, `reihe-button.tsx`),
   beide in `try/finally`. Das Muster ist damit erprobt und lässt sich
   übertragen — **in den beiden Ketten-Dialogen steht der Fehler unverändert**.
3. **Ein bezahltes Blatt geht beim Schließen am Halt verloren.** Der Dialog
   lässt sich in der Prüfen-Phase schließen; das fertige Vorne-Blatt ist dann
   weg, und der nächste Klick bezahlt es erneut. Beim Weg „Neu erzeugen" sagt
   der Dialog ausdrücklich, das Bild bleibe in der Warteschlange — beim
   Schließen sagt er nichts.
4. **„Weiter mit ‚Rückseite'" löst bis zu drei Erzeugungen aus.** Der Knopf
   nennt einen Schritt, startet aber die ganze Restliste. Vorschlag:
   „Weiter — Rückseite, Detailaufnahmen und Referenzsheet (3 Bilder)".

### Irreführende Anzeigen

5. **Der Fehler wird beim falschen Schritt gemeldet.** Gemeldet wird immer der
   erste offene Schritt, nicht der gescheiterte — daneben steht dann ein
   grüner Haken für genau diesen Schritt. Auch in PROJ-48.
6. **Am Ende kein einziges Ergebnisbild.** Nach dem Halt laufen drei Blätter
   durch, der Dialog zeigt danach nur Häkchen. Vier Vorschaubilder im
   Fertig-Zustand wären ein kleiner Eingriff mit großer Wirkung — und die
   einzige Stelle, an der ein misslungenes Blatt 3 auffiele.

### Datenbank

7. **Kein Eindeutigkeits-Index auf Variantennamen.** Nachgemessen in der Nacht
   zum 04.09.2026: Weder `outfit_variants` noch `character_variants` haben
   einen Unique-Index auf `(parent_id, name)`. Zwei parallele Läufe legen
   deshalb zwei Fächer gleichen Namens an, und `standErmitteln` greift dann
   willkürlich eines. Ein Index würde beide Ketten auf einmal absichern —
   **vor dem Anlegen prüfen, ob es schon Dubletten gibt**, sonst scheitert er.

### Struktur

8. **`istEigenerSpeicher` liegt in der falschen Datei.** Es ist eine Regel des
   Arbeiters, keine der Charakterkette — steht aber in `referenzkette.ts` und
   wird von der Outfit-Kette re-exportiert. Inzwischen zieht auch das
   Outfit-Formular `referenzkette.ts` mit herein. Gehört in ein neutrales
   Modul (`lib/speicher.ts`), das beide importieren. Fünf Minuten.

### Kleinere Punkte

- Klick auf das X während „wartet" tut sichtbar nichts — ein Toast würde
  reichen.
- Eine gefüllte Lücke zieht das Referenzsheet nicht nach: Fehlte die Rückseite
  und wird nachgeholt, bleibt ein ohne sie gebautes Referenzsheet stehen.
- Nirgends im Dialog steht, dass ein Klick vier bezahlte Erzeugungen auslöst.
