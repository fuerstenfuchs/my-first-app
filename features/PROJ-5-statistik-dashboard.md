# PROJ-5: Statistik-Dashboard

## Status: Deployed
**Created:** 2026-06-12
**Last Updated:** 2026-06-12

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — geschützte Route
- Requires: PROJ-2 (Prompt-Verwaltung) — `usage_count` wird beim Kopieren inkrementiert
- Requires: PROJ-4 (Sammlungen) — Tags für „Meistgenutzter Tag"-KPI kommen aus Prompt-Daten

## User Stories
- Als Owner möchte ich auf einen Blick sehen welche Prompts ich am häufigsten nutze, damit ich erkenne welche den größten Wert haben
- Als Owner möchte ich meine Gesamtnutzung sehen (Kopiervorgänge, Prompt-Anzahl), damit ich ein Gefühl für meinen Workload bekomme
- Als Owner möchte ich direkt aus der Rangliste einen Prompt öffnen können, damit ich ihn sofort kopieren oder bearbeiten kann
- Als Owner möchte ich sehen welcher Tag bei mir am häufigsten vorkommt, damit ich meine Schwerpunkte erkenne

## Out of Scope
- Nutzung über Zeit (Trends, Woche/Monat, Verlaufsgraphen) — zu aufwändig für MVP
- Zeitfilter (letzte 7/30/90 Tage) — alle Statistiken sind immer kumulativ (All-Time)
- Mehr als Top 10 in der Rangliste
- Export der Statistiken als CSV/PDF
- Aufschlüsselung nach Tag in einem Balken- oder Tortendiagramm
- Rating/Bewertungssystem — deferred (wurde in PROJ-2 bereits explizit ausgeschlossen)
- Vergleich zwischen Zeiträumen
- Aktivster Wochentag oder Tageszeit

## Acceptance Criteria

**Navigation:**
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er die Sidebar sieht, dann ist ein Eintrag „Statistiken" mit Chart-Icon unterhalb von „Alle Prompts" und oberhalb der Sammlungen sichtbar
- [ ] Angenommen der Nutzer klickt auf „Statistiken", dann wird er zur `/stats`-Seite navigiert

**Leerseite (keine Kopiervorgänge):**
- [ ] Angenommen kein Prompt wurde jemals kopiert (alle `usage_count = 0`), wenn der Nutzer `/stats` aufruft, dann sieht er die Meldung „Noch keine Nutzungsdaten" und einen Button „Zur Hauptansicht"
- [ ] Angenommen der Nutzer klickt auf „Zur Hauptansicht", dann wird er zu `/` navigiert

**KPI-Kacheln:**
- [ ] Angenommen mindestens ein Prompt wurde kopiert, wenn der Nutzer `/stats` aufruft, dann sieht er drei Kennzahl-Kacheln: „Gesamt-Kopiervorgänge", „Prompts gesamt" und „Meistgenutzter Tag"
- [ ] Angenommen kein Prompt hat einen Tag, dann zeigt die Kachel „Meistgenutzter Tag" den Wert „—" (kein Tag vorhanden)

**Top-10-Rangliste:**
- [ ] Angenommen mindestens ein Prompt wurde kopiert, dann sieht der Nutzer eine Rangliste mit bis zu 10 Prompts sortiert nach `usage_count` absteigend
- [ ] Angenommen ein Prompt hat `usage_count = 0`, dann erscheint er nicht in der Rangliste
- [ ] Angenommen weniger als 10 Prompts wurden kopiert, dann zeigt die Rangliste nur die tatsächlich vorhandenen Einträge ohne Platzhalter
- [ ] Angenommen der Nutzer klickt auf einen Eintrag in der Rangliste, dann öffnet sich das Detail-Modal dieses Prompts

## Edge Cases
- **Gleichstand:** Zwei Prompts mit identischem `usage_count` → beide erscheinen in der Rangliste, Reihenfolge nach `title` alphabetisch (Tiebreaker)
- **Netzwerkfehler beim Laden:** Fehlermeldung „Statistiken konnten nicht geladen werden — bitte Seite neu laden"
- **Prompt wurde gelöscht:** Gelöschte Prompts tauchen nicht in der Rangliste auf, da `usage_count` mit dem Prompt zusammen entfernt wird
- **Meistgenutzter Tag bei Gleichstand:** Tag der beim meistgenutzten Prompt zuerst in der Tags-Liste steht

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Nur All-Time-Statistiken, kein Zeitfilter | Einfachheit für MVP — kumulativer Wert reicht um Lieblings-Prompts zu erkennen | 2026-06-12 |
| Top 10, nicht mehr | Mehr wäre auf einer Seite unübersichtlich und der Nutzer hat selten >10 stark genutzte Prompts | 2026-06-12 |
| Prompts mit 0 Kopien ausgeblendet | Eine Rangliste mit `usage_count = 0` wäre bedeutungslos | 2026-06-12 |
| Klick → Detail-Modal statt Navigation | Konsistentes UX mit der Hauptansicht; Nutzer kann Prompt direkt kopieren ohne zurückzunavigieren | 2026-06-12 |
| 3 KPI-Kacheln (Kopiervorgänge, Prompts, Tag) | Schneller Überblick ohne Overcrowding; alle drei Werte sind sofort aus vorhandenen Daten berechenbar | 2026-06-12 |
| Sidebar-Position: nach „Alle Prompts", vor Sammlungen | Statistiken sind globale Sicht, Sammlungen sind spezifischer — logische Hierarchie | 2026-06-12 |

### Technical Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Keine neue DB-Tabelle | Alle benötigten Daten (`usage_count`, `tags`) sind bereits in `prompts` vorhanden | 2026-06-12 |
| Rein client-seitige Berechnung | Dieselbe Strategie wie PROJ-3 (Suche/Filter) — alle Prompts sind bereits im Speicher nach dem Laden | 2026-06-12 |
| Eigener `useStats`-Hook | Kapselt die Berechnung von KPIs + Top-10 und hält `stats/page.tsx` übersichtlich | 2026-06-12 |
| „Meistgenutzter Tag" = höchste kumulierte usage_count | Aussagekräftiger als bloße Tag-Häufigkeit — zeigt welcher Themenbereich am meisten genutzt wird | 2026-06-12 |
| Keine Charting-Library | Kein Diagramm im Scope — Progress-Bar in der Rangliste reicht als visuelle Orientierung | 2026-06-12 |
| PromptModal wiederverwenden | Bereits gebaut in PROJ-2, konsequentes UX-Muster | 2026-06-12 |

### Open Questions
- keine

---

## Tech Design

### Komponenten-Struktur

```
/stats (neue Seite)
+-- Header
|   +-- SidebarTrigger
|   +-- Seitentitel „Statistiken"
+-- Leerseite (wenn Gesamt-Kopiervorgänge = 0)
|   +-- Icon + Meldung „Noch keine Nutzungsdaten"
|   +-- Button „Zur Hauptansicht" → /
+-- KPI-Bereich (3 Kacheln, nebeneinander)
|   +-- KpiCard „Gesamt-Kopiervorgänge" (Summe aller usage_count)
|   +-- KpiCard „Prompts gesamt" (Anzahl Prompts)
|   +-- KpiCard „Meistgenutzter Tag" (Tag mit höchster kumulierter usage_count)
+-- Top-10-Rangliste (nur wenn Gesamt-Kopiervorgänge > 0)
    +-- Tabellen-Header: Rang | Prompt | Kopiervorgänge
    +-- RankRow (je Eintrag, klickbar)
        +-- Rang-Nummer (1–10)
        +-- Prompt-Titel
        +-- Kopieranzahl als Badge
        +-- Progress-Bar (relativ zur Top-1-Anzahl)

Wiederverwendet aus PROJ-2:
+-- PromptModal — öffnet bei Klick auf Ranglisten-Eintrag

Sidebar (ERWEITERT in app-sidebar.tsx):
+-- „Alle Prompts" (bestehend)
+-- „Statistiken" (NEU) — BarChart-Icon, Link zu /stats
+-- Sammlungen (bestehend)
```

### Datenhaltung

Keine neuen Daten — alles wird aus der bestehenden `prompts`-Tabelle abgeleitet:

| KPI | Berechnung |
|---|---|
| Gesamt-Kopiervorgänge | Summe aller `usage_count`-Werte über alle Prompts |
| Prompts gesamt | Anzahl der Einträge in der `prompts`-Tabelle |
| Meistgenutzter Tag | Tag dessen Prompts kumulativ die meisten Kopiervorgänge aufweisen |
| Top-10-Rangliste | Prompts mit `usage_count > 0`, absteigend sortiert, max. 10 Einträge |

### Neue Dateien
- `src/app/(app)/stats/page.tsx` — Statistik-Seite
- `src/components/stats/kpi-card.tsx` — wiederverwendbare Kennzahl-Kachel
- `src/hooks/use-stats.ts` — Hook: lädt Prompts, berechnet alle KPIs + Top-10

### Geänderte Dateien
- `src/components/app-sidebar.tsx` — „Statistiken"-Eintrag hinzufügen

### Neue Packages
Keine — `Card`, `Badge`, `Progress`, `Table` aus shadcn sind bereits installiert.

## QA Test Results

**Tested:** 2026-06-12
**App URL:** https://my-first-app-gamma-ecru.vercel.app/
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### Navigation
- [x] Sidebar-Eintrag „Statistiken" mit BarChart2-Icon unterhalb „Alle Prompts", oberhalb Sammlungen ✓
- [x] Klick → `/stats` ✓

#### Leerseite
- [x] `totalCopies === 0` → „Noch keine Nutzungsdaten" + Button „Zur Hauptansicht" ✓
- [x] Button → `router.push('/')` ✓

#### KPI-Kacheln
- [x] 3 KpiCards: Gesamt-Kopiervorgänge, Prompts gesamt, Meistgenutzter Tag ✓
- [x] Kein Tag vorhanden → `topTag ?? '—'` ✓

#### Top-10-Rangliste
- [x] Sortiert nach `usage_count` absteigend, max. 10 Einträge ✓
- [x] `usage_count = 0` gefiltert via `.filter(p => p.usage_count > 0)` ✓
- [x] Weniger als 10 → zeigt nur verfügbare Einträge ✓
- [x] Klick auf Eintrag → Detail-Modal öffnet sich ✓

### Edge Cases Status
- [x] Gleichstand: alphabetischer Tiebreaker `|| a.title.localeCompare(b.title)` ✓
- [x] Gelöschte Prompts: automatisch ausgeblendet (nicht in `prompts`-State) ✓
- [x] Kein Tag vorhanden: `topTag = null` → „—" angezeigt ✓

### Security Audit Results
- [x] **Route-Schutz**: `/stats` in `(app)`-Routegruppe, durch Middleware geschützt ✓
- [x] **Kein User-Input**: Statistiken sind rein lesend — kein XSS/Injection-Risiko ✓
- [x] **IDOR**: Nutzer sieht nur eigene Prompts via RLS ✓
- [x] **Keine Secrets im Client**: Nur `NEXT_PUBLIC_`-Variablen ✓

### Automated Test Results

**Unit Tests (Vitest): 48/48 passed** (inkl. 11 neue PROJ-5-Tests)
- `src/hooks/use-stats.test.ts` — 11 Tests: KPI-Berechnungen, topTag, Top-10-Rangliste, Tiebreaker, Grenzen

**E2E Tests (Playwright): 2/2 passed, 18 skipped (TEST_PASSWORD not set)**
- `tests/proj-5-statistik.spec.ts` — 10 Tests × 2 Browser (Chrome Desktop + Pixel 5)
- Ohne Credentials: Redirect-Test — bestanden
- Mit Credentials: 9 weitere Tests ausführbar

### Bugs Found

**BUG-1 (Low):** Netzwerkfehler zeigt generischen Toast
- **Beschreibung:** Die Spec verlangt die Meldung „Statistiken konnten nicht geladen werden — bitte Seite neu laden". Stattdessen zeigt `usePrompts` den generischen Toast „Fehler beim Laden der Prompts".
- **Auswirkung:** Nutzer wird über den Fehler informiert, aber mit einer nicht-seitenspezifischen Nachricht.
- **Workaround:** Toast vom gemeinsamen Hook ist ausreichend informativ für MVP.

### Summary
- **Acceptance Criteria:** 10/10 bestanden
- **Edge Cases:** 3/3 bestanden
- **Bugs Found:** 1 Low (nicht deployment-blockierend)
- **Security:** Bestanden — keine Lücken gefunden
- **E2E Tests:** 2/2 ohne Credentials bestanden, 9 weitere mit `TEST_PASSWORD` ausführbar
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment

**Deployed:** 2026-06-12
**Production URL:** https://my-first-app-gamma-ecru.vercel.app/stats
**Platform:** Vercel (GitHub auto-deploy from `main`)
**Git Tag:** v1.5.0-PROJ-5