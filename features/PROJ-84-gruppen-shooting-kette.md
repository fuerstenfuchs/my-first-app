# PROJ-84 — Gruppen-Shooting-Kette

**Status:** In Review
**Erstellt:** 2026-09-06
**Baut auf:** PROJ-75 (Shooting-Kette), PROJ-78–83 (Gruppen-Referenzblatt)

---

## Der Auftrag

Mark am 06.09.2026, nachdem das Fünfer-Blatt funktioniert hat:

> „Ja, die Kette kannst du bauen. Also es soll auf einem Bild natürlich jeder
> etwas anders stehen und teilweise sitzen, je nachdem. Aber wir das mal zu
> machen, verfeinern können wir es ja dann immer noch."

Vorgeschichte: Am selben Tag hatte er zur Gruppe gesagt, sie solle „natürlich
dann auch eine eigene Kette vielleicht machen können. Wenn das dann klappt,
alles. Aber probieren wir erst mal." Es hat geklappt — über zwei, drei und fünf
Personen.

---

## Warum die bestehende Kette hier nicht gereicht hätte

Die Gruppe ist ein ganz gewöhnlicher Charaktereintrag mit dem Schlagwort
`gruppe`; ihr Titelbild ist das Referenzblatt. Deshalb LIEF die Shooting-Kette
schon vorher, wenn man eine Gruppe als Charakter wählte — sie lieferte fünf
Bilder, und niemand hätte einen Fehler gemeldet.

Falsch war der Inhalt, nicht der Ablauf. Im Prompt stand:

```
POSE
The subject is standing still, weight on one leg, looking off to the side.
```

Bei einem Menschen ist das die Pose. Bei fünfen ist es die Anweisung an alle
fünf, dasselbe zu tun. Heraus kommt eine Reihe gleicher Leute in gleicher
Haltung: ein Klassenfoto, kein Shooting.

---

## Was gebaut wurde

### Der Angelpunkt: die Links-rechts-Ordnung bleibt die des Blattes

Auf dem Referenzblatt steht Person 1 links, Person 5 rechts. Bliebe diese
Ordnung im Shooting nicht erhalten, müsste das Modell in jedem der fünf Bilder
neu erraten, wer wer ist — genau der Fehler, den das Blatt abgeschafft hat.

In jedem Prompt steht deshalb:

> Left to right they stand in the SAME ORDER as on the group sheet: the person
> at the far left of the sheet stands at the far left here, the person at the
> far right stands at the far right. Only their distance from the camera
> differs.

Damit ist die Tiefe da (jemand tritt vor, jemand steht zurück), ohne dass die
Zuordnung wackelt. Und weil links links bleibt, können die Haltungen über
dieselben Positionsanker vergeben werden, die das Blatt schon benutzt:
`PERSON 3 (rightmost) is …`. Dieselbe Formulierung, nicht bloß eine ähnliche —
`platzImBild()` wurde dafür aus `gruppen-referenz.ts` herausgezogen und wird
von beiden Seiten benutzt.

### Je Person eine eigene Haltung, mit abwechselnden Kopfhöhen

`HALTUNGEN` hält je Platz fünf Haltungen; Person 1 bekommt die erste, Person 2
die zweite und so fort. Die Reihenfolge ist nicht beliebig: **benachbarte Höhen
sind immer verschieden** (`hoch` / `mittel` / `tief`). Weil jeder Anfang einer
abwechselnden Liste selbst abwechselt, gilt das bei zwei Personen genauso wie
bei fünf.

Das ist zugleich Marks „teils sitzend": Das Sitzen ist hier kein Einfall,
sondern das Mittel, mit dem die Höhen auseinandergehen. Köpfe auf einer Höhe
sind der Grund, warum Gruppenbilder wie eine Belegschaftsaufnahme aussehen.

### Zwei Plätze mussten für Gruppen umgeschrieben werden

Vier der fünf Plätze übertragen sich unverändert. Zwei kippen:

**Gegenlicht.** Der Platz lebt von der Kontur. Fünf Umrisse Schulter an
Schulter verschmelzen zu einem schwarzen Klotz — bei einem Menschen kann das
nicht passieren. Jetzt steht dort, dass zwischen je zwei Personen ein Streifen
hellen Hintergrunds sichtbar bleiben muss.

**Der Übergang.** Er lebt davon, unposiert zu wirken. Fünf Leute nebeneinander
im Gleichschritt sind das Gegenteil — das ist ein Filmplakat, kein
Schnappschuss. Jetzt: lose Diagonale, jeder in einer anderen Schrittphase.

Die Fläche unterscheidet außerdem nach Anzahl: zwei überlappend an der Fläche,
drei als Dreieck, ab vier zwei Reihen — die hintere versetzt in den Lücken der
vorderen, nie direkt dahinter.

### Kein Outfitwechsel bei einer Gruppe

Ein zweites Outfit ist EIN Kleidungsstück. Bei einer Gruppe zöge es allen
dasselbe an und zerstörte genau die Zuordnung, für die das Blatt gebaut wurde.
Der Knopf blendet die Auswahl deshalb aus, **und** die Kette ignoriert sie,
falls ein Aufrufer sie doch setzt.

Wichtiger noch: **es geht auch kein Outfitbild als Referenz mit.** Ginge es
mit, sagte der Text „jeder trägt seins" und das Bild „alle tragen das hier" —
und das Bild gewinnt. Zu merken wäre es an drei Leuten im selben Kleid, nach
fünf bezahlten Erzeugungen.

### Die Personenzahl

`gruppenGroesse()` liest sie aus `metadata.gruppe.anzahl`, das der
Gruppendialog ab jetzt mitschreibt. Marks bereits angelegte Gruppen tragen das
nicht — die heißen aber „Anna + Ben + Carla", und daraus ist die Zahl ablesbar.
Ohne diesen zweiten Weg wären genau die Gruppen ausgeschlossen, für die das
hier gebaut wurde.

Lässt sich nichts zählen, ist die Antwort `null`, und die Kette fällt auf den
Einzelweg zurück. Eine geratene Zahl wäre schlimmer: Sie verteilte vier
Haltungen an drei Leute.

---

## Was zwei unabhängige Prüfungen gefunden haben

Vor der Abgabe haben Critic und der Bildprompt-Spezialist getrennt voneinander
geprüft. Sie sind auf dieselben Kernpunkte gekommen; jede Behauptung ist
anschließend an der Datei nachgemessen worden, bevor etwas geändert wurde.
**Alle stimmten.**

### Zwei Fehler, die jedes Gruppen-Shooting unbrauchbar gemacht hätten

**1. Die Fläche stand auf „Portrait" — also „from chest up".**
Das ist für einen Menschen an einer Wand genau richtig. Bei einer Gruppe sitzt
Person 1 am Boden. Es gibt **keinen** Ausschnitt, der „ab Brust" und „jemand
sitzt am Boden" zugleich erfüllt: Entweder fehlen zwei Personen in einem Bild,
das ausdrücklich fünf verlangt, oder die bestellte Einstellungsgröße stimmt
nicht. Gruppen haben jetzt eine eigene Größentabelle (`gruppenGroesseJePlatz`):
Fläche `half_body` bei zweien, `three_quarter` ab dreien; der Übergang
`full_body`, weil Schrittphasen Beine und Füße brauchen.

**2. Das Gruppenblatt wurde dem Modell als EINE Person erklärt.**
Ohne eigene Zuordnungszeilen schreibt der Promptbau für ein Charakterbild
wörtlich „take the face, hair, skin tone and body identity of **this person**" —
Einzahl, für ein Blatt mit bis zu fünf Menschen in zwei Reihen. Und der übliche
Schlusssatz gibt dem **Bild** den Vorrang, wenn der Text „die Person" anders
beschreibt — was der Text hier absichtlich tut: kauernd, sitzend, gestaffelt
statt aufrecht in einer Reihe. Beides zusammen hätte das Blatt entwertet, für
das die ganze Kette gebaut ist — ein Rückfall in genau den Fehler von PROJ-78,
nur eine Ebene tiefer.

Neu sind deshalb `gruppenBlattZuordnung()` (erklärt das Blatt als Blatt, mit
Zahl und Leserichtung) und `GRUPPEN_VORRANG`: **Das Blatt entscheidet WER und
WAS, der Text entscheidet WO und WIE.** `promptFuerAuftrag` nimmt dafür einen
eigenen Vorrangsatz entgegen.

### Vier Sätze, die an der Konstellation vorbeiliefen

`buildPrompt` weiß nichts von Gruppen und schrieb aus der Szene heraus Sätze,
die bei einem Menschen richtig sind — **vor** dem Konstellationsblock, also an
der stärkeren Stelle:

| Quelle | Was dastand | Warum das schadet |
|---|---|---|
| `scene.outfit` | „Use the provided outfit reference." | Das Bild dazu geht bei Gruppen gar nicht mit. Das Modell sucht das gemeinte unter dem, was da ist — und da ist nur das Blatt. Folge: alle tragen die Kleidung *einer* Person daraus. |
| `scene.pose` | „The character is in a X pose." | Eine Einzelpose für alle, kurz und konkret — und damit leichter zu befolgen als fünf ausformulierte Haltungen. Das Klassenfoto. |
| `scene.character` | „Use the provided **character** reference." | Einzahl, und die Zuordnungszeile sagt es ohnehin genauer. |
| Ortsbaustein | „…behind **the standing position**" | Ein Punkt, an dem einer steht. Zwei Zeilen später stehen fünf Leute, teils sitzend. |

Die ersten drei fallen für Gruppen aus dem Basisprompt heraus; der Ortsbaustein
wird von `bausteinFuerGruppe()` in die Mehrzahl gesetzt — nur die eine Wendung,
nicht eine zweite Fassung aller Bausteine, die beim nächsten Feilen am Ort
auseinanderliefe.

### Sechs Formulierungen, die zuverlässig ignoriert worden wären

- **„Count them."** Ein Bildmodell zählt nicht, es zeichnet. Und „not six, not
  four" setzt genau die falschen Zahlwörter neben das Wort „people", wo sie
  mitwirken statt ausgeschlossen zu werden. Jetzt: die richtige Zahl dreimal
  positiv, ausgeschrieben.
- **„NO TWO HEADS AT THE SAME HEIGHT."** Bei vier oder fünf Personen
  unerfüllbar — es gibt nur drei Höhenlagen. Eine Bedingung, die das Modell
  nicht erfüllen *kann*, verwirft es ganz statt teilweise; die Zeile kostete
  dann auch dort, wo sie erfüllbar gewesen wäre. Jetzt auf Nachbarn
  eingeschränkt.
- **„…would turn the group into a fence across the landscape"** und **„…or the
  group collapses into one black shape".** Beides malbare Substantive in einem
  Verbot: Das Modell bekommt „fence" und „black shape" geliefert, mit einem
  schwachen Nein davor.
- **„EVERY HAND HAS SOMETHING TO DO."** Der Grundsatz stimmt, die Umsetzung
  nicht: eine allgemeine Menüzeile ohne Besitzer, die acht Haltungen abdecken
  musste, in denen gar keine Hand vorkam. Jetzt nennt **jede Haltung ihre
  eigenen Hände**, und die allgemeine Zeile ist weg. Auch „holding" ist raus —
  ohne Objekt lädt es das Modell ein, Requisiten zu erfinden, die im nächsten
  Bild wieder verschwinden.
- **„leaning against whatever runs along the line."** „whatever" hat kein
  Substantiv; das Modell erfindet etwas oder lässt das Anlehnen weg. Jetzt:
  „the wall, railing or edge".
- **„close beside the person to the left."** Doppeldeutig — links von ihr oder
  links im Bild? Jetzt über den Positionsanker.

### Zwei Konstellationen, die einander widersprachen

- **Tiefe:** „hintereinander entlang der Fluchtlinie" gegen „links nach rechts
  wie auf dem Blatt". Wer in einer Kolonne steht, steht nicht mehr links nach
  rechts — Person 5 säße hinten in der Bildmitte und hieße trotzdem
  „rightmost". Die Staffelung ist jetzt **diagonal**: Tiefe und Ordnung
  zugleich.
- **Fläche ab vier:** Beide Reihen sollten die Fläche im Rücken haben. Jetzt
  hat nur die stehende Reihe sie im Rücken, die niedrige sitzt davor.

### Der Schutz gegen das Blatt im Bild

Die Einzelplatten haben den Absatz „ONE PHOTOGRAPH, NOT A SHEET" — dem
Gruppen-Prompt fehlte er, und hier ist die Gefahr **größer**: Das mitgeschickte
Referenzbild *ist* ein Blatt auf hellgrauem Studiogrund, und der Text verweist
auch noch darauf. Er steht jetzt in jedem Prompt.

---

## Ein Widerspruch, den ich selbst gebaut und selbst gefunden habe

Der erste Entwurf enthielt in jedem Prompt beide Sätze:

> Leave a visible gap of bright background between every two people …
> The silhouettes overlap slightly where they meet …

Ein Spalt Licht dazwischen UND überlappende Umrisse — zwei gegenläufige
Anweisungen im selben Prompt. Beim Schreiben der einzelnen Zeilen fällt so
etwas nicht auf; beim Lesen des **fertig zusammengesetzten Blocks** sofort.

Der Zusammenhalt ist deshalb platzabhängig (`zusammenhalt()`): überall
Überlappung, im Gegenlicht Nähe ohne Berührung.

**Die Lehre, die über diesen Fall hinausgeht:** Prompts müssen zusammengesetzt
gelesen werden, nicht in Bruchstücken. Dieselbe Lesung hat später auch die
Einzahl-Reste gefunden, die die Prüfer bemängelt hatten.

---

## Ein Test, der nichts gemessen hat

Beim Rückschritt-Test fiel auf: Die Zeile

```ts
expect(s.prompt).not.toContain('character reference')
```

blieb grün, **auch nachdem der Fehler wieder eingebaut war**. Grund: Die
Testszene hatte `character: null`, und dann erzeugt `buildPrompt` den Satz gar
nicht erst. Der Test war grün, weil die Szene leer war, nicht weil der Code
richtig war.

Die Szene hat jetzt einen Charakter. Ohne den Rückschritt-Test wäre das nie
aufgefallen — ein grüner Test sagt für sich genommen nichts darüber, ob er
überhaupt hinsieht.

---

## Geändert

| Datei | Was |
|---|---|
| `src/lib/gruppen-shooting.ts` | **neu** — Erkennung, Haltungen, Formationen, Konstellationsblock, Blattzuordnung, Vorrangsatz, Größentabelle, Kontinuität |
| `src/lib/gruppen-shooting.test.ts` | **neu** — 39 Tests |
| `src/lib/shooting-kette.ts` | Option `gruppe`; Outfit, Pose, Ausdruck und Charakterzeile für Gruppen aus dem Basisprompt; Anzahl ganz nach vorn; eigene Einstellungsgrößen; Ortsbaustein in der Mehrzahl |
| `src/lib/shooting-kette.test.ts` | 10 Tests für den Gruppenzweig, darunter zwei, die den Einzelweg als unverändert festnageln |
| `src/lib/image-generation.ts` | `promptFuerAuftrag` nimmt einen eigenen Vorrangsatz; `ROLLEN_ANWEISUNG` exportiert |
| `src/components/shooting-kette-button.tsx` | Gruppenerkennung, Blattzuordnung, Vorrangsatz, Referenzbilder, Text, Outfitblock ausgeblendet |
| `src/components/shooting-kette-button.test.tsx` | **neu** — 7 Tests, darunter die beiden teuren: welche Referenzbilder mitgehen, und wie das Blatt erklärt wird |
| `src/lib/gruppen-referenz.ts` | `platzImBild()` herausgezogen und exportiert |
| `src/components/characters/gruppen-referenz-dialog.tsx` | schreibt die Personenzahl mit |

Tests gesamt: 682 → 738. Build sauber.

---

## Nachgemessen

- **Zehn Rückschritte eingebaut** und geprüft, ob die Tests sie bemerken:
  gebrochene Höhenabwechslung, entfernter Ordnungssatz, Zweireiher schon bei
  drei Personen, geglaubte Personenzahl 1, alle bekommen Haltung 1, entkernte
  Tiefen-Formation, Fläche zurück auf Portrait, durchlaufende Charakterzeile,
  Ortsbaustein in der Einzahl, fehlende Blattzuordnung. **Neun wurden sofort
  bemerkt; einer nicht** — siehe oben, der Test war blind und ist berichtigt.
- **Die fertigen Prompts vollständig gelesen**, für zwei, drei und fünf
  Personen, an allen fünf Plätzen, einschließlich Bildzuordnung und
  Formatansage. Dabei fielen der Gegenlicht-Widerspruch und die Einzahl-Reste
  auf.
- **Der Knopf** wurde als Bauteil gerendert und geprüft. Im Browser war das
  nicht zu prüfen — der Prüfbrowser hat keine Anmeldung, und Passwörter gebe
  ich nicht ein.

---

## Offen

- **Die Reihenfolge der Haltungen ist fest.** Person 1 bekommt an jedem Platz
  die erste Haltung. Über fünf Bilder hinweg steht damit dieselbe Person immer
  vorn oder immer hoch — das liest sich über die Serie als Rangordnung. Ein
  Versatz je Platz wäre die naheliegende Verfeinerung; dabei müsste die
  Höhenabwechslung erhalten bleiben. Mark ausdrücklich: „verfeinern können wir
  es ja dann immer noch."
- **Der Boden der Szene wird nicht berücksichtigt.** „Sitting on the ground"
  steht auch dann da, wenn die Szene Schnee oder Nässe führt (PROJ-56) oder die
  Fläche Wasser ist.
- **Über fünf Personen** wird gedeckelt. Ein solches Blatt kann über die
  Oberfläche nicht entstehen; käme die Zahl trotzdem herein, wäre sie
  beschädigt.
- **Gruppen umbenennen.** Wer eine ältere Gruppe umbenennt und dabei die
  Pluszeichen verliert, verliert die Personenzahl. Neue Gruppen sind davon
  nicht betroffen, weil die Zahl mitgeschrieben wird.
