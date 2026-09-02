-- PROJ-42: Vergrößern wahlweise rechnerisch oder mit KI-Detailrekonstruktion.
--
-- Bis hierher gab es genau ein Verfahren (Lanczos, im Arbeiter gerechnet). Ein
-- zweites kommt daneben: SeedVR2 von ByteDance über fal.ai. Der Unterschied ist
-- nicht graduell — Lanczos verteilt vorhandene Bildpunkte, SeedVR2 erfindet
-- Struktur dazu (Haut, Haar, Stoff). Und es kostet Geld, wenn auch wenig.
--
-- Deshalb steht das Verfahren in der Zeile und nicht in der Konfiguration des
-- Arbeiters: Am fertigen Auftrag muss ablesbar sein, wie er entstanden ist und
-- ob er etwas gekostet hat.

alter table public.image_jobs
  add column if not exists upscaler text;

-- Bestandsaufträge sind alle rechnerisch entstanden — das ist keine Annahme,
-- sondern die einzige Möglichkeit, die es bis heute gab.
update public.image_jobs
   set upscaler = 'lanczos'
 where job_type = 'upscale' and upscaler is null;

alter table public.image_jobs drop constraint if exists image_jobs_upscaler_check;
alter table public.image_jobs add constraint image_jobs_upscaler_check
  check (upscaler is null or upscaler in ('lanczos', 'seedvr2'));

-- Ein Vergrößerungsauftrag ohne Verfahren wäre eine offene Frage an den
-- Arbeiter. Der soll nicht raten müssen, was er kostenpflichtig tun darf.
alter table public.image_jobs drop constraint if exists image_jobs_upscale_braucht_verfahren;
alter table public.image_jobs add constraint image_jobs_upscale_braucht_verfahren
  check (job_type <> 'upscale' or upscaler is not null);

-- Umgekehrt: Ein Erzeugungsauftrag hat kein Vergrößerungsverfahren. Ohne diese
-- Schranke könnte eine spätere Änderung 'seedvr2' in eine Erzeugungszeile
-- schreiben, wo es folgenlos danebenstünde und beim Lesen in die Irre führt.
alter table public.image_jobs drop constraint if exists image_jobs_generate_ohne_verfahren;
alter table public.image_jobs add constraint image_jobs_generate_ohne_verfahren
  check (job_type <> 'generate' or upscaler is null);

comment on column public.image_jobs.upscaler is
  'lanczos = rechnerisch auf dem PC, kostenlos; seedvr2 = KI-Detailrekonstruktion über fal.ai, kostenpflichtig';

-- ── Nachtrag: Wiederaufnahme statt Wiederholung ────────────────────────────
--
-- Bis hierher war jeder Fehler NACH dem Absenden ein zweites Mal bezahlt: Der
-- Auftrag ging auf 'queued' zurück und der nächste Durchgang schickte einen
-- neuen, kostenpflichtigen Auftrag an fal — obwohl drüben längst gerechnet und
-- abgerechnet wurde. Wege dorthin gab es reichlich: Zeitablauf, misslungenes
-- Hochladen, eine einzelne 5xx-Antwort beim Nachfragen, ein Neustart durch
-- `node --watch`, zweimal Strg+C.
--
-- Das Gegenstück zu `result_paths` beim Erzeugen: Was bezahlt ist, wird sofort
-- festgehalten. Hier ist das Bezahlte kein Bild, sondern die Auftragsnummer bei
-- fal — mit ihr lässt sich dasselbe Ergebnis noch einmal abholen.
alter table public.image_jobs
  add column if not exists external_ref jsonb;

-- Nur Vergrößerungen haben eine Gegenstelle. Stünde das an einem
-- Erzeugungsauftrag, wäre es eine Angabe ohne Bedeutung, die beim Lesen in die
-- Irre führt.
alter table public.image_jobs drop constraint if exists image_jobs_external_ref_nur_upscale;
alter table public.image_jobs add constraint image_jobs_external_ref_nur_upscale
  check (external_ref is null or job_type = 'upscale');

comment on column public.image_jobs.external_ref is
  'Auftragsnummer und Abholadressen bei fal.ai. Damit ein Neuversuch das bereits bezahlte Ergebnis abholt, statt einen zweiten kostenpflichtigen Lauf zu starten.';

-- ── Nachtrag: zweites KI-Verfahren (Crystal Upscaler von Clarity AI) ───────
--
-- Mark kennt beide aus der Praxis und will die Wahl. Sie arbeiten
-- unterschiedlich: SeedVR2 rekonstruiert zurueckhaltend und bleibt nah am
-- Original, Crystal geht freier zu Werke. Welches besser ist, haengt vom Bild
-- ab — deshalb beide, statt eines auszuwaehlen.
alter table public.image_jobs drop constraint if exists image_jobs_upscaler_check;
alter table public.image_jobs add constraint image_jobs_upscaler_check
  check (upscaler is null or upscaler in ('lanczos', 'seedvr2', 'crystal'));

comment on column public.image_jobs.upscaler is
  'lanczos = rechnerisch auf dem PC, kostenlos; seedvr2 und crystal = KI-Detailrekonstruktion über fal.ai, kostenpflichtig';
