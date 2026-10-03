-- ── PROJ-94: 5K lokal hochrechnen (SeedVR2 7B Sharp auf dem neuen PC) ───────────────────────────────────────────
--
-- Zwei neue Verfahren für Vergrößerungsaufträge:
--   lokal_5k       eine Stufe mit SeedVR2 7B Sharp auf 5K (Vorgabe, Mark 03.10.2026)
--   lokal_5k_zwei  erst normal 2×, dann Sharp auf 5K
--
-- 5K heißt: lange Seite 5120 Pixel, höchstens 18 Megapixel. Das Ziel steht damit fest — weder `scale` noch `ziel_klasse` werden gefüllt,
-- und die Datenbank setzt das durch (sonst stünde bei einem 5K-Auftrag ein Faktor, der nicht stimmt).
-- Lokal heißt: kostet nur Strom, läuft über den Arbeiter auf dem alten PC, der den neuen PC im Heimnetz ruft.

alter table public.image_jobs drop constraint if exists image_jobs_upscaler_check;
alter table public.image_jobs add constraint image_jobs_upscaler_check
  check (upscaler is null or upscaler in ('lanczos', 'seedvr2', 'crystal', 'gemini', 'lokal_5k', 'lokal_5k_zwei'));

alter table public.image_jobs drop constraint if exists image_jobs_upscale_ziel;
alter table public.image_jobs add constraint image_jobs_upscale_ziel
  check (
    job_type <> 'upscale'
    or (
      upscaler is not null
      and (
        (upscaler = 'gemini' and ziel_klasse is not null and scale is null)
        or (upscaler in ('lokal_5k', 'lokal_5k_zwei') and scale is null and ziel_klasse is null)
        or (upscaler not in ('gemini', 'lokal_5k', 'lokal_5k_zwei') and scale is not null and ziel_klasse is null)
      )
    )
  );
