# Der Bild-Arbeiter

Holt Bildaufträge aus Prompt Trésor ab, lässt sie vom lokalen Proxy erzeugen und
legt die Ergebnisse zurück. Läuft auf dem PC, weil die App in der Cloud die
Adresse `127.0.0.1` nie erreichen kann.

## Muss ich ihn selbst starten?

Nein — beides ist eingerichtet:

**Beim Hochfahren** startet er von selbst. Im Autostart-Ordner von Windows liegt
eine Verknüpfung auf `arbeiter-starten.cmd`; sie öffnet ein minimiertes Fenster.

Wieder loswerden: `Win+R`, `shell:startup` eingeben, die Verknüpfung
„Prompt Tresor Arbeiter" löschen.

**Nach einer Änderung am Code** startet er ebenfalls von selbst — `npm start`
läuft mit `--watch`. Früher musste er nach jeder Änderung von Hand neu gestartet
werden, und wer das vergaß, hatte einen Arbeiter mit altem Stand laufen. Beim
ersten Mal hat das einen Vergrößerungsauftrag dreimal ans Bildmodell geschickt
und verbrannt.

**Ob er gerade läuft**, steht in der App: Die Seite *Warteschlange* zeigt oben
„Arbeiter läuft" oder „Arbeiter zuletzt vor …". Er meldet sich alle zwanzig
Sekunden; bleibt die Meldung länger als sechzig Sekunden aus, gilt er als weg.

Das Lebenszeichen hängt bewusst **nicht** am Auftragstakt: Der wird bei längerer
Ruhe träger (bis 60 s), und sonst hätte die Anzeige einen sparsamen Arbeiter für
einen abgestürzten gehalten.

## Von Hand starten

```bash
cd worker
npm start
```

Beenden mit `Strg+C`. Der laufende **Auftrag** wird noch zu Ende gebracht — bei
mehreren Durchläufen also bis zu vier Bilder. Nochmal `Strg+C` bricht sofort ab
und stellt den Auftrag zurück, ohne einen Versuch zu verbrauchen.

## Einrichtung nach einem Klon

```bash
cd worker
npm install
cp .env.example .env     # dann ausfüllen
npm run pruefen          # prüft die Einrichtung, erzeugt kein Bild
npm start
```

`node_modules` liegt bewusst nicht im Repository — `sharp` bringt
plattformabhängige Binärdateien mit, die auf einem anderen Rechner ohnehin nicht
passen.

## Befehle

| Befehl | Wozu |
|---|---|
| `npm start` | Dauerbetrieb, startet bei Code-Änderungen neu |
| `npm run pruefen` | Prüft Proxy, Datenbank, Ablage — **kostet nichts** |
| `npm run einmal` | Genau ein Auftrag, dann Schluss. Für die Abnahme. |
| `npm test` | Prüft die Adressschranke der fal.ai-Anbindung — **kostet nichts** |

## Voraussetzungen

- **Node ab 22.18** — der Arbeiter führt TypeScript ohne Bauschritt aus, und das
  gibt es ohne Zusatzschalter erst ab dieser Fassung.
- **EasyCLIProxyAPI** muss laufen (liegt ebenfalls im Autostart). Antwortet er
  beim Hochfahren noch nicht, bleibt der Auftrag einfach liegen — das kostet
  keinen Versuch.

## Was in der `.env` steht

| Schlüssel | Bedeutung |
|---|---|
| `PROXY_URL` | Adresse des Bild-Proxys, üblicherweise `http://127.0.0.1:8317` |
| `PROXY_TOKEN` | Zugang zum Proxy |
| `SUPABASE_URL` | Projekt-Adresse |
| `SUPABASE_SERVICE_KEY` | **Service-Key**, nicht der anon-Key |
| `WORKER_USER_ID` | Für wen er läuft — nur fürs Lebenszeichen |
| `POLL_INTERVAL_MS` | Abstand zwischen zwei Abfragen (5000) |
| `REQUEST_TIMEOUT_MS` | Zeitgrenze je Bild (300000) |
| `STALE_MINUTES` | Ab wann ein Auftrag als verwaist gilt (30) |
| `MAX_ATTEMPTS` | Versuche je Auftrag (3) |
| `FAL_KEY` | **Optional.** Zugang zu fal.ai für die KI-Vergrößerung |
| `FAL_TIMEOUT_MS` | Wie lange auf fal gewartet wird (600000) |

`STALE_MINUTES` muss über der längsten Laufzeit liegen: vier Durchläufe mal fünf
Minuten sind zwanzig. Ein zu kleiner Wert reiht einen noch laufenden Auftrag neu
ein — und jedes Bild kostet Geld.

Die Datei ist doppelt von Git ausgeschlossen. Sie enthält den Service-Key, der
alle Zugriffsregeln umgeht.

## Die zwei Wege beim Vergrößern

| | Rechnen (`lanczos`) | KI (`seedvr2`) |
|---|---|---|
| Wo | auf diesem PC | fal.ai |
| Kosten | nichts | ca. 0,5 ct (2×) bis 2 ct (4×) |
| Was passiert | vorhandene Bildpunkte klüger verteilt | Struktur wird rekonstruiert: Haut, Haar, Stoff |
| Ohne Internet | läuft | läuft nicht |
| Bild verlässt den PC | nein | **ja** |

Das Verfahren steht **im Auftrag**, nicht in dieser `.env`. Der Arbeiter rät es
nie: Fehlt es, scheitert der Auftrag mit einer Ansage. Eine stille Voreinstellung
wäre genau die Stelle, an der ein Klick unbemerkt Geld ausgibt.

**Ein Neuversuch zahlt nicht zweimal.** Ab dem Absenden ist der Lauf bei fal
bezahlt. Die Auftragsnummer wird deshalb sofort in der Zeile festgehalten
(`external_ref`) — jeder spätere Versuch holt zuerst dieses Ergebnis ab und
schickt nur dann einen neuen Auftrag, wenn bei fal nichts mehr liegt. Das gilt
auch nach `Strg+C`, nach einem Neustart durch `--watch` und nach „Erneut
einreihen".

**Warum nicht lokal?** SeedVR2 ist unter Apache 2.0 frei verfügbar und ließe sich
selbst betreiben — aber nur mit einer NVIDIA-Karte mit reichlich eigenem
Speicher. Dieser PC hat eine integrierte AMD 780M ohne eigenen Videospeicher und
kein CUDA. Gemessen am 02.09.2026.

`FAL_KEY` liegt hier und **nicht** bei Vercel: Der Arbeiter läuft auf dem PC,
die App in der Cloud. In der Vercel-Umgebung stünde der Schlüssel jeder
Server-Route offen; hier kennt ihn nur dieser eine Prozess.
