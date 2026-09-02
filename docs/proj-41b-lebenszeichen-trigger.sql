-- PROJ-41b: Das Lebenszeichen des Arbeiters war seit dem Bau eingefroren.
--
-- GEMESSEN am 02.09.2026: Die Warteschlange zeigte „Arbeiter zuletzt vor 18
-- Stunden", waehrend derselbe Arbeiter gerade Auftraege abarbeitete.
--
-- Der Grund: `gesehen_am` hat `default now()`, und der Arbeiter schickt die
-- Spalte bewusst NICHT mit (die PC-Uhr geht 34 Sekunden vor, ein Zeitstempel
-- von dort waere in der Zukunft gelandet). Ein DEFAULT gilt aber nur beim
-- EINFUEGEN. Die Upsert-Anfrage laeuft auf `on conflict do update set version
-- = ...` hinaus — `gesehen_am` steht nicht im Rumpf, wird also nie angefasst.
--
-- Die Zeile wurde am 01.09.2026 um 20:34 angelegt und trug diesen Zeitstempel
-- seitdem unveraendert. Nachgewiesen: Nach einem Aufruf war `version` neu und
-- `gesehen_am` unveraendert.
--
-- WARUM DAS SCHLIMM IST: Der Ausfall zeigt in die Richtung „Arbeiter ist weg" —
-- also genau die Anzeige, die es abschaffen sollte, dass Stille wie Geduld
-- aussieht. Wer ihr geglaubt haette, haette den Arbeiter neu gestartet und den
-- Fehler woanders gesucht.
--
-- Die Loesung gehoert in die Datenbank und nicht in den Arbeiter: Dort steht
-- die richtige Uhr, und sie gilt fuer jeden Schreibweg — auch fuer einen
-- kuenftigen zweiten Arbeiter oder eine Reparatur von Hand.

create or replace function public.worker_heartbeat_stempeln()
returns trigger
language plpgsql
as $$
begin
  new.gesehen_am := now();
  return new;
end;
$$;

drop trigger if exists worker_heartbeat_stempeln on public.worker_heartbeat;
create trigger worker_heartbeat_stempeln
  before insert or update on public.worker_heartbeat
  for each row execute function public.worker_heartbeat_stempeln();

comment on function public.worker_heartbeat_stempeln() is
  'Setzt gesehen_am bei jedem Schreiben auf die Serverzeit. Ohne diesen Trigger bleibt der Zeitstempel beim Upsert stehen, weil default now() nur beim Einfuegen gilt.';
