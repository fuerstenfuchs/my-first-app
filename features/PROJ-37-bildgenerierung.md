# PROJ-37: Bildgenerierung (Auftragstabelle + lokaler Arbeiter)

## Status: In Review
**Created:** 2026-09-01
**Last Updated:** 2026-09-01
**Grundlage:** BRIEFING-Bildgenerierung.md vom 01.09.2026

## Ziel

Aus dem Scene Builder soll ein Auftrag in eine Warteschlange wandern, lokal
abgearbeitet werden, und das fertige Bild in Trésor erscheinen. Die
Prompt-Erzeugung bleibt unverändert — es kommt nur ein Weg dazu, den Prompt
auszuführen statt ihn zu kopieren.

## Warum Auftragstabelle statt Direktaufruf

Vercel erreicht `127.0.0.1` nicht — Trésor läuft in der Cloud, der Bild-Proxy
auf dem PC. Unabhängig davon bricht Vercel lange Anfragen ab; ein Bild dauert
bei gpt-image-2 25 bis 180 Sekunden. Eine Auftragstabelle wäre also auch mit
direktem OpenAI-Schlüssel nötig. Der Arbeiter ist austauschbar.

## Umgesetzt

### Stufe 1 — Datenbank und Arbeiter
- `docs/proj-37-image-jobs.sql` — Tabelle `image_jobs`, RLS, zwei Funktionen,
  Bucket `generated-images` samt Storage-Policies. **Eingespielt am 01.09.2026.**
- `worker/` — eigenständiges Programm, kein Teil der Next.js-App.
  Keine Abhängigkeiten: Node 26 führt TypeScript direkt aus und lädt die `.env`
  selbst (`node --env-file=.env src/index.ts`).
  - `npm start` — Dauerbetrieb, fragt alle 5 s nach Aufträgen
  - `npm run einmal` — genau ein Auftrag, für die Abnahme
  - `npm run pruefen` — Verbindungsprüfung ohne Bilderzeugung, kostet nichts

### Stufe 2 — Trésor
- `src/lib/image-generation.ts` — Formatzuordnung, Modelle, Statustexte
- `src/hooks/use-image-jobs.ts` — Aufträge anlegen, lesen, erneut einreihen, löschen
- `src/components/scene-builder/queue-button.tsx` — Knopf „Zur Warteschlange"
  samt Modell- und Durchlauf-Auswahl
- `src/app/(app)/queue/page.tsx` — Warteschlange mit Ergebnisraster
- Seitenleiste: Eintrag „Warteschlange" nach dem Scene Builder

## Abweichungen vom Briefing — begründet

**1. `reference_urls` statt `reference_paths`.**
Das Briefing sieht Storage-Pfade vor. Der Scene Builder führt aber nur
öffentliche URLs mit (`type RefImage = { url, label }`). Pfade wären nur über
einen Umbau der Referenzauswahl zu bekommen. Alle zwölf Bild-Buckets sind
öffentlich lesbar — der Arbeiter lädt direkt per HTTPS.

**2. Zusätzliche Spalte `aspect_ratio`.**
`size` ist die tatsächlich angeforderte native Größe, `aspect_ratio` das
gewünschte Verhältnis. Damit ist ein späteres Beschneiden (Briefing 6.3) ohne
Datenmigration nachrüstbar.

**3. Übernahme als Datenbankfunktion statt als rohes SQL im Arbeiter.**
`for update skip locked` lässt sich über die REST-Schnittstelle nicht
ausdrücken. Ohne diese Sperre würden zwei versehentlich gleichzeitig laufende
Arbeiter denselben Auftrag doppelt abarbeiten — und jedes Bild kostet Geld.

## Messbefund, der die Oberfläche bestimmt

Am 01.09.2026 am laufenden Proxy nachgemessen:

- **Ohne Referenzbild** wirkt `size`. Angefordert 1536x1024, zurückbekommen
  1536x1024.
- **Mit Referenzbild** wirkt `size` NICHT. Angefordert 1024x1024,
  zurückbekommen 1122x1402 — das Modell richtet sich nach dem Referenzbild.

Folge: Sobald Referenzen mitgehen, hängt der Knopf eine Formatansage an den
Prompt (`Output a WIDE 16:9 CINEMATIC LANDSCAPE frame.`) und weist in der
Oberfläche darauf hin. Die Prompt-Erzeugung des Scene Builders selbst bleibt
unangetastet — angehängt wird erst beim Einreihen.

## Abnahme Stufe 1

Zwei Aufträge von Hand eingereiht und abgearbeitet:

| Auftrag | Weg | Ergebnis |
|---|---|---|
| `07370f33` | `/v1/images/generations`, ohne Referenz | 1536x1024, 25 s, 2,2 MB |
| `ce2a836e` | `/v1/images/edits`, 1 Referenz, input_fidelity=high | 1122x1402, 27 s, 2,1 MB |

Beide Bilder liegen in `generated-images` und sind über die öffentliche Adresse
abrufbar.

## Nachprüfung durch Critic — sieben Befunde behoben

**BLOCKER, nachgemessen und geschlossen:** Beide `security definer`-Funktionen
waren mit dem öffentlichen anon-Schlüssel aufrufbar (HTTP 200). Damit hätte
jeder fremde Auftragszeilen auslesen (`returning *`), Versuche verbrennen und
mit `stale_minutes: 0` laufende Aufträge abbrechen können. Nach dem
Rechteentzug: HTTP 401. Die `revoke`/`grant`-Zeilen stehen jetzt im
Migrations-SQL, nicht nur in der Datenbank.

**Doppelte Kosten bei Absturz:** `result_paths` wurde erst nach der ganzen
Schleife geschrieben. Ein Auftrag mit vier Durchläufen, der beim vierten Bild
abstürzte, verlor drei bezahlte Bilder — der Neuversuch erzeugte sie erneut.
Jetzt wird nach jedem Bild fortgeschrieben, und der Neuversuch setzt fort.

**Auftrag, der still für immer wartet:** Beim Abbruch wurde `attempts` nicht
zurückgenommen. Ein im dritten Versuch abgebrochener Auftrag blieb mit
attempts = 3 auf `queued` — claim holt ihn nie wieder, requeue sieht ihn nicht,
auf /queue zeigte er dauerhaft „Wartet". Jetzt eigener Weg
`auftragZurueckstellen`, der den nicht stattgefundenen Versuch zurückgibt.

**Aufräumgrenze zu knapp:** 10 Minuten bei bis zu 20 Minuten Laufzeit. Bei zwei
Arbeitern wäre ein laufender Auftrag neu eingereiht und ein zweites Mal erzeugt
worden. Jetzt 30 Minuten, und `started_at` wird nach jedem Bild aufgefrischt —
gemessen wird damit die Zeit seit dem letzten Bild, nicht seit Auftragsbeginn.

**Weitere:** Node-Anforderung auf >=22.18 berichtigt (TypeScript ohne Flag gibt
es erst ab dort), Formatansage wird im Knopf wörtlich angezeigt statt nur
erwähnt, Löschfehler wird nicht mehr verschluckt, Cache-Brecher an den
Ergebnisbildern, Abfrage-Intervall stabilisiert. Die Anhängelogik ist als
`promptFuerAuftrag` aus der Komponente ausgelagert und jetzt geprüft — es ist
die einzige Stelle im Vorhaben, die den Prompt anfasst.

## Zweite Abnahme nach den Korrekturen

Auftrag `c4e01d96` mit zwei Durchläufen: beide Bilder 1536x1024, 23 s und 26 s.
In der Datenbank nachgemessen: `status = done`, `attempts = 1`,
`array_length(result_paths, 1) = 2`, `finished_at` gesetzt.

## Offen

- **Stufe 2 in der laufenden App abnehmen.** Knopf und Seite sind gebaut,
  Typen und Build sind sauber, 214 Tests grün — aber niemand hat den Knopf in
  der angemeldeten App geklickt. Das braucht Marks Zugang.
- **Proxy-Token.** Steht laut Briefing auf einem trivialen Wert. Solange der
  Proxy nur auf 127.0.0.1 lauscht, unkritisch; vor jeder Freigabe nach außen
  ändern.
- **Stufe 3** (Anker-Kette, Serien, Vergleichsansicht, zweites Modell) bewusst
  nicht begonnen. Das Feld `anchor_job_id` ist vorbereitet.

## Nicht gebaut (Briefing 9)

Keine zweite Oberfläche, keine Änderung an der Prompt-Erzeugung, keine
Generierung im Server der App.
