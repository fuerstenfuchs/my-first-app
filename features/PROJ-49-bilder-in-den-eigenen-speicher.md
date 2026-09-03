# PROJ-49: Erfasste Bilder in den eigenen Speicher kopieren

## Status: Planned
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
