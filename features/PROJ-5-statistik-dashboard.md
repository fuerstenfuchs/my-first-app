# PROJ-5: Statistik-Dashboard

## Status: Planned
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

### Open Questions
- keine