-- PROJ-42c: Zwei Luecken schliessen, die Critic am 02.09.2026 gefunden hat.

-- 1) `image_jobs_upscale_ziel` traegt sich nicht selbst.
--
-- Bei `upscaler is null` ergeben BEIDE Vergleiche NULL, und `false or null or
-- null` ist NULL — eine CHECK-Schranke gilt bei NULL als erfuellt. Sie liesse
-- also einen Vergroesserungsauftrag ohne Verfahren und ohne jedes Ziel durch.
--
-- Geschlossen wird das heute von `image_jobs_upscale_braucht_verfahren`. Aber
-- wer nur diese Schranke liest, haelt sie fuer selbsttragend — und die
-- Nachbarschranke wurde in diesem Projekt schon zweimal ersetzt. Deshalb steht
-- die Bedingung jetzt ausdruecklich hier drin, statt sich auf eine andere Zeile
-- zu verlassen.
alter table public.image_jobs drop constraint if exists image_jobs_upscale_ziel;
alter table public.image_jobs add constraint image_jobs_upscale_ziel
  check (
    job_type <> 'upscale'
    or (upscaler is not null and (
         (upscaler =  'gemini' and ziel_klasse is not null and scale is null)
      or (upscaler <> 'gemini' and scale       is not null and ziel_klasse is null)
    ))
  );

-- 2) Das Gegenstueck zu image_jobs_external_ref_nur_upscale hat gefehlt.
--
-- Ein Erzeugungsauftrag durfte bisher eine Groessenklasse tragen. Folgenlos,
-- aber genau die Art Angabe, die beim Lesen in die Irre fuehrt — und die
-- dieselbe Datei bei `upscaler` ausdruecklich verbieten wollte.
alter table public.image_jobs drop constraint if exists image_jobs_ziel_klasse_nur_upscale;
alter table public.image_jobs add constraint image_jobs_ziel_klasse_nur_upscale
  check (ziel_klasse is null or job_type = 'upscale');

-- ACHTUNG BEIM NEUAUFSETZEN: Die Schranke image_jobs_ziel_klasse_nur_upscale
-- aus Punkt 2 wurde spaeter durch proj-43b/43c ERSETZT, weil Gemini seit dem
-- 02.09.2026 auch erzeugen darf und dabei eine Groessenklasse braucht. Wer nur
-- bis hierher einspielt, kann keine Gemini-Bilder erzeugen — die Schranke
-- lehnt sie ab. Immer bis 43c durchziehen.
