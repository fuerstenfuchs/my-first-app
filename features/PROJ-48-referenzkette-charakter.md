# PROJ-48: Referenzkette für Charaktere

## Status: In Review
**Created:** 2026-09-03

## Warum

Mark am 03.09.2026:

> „Ich hab meistens ein Bild von einer Person, damit lege ich den Charakter
> auch an. Dann brauche ich Referenzbilder vom Kopf, vom Körper. Und dann noch
> ein Referenzbild — das haben wir noch gar nicht angelegt. Sollten wir aber
> tun, weil ich das wahrscheinlich am häufigsten nutze."

Heute macht er das von Hand: Sheet erzeugen, Ergebnis herunterladen, wieder
hochladen, nächstes Sheet erzeugen. Bei drei Bildern je Charakter ist das der
Handgriff, den er am häufigsten macht — und der, bei dem am meisten schiefgeht.

## Das dritte Referenzbild, das es noch nicht gibt

Marks Beschreibung, wörtlich sinngemäß: **ein großes Kopfbild von leicht schräg
vorne** (Dreiviertel, damit man eine Seite mitsieht), **daneben der Körper von
vorne, komplett ohne Kopf**, und **daneben der Körper von hinten**.

Der Grund für „ohne Kopf" ist der wichtige Teil: So sieht das Modell den Kopf
**genau einmal in groß** und kommt nicht durcheinander. Ein Blatt, das dreimal
dasselbe Gesicht in klein zeigt, führt zu Vermischungen.

## Die Kette

Jedes erzeugte Bild wird beim Charakter gespeichert **und** ist die Referenz
für das nächste:

```
Originalbild des Charakters
        │
        ▼
   1. Kopf-Sheet          Referenz: das Original
        │
        ▼
   2. Körper-Sheet        Referenz: der erzeugte Kopf
        │
        ▼
   3. Kombi-Referenz      Referenz: Kopf UND Körper
      (großer 3/4-Kopf + Körper vorne ohne Kopf + Körper hinten)
```

Am Ende hat der Charakter vier Bilder: das Original plus drei erzeugte.

## Marks Antworten (03.09.2026) — damit ist geklärt

**1. Halb von Hand, halb automatisch.** Der Kopf wird zuerst erzeugt und Mark
sieht ihn an: „Ja, wär wahrscheinlich besser, wenn ich das generierte Kopfbild
zuerst sehe." Erst wenn er ihn nimmt, laufen Körper und Referenzsheet **ohne
weiteres Zutun** durch. Das ist die richtige Stelle für den Halt: Ein
misslungener Kopf pflanzt sich sonst in beide folgenden Bilder fort.

**2. Schritt 2 bekommt NUR den erzeugten Kopf.** Nicht zusätzlich das Original.

**3. Die Benennung steht fest:** das erste heißt **Kopf**, das zweite
**Körper**, das dritte **Referenzsheet**.

**4. Neue Anforderung an das Körperbild** (Marks Worte): Im Prompt muss
**neutrale Kleidung** verlangt werden — aber so, dass man **die Proportionen
des Körpers gut sieht**. Und **möglichst kein Schattenwurf**.

**5. Drei eigene Varianten.** Mark am 03.09.2026: „Es werden drei eigene
Varianten. Es werden einmal Kopf, einmal Körper und einmal Referenzsheet."
Nicht alle drei in eine Variante, und das Titelbild wird nie überschrieben —
stehende Regel seit dem 02.09.2026.

## Voraussetzung — PROJ-49, erledigt

Die Kette setzt voraus, dass das Ausgangsbild im eigenen Speicher liegt. Genau
daran ist Marks Versuch am 03.09.2026 zunächst gescheitert. PROJ-49 hat das
behoben: 401 Bilder nachgeholt, und die Erweiterung kopiert ab jetzt beim
Erfassen. **Mark hat am 03.09.2026 bestätigt: „Das Bild geht jetzt auch
durch."** Der Weg ist frei.

## Umsetzung (03.09.2026)

**Neue Dateien**

- `src/lib/referenzkette.ts` — die Regeln ohne Oberfläche: Reihenfolge,
  Variantennamen, Referenzzuordnung je Schritt, die Speicher-Schranke und
  „wo geht es weiter". Frei von React und Supabase, damit ohne Anmeldung
  prüfbar.
- `src/lib/referenzkette.test.ts` — 16 Prüfungen. Jede wurde einmal absichtlich
  zum Scheitern gebracht (Reihenfolge vertauscht, Titelbild zusätzlich an
  Schritt 2, Speicher-Schranke ausgehängt): 7 Prüfungen wurden rot, danach
  wieder grün.
- `src/hooks/use-referenzkette.ts` — die Ausführung: einreihen, warten,
  ablegen, wiederaufnehmen.
- `src/components/characters/referenzkette-dialog.tsx` — die Oberfläche.

**Geänderte Dateien**

- `character-sheet-dialog.tsx` — `Referenzsheet` als vierter, einzeln wählbarer
  Sheet-Typ; die drei Ketten-Prompts werden exportiert (eine Quelle, keine
  Kopie).
- `characters/page.tsx` — Knopf „Referenzkette" in der Kopfzeile.

**Entscheidungen**

- **Eigene Referenzansage je Schritt** statt `referenzZuordnung()` aus
  `image-generation.ts`: Die kennt nur Charakter/Outfit/Location und hätte beim
  Referenzsheet zweimal „CHARACTER" geschrieben. Beim dritten Schritt sind es
  aber zwei Aufgaben — Gesicht aus Bild 1, Körperbau aus Bild 2. Die
  Sheet-Prompts selbst bleiben unverändert; angehängt wird nur die Zuordnung.
- **Die Vorlage des nächsten Schrittes ist das ABGELEGTE Bild**, nicht das
  Ergebnis des Auftrags: Wird ein Auftrag aus der Warteschlange gelöscht,
  verschwindet seine Datei mit.
- **Titelbild wird vorher geprüft**, nicht erst vom Arbeiter abgelehnt. Sonst
  reiht die Kette Aufträge ein, von denen der erste sicher scheitert.
- **Kein harter Zeitablauf beim Warten**, nur ein Hinweis nach vier Minuten.
  Ein Auftrag darf lange dauern, wenn andere vor ihm liegen.
- **Format bleibt wie bisher** (kein `aspect_ratio`, keine Formatansage im
  Prompt) — genau wie beim bisherigen Weg über den Sheet-Dialog. Mit
  Referenzbild richtet sich gpt-image-2 ohnehin nach der Vorlage. OFFEN: ob die
  Sheets ausdrücklich quer angefordert werden sollen.

## Erweiterung: Körperquelle für den Körper-Schritt (03.09.2026, zweite Runde)

**Der Befund.** Mark: „Ich habe bisher die Erfahrung gemacht bei den letzten
Bildern, dass der Körper irgendwie immer gleich aussieht." Ursache, am Code
nachgemessen: Der Körper-Schritt bekam als einzige Referenz das erzeugte
Kopf-Sheet — das zeigt aber keinen Körper. Das Modell hatte nichts, an dem es
sich beim Körperbau hätte orientieren können, und griff auf etwas Generisches
zurück.

**Marks drei Fälle, wörtlich sinngemäß zusammengefasst:**

1. „Ich such gezielt nach Fotos, bei denen meist nur der Kopf recht groß zu
   sehen ist … Ich kann dazu bewusst auch ein Körperbild als Zweites mit
   dazuladen … Dann sollte automatisch erkannt werden — oder man die
   Möglichkeit hat — ein Körperbild zum Kopfbild mitzuladen." Das
   Originalfoto liefert dabei NUR den Körperbau, das Gesicht darauf zählt
   nicht — „bevor das Körperbild drankommt, sollte das Originalkörperbild
   natürlich genommen werden und nur für den Körper genutzt werden. Das muss
   im Prompt so drinstehen."
2. „Als Ursprungsbild hab ich praktisch schon ein Ganzkörperbild mit Kopf.
   Das wird dann als Referenzbild für Kopf genommen. Und auch für Körper."
3. Nur ein Kopfbild, kein Körperbezug irgendwo: „Ich bräuchte dann noch mehr
   Eingriffsmöglichkeiten … nicht nur schlank, kräftig, sportlich, groß,
   sondern auch detailliert große Oberweite, kleine Oberweite bei Frauen,
   Ausladung des Beckens, lange Beine, kurze Beine. Das sollte man alles
   auswählen können."

**Die Lösung — alle drei Fälle ohne Sonderfall-UI:**

- `src/lib/referenzkette.ts`: `quellenFuer(schritt, { hatKoerperfoto })` ersetzt
  die alte feste `QUELLEN`-Tabelle. Für den Körper-Schritt liefert sie
  `koerperfoto`, wenn eines hochgeladen wurde, sonst fällt sie automatisch auf
  `titelbild` zurück — Fall 2 (Ganzkörper-Original) braucht dafür KEIN eigenes
  Bedienelement, er ist der Normalfall ohne Körperfoto.
- Ein echtes Foto in der Rolle „Körperquelle" (ob Körperfoto oder Titelbild)
  bekommt im Prompt die strikte Ansage „Completely ignore any face visible in
  it" — das erzeugte Körper-Sheet in Schritt 3 dagegen nur die mildere
  „secondary" (das ist schon KI-Ergebnis im Wissen um den Kopf, kein
  Verwechslungsrisiko).
- Neue Variante `KOERPERFOTO_VARIANTE = 'Körperfoto'` für Marks eigenes
  Hochladen (Fall 1) — bewusst KEIN vierter `KettenSchritt`: Es ist eine
  Eingabe, kein Kettenergebnis, und zählt darum nicht zum Fortschritt.
- `KoerperAuswahl` (Fall 3) — fünf einzeln optionale Felder, Marks Liste
  wörtlich: `bau` (schlank/durchschnittlich/kräftig/sportlich), `groesse`,
  `oberweite`, `becken`, `beinlaenge`. `koerperMerkmaleText()` hängt NUR die
  gesetzten Felder an, als „ADDITIONAL BODY CHARACTERISTICS — apply these
  specifically, on top of whatever the reference images show". Ausdrücklich
  additiv, nicht nur für Fall 3 gedacht — auch mit Körperfoto/Ganzkörper-
  Original nutzbar, falls die Referenz z. B. durch Kleidung nicht alles zeigt.
- `src/hooks/use-referenzkette.ts`: `koerperfotoUrl`, `koerperfotoLaedt`,
  `koerperfotoHochladen()` (eigener Upload-Pfad, dieselbe Größenprüfung wie
  beim „Übernehmen"), `koerperAuswahl`/`setKoerperAuswahl` (nur Lauf-Zustand,
  NICHT in der Datenbank — ein zweiter Lauf mit anderer Auswahl soll möglich
  sein, ohne die vorige aufzuräumen).
- `src/components/characters/referenzkette-dialog.tsx`: neuer Abschnitt
  „Vorgaben für den Körper" — Körperfoto-Vorschau/Upload + die fünf
  Auswahlfelder. Sichtbar bei `standGeladen && !stand.vorhanden.koerper &&
  (phase.art === 'bereit' || 'pruefen' || 'fehler')`. Die Einschränkung auf
  diese drei Phasen ist bewusst: Ab dem Klick auf „Nehmen und weiter" hat
  `kopfNehmen()` die Werte bereits in den automatisch laufenden Körper-Auftrag
  übernommen, aber `stand` selbst wird erst nach dem GESAMTEN automatischen
  Lauf (Körper und Referenzsheet) nachgeführt — ohne diese Einschränkung wäre
  der Abschnitt während des ganzen automatischen Laufs weiter sichtbar und
  bedienbar gewesen, obwohl jede Änderung darin wirkungslos verpufft wäre.

**Tests.** `referenzkette.test.ts` von 16 auf 28 Prüfungen erweitert:
Körperfoto-vor-Titelbild-Vorrang, die unterschiedliche Strenge der
Gesichts-Ansage (Foto vs. erzeugtes Sheet), alle fünf Merkmalsfelder einzeln,
und dass die Merkmalsauswahl nur beim Körper-Schritt greift. Alle 28 grün.

**Geändert:** `src/lib/referenzkette.ts`, `src/lib/referenzkette.test.ts`,
`src/hooks/use-referenzkette.ts`, `src/components/characters/referenzkette-dialog.tsx`.
`src/lib/bausteine.ts` (Größenprüfung fürs Körperfoto, dieselbe Funktion wie
beim „Übernehmen") war schon vom vorherigen Fix (Speichergrenzen) an Ort und
Stelle.
