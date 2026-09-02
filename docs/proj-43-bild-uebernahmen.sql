-- PROJ-43: Merken, welches Ergebnisbild schon in einen Baustein uebernommen wurde.
--
-- WARUM DAS NICHT ABLEITBAR IST: Beim Uebernehmen wird das Bild KOPIERT (siehe
-- use-bild-uebernehmen.ts). Die Kopie im Baustein hat einen eigenen Pfad in
-- einem eigenen Eimer und keinerlei Verweis auf das Ergebnisbild. Ohne diese
-- Tabelle liesse sich die Frage „was habe ich schon abgelegt?" nur beantworten,
-- indem man Bilder vergleicht.
--
-- Sie ist bewusst eine reine NOTIZ: Wird eine Zeile hier geloescht, geht kein
-- Bild verloren — es steht dann nur wieder als „noch nicht abgelegt" da.

create table if not exists public.bild_uebernahmen (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- Der Pfad des ERGEBNISBILDES in generated-images. Nicht die Adresse:
  -- Die traegt einen Cache-Brecher und wechselt damit die Zeichenkette.
  quell_pfad   text not null,
  ziel_art     text not null,
  ziel_id      uuid not null,
  ziel_name    text not null,
  created_at   timestamptz not null default now(),
  -- Zweimal dasselbe Bild in denselben Eintrag ist kein Fehler, aber auch
  -- keine zweite Notiz wert.
  unique (user_id, quell_pfad, ziel_art, ziel_id)
);

create index if not exists bild_uebernahmen_quelle_idx
  on public.bild_uebernahmen (user_id, quell_pfad);

alter table public.bild_uebernahmen enable row level security;

-- Dieselbe Regel wie ueberall im Projekt: jeder sieht und schreibt nur das
-- Eigene. `with check` steht ausdruecklich dabei — ohne ihn koennte man Zeilen
-- mit fremder user_id einfuegen, weil `using` beim INSERT nicht greift.
drop policy if exists "Users manage own bild_uebernahmen" on public.bild_uebernahmen;
create policy "Users manage own bild_uebernahmen"
  on public.bild_uebernahmen
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.bild_uebernahmen is
  'Notiz, welches Ergebnisbild bereits in einen Baustein uebernommen wurde. Reine Anzeige-Hilfe fuer den Lichttisch — Loeschen verliert kein Bild.';
