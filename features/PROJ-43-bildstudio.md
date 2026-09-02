# PROJ-43: Bildstudio

## Status: In Progress
**Created:** 2026-09-02

Konzept mit Mockups:
https://claude.ai/code/artifact/feccc689-9c7d-457c-8c57-e123e50fbb9a

## Warum

Die Warteschlange zeigt **Aufträge** — Status, Versuchszähler, Fehlertext,
Arbeiter-Ampel. Das ist ein Maschinenraum, und als solcher richtig. Was fehlt,
ist der Raum davor: einer, der **Bilder** zeigt.

Marks Ausgangspunkt: Ein fertiges Bild einer Person in die Charakterbibliothek
zu bringen kostet sieben Handgriffe über drei Bildschirme — herunterladen, zur
Bibliothek wechseln, Eintrag suchen, Variante wählen, hochladen, beschriften.
Dazu geht heute gar nicht: ein Bild einfach so erzeugen, ohne den Scene Builder.

## Phasen

| | | Stand |
|---|---|---|
| **A** | „Übernehmen nach …" auf jeder Ergebniskachel | **fertig** |
| **B** | Rubrik Bildstudio mit Lichttisch | **fertig** |
| **C** | Freie Erzeugung mit Speichern in den Trésor | **fertig** |
| D | Werkbank: Zuschneiden und sieben Regler | offen |

Marks Änderung an der Reihenfolge: Gemini als viertes Vergrößerungsverfahren
zuerst (erledigt, PROJ-42), dann A bis D.

## Phase A — „Übernehmen nach …"

Dritter Knopf auf jeder Ergebniskachel in `/queue`. Zwei Entscheidungen, dann
liegt das Bild in der Bibliothek: welche Art, welcher Eintrag.

**Auswahl über Bilder, nicht über Namen.** Dieselbe Lehre wie beim
Referenz-Auswahldialog — Mark kennt die Namen seiner Outfits nicht, er erkennt
sie am Bild. Das Suchfeld ist die Abkürzung bei vielen Einträgen, nicht die
Voraussetzung.

### Die zwei Entscheidungen, die zählen

**Kopieren statt verweisen.** Es gäbe `addImageUrl()` in allen fünf Hooks — es
hängt einem Baustein eine Bildadresse an, ohne ein Byte zu bewegen, und
`generated-images` ist öffentlich lesbar. Der Verweis würde funktionieren, bis
Mark den Auftrag löscht: `use-image-jobs.ts` löscht dann dessen Dateien mit, und
das Bild im Charakter stürbe still mit — ein kaputtes Kästchen ohne
Fehlermeldung, vielleicht erst Wochen später bemerkt. Der Preis des Kopierens
ist Speicherplatz, der Gewinn ist, dass nichts unbemerkt kaputtgeht.

**Das Titelbild wird nicht angefasst** — auch dann nicht, wenn der Baustein noch
keines hat. Mark am 02.09.2026: „Da habe ich mühsam schon eigene Titelbilder
erstellt, sodass die möglichst alle gleich aussehen." Ein übernommenes Bild ist
immer nur ein weiteres Bild.

### Wie es gebaut ist

`src/lib/bausteine.ts` ist eine Tabelle, keine fünf Funktionen. Nachgemessen:
Alle fünf Bildtabellen haben exakt dieselben Spalten
(`id, variant_id, user_id, url, storage_path, sort_order, created_at`). Im
Projekt steht der Ablauf „hochladen → Adresse holen → Zeile einfügen" trotzdem
acht- bis zehnmal da, jedes Mal leicht anders. Ein sechster Baustein ist hier
ein Eintrag, keine Kopie.

Der Ablagepfad ist für alle fünf einheitlich
(`{user}/{parent}/{variant}/{marke}.{endung}`), obwohl die vorhandenen Wege sich
unterscheiden. Gefahrlos, weil in allen fünf Hooks über die Spalte
`storage_path` gelöscht wird und nicht über einen zusammengebauten Pfad —
nachgemessen. Und die Speicherregel verlangt nur, dass der erste Ordner die
Nutzerkennung ist.

Scheitert das Eintragen der Zeile, wird die bereits hochgeladene Datei wieder
weggeräumt. Sonst läge sie im Eimer, ohne dass jemand wüsste, wozu sie gehört.

### Neun Ziele, drei Bauarten (nachgereicht auf Marks Wunsch)

Prompts und die drei Archetypen-Bibliotheken sind dazugekommen. Sie sind anders
gebaut als die fünf Bibliotheken, und diese Unterschiede stehen jetzt als
Felder in der Tabelle statt als `if` im Ablauf:

| | Bibliotheken | Archetypen | Prompts |
|---|---|---|---|
| Bild hängt an | `variant_id` | `archetype_id` | `prompt_id` |
| Varianten | ja | **nein** | **nein** |
| `storage_path` | ja | ja | **nein** |
| Pflichtfeld | — | — | **`type` ('image')** |
| Namensspalte | `name` | `name` | **`title`** |

Die Namensspalte war der stillste Fallstrick: `prompts` heißt die Spalte
`title`. Eine Abfrage auf `name` hätte einen Fehler geliefert, keine leere
Liste — der Alias `name:title` macht daraus für die Oberfläche wieder einen
einheitlichen Namen.

Und „keine Varianten" heißt hier ausdrücklich NICHT „geht nicht": Der Warnsatz
„hat noch keine Variante" erscheint nur bei Bausteinen, die überhaupt welche
haben.

## Phase B — der Lichttisch

Eigene Rubrik `/bildstudio`, in der Seitenleiste VOR der Warteschlange. Alle
Bilder aus allen Aufträgen als ein Raster, neueste zuerst. Ein Auftrag mit vier
Durchläufen ist hier vier Kacheln, kein Eintrag mit vier Bildern darin — genau
das ist der Unterschied zur Warteschlange.

Vier Filter: **Alle · Heute · Vergrößert · Noch nicht abgelegt.**

### „Noch nicht abgelegt" brauchte eine eigene Tabelle

Der Filter ließ sich nicht ableiten. Beim Übernehmen wird das Bild **kopiert**;
die Kopie im Baustein hat einen eigenen Pfad in einem eigenen Eimer und
keinerlei Verweis zurück. Die Frage „was habe ich schon abgelegt?" wäre nur
durch Bildvergleich zu beantworten.

Deshalb `bild_uebernahmen` (`docs/proj-43-bild-uebernahmen.sql`) — eine reine
Notiz: Wird eine Zeile gelöscht, geht kein Bild verloren, das Bild steht dann
nur wieder als „noch nicht abgelegt" da. Gemerkt wird der **Speicherpfad**, nicht
die Adresse: Die trägt einen Cache-Brecher (`?v=`), der sich mit jedem Versuch
ändert.

Abgelegte Bilder tragen eine grüne Marke links oben.

### Die Kachel steht nur einmal da

`src/components/ergebnis-kachel.tsx` — Bild, Vergrößern-Menü, Übernehmen,
Herunterladen. Die Warteschlange benutzt jetzt dieselbe Komponente.

Als Kopie wären die beiden genau dort auseinandergedriftet, wo es weh tut: bei
den Preisangaben und beim Vergrößerungsmenü. Denselben Fehler hat Critic in
diesem Projekt schon einmal gefunden — Menü und Bestätigung nannten
verschiedene Preise.

Beim Zusammenführen fiel ein Unterschied auf, der sonst still geblieben wäre:
Der erste Entwurf der Kachel nahm beim Dateinamen `scene_meta.name ?? prompt`,
die Warteschlange bisher `?? null`. Das hätte jedem Download hundert Zeichen
Prompt in den Namen geschrieben. Jetzt wieder wie vorher.

## Phase C — freie Erzeugung

Links im Bildstudio: Prompt eintippen, Modell, Format, Anzahl. Kein Umweg über
den Scene Builder. Der Einfügeweg dahinter ist derselbe (`anlegen()`) — er weiß
nichts von Szenen und wurde nicht angefasst.

**Gemini ist erstmals als Bildmodell wählbar.** Es funktioniert grundlegend
anders: nativer Google-Endpunkt statt `/v1/images/generations`, Seitenverhältnis
plus Größenklasse statt Pixelmaßen, JPEG statt PNG. Gemessen an einem echten
Lauf: 16:9 in 2K ergab 2752×1536 in 25 Sekunden.

| | gpt-image-2 | Gemini |
|---|---|---|
| 16:9 wird | 3:2 (16 % daneben) | 1,7917 (0,78 % daneben) |
| Auflösung | ~1,5 MP | bis 17 MP |
| Referenzbilder | ja | **nein** |

**Prompt speichern:** Unter dem Feld erscheint „War gut?" mit vorbelegtem
Titelfeld. Kein Dialog — ein Dialog für ein Feld ist einer zu viel. Der Prompt
landet mit dem Etikett `bildstudio` im Trésor und geht in die semantische Suche.

### Was Critic gefunden hat

**Der Blocker war einer, den ich allein nicht gefunden hätte:** `MODELLE` speist
nicht nur das neue Bedienfeld, sondern auch den Scene Builder. Dort wird nur
`m.label` gerendert — die Notiz „ohne Referenzbilder" erscheint gar nicht. Mark
hätte eine Szene mit Charakter- und Outfit-Referenz gebaut, auf Gemini gestellt
(weil dort 16:9 wirklich 16:9 wird) und ein Bild mit einer **erfundenen Person**
bekommen. Der Prompt hätte weiter „Image 1 = CHARACTER — take the face" diktiert,
ohne dass ein Bild 1 mitginge. In der Warteschlange stünde trotzdem „2 Ref.".

Behoben doppelt: `kannReferenzen` ist jetzt ein **Datum** am Modell (eine Notiz,
die an der entscheidenden Stelle nicht gerendert wird, schützt niemanden), der
Scene Builder bietet bei Referenzbildern nur passende Modelle an und stellt
zurück, wenn nachträglich eine Referenz dazukommt — und der Arbeiter bricht mit
klarer Ansage ab, statt sie zu verschlucken.

**Die Datenbankschranke war nicht dicht.** `ziel_klasse is null or ... or model
like 'gemini%'` ließ einen Gemini-Auftrag OHNE Größenklasse durch, und der
Arbeiter fiel still auf 2K zurück — während drei Zweige weiter oben dieselbe
Lücke bei der Vergrößerung als Fehler galt. Zwei Zweige, dieselbe Frage,
entgegengesetzte Antwort. Jetzt eine Äquivalenz (`proj-43c`), und der Rückfall
ist ein Fehler. Alle vier Fälle an der laufenden Datenbank durchprobiert.

**Drei Anzeigen widersprachen sich** über dasselbe Bild: Die Warteschlange zeigte
`1536x1024` (ein Pflichtfeld ohne Bedeutung), der Arbeiter protokollierte die
Klasse, und der Download nannte jede Datei `.png` — auch die JPEGs, für die
`ergebnisAblegen` eigens Endung und Typ aus dem Inhalt bestimmt. Alle drei ziehen
jetzt am selben Strang.

**Der Autostart-Schutz griff für Gemini nicht.** `index.ts` erkennt den
Wettlauf zwischen Arbeiter und Proxy an einer Textprobe — und der Satz stand nur
in `proxy.ts`. Ein Gemini-Auftrag beim Hochfahren hätte alle drei Versuche in
Sekunden verbrannt. Der Satz ist jetzt eine Konstante in `netz.ts`, genau wie
`mitFrist` nach dem letzten Durchgang.

Dazu: `JSON.parse` ungesichert · Modell fest verdrahtet statt durchgereicht ·
Zeitgrenze aus dem falschen Topf (`falTimeoutMs` statt `requestTimeoutMs`,
obwohl Gemini über den *lokalen* Proxy läuft) · stiller Rückfall auf 1:1 bei
unbekanntem Format · die widerlegte „exakt"-Zusage stand noch im Arbeiter ·
fehlende Beschriftungen · der Speichern-Knopf ließ sich in eine Sackgasse
fahren, wenn man nach dem Speichern den Titel korrigierte.

## Nach Marks erstem Durchgang (02.09.2026)

**Der Erzeugen-Bereich war zu schmal.** „Ich kann hier fast nichts lesen, was
dort alles steht." Jetzt ein Trennbalken zwischen Feld und Bildern: ziehen,
Pfeiltasten, Doppelklick setzt zurück. Die Breite bleibt im Browser gespeichert.
Das Bildraster nimmt entsprechend weniger Spalten.

**Bilder landeten immer in der ersten Variante.** „Bei den Charakteren ist es
das erste, das mit Kopf betitelt ist. Da werden die alle abgelegt." Der Grund:
Die Variantenwahl war ein kleines Aufklappmenü am unteren Rand, vorbelegt mit
der ersten — und wurde übersehen. Jetzt sichtbare Schaltflächen, und der
Bestätigungsknopf nennt das Ziel mitsamt Variante.

**Alle Bilder eines Charakters auf einen Blick.** „Man sollte eigentlich schon
alle Bilder sehen können, die den jeweiligen Charakter betreffen, ohne dass man
immer klicken muss." Unter dem Variantenraster steht jetzt eine Übersicht über
alle Bilder aller Varianten; jedes trägt die Marke seiner Variante und bringt
einen mit einem Klick dorthin. Die Varianten bleiben — sie tragen Prompt und
Beschreibung, das ist ihr Zweck. Was fehlte, war die Übersicht darüber.

**Zwei Formate dazu: 4:3 und 3:4.** Gemini kennt beide nativ; gpt-image-2 macht
daraus die nächstliegende seiner drei Größen (4:3 → 3:2, spürbar breiter — das
steht als Hinweis am Feld).

**Nano Banana Pro: der erste Befund war zu grob.** „Unknown provider for model"
liest sich wie „gibt es nicht" — es heißt aber „kein angemeldeter ANBIETER
führt es".

Genauer gemessen, in der Anwendung selbst: `gemini-3-pro-image` steht 4×,
`gemini-2.5-flash-image` 5× im Katalog des Proxys, mitsamt vollständiger
Modellbeschreibung (`owned_by: google`, `type: gemini`). Der Proxy meldet
36 Modelle aus drei Anbietern — anthropic 15, **antigravity 11**, openai 10.
Keiner vom Typ `gemini`, weil `gemini-api-key` in `config.yaml` auskommentiert
ist. Marks antigravity-Anmeldung führt nur `gemini-3.1-flash-image`.

**Es fehlt also ein Schlüssel, kein Modell.** Beide sind jetzt in der Auswahl,
mit dem Hinweis dazu; ohne Schlüssel scheitert der Auftrag mit einer Meldung,
die sagt, was zu tun ist (an der echten Gegenstelle geprüft).

`gemini-3.1-pro-image` steht dagegen **gar nicht** in der Anwendung — diese
Fassung (v0.2.63) kennt nur `gemini-3-pro-image` und
`gemini-3-pro-image-preview`. Es käme mit einer neueren EasyCLIProxyAPI.

## Offen

- Einen Baustein direkt aus dem Dialog neu anlegen geht noch nicht — bisher nur
  in vorhandene übernehmen.
- Sammlungen, Kamera/Licht und Look & Grading sind keine Ziele. Sie haben nur
  ein Titelbild und keine Bilderliste — dorthin zu übernehmen hieße, das
  Titelbild zu überschreiben, und genau das soll nicht passieren.
