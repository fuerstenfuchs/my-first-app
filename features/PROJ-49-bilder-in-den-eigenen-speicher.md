# PROJ-49: Erfasste Bilder in den eigenen Speicher kopieren

## Status: In Progress
**Created:** 2026-09-03

## Warum — der Auslöser

Mark wollte am 03.09.2026 ein Charakter-Sheet erzeugen. Die Warteschlange
meldete:

> Referenzbilder dürfen nur aus dem eigenen Speicher kommen.

Nachgemessen: Das mitgegebene Referenzbild war

```
https://scontent-dus1-1.xx.fbcdn.net/v/t39.30808-6/510969862_…jpg
```

also eine Adresse auf einem Facebook-Server. Die Schranke im Arbeiter
(`bildHolen` in `worker/src/supabase.ts`) hat richtig gehandelt: Der Arbeiter
läuft auf Marks PC und erreicht damit alles im Heimnetz. Dürfte er beliebige
Adressen abrufen, ließe sich über die Fehlermeldung auf `/queue` ausspähen,
welche Geräte hier antworten.

## Was dahintersteckt — größer als ein Charakter

Die Erweiterung schreibt beim Erfassen die **fremde Adresse** direkt in die
Datenbank (`cover_image_url: capture.imageUrl` in `CharacterCaptureScreen.tsx`,
`LocationCaptureScreen.tsx` und den übrigen Erfassungsbildschirmen). Kopiert
wird nichts. Nur Quick Capture lädt tatsächlich hoch.

Am 03.09.2026 gezählt:

| Baustein | zeigt nach außen | von … mit Bild |
|---|---|---|
| Locations | **30** | 46 |
| Outfits | **13** | 15 |
| Charaktere | 1 | 15 |

**Zwei Folgen, und die zweite ist die schlimmere:**

1. Solche Bilder können nicht als Referenz dienen — genau der Fehler oben.
2. **Sie verschwinden irgendwann.** Adressen von Facebook-CDN und ähnlichen
   Diensten laufen ab; andere Seiten sperren das Einbinden von außen. Marks
   Bibliothek steht zu großen Teilen auf geliehenen Verweisen, und wenn sie
   reißen, ist das Bild weg, ohne dass irgendetwas kaputtgeht oder meldet.

## Was gebaut wird

**1. Beim Erfassen kopieren.** Die Erweiterung lädt das Bild in Marks eigenen
Speicher, bevor sie den Baustein anlegt, und schreibt die eigene Adresse.
Fällt das Kopieren aus, wird der Baustein trotzdem angelegt — mit der fremden
Adresse und einem sichtbaren Hinweis. Ein verlorener Fund wäre schlimmer als
ein geliehener Verweis.

**2. Ein Reparaturlauf** für den Bestand. Er holt jedes fremde Bild, legt es im
eigenen Speicher ab und zieht die Adresse nach. Nur was sich holen lässt —
abgelaufene Verweise werden gemeldet, nicht stillschweigend geleert.

Für beides gibt es das Werkzeug bereits: `/api/referenz-holen` (seit PROJ-43)
holt serverseitig, prüft gegen SSRF, begrenzt Größe und Typ und legt unter der
eigenen Nutzerkennung ab.

## Reihenfolge

PROJ-49 ist die Voraussetzung für PROJ-48 (Referenzkette). Ohne Bild im eigenen
Speicher kann keine Kette starten.

## Reparaturlauf durchgeführt (03.09.2026)

`worker/src/bilder-nachholen.mts`, zwei Gänge. Der erste ändert nichts und
sagt nur, was noch erreichbar ist — genau die Zahl, die man vorher wissen will.

```
gefunden:     431 fremde Bildadressen
erreichbar:   403
nicht mehr:    28   ← schon verloren, bevor wir angefangen haben
nachgeholt:   401
Fehler dabei:   2
```

Von 431 zeigen jetzt noch **30** nach außen; das sind die toten und die zwei
Fehlschläge. Marks blockierter Charakter liegt im eigenen Speicher, das Sheet
kann laufen.

**Zwei Dinge, die beim Bau auffielen:**

- Ein HTTP/2-Fehler eines fremden Servers kommt als unbehandeltes Ereignis an
  der Sitzung an, NICHT als abgelehnte Zusage — er entkommt jedem `try/catch`
  um den Abruf. Der erste Lauf ist daran beim 331. von 431 Bildern gestorben.
  Bei einem Skript über Hunderte fremder Server ist das die Regel, nicht die
  Ausnahme.
- Der Bericht wird nach JEDEM Bild geschrieben, nicht am Ende. Die alten
  Adressen stehen darin, bevor sie überschrieben werden — nichts geht
  unwiederbringlich verloren.

## Punkt 1 gebaut (03.09.2026) — beim Erfassen kopieren

Neu: `extension/src/lib/bildSichern.ts`. `bildSichern(quelle, art)` holt ein Bild
(auch eine `data:`-Adresse) und legt es unter `${user.id}/erfasst/<uuid>.<endung>`
im passenden Eimer ab. Liegt die Adresse schon im eigenen Speicher, passiert
nichts. Scheitert das Kopieren, kommt die **ursprüngliche** Adresse zurück plus
ein Satz zum Warum — der Baustein wird trotzdem angelegt.

Die Erweiterung darf fremde Adressen selbst abrufen (`<all_urls>` in den
`host_permissions`). Die Server-Route `/api/referenz-holen` wird hier nicht
gebraucht.

Umgestellt sind alle acht genannten Stellen in sieben Bildschirmen — dazu die
vier `crop_image_url`-Spalten in den Erfassungsbildschirmen, wo bisher der ganze
Zuschnitt als `data:`-Text in der Datenbankzeile stand.

**Drei Entscheidungen, die man kennen sollte:**

- **Der Bildtyp wird an den ersten Bytes abgelesen, nicht am `Content-Type`.**
  Manche Server liefern `application/octet-stream`, manche eine Fehlerseite in
  HTML mit Status 200. Gegengeprüft an echten Dateien: JPEG/PNG/GIF/WebP/BMP
  werden erkannt, HTML und SVG abgelehnt.
- **`data:`-Adressen werden mit `atob` aufgelöst, nicht über `fetch`.** Auf einer
  Erweiterungsseite gilt eine eigene Inhaltsrichtlinie; ein Umweg über das Netz
  bei Daten, die schon im Speicher liegen, wäre nur eine Fehlerquelle mehr.
- **Bei einem misslungenen Kopieren blendet der Bildschirm nicht weg.** Sonst
  stünde der Hinweis 800 ms lang da. Mark muss „Verstanden" drücken.

**Nicht geprüft:** Der Ablauf im Browser. Das geht nur, indem Mark die
Erweiterung neu lädt (`dist/` ist gebaut) und einmal etwas erfasst — je einen
Fund von einer fremden Seite und einen mit Zuschnitt.
