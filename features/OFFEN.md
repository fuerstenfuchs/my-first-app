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
