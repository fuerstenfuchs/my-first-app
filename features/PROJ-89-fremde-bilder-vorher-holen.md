# PROJ-89 - Fremde Referenzbilder werden vor dem Abschicken geholt

**Status:** In Review
**Erstellt:** 2026-09-07
**Schliesst ab:** PROJ-49 (Erfasste Bilder in den eigenen Speicher kopieren)

---

## Der Auftrag

Mark am 07.09.2026 zu PROJ-49:

> Ja, das sollte finalisiert werden, dass die Bilder auf jeden Fall genommen
> werden, egal wo sie herkommen und welche Endung sie haben.

---

## Was nachgemessen wurde, bevor etwas gebaut wurde

**Die Endung spielt an keiner Stelle eine Rolle.** Der Arbeiter prueft nur die
HERKUNFT (`worker/src/supabase.ts`: eine Adresse muss mit
`<eigener-speicher>/storage/v1/object/public/` beginnen). Die Hol-Route leitet
die Endung aus dem erkannten Bildtyp ab und kennt jpg, png, webp, gif und avif -
und sie liest den Typ an den ERSTEN BYTES ab, nicht am gemeldeten
`Content-Type`, weil manche Server `application/octet-stream` liefern. Ein Bild
ohne Endung in der Adresse kommt genauso durch wie eines mit `.PNG`.

**Was fehlte, war der Weg davor.** PROJ-49 hatte zwei Teile gebaut: Die
Erweiterung kopiert beim Erfassen, und ein einmaliger Reparaturlauf holte 401
von 431 Bildern nach. Aber es gab keinen Weg, ein fremdes Bild aus der App
heraus zu sichern. Ein Auftrag damit scheiterte beim Arbeiter - und weil das
erst in der Warteschlange auffaellt, sucht man den Fehler beim Prompt.

---

## Warum die Schranke NICHT einfach faellt

Sie ist keine Schikane. Der Arbeiter laeuft auf Marks PC und erreicht damit
alles in seinem Heimnetz. Duerfte er beliebige Adressen abrufen, liesse sich
ueber die Fehlermeldung in der Warteschlange ausspaehen, welche Geraete dort
antworten. **Die Schranke bleibt, wo sie ist.**

Geaendert hat sich, was davor passiert: `referenzenSichern()` holt jede fremde
Adresse ueber `/api/referenz-holen` in den eigenen Speicher, bevor der Auftrag
eingereiht wird. Die Route prueft serverseitig gegen SSRF, begrenzt die Groesse
und erkennt den Bildtyp - sie ist seit PROJ-43 genau dafuer da.

---

## Zwei Entscheidungen, die man kennen sollte

**Die Reihenfolge bleibt erhalten.** Das ist keine Kleinigkeit: Die
Zuordnungszeilen im Prompt sind stellungsgebunden ("Image 1 = ..., Image 2 =
..."). Kaeme die Liste umsortiert zurueck, truege jedes Bild das falsche
Etikett - und das saehe man dem Ergebnis nicht als Fehler an.

**Was sich nicht holen laesst, BLEIBT in der Liste.** Es stillschweigend zu
entfernen hiesse, einen Auftrag mit weniger Referenzen abzuschicken, als der
Prompt beschreibt. Stattdessen sagt eine Meldung, wie viele geholt wurden und
wie viele nicht - abgelaufene Verweise sind der haeufigste Fall.

---

## Eine Sperre, die dadurch ueberfluessig wurde

PROJ-85 hatte auf einen Critic-Befund hin die Vorbelegung so eingeengt, dass
sie fremde Bilder ueberspringt - mit der Begruendung, ein still gefuellter
Platz fuehre sonst zu einem Auftrag, der sicher scheitert. Diese Begruendung ist
jetzt weg. Die Sperre ist zurueckgenommen; ein Platz leer zu lassen, obwohl das
Bild da ist, waere nur noch Handarbeit ohne Grund.

---

## Ein Fehler in einem Testdoppel, der etwas Allgemeines zeigt

Der neue Code ruft `toast.info(...)`. Zwei Testdoppel fuer `sonner` kannten nur
`error` und `success` - der Aufruf warf, `anlegen` wurde nie erreicht, und der
Test meldete "erwartet: mindestens einmal aufgerufen". Der Fehler lag NICHT im
Produktionscode.

**Die Lehre:** Ein Testdoppel, das weniger kann als das Original, faellt erst
auf, wenn jemand die fehlende Methode benutzt - und der Fehler zeigt dann
irgendwohin, nur nicht auf das Doppel.

---

## Geaendert

| Datei | Was |
|---|---|
| `src/lib/referenzen-sichern.ts` | **neu** - holt fremde Adressen, haelt die Reihenfolge, meldet was nicht ging |
| `src/lib/referenzen-sichern.test.ts` | **neu** - 9 Tests, darunter die Reihenfolge bei mehreren fremden |
| `src/components/prompts/prompt-to-image-dialog.tsx` | sichert vor dem Einreihen; Vorbelegungssperre zurueckgenommen |
| `src/components/shooting-kette-button.tsx` | sichert vor jedem der fuenf Auftraege |
| beide Knopftests | `toast.info` im Doppel, kein echter Netzzugriff mehr |

---

## Offen

- **Die Datenbankzeile bleibt fremd.** Gesichert wird die Adresse IM AUFTRAG,
  nicht das Titelbild am Charakter. Beim naechsten Auftrag wird dasselbe Bild
  erneut geholt. Das ist verschmerzbar (es passiert einmal je Auftrag), aber es
  erzeugt Kopien im Speicher.
- **Die Schleife ist seriell.** Bei drei Referenzen ist das richtig; bei sehr
  vielen waere es langsam. Heute kommt kein Weg ueber vier Referenzbilder.
- **Der Reparaturlauf bleibt ein Kommandozeilen-Skript**
  (`worker/src/bilder-nachholen.mts`). Die 30 verbliebenen fremden Adressen sind
  tote Verweise; die holt auch er nicht mehr.

---

## Was die unabhängige Prüfung gefunden hat

Critic hat gegengelesen. Kein Blocker, aber drei Befunde — alle am Quelltext
nachgemessen, alle bestätigt.

### Mein eigener Kommentar war falsch

Ich hatte hier geschrieben, die Hol-Route lese den Bildtyp „an den ersten Bytes
ab statt am gemeldeten `Content-Type`". **Das tat sie nicht.** Sie schaute
allein auf den Kopf und lehnte alles ab, was nicht mit `image/` begann. Das
Byte-Lesen gab es nur in der Erweiterung und im Arbeiter.

Das ist die gefährlichste Sorte Fehler: Eine Kommentarzeile behauptet eine
Wache, auf die sich der Nächste verlässt.

**Und sachlich hat Mark deshalb nicht bekommen, was er wollte.** Falsch
eingerichtete S3-Eimer und CDNs liefern ein gültiges JPEG regelmäßig als
`application/octet-stream` — das Bild wurde abgelehnt, obwohl es eines war.

Die Route liest jetzt wirklich die Bytes, aber nur dann, wenn der Kopf nichts
Brauchbares sagt (`''`, `application/octet-stream` und Verwandte). Wer etwas
ANDERES behauptet (`text/html`, `application/json`), fällt weiterhin vorher
durch: Wer das erst herunterlädt, um es zu verwerfen, holt sich Seiten ins Haus,
die er nicht wollte.

Das ist nicht die lockerere, sondern die **strengere** Prüfung — sie glaubt dem
Inhalt statt einer Behauptung. Eine HTML-Fehlerseite mit Status 200 fällt damit
ebenso durch wie vorher, und SVG bleibt ausgeschlossen, weil es ausführbarer
Text ist.

### Dasselbe Bild wurde fünfmal geholt

`referenzenSichern` stand INNERHALB der Auftragsschleife der Kette. Die fünf
Aufträge teilen sich dieselben Referenzen; die Route legt aber bei jedem Aufruf
unter einer neuen Kennung ab. Ein Shooting mit zwei fremden Referenzen ergab
**zehn Dateien statt zwei** — und der Knopf stand die ganze Zeit auf „0/5", weil
jeder Abruf bis zu 20 Sekunden dauern darf.

Jetzt wird einmal vor der Schleife gesichert. Ein Test hält es fest: Fünf
Aufträge dürfen aus drei Adressen keine fünfzehn Abrufe machen.

### Was ausdrücklich in Ordnung war

- **Die Reihenfolge bleibt unter allen Umständen erhalten** — genau ein Eintrag
  je Eingabe, Fehlschläge behalten das Original.
- **Die Sicherheitsschranke des Arbeiters ist nicht umgangen.** Die Route legt
  im eigenen Speicher ab; die entstehende Adresse **erfüllt** die Prüfung,
  statt sie zu umgehen.

---

## Nachgemessen

- **Acht Byte-Signaturen**, darunter zwei, die man leicht falsch macht: RIFF
  ohne WEBP-Marke (eine WAV-Datei fängt genauso an) und eine HTML-Seite mit
  Status 200.
- **Der Abruf-Zähler** in der Kette ist festgenagelt.
