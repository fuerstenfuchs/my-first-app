-- PROJ-41: Lebenszeichen des Arbeiters.
--
-- Damit die Warteschlange sagen kann, ob überhaupt jemand die Aufträge abholt.
-- Ohne diese Auskunft sieht ein wartender Auftrag genau gleich aus, egal ob der
-- Arbeiter ihn gleich abholt oder seit gestern aus ist — Stille sieht aus wie
-- Geduld, und genau das hat in diesem Projekt schon zweimal Zeit gekostet.

create table if not exists public.worker_heartbeat (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  gesehen_am timestamptz not null default now(),
  version    text
);

alter table public.worker_heartbeat enable row level security;

drop policy if exists "own heartbeat" on public.worker_heartbeat;
create policy "own heartbeat" on public.worker_heartbeat
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Die Uhr des PCs weicht von der Datenbankuhr ab — am 01.09.2026 um 34 Sekunden
-- gemessen, das ergab in der ersten Fassung „zuletzt gesehen vor -34 Sekunden".
-- Deshalb rechnet die Datenbank die Zeitspanne aus, und der Arbeiter schickt gar
-- keinen Zeitstempel mehr mit: Die Spalte hat default now().
create or replace view public.worker_status
with (security_invoker = true) as
select
  user_id,
  gesehen_am,
  version,
  greatest(0, round(extract(epoch from (now() - gesehen_am))))::int as sekunden_her
from public.worker_heartbeat;

grant select on public.worker_status to authenticated;
