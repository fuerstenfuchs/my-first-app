# PROJ-48: Referenzkette für Charaktere

## Status: Planned
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

## Was noch offen ist

- In welche Variante die drei Bilder gehören. Marks Benennung legt eigene
  Varianten nahe („Kopf", „Körper", „Referenzsheet"). Das Titelbild wird nie
  überschrieben — stehende Regel.

## Was vorher geklärt werden muss

Diese Fragen ändern den Bau, deshalb stehen sie hier und nicht im Code:

1. **Läuft die Kette in einem Rutsch durch oder Schritt für Schritt?**
   Durchlaufend ist bequemer; Schritt für Schritt erlaubt, ein misslungenes
   Sheet zu wiederholen, bevor der Fehler sich in die nächsten fortpflanzt —
   und genau das ist bei einer Kette die Gefahr.
2. **Bekommt Schritt 2 nur den erzeugten Kopf oder Kopf UND Original?**
   Mark hat „Referenzbild der vorher generierte Kopf" gesagt. Nur den Kopf zu
   geben ist konsequent; das Original mitzugeben könnte die Körperstatur besser
   treffen, birgt aber die Vermischung, die Schritt 3 gerade vermeiden will.
3. **Wohin gehen die drei Bilder?** In dieselbe Variante wie das Original oder
   in eigene Varianten („Kopf", „Körper", „Referenz")? Marks stehende Regel
   gilt: **das Titelbild wird nie überschrieben.**

## Voraussetzung — erst PROJ-49

Die Kette setzt voraus, dass das Ausgangsbild im eigenen Speicher liegt. Genau
daran ist Marks Versuch am 03.09.2026 gescheitert (siehe PROJ-49). Ohne das
kann Schritt 1 gar nicht starten.
