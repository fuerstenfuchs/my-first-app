# PROJ-94: 5K lokal hochrechnen

**Status:** In Review · **Datum:** 2026-10-03 · **Auftrag:** Mark („Ja, bau 5K auch im Trésor ein")

## Was
In der Ergebniskachel (Vergrößern-Menü) zwei neue Wege, die auf dem neuen PC (RTX 5060 Ti) rechnen und nur Strom kosten:
- **Lokal · 5K scharf** (Vorgabe): eine Stufe mit SeedVR2 7B Sharp.
- **Lokal · 5K zwei Stufen**: erst normal 2×, dann Sharp.

5K = lange Seite 5120 Pixel, höchstens 18 Megapixel (Quadrate und Hochformate werden dafür schmaler). Den Faktor rechnet der Arbeiter aus der Bildgröße.

## Wie
- Datenbank (`docs/proj-94-lokal-5k.sql`, am 03.10.2026 auf Produktion angewendet): `upscaler` kennt `lokal_5k` und `lokal_5k_zwei`; bei beiden sind `scale` und `ziel_klasse` leer.
- Worker (`worker/src/lokal.ts` → `bildHochrechnen5k`, `abarbeiten.ts`): holt die Quelle wie bei jeder Vergrößerung (Original aus Backblaze, sonst die WebP-Fassung aus Supabase), schickt sie in voller Größe als `quelle` an den Arbeiter (Auftrag `hochrechnen`), legt das Ergebnis wie jede Vergrößerung ab.
- Arbeiter (`werkzeuge/arbeiter-neuer-pc`): Auftrag `hochrechnen` ohne Bildmodell, Bild bis 4096 px je Seite, nicht auf 1024 verkleinert.

## Gemessen
Quelle 1390×2048 (WebP) → 3474×5120: scharf 51 s, zwei Stufen 78 s. Kein sichtbares Gitter.

## Offen
- Der neue PC muss an sein, sonst scheitert der Auftrag mit der Meldung „Der neue PC ist nicht erreichbar".
- Crystal ist aus dem Menü genommen (zu teuer); Typ und Datenbankwert bleiben, alte Aufträge scheitern mit klarem Satz.
