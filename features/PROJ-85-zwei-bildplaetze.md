# PROJ-85 — Zwei Bildplätze für die einzeln erzeugten Blätter

**Status:** In Review
**Erstellt:** 2026-09-07
**Behebt einen Fehler in:** PROJ-28 (Sheet-Knopf), PROJ-38 (Prompt → Bild), PROJ-48 (Referenzkette)

---

## Der Befund

Mark am 07.09.2026, wörtlich:

> „Mir ist aufgefallen bei Charakter, wenn man nicht die Kette macht, sondern
> die einzelnen Schienen macht. Und zwar sowohl beim Körperbild als auch beim
> Referenzbild kann man nicht zwei Bilder hochladen, beziehungsweise es geht
> nur eins — und braucht ja aber sowohl beim Körperbild als auch beim
> Charaktersheet zwei Bilder. Einmal vom Kopf und einmal vom Körper. … Und das
> kann man alles nicht auswählen, wenn man es einzeln macht. Die Kette geht das
> schon."

**Am Code nachgemessen: er hat recht, in beiden Punkten.**

`quellenFuer()` in `referenzkette.ts` schreibt seit dem 03.09.2026 vor:

| Schritt | Bild 1 | Bild 2 |
|---|---|---|
| Kopf-Sheet | Ausgangsfoto | — |
| Körper-Sheet | **erzeugtes Kopfblatt** | Körperfoto (sonst Ausgangsfoto) |
| Referenzsheet | **erzeugtes Kopfblatt** | **erzeugtes Körperblatt** |

Die Kette (`use-referenzkette.ts`) setzt beide ein. Der Weg über den
Sheet-Knopf lief dagegen durch `PromptToImageDialog` — und der hatte **genau
einen Platz je Rolle**: Charakter, Outfit, Ort. Ein zweites Charakterbild
konnte dort gar nicht mitkommen.

## Warum das mehr als eine Unbequemlichkeit war

Der Prompt setzt das zweite Bild ausdrücklich voraus. `KOERPER_PROMPT` sagt
wörtlich:

> Take the head angle for each panel from the matching view in the **head
> reference sheet**: front view with the front head, 3/4 left with the 3/4 left
> head, left profile with the left profile head.

Ohne das Kopfblatt kann das Modell dieser Anweisung nicht folgen. Es erfindet
dann ein Gesicht — und **das sieht man dem Ergebnis nicht als Fehler an.** Das
Blatt ist technisch in Ordnung, es zeigt nur eine andere Person. Auffallen kann
das erst später, wenn zwei Blätter desselben Charakters nebeneinander liegen.

Genauso beim Referenzsheet: Es soll Gesicht, Vorder- und Rückansicht in einem
Blatt vereinen. Ohne das Körperblatt fehlt ihm die Hälfte seiner Quelle.

---

## Was gebaut wurde

### Die Plätze kommen aus derselben Quelle wie die Kette

`bildplaetze(schritt, optionen)` in `referenzkette.ts` baut die Liste aus
`quellenFuer` und `ANSAGE_TEXT` — den beiden Stellen, die es schon gibt. Dazu
kommt nur, was der Dialog zusätzlich braucht: eine Beschriftung, ein Satz
welches Bild gemeint ist, und die Variante zum Vorbelegen.

**Warum nicht einfach eine Liste im Dialog:** Das wäre eine zweite Wahrheit.
Wer später an der Kette feilt, änderte sie an einer Stelle — und der Einzelweg
liefe still daneben her. Ein Test hält das fest: Jede Zuordnungszeile eines
Platzes muss wörtlich in `referenzAnsage()` desselben Schrittes vorkommen.

### Der Dialog kann mehrere Bilder für dieselbe Rolle

Neue Eigenschaft `bildplaetze`. Ist sie gesetzt, treten N Karten an die Stelle
der einen Charakterkarte — jede mit eigener Überschrift („Kopf-Sheet",
„Körperfoto") und eigenem Hinweis. Outfit und Ort bleiben, wie sie waren.

Ohne die Eigenschaft ändert sich **nichts**. Die anderen beiden Aufrufer
(Prompt-Bibliothek, Location-Sheets) sehen denselben Dialog wie vorher; ein
Test nagelt das fest.

### Die Plätze füllen sich selbst

Beide Bilder liegen in aller Regel schon beim Charakter — das Kopfblatt in der
Variante „Kopf", das Körperbild in „Körper Original". Sie von Hand
herauszusuchen ist genau die Arbeit, die der Knopf abnehmen soll.

**Es bleibt ein Vorschlag.** Wer sein Kopfblatt in „Sonstiges" abgelegt hat —
weil er es einzeln erzeugt und selbst einsortiert hat —, findet den Platz leer
und wählt wie bisher von Hand. Ein leerer Platz ist kein Fehler.

### Jedes Bild sagt dem Modell, wofür es steht

Ohne eigene Zeilen stünde im Prompt zweimal „Image N = CHARACTER" — für zwei
Bilder, die Verschiedenes beitragen sollen: das eine das Gesicht, das andere
den Körperbau. Genau diese Doppeldeutigkeit hat die Kette am 01.09.2026 schon
einmal ein Ergebnis gekostet.

Jetzt gehen dieselben Zeilen mit, die auch die Kette benutzt:

```
Image 1 = HEAD REFERENCE SHEET — take the face, hair and skin tone from it.
Image 2 = ORIGINAL PHOTO — take ONLY the body proportions, build and posture
          from it. Completely ignore any face visible in it; the head reference
          above alone decides the face.
```

Die **Reihenfolge ist bedeutungstragend**: „the head reference *above*". Käme
das Körperbild zuerst, zeigte dieser Verweis ins Leere — und das Modell nähme
das Gesicht aus dem Körperfoto.

### Eine Vorschau, die nicht lügt

Der Dialog zeigt unter „Zusätze im Prompt ansehen", was zusätzlich mitgeht.
Baute er sich diesen Text selbst zusammen, zeigte er bei eigenen
Zuordnungszeilen weiter die allgemeine Fassung — eine Vorschau, die etwas
anderes verspricht als das Abgeschickte. `zuordnungsBlock()` in
`image-generation.ts` ist jetzt die eine Quelle für beide.

---

## Ein Fallstrick, der beinahe drin geblieben wäre

`bildplaetze()` gibt bei jedem Aufruf ein **neues** Feld zurück. Der
Vorbelegungs-Effekt im Dialog hängt daran — ohne `useMemo` hieße „ändert sich"
hier: bei jedem Rendern. Wer ein Bild von Hand ausgetauscht hätte, sähe es beim
nächsten Klick irgendwo im Dialog wieder auf die Vorbelegung zurückspringen.

Der Aufrufer hält die Liste mit `useMemo` stabil — und seit der Prüfung hängt
der Effekt **zusätzlich** nicht mehr am Feld selbst, sondern an einem Schlüssel
aus den Beschriftungen. Damit kann auch ein künftiger Aufrufer, der das
`useMemo` vergisst, nichts kaputtmachen.

---

## Die Outfit-Kette ist nicht betroffen

Nachgemessen, weil sie nach demselben Muster gebaut ist: Ihr Referenzsheet
bräuchte sogar **drei** Bilder (vorne, Rückseite, Details). Aber es gibt für
Outfits gar keinen Einzelweg — `PromptToImageDialog` wird nur von den
Charakter-Sheets, den Location-Sheets und der Prompt-Bibliothek aufgerufen.
Outfit-Blätter entstehen ausschließlich über ihre Kette, und die setzt alle
drei Bilder ein.

---

## Was die unabhängige Prüfung gefunden hat

Critic hat den fertigen Stand gegengelesen. Jeder Befund wurde an der Datei
nachgemessen, bevor etwas geändert wurde — **alle stimmten.** Kein Blocker,
aber fünf Dinge, die ohne die Prüfung stehen geblieben wären, und zwei
Kleinigkeiten:

### Der Verweis zeigte ins Leere, wenn genau das Bild fehlte

Die übliche Zeile zum zweiten Bild lautet:

> Completely ignore any face visible in it; **the head reference above** alone
> decides the face.

Bleibt der erste Platz leer, bekommt das Modell **ein** Bild und die Anweisung,
dessen Gesicht vollständig zu ignorieren — und hat damit gar keine
Gesichtsquelle mehr. Am fertigen Blatt ist das nicht als Fehler zu erkennen: Es
ist in Ordnung, es zeigt nur einen Fremden.

Mein eigener Test hat diesen Zustand sogar als gewollt festgeschrieben und nur
geprüft, dass das Etikett zum verbliebenen Bild passt. Das war die richtige
Prüfung an der falschen Frage.

Jeder Platz hat jetzt eine **zweite Fassung seiner Zeile** (`zuordnungAllein`)
ohne jeden Verweis auf ein anderes Bild. Fehlt das Kopfblatt, steht dort
stattdessen: „ORIGINAL PHOTO OF THE PERSON — take the face … and the body
proportions … **It is the only reference.**"

Dazu ein sichtbarer Hinweis über dem Knopf, weil ein leerer Platz sonst still
ist und das Blatt trotzdem entsteht.

### Die Vorbelegung prüfte nicht, ob das Bild im eigenen Speicher liegt

Der Arbeiter lehnt fremde Adressen als Referenz ab, und die Kette bricht dafür
eigens mit einer Meldung ab (`use-referenzkette.ts`). Was hier von selbst in
den Platz rutschte, hatte niemand ausgewählt — der Auftrag wäre erst beim
Arbeiter gescheitert, und der Fehler wäre beim Prompt gesucht worden. Relevant,
solange PROJ-49 („Erfasste Bilder in den eigenen Speicher kopieren") offen ist.

### Variantennamen wurden genau verglichen, überall sonst getrimmt

`use-referenzkette.ts` und `outfit-kette.ts` vergleichen
`trim().toLowerCase()`. Eine Variante „Kopf " oder „kopf" wäre hier nicht
gefunden worden — und der Platz bliebe leer, also **der gemeldete Fehler, nur
seltener.**

### Die Abhängigkeit hing am Aufrufer statt am Bauteil

Dass der Vorbelegungs-Effekt nicht bei jedem Rendern läuft, hing allein an
einem `useMemo` beim Aufrufer — am Bauteil selbst stand davon nichts. Der
nächste Aufrufer schriebe die Liste inline, und Mark verlöre seine Handauswahl
bei jedem Elternrender. Der Effekt hängt jetzt an einem Schlüssel aus den
Beschriftungen; damit kann der Aufrufer nichts falsch machen.

### Und der wichtigste Befund war eine Testlücke

Alle sieben ersten Tests führten dieselbe Bewegung aus: rendern, Vorbelegung
abwarten, abschicken. **Kein einziger öffnete den Wähler oder drückte das
Kreuz.** Damit wären mindestens drei Rückschritte grün durchgegangen — darunter
„jede Auswahl landet im ersten Platz", was das Kopfblatt durch das Körperbild
ersetzt hätte.

Das ist keine Randnotiz: Marks Satz war „das kann man alles nicht **auswählen**".
Die Vorbelegung ist die Bequemlichkeit, das Auswählen ist die Behebung — und
geprüft war nur die Bequemlichkeit.

### Zwei kleinere Dinge, gleich mitgenommen

- **Zweimal dasselbe Bild** in beiden Plätzen (durch den Titelbild-Knopf gut
  möglich) hieße für dieselbe Adresse „take the face" und „ignore any face".
  Der Dialog sagt es jetzt.
- **Während des Vorbelegens** waren die Plätze anklickbar, obwohl der Effekt
  gleich darauf das ganze Feld überschreibt. Sie sind jetzt so lange gesperrt.
- **Der Hinweistext** stand auf 10px. In `DESIGN.md` steht „nichts unter 13px —
  kleine Schrift ist für ihn ein Ausfall, kein Schönheitsfehler", und
  ausgerechnet dieser Satz sagt, welches Bild wohin gehört. Jetzt 13px.

---

## Geändert

| Datei | Was |
|---|---|
| `src/lib/referenzkette.ts` | `Bildplatz` und `bildplaetze()` aus `quellenFuer` und `ANSAGE_TEXT`; zweite Zeilenfassung fuer den Alleingang |
| `src/lib/referenzkette.test.ts` | 7 neue Tests, darunter der Gleichlauf mit `referenzAnsage` |
| `src/components/prompts/prompt-to-image-dialog.tsx` | Eigenschaft `bildplaetze`, N Karten, Vorbelegung, eigene Zuordnungszeilen |
| `src/components/prompts/prompt-to-image-dialog.test.tsx` | **neu** — 16 Tests, darunter die Auswahl von Hand |
| `src/lib/image-generation.ts` | `zuordnungsBlock()` herausgezogen; Vorschau und Auftrag lesen dasselbe |
| `src/components/characters/character-sheet-dialog.tsx` | gibt die Plätze für Körper-Sheet und Referenzsheet mit, stabil per `useMemo` |

Tests gesamt: 738 → 762. Build sauber.

---

## Nachgemessen

- **Zehn Rückschritte eingebaut** und geprüft, ob die Tests sie bemerken: nur
  der erste Platz geht mit; keine eigenen Zuordnungszeilen; die Vorbelegung
  nimmt das erste beste Bild; kein Rückfall aufs Titelbild; jede Auswahl landet
  im ersten Platz; das Kreuz räumt beide Plätze; die Platzverzweigung im Wähler
  entfernt; der Verweis ins Leere bleibt stehen; keine Speicherprüfung; der
  Variantenvergleich wieder genau. **Alle zehn wurden bemerkt** — sechs davon
  erst, nachdem die Prüfung die Testlücke bei der Handauswahl aufgezeigt hatte.
- **Der Fall „ein Platz bleibt leer"** ist eigens geprüft: Der Auftrag geht
  trotzdem los, und die verbliebene Zeile trägt die Bedeutung des tatsächlich
  gesendeten Bildes — nicht die des fehlenden.
- **Der unveränderte Weg** ist festgenagelt: ohne `bildplaetze` eine
  Charakterkarte, Standardzuordnung, und es wird gar nicht erst nach
  Variantenbildern gefragt.
- **Im Browser nicht geprüft** — der Prüfbrowser hat keine Anmeldung, und
  Passwörter gebe ich nicht ein. Stattdessen wurde der Dialog als Bauteil
  gerendert und der abgeschickte Auftrag gemessen.

---

## Offen

- **Die Ablage.** Ein einzeln erzeugtes Blatt landet in der Warteschlange und
  wird von Hand einsortiert; die Kette legt ihre Ergebnisse dagegen selbst in
  die richtige Variante. Wer sein Kopfblatt einzeln erzeugt und in „Sonstiges"
  ablegt, findet beim nächsten Schritt keine Vorbelegung. Ein Ablageziel wie
  bei der Shooting-Kette (PROJ-76) würde das schließen — nicht beauftragt.
- **Der Kopf-Schritt** behält seinen einen generischen Charakterplatz. Er
  braucht nur ein Bild, aber seine Zuordnungszeile wäre mit
  `bildplaetze('kopf', …)` genauer als das allgemeine „CHARACTER".
