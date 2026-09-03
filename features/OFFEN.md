# Offene Punkte

> Stand: 3. September 2026, Ende der Nachtsitzung.
> Diese Datei ist die **erste**, die in der nächsten Sitzung gelesen werden
> sollte. Was hier nicht steht, ist morgen vergessen.

## Als Nächstes, in dieser Reihenfolge

Mark hat am 03.09.2026 zugestimmt, dass PROJ-44 und PROJ-45 „auf jeden Fall"
gemacht werden. PROJ-46 hat er selbst als heutiges Problem benannt — deshalb
steht es zuerst.

1. **PROJ-46 — Bausteine finden statt scrollen.** Der erste Schritt ist klein
   und tut sofort weh, wenn er fehlt: ein Suchfeld im Übernehmen-Dialog. Mark:
   „wenn ich ein Bild vom Lichttisch in einen Prompt-Baustein übergeben will und
   da schon ewig scrollen muss".
2. **PROJ-45 — Lichttisch als Auswahlwerkzeug.** Zwei Bilder gegeneinander
   halten und durchschalten.
3. **PROJ-44 — Einstellungsreihe.** Mehrere Einstellungen desselben Moments.

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
