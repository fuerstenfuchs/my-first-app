# PROJ-1: Authentifizierung

## Status: Planned
**Created:** 2026-06-11
**Last Updated:** 2026-06-11

## Dependencies
- Keine

## User Stories
- Als Owner möchte ich mich mit Google OAuth einloggen, damit ich schnell ohne Passwort Zugang habe
- Als Owner möchte ich mich mit E-Mail + Passwort einloggen, als Alternative zu Google
- Als Owner möchte ich mein Passwort zurücksetzen können, wenn ich es vergesse
- Als Owner möchte ich automatisch zu `/login` weitergeleitet werden, wenn ich die App ohne aktive Session aufrufe
- Als Owner möchte ich mich über die Sidebar abmelden können, damit meine Session sauber beendet wird

## Out of Scope
- Öffentliche Registrierung — Signups in Supabase deaktiviert, kein `/register`
- Mehrere Nutzer / Nutzerverwaltung
- „Angemeldet bleiben"-Checkbox (Auto-Session reicht)
- 2FA / MFA
- Account-Einstellungen (E-Mail oder Passwort in der App ändern) — ggf. später via Supabase-Dashboard

## Acceptance Criteria

**Login-Flow:**
- [ ] Angenommen der Nutzer ist nicht eingeloggt, wenn er eine geschützte Route aufruft, dann wird er zu `/login` weitergeleitet
- [ ] Angenommen der Nutzer gibt korrekte Anmeldedaten ein, wenn er auf „Anmelden" klickt, dann landet er auf `/` (Alle Prompts)
- [ ] Angenommen der Nutzer klickt auf „Mit Google anmelden", wenn die Google-Authentifizierung erfolgreich ist, dann landet er auf `/`
- [ ] Angenommen der Nutzer gibt falsche Anmeldedaten ein, wenn er auf „Anmelden" klickt, dann erscheint eine generische Fehlermeldung ohne Hinweis ob E-Mail oder Passwort falsch ist

**Allowlist:**
- [ ] Angenommen ein Google-Account versucht sich einzuloggen, wenn die E-Mail-Adresse nicht auf der Allowlist steht, dann wird der Login blockiert und eine Meldung „Diese App ist nicht öffentlich zugänglich" angezeigt
- [ ] Angenommen ein E-Mail/Passwort-Login-Versuch mit einer nicht-gelisteten E-Mail erfolgt, dann wird er ebenfalls blockiert

**Passwort-Reset:**
- [ ] Angenommen der Nutzer klickt auf „Passwort vergessen?", wenn er seine E-Mail eingibt und abschickt, dann erhält er eine Reset-E-Mail von Supabase
- [ ] Angenommen der Nutzer folgt dem Reset-Link, wenn er ein neues Passwort gesetzt hat, dann wird er zu `/login` weitergeleitet
- [ ] Angenommen der Reset-Link ist abgelaufen, wenn der Nutzer ihn aufruft, dann sieht er eine Fehlermeldung mit Option einen neuen Link anzufordern

**Session & Logout:**
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er die App nach mehreren Tagen erneut öffnet (max. 7 Tage Inaktivität), dann ist er noch eingeloggt (Auto-Refresh)
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er in der Sidebar auf „Abmelden" klickt, dann wird die Session beendet und er landet auf `/login`

## Edge Cases
- **Google-OAuth-Abbruch:** Nutzer klickt „Abbrechen" im Google-Dialog → bleibt auf `/login`, kein Fehler
- **Netzwerkfehler beim Login:** Toast „Verbindungsfehler — bitte erneut versuchen", Formular bleibt ausgefüllt
- **Direktzugriff auf Supabase-API ohne Session:** RLS blockiert alle DB-Operationen als zweite Sicherheitsebene hinter der Allowlist
- **Reset-Link abgelaufen:** Fehlermeldung + Button „Neuen Link anfordern"

## Decision Log

### Product Decisions
| Entscheidung | Begründung | Datum |
|---|---|---|
| Keine öffentliche Registrierung | App ist rein persönlich, kein Multi-User-Produkt | 2026-06-11 |
| Google OAuth + E-Mail/Passwort | Komfort (Google) + Fallback (Passwort) | 2026-06-11 |
| Allowlist per E-Mail | Verhindert aktiv unbekannte Logins, sicherer als nur RLS | 2026-06-11 |
| Kein „Angemeldet bleiben"-Checkbox | Supabase 7-Tage Auto-Refresh reicht für persönliches Tool | 2026-06-11 |
| Logout in Sidebar unten | Immer sichtbar, nicht aufdringlich | 2026-06-11 |
| Keine Landing Page | Persönliches Tool braucht kein Marketing | 2026-06-11 |

### Technical Decisions
<!-- Added by /architecture -->

---

## Tech Design
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
