-- PROJ-92: Eigene Körperform-Presets
--
-- Mark am 29.09.2026: „Ich nenne ein Preset Model und setze dann die
-- verschiedenen Körperkriterien und kann das abspeichern. Und wenn ich
-- draufklicke, ist alles schon so wie im Preset vorgespeichert."
--
-- Ein Preset = Name + Auswahl der zwölf Körperregionen (jsonb, Schlüssel und
-- Stufen wie in `KoerperAuswahl`) + optional ein Blender-Körperbild als
-- Referenz. Geprüft wird beim Lesen (`bereinigeMerkmale`), nicht in der
-- Datenbank: Kommt eine Stufe dazu oder fällt eine weg, soll das keine
-- Migration verlangen.

create table if not exists public.koerper_presets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  merkmale     jsonb not null default '{}'::jsonb,
  koerper_bild text,
  sortierung   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists koerper_presets_user_idx
  on public.koerper_presets(user_id, sortierung, created_at);

alter table public.koerper_presets enable row level security;

drop policy if exists koerper_presets_select_own on public.koerper_presets;
drop policy if exists koerper_presets_insert_own on public.koerper_presets;
drop policy if exists koerper_presets_update_own on public.koerper_presets;
drop policy if exists koerper_presets_delete_own on public.koerper_presets;

create policy koerper_presets_select_own on public.koerper_presets for select using (auth.uid() = user_id);
create policy koerper_presets_insert_own on public.koerper_presets for insert with check (auth.uid() = user_id);
create policy koerper_presets_update_own on public.koerper_presets for update using (auth.uid() = user_id);
create policy koerper_presets_delete_own on public.koerper_presets for delete using (auth.uid() = user_id);
