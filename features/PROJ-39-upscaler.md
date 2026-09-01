# PROJ-39: Ergebnisbilder vergrößern

## Status: In Review
**Created:** 2026-09-01

## Was es tut

Knopf auf jeder Ergebniskachel in `/queue`, wahlweise 2×, 3× oder 4×. Das Menü
nennt gleich die Zielmaße — „3×" ist abstrakt, „3366×4206" nicht.

Gemessen an einem echten Bild (1122×1402):

| Faktor | Ergebnis | Dauer | Datei |
|---|---|---|---|
| 2× | 2244×2804 | 0,4 s | 7,8 MB |
| 3× | 3366×4206 | 0,6 s | 11,2 MB |
| 4× | 4488×5608 | 0,9 s | 16 MB |

## Wie es gebaut ist

- **Lanczos3 über `sharp`**, läuft lokal im Arbeiter. Kostet nichts, es geht
  keine Anfrage an ein Bildmodell.
- **Zweiter Auftragstyp in derselben Warteschlange** (`job_type`) statt einer
  zweiten Tabelle. Übernahme, Versuchszählung, Aufräumen und die Seite `/queue`
  gelten unverändert weiter.
- **Notbremse bei 8192 Pixeln** Kantenlänge. Darüber frisst das Bild Speicher,
  ohne dass ein einziger echter Bildpunkt dazukäme.
- Die Datenbank lehnt einen Vergrößerungsauftrag **ohne Quellbild oder Faktor**
  sofort ab, statt ihn dreimal scheitern zu lassen.
- Ein bereits vergrößertes Bild bietet kein weiteres Vergrößern an.

Erste Abhängigkeit im Arbeiter: `sharp`. Bewusster Tausch — echtes Lanczos
selbst zu schreiben wäre langsamer und fehleranfälliger gewesen.

## Warum kein KI-Upscaler — geprüft, nicht vermutet

Am 01.09.2026 auf diesem Rechner durchgemessen:

**ComfyUI läuft nicht.** `venv` steht auf Python 3.14 ohne torch, `venv312` hat
torch, aber `comfyui.bat` startet `venv`. ZLUDA selbst lädt sauber und erkennt
die Grafikkarte.

**Real-ESRGAN eigenständig** (`realesrgan-ncnn-vulkan`) heruntergeladen und
ausprobiert. Die Grafikkarte ist eine **integrierte AMD Radeon 780M**:

- `realesrgan-x4plus` (Fotomodell) → `vkAllocateMemory failed`, auch mit den
  kleinsten zulässigen Kacheln. Passt nicht in den geteilten Speicher.
- `realesr-animevideov3-x4` (Video-/Zeichentrickmodell) → läuft.

**Ergebnis am selben Ausschnitt verglichen:** Das Video-Modell bügelt Gesichter
glatt — Haut wirkt wachsartig, Poren und feine Struktur verschwinden. Mark hat
den Dreier-Vergleich beurteilt: einfach vergrößert zu unscharf, ESRGAN zu glatt,
**Lanczos am besten**.

Damit ist die Sache entschieden. Ein echter Foto-Upscaler bräuchte eine
Grafikkarte mit eigenem Speicher; solange die nicht da ist, wäre er auf diesem
Rechner eine Verschlechterung.

## Ehrlich eingeordnet

Lanczos verteilt die vorhandenen Bildpunkte klüger, es erfindet keine Details
dazu. Gegenüber dem einfachen Vergrößern beim Zoomen ist der Unterschied
deutlich sichtbar (Kanten, Hautstruktur, Falten). Ein KI-Upscaler auf passender
Hardware könnte mehr — mit dem Risiko, Details zu erfinden, die nie da waren.

## Aufgeräumt

Die Ablaufschleife des Arbeiters stand zweimal da, im Dauerbetrieb und im
Abnahmewerkzeug. Die Kopie lief zweimal hinterher: erst beim Fortschreiben nach
jedem Bild, dann beim zweiten Auftragstyp, wo das Werkzeug eine Vergrößerung ans
Bildmodell schickte und eine Absage bekam. Jetzt gemeinsam in
`worker/src/abarbeiten.ts`.

Dabei ebenfalls behoben: Der Ignorieren-Eintrag lautete `/node_modules` und galt
nur im Hauptordner — beim Installieren von `sharp` sind dadurch 126 Dateien und
20 MB plattformabhängige Binärdateien ins Repository gewandert.

## Offen

- In der laufenden App abgenommen ist die Kette über das Abnahmewerkzeug. Den
  Knopf selbst hat noch niemand geklickt — das braucht Marks Zugang.
- **Nach jeder Änderung am Arbeiter muss er neu gestartet werden.** Der laufende
  Prozess hat sonst den alten Stand: Beim ersten Test hat er den
  Vergrößerungsauftrag dreimal ans Bildmodell geschickt und verbrannt.
