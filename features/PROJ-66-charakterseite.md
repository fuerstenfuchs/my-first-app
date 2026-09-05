# PROJ-66: Die Charakterseite auf dem beleuchteten Tisch

## Status: In Review
**Created:** 2026-09-05

## Warum

Mark am 05.09.2026, unmittelbar nach der Warteschlange: „jetzt die
Charakterseite."

## Was gebaut wurde

- **Der beleuchtete Tisch** unter der ganzen Seite (`lt` an der Wurzel).
- **Beide Kopfzeilen** als `lt-kopf`, Titel von 16 auf 20px.
- **Suchfeld und Knöpfe** als `lt-feld` bzw. `lt-haupt`, von 32 auf 40–44px Höhe.
- **Die Liste links:** Einträge von `rounded-lg` auf 12px, Vorschaubilder von
  40 auf 44px mit sichtbarer Kante, Name von 14 auf 15px, Beschreibung von 12
  auf 13px.

## Violett ist weg — 34 Stellen

Die Charakterseite hatte eine eigene Kennfarbe: Violett, in sieben Dateien und
34 Klassen. Das widerspricht der Regel, die seit der Seitenleiste gilt und die
Mark selbst gesetzt hat: **ein Akzent, und Orange heißt „ausgewählt"**.

Am deutlichsten war es am ausgewählten Listeneintrag: Er war violett, während
dieselbe Auswahl überall sonst in der App orange ist. Zwei Farben für dieselbe
Aussage sind eine Farbe zu viel.

Ersetzt wurde nach Bedeutung, nicht stumpf: der helle Ton für Text, der volle
für Flächen und Kanten, der Hauptknopf auf `bg-primary` mit dunkler Schrift.

## Eine Falle, die eine Runde gekostet hat

Beim ersten Anlauf blieb die Seite **schwarz**, obwohl alle Klassen im Markup
standen. Der Grund: `lichttisch.css` wird über einen Import in der Seite
geladen, und den hatte die Charakterseite nicht. Die Klassen `lt`, `lt-kopf`,
`lt-feld` standen da und taten nichts.

Die Warteschlange hatte den Import nur zufällig — er war dort aus einem anderen
Grund hineingekommen (die gemeinsame Ergebniskachel). **Wer eine weitere Seite
umstellt, muss zuerst den Import setzen.**

## Geprüft

- `npx tsc --noEmit` — keine neuen Fehler.
- `npx vitest run` — 601 Tests grün.
- `npm run build` — erfolgreich.
- Bildschirmfoto der echten Seite (Leerzustand, weil die Vorschau ohne
  Anmeldung keine Charaktere sieht).

## Offen

Die Detailspalte mit einem ausgewählten Charakter — Varianten, Referenzkette,
Sheets — habe ich nicht gesehen. Dort liegen die Bauteile
`variant-card.tsx`, `referenzkette-dialog.tsx` und `character-sheet-dialog.tsx`,
deren Farben mitgezogen wurden, aber deren Formen noch aus dem alten Bild
stammen.
