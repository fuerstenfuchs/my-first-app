# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**PromptDB** — Persönliche KI-Prompt-Management-Plattform. Nutzer können Prompts für verschiedene KI-Tools (Claude, Suno, ComfyUI, MidJourney, Runway u.a.) speichern, organisieren, suchen und in Workflows verketten. Jeder Nutzer sieht nur seine eigenen Daten (Supabase RLS). Eine vollständige Referenzimplementierung als Einzeldatei liegt unter `docs/prompt-db-standalone-backup.html`.

## Befehle

```bash
npm run dev          # Entwicklungsserver auf localhost:3000
npm run build        # Produktions-Build
npm run lint         # ESLint
npm test             # Vitest (einmalig)
npm run test:watch   # Vitest im Watch-Modus
npm run test:e2e     # Playwright E2E (startet dev-Server automatisch)
npm run test:e2e:ui  # Playwright mit UI
npm run test:all     # Vitest + Playwright
```

Einzelnen Test ausführen:
```bash
npx vitest run src/path/to/file.test.ts
npx playwright test tests/feature.spec.ts
```

## Architektur

### Tech Stack
- Next.js 16 App Router, TypeScript, strict mode
- Tailwind CSS + shadcn/ui (Radix UI primitives, in `src/components/ui/`)
- Supabase: PostgreSQL + Auth + Storage
- Formulare: react-hook-form + Zod
- Toasts: `sonner` (nicht Radix Toast)
- Command Palette: `cmdk`
- Theming: `next-themes`
- Tests: Vitest (jsdom) für Unit/Integration, Playwright für E2E (Desktop Chrome + iPhone 13)

### Pfad-Alias
`@/*` → `./src/*` (in tsconfig und vitest.config.ts konfiguriert)

### Supabase-Setup
`src/lib/supabase.ts` enthält den Client — aktuell auskommentiert. Aktivieren sobald `.env.local` mit `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` befüllt ist (siehe `.env.local.example`). Der MCP-Server in `.mcp.json` erlaubt direkten Datenbankzugriff via Claude Code.

### Datenmodell (geplant)
```
prompts            — title, description, content, tool, category, tags[], rating,
                     favorite, preview_image, notes, color_label, variables[],
                     usage_count, version, history[], user_id
collections        — name, description, user_id
collection_prompts — collection_id, prompt_id, sort_order
```
Alle Tabellen brauchen Row Level Security: `user_id = auth.uid()`.

## Entwicklungs-Workflow (Skills)

1. `/init` — PRD + Feature-Map (einmalig)
2. `/write-spec` — Feature-Spezifikation (PROJ-X)
3. `/architecture` — Tech-Design ohne Code
4. `/frontend` — UI mit shadcn/ui
5. `/backend` — Supabase-Schema, API Routes, RLS
6. `/qa` — Tests + Security-Audit
7. `/deploy` — Vercel-Deployment

Feature-IDs: `PROJ-1`, `PROJ-2`, … — Status in `features/INDEX.md` tracken.
Commits: `feat(PROJ-X): beschreibung`

## Konventionen

- **shadcn/ui first:** Keine eigenen Versionen von installierten shadcn-Komponenten bauen. Neue Komponenten mit `npx shadcn@latest add <name>` hinzufügen.
- **Tests:** Unit-Tests co-located neben der Quelldatei (`useHook.test.ts` neben `useHook.ts`). E2E-Tests in `tests/`.
- **Status-Updates:** Nach jedem abgeschlossenen Feature `features/INDEX.md` und das Feature-Spec aktualisieren — immer mit Edit-Tool, nie nur beschreiben.
- **Vor jeder Änderung:** `features/INDEX.md` lesen um den aktuellen Stand zu kennen.

## Permissions

`Read(**/.env*)` und `Edit(**/.env*)` sind gesperrt — `.env.local.example` als Referenz nutzen.
`git push --force` ist gesperrt.

## Produkt-Kontext

@docs/PRD.md

## Feature-Übersicht

@features/INDEX.md
