# Product Requirements Document

## Vision
PromptDB ist eine persönliche KI-Prompt-Management-Plattform für KI-Power-User. Sie löst das Problem, dass wertvolle Prompts über Notizen, Chats und Dokumente verstreut sind und nicht wiederverwendet werden können. Mit PromptDB speichert, organisiert und verkettet der Nutzer seine Prompts für alle KI-Tools an einem Ort — mit vollem Zugriff von jedem Gerät.

## Target Users

**Primärer Nutzer: KI-Power-User (Solo)**
- Arbeitet täglich mit mehreren KI-Tools (Claude, ChatGPT, Suno, ComfyUI, MidJourney, Runway, CapCut)
- Hat Dutzende bis Hunderte wertvolle Prompts, die er wiederverwenden will
- Erstellt komplexe KI-Workflows (z.B. Musikvideo: Lyrics → Musik → Video → Schnitt)
- Braucht schnellen Zugriff von Desktop und Mobilgerät
- Nutzt Template-Variablen um Prompts für verschiedene Projekte anzupassen

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | Authentifizierung (Login / Registrierung) | Spec fertig ✓ |
| P0 (MVP) | Prompt-Verwaltung (CRUD) | Spec fertig ✓ |
| P0 (MVP) | Suche & Filter | Planned |
| P1 | Sammlungen & Workflows | Planned |
| P1 | Statistik-Dashboard | Planned |
| P2 | Import / Export | Planned |

## Success Metrics
- Nutzer hat alle seine Prompts in PromptDB migriert (>20 Prompts)
- Durchschnittliche Nutzung: min. 1× täglich
- Kopiervorgänge (usage_count) steigen über Zeit → Prompts werden aktiv wiederverwendet
- Kein Prompt geht verloren (Versionsverlauf, Export-Backup)

## Constraints
- Solo-Entwickler, schrittweise Umsetzung
- Supabase Free Tier (500 MB Datenbank, 50.000 MAU)
- Kein separates Backend nötig — Next.js API Routes + Supabase reichen

## Non-Goals (MVP)
- Kein Sharing/Collaboration mit anderen Nutzern
- Kein öffentlicher Prompt-Marktplatz
- Keine KI-Integration direkt in der App (kein „Prompt ausführen"-Button)
- Keine Ordner-Hierarchie (nur flache Kategorien + Tags)
- Keine mobile App (responsives Web reicht)
