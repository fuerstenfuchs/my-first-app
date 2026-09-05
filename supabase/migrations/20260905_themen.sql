-- PROJ-63: Themen für die Prompt-Datenbank
--
-- WARUM: Von 80 Prompts hatten 51 kein Schlagwort, 3 waren Favorit, einer war
-- bewertet, 30 lagen in einer Sammlung. Es gab kein Feld mit wenigen festen
-- Werten, nach dem man ordnen konnte — `tool` und `category` standen nur im
-- Plan und wurden nie gebaut. Die Ordnung, die Mark nicht pflegt, macht
-- deshalb einmalig eine Text-KI; danach pflegt er sie, wie er will.

create table if not exists public.themen (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  beschreibung        text,

  -- DIE VIER BILDER DER KARTE STEHEN FEST. Mark am 05.09.2026: „Wenn die immer
  -- gleich blieben, also nicht dass auch die Neuesten immer dann angezeigt
  -- werden, sondern wirklich feste, die für diese Rubrik auch wirklich stehen."
  -- Ein Titelbild, das sich ändert, ist kein Titelbild — man müsste die Karte
  -- jedes Mal neu lesen. Neue Prompts wandern ins Thema, nicht auf die Karte.
  titelbild_prompt_id uuid references public.prompts(id) on delete set null,
  beleg_prompt_ids    uuid[] not null default '{}',

  sortierung          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- EIN Thema je Prompt, nicht viele. Mark ordnet einmal von Hand nach; eine
-- Mehrfachzuordnung wäre eine zweite Pflegeaufgabe, und genau daran ist die
-- bisherige Ordnung gescheitert.
alter table public.prompts
  add column if not exists thema_id uuid references public.themen(id) on delete set null;

create index if not exists prompts_thema_idx on public.prompts(thema_id);
create index if not exists themen_user_idx  on public.themen(user_id, sortierung);

alter table public.themen enable row level security;

drop policy if exists themen_select_own on public.themen;
drop policy if exists themen_insert_own on public.themen;
drop policy if exists themen_update_own on public.themen;
drop policy if exists themen_delete_own on public.themen;

create policy themen_select_own on public.themen for select using (auth.uid() = user_id);
create policy themen_insert_own on public.themen for insert with check (auth.uid() = user_id);
create policy themen_update_own on public.themen for update using (auth.uid() = user_id);
create policy themen_delete_own on public.themen for delete using (auth.uid() = user_id);
