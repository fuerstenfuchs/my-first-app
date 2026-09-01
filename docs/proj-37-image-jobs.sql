-- PROJ-37: Bildgenerierung — Auftragstabelle
-- Auszuführen im Supabase SQL-Editor.
--
-- Abweichung vom Briefing (Abschnitt 4), bewusst und begründet:
-- Das Briefing sieht `reference_paths text[]` mit Storage-Pfaden vor. Der Scene
-- Builder führt aber nur öffentliche URLs mit (`type RefImage = { url, label }`
-- in src/app/(app)/scene-builder/page.tsx). Pfade wären nur über einen Umbau der
-- Referenzauswahl zu bekommen. Da alle zwölf Bild-Buckets öffentlich lesbar sind
-- (getPublicUrl in allen Hooks), lädt der Arbeiter direkt per HTTPS.
-- Die Spalte heißt deshalb ehrlich `reference_urls`.
--
-- Zweite Ergänzung: `aspect_ratio` neben `size`. gpt-image-2 kennt nur drei feste
-- Größen, Trésor bietet fünf Formate. `size` ist die tatsächlich angeforderte
-- Größe, `aspect_ratio` das ursprünglich gewünschte Verhältnis — damit ein
-- späteres Beschneiden (Briefing 6.3) ohne Datenmigration nachrüstbar ist.

create table if not exists public.image_jobs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,

  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz,

  status            text not null default 'queued',
  attempts          int  not null default 0,
  error             text,

  -- Auftrag
  prompt            text not null,
  model             text not null default 'gpt-image-2',
  size              text not null default '1024x1024',
  aspect_ratio      text,
  input_fidelity    text default 'high',
  variants          int  not null default 1,

  -- Eingang
  reference_urls    text[] not null default '{}',
  anchor_job_id     uuid references public.image_jobs(id) on delete set null,

  -- Herkunft, fürs Archiv
  character_id      uuid,
  preset_id         uuid,
  scene_meta        jsonb,

  -- Ergebnis
  result_paths      text[] not null default '{}',

  constraint image_jobs_status_check
    check (status in ('queued', 'running', 'done', 'failed')),
  constraint image_jobs_variants_check
    check (variants between 1 and 4)
);

-- Index für die Abfrage des Arbeiters: nur wartende Aufträge, älteste zuerst.
create index if not exists image_jobs_pending_idx
  on public.image_jobs (created_at)
  where status = 'queued';

-- Index für die Seite /queue: eigene Aufträge, neueste zuerst.
create index if not exists image_jobs_user_recent_idx
  on public.image_jobs (user_id, created_at desc);

alter table public.image_jobs enable row level security;

drop policy if exists "own jobs" on public.image_jobs;
create policy "own jobs" on public.image_jobs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Auftrag atomar übernehmen.
--
-- Als Funktion statt als rohes SQL im Arbeiter: Über die REST-Schnittstelle von
-- Supabase lässt sich `for update skip locked` nicht ausdrücken. Ohne diese
-- Sperre würden zwei versehentlich gleichzeitig laufende Arbeiter denselben
-- Auftrag doppelt abarbeiten — und jedes Bild kostet Geld.
--
-- security definer, damit die Funktion die Zeile sperren darf; der Arbeiter
-- ruft sie ohnehin mit dem Service-Key auf.
-- ---------------------------------------------------------------------------
create or replace function public.claim_next_image_job(max_attempts int default 3)
returns setof public.image_jobs
language sql
security definer
set search_path = public
as $$
  update public.image_jobs
  set    status     = 'running',
         started_at = now(),
         attempts   = attempts + 1
  where  id = (
    select id
    from   public.image_jobs
    where  status = 'queued'
      and  attempts < max_attempts
    order  by created_at
    limit  1
    for update skip locked
  )
  returning *;
$$;

-- ---------------------------------------------------------------------------
-- Hängengebliebene Aufträge einsammeln (Arbeiter abgestürzt, Briefing 5).
-- Läuft im Arbeiter vor jedem Durchgang.
-- ---------------------------------------------------------------------------
-- Die Vorgabe MUSS über der längstmöglichen Laufzeit liegen: 4 Durchläufe
-- (Schranke oben) mal 5 Minuten Zeitgrenze je Bild sind 20 Minuten. Ein zu
-- kleiner Wert reiht einen noch laufenden Auftrag neu ein — bei zwei Arbeitern
-- wird er dann ein zweites Mal erzeugt, und jedes Bild kostet Geld.
create or replace function public.requeue_stale_image_jobs(stale_minutes int default 30)
returns int
language sql
security definer
set search_path = public
as $$
  with wiedereingereiht as (
    update public.image_jobs
    set    status = case when attempts >= 3 then 'failed' else 'queued' end,
           error  = coalesce(error, 'Arbeiter hat den Auftrag nicht abgeschlossen'),
           -- ohne finished_at zeigt /queue bei genau diesen Auftraegen keine Dauer
           finished_at = case when attempts >= 3 then now() else null end
    where  status = 'running'
      and  started_at < now() - make_interval(mins => stale_minutes)
    returning 1
  )
  select coalesce(count(*), 0)::int from wiedereingereiht;
$$;

-- ---------------------------------------------------------------------------
-- Storage-Ablage für die Ergebnisse.
-- Öffentlich lesbar wie die bestehenden zwölf Buckets; Schreibrecht nur im
-- eigenen Ordner. Pfadmuster: {user_id}/{job_id}/{index}.png
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('generated-images', 'generated-images', true)
on conflict (id) do nothing;

drop policy if exists "generated read" on storage.objects;
create policy "generated read" on storage.objects
  for select using (bucket_id = 'generated-images');

drop policy if exists "generated write own" on storage.objects;
create policy "generated write own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "generated delete own" on storage.objects;
create policy "generated delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Ausführungsrechte einschränken.
--
-- WICHTIG, nicht weglassen: Beide Funktionen sind `security definer` und
-- umgehen damit RLS. Postgres vergibt EXECUTE auf neue Funktionen an PUBLIC,
-- und Supabase reicht anon/authenticated an das public-Schema durch. Der
-- anon-Schlüssel steht in jedem ausgelieferten Browser-Bündel.
--
-- Am 01.09.2026 nachgemessen: Ohne diese Zeilen lieferte ein Aufruf von
-- claim_next_image_job mit dem anon-Schlüssel HTTP 200 — also die vollständige
-- Zeile eines fremden Nutzers, samt Sabotagemöglichkeit über attempts und
-- requeue_stale_image_jobs mit stale_minutes = 0. Nach dem Entzug: HTTP 401.
--
-- Nur der Arbeiter braucht sie, und der läuft mit dem Service-Key.
-- ---------------------------------------------------------------------------
revoke execute on function public.claim_next_image_job(int)     from public, anon, authenticated;
revoke execute on function public.requeue_stale_image_jobs(int) from public, anon, authenticated;
grant  execute on function public.claim_next_image_job(int)     to service_role;
grant  execute on function public.requeue_stale_image_jobs(int) to service_role;
