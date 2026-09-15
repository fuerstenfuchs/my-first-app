-- Datei-Verweise zählen, bevor eine Speicherdatei gelöscht wird
--
-- EINGESPIELT AM 15.09.2026 mit Marks Freigabe („Ja, beide Schritte
-- ausführen, direkt auf main."), als Supabase-Migration `datei_verweise`.
-- Vorher in einer Transaktion mit Rollback gegen die echte Datenbank geprüft,
-- als Marks Nutzer mit der Rolle `authenticated`: alle Prüfungen grün (T1–T9),
-- danach nachweislich nichts geblieben. Eingespielt wurde genau diese Fassung
-- (ohne die Begründungskommentare außerhalb der Funktionsrümpfe).
--
-- WARUM: Byte-gleiche Bilder sollen später zu EINER Datei zusammengelegt
-- werden — mehrere Zeilen, auch aus verschiedenen Bausteinen und Eimern,
-- zeigen dann auf dieselbe Datei. Bis heute löscht jede Löschstelle ihre Datei
-- ohne Nachfrage. Nach dem Zusammenlegen verschwände ein Bild damit still für
-- alle ANDEREN Zeilen: ein kaputtes Kästchen, das vielleicht erst Wochen später
-- jemand bemerkt. Diese Funktion beantwortet vor dem Löschen die eine Frage:
-- Zeigt noch irgendetwas auf diese Datei?
--
-- WICHTIG: Die App ruft diese Funktion auf, sobald der neue Code ausgeliefert
-- ist. Fehlt sie in der Datenbank, schlägt die Zählung fehl — und dann wird
-- NICHTS gelöscht (siehe src/lib/datei-freigeben.ts). Das ist gewollt: Ohne
-- Funktion bleiben Dateien liegen, statt dass Bilder kaputtgehen. Erst diese
-- Migration anwenden, dann ausliefern — sonst sammeln sich verwaiste Dateien.

-- ---------------------------------------------------------------------------
-- 1. Prozent-Kodierung auflösen.
--
-- WARUM IN SQL: Eine Adresse von `getPublicUrl` ist kodiert (`%20`), eine vom
-- Nutzer eingefügte vielleicht mit kleinen Hex-Ziffern (`%c3%a4`),
-- `storage_path` steht im Klartext. Verglichen wird deshalb immer die
-- DEKODIERTE Form. Die Alternative — nach mehreren Schreibweisen fragen —
-- fände `%c3%a4` nie, weil `encodeURI` nur Großbuchstaben erzeugt.
--
-- DIE REGEL, Zeichen für Zeichen, identisch zu `prozentDekodiert` in
-- src/lib/datei-freigeben.ts:
--   · `%` gefolgt von genau zwei Hex-Ziffern (groß oder klein) wird ein Byte;
--   · jedes andere Zeichen bleibt, wie es ist (auch ein einzelnes `%`);
--   · ergeben die Bytes kein gültiges UTF-8, bleibt die GANZE Eingabe roh.
-- `+` wird nicht zu Leerzeichen — das tut `decodeURIComponent` auch nicht.
--
-- Zwei Funktionen, weil ein plpgsql-Block mit EXCEPTION bei jedem Aufruf eine
-- Untertransaktion öffnet. Die äußere prüft vorher, ob überhaupt ein `%` da
-- ist — bei fast allen Zeilen nicht.
-- ---------------------------------------------------------------------------
-- LINEAR, NICHT ZEICHEN FÜR ZEICHEN (15.09.2026, Critic S2).
--
-- Die erste Fassung hängte in einer Schleife jedes Zeichen an einen
-- wachsenden bytea — jede Verkettung kopiert das Bisherige, also quadratisch.
-- In `scene_presets.config` stehen auch lange Freitexte und `data:`-Adressen;
-- das hätte in die 8-Sekunden-Grenze von PostgREST laufen können.
--
-- Jetzt wird die Eingabe einmal in Stücke zerlegt, jedes Stück für sich
-- umgewandelt und am Ende EINMAL zusammengefügt:
--   · eine Folge von `%XX`-Gruppen      → ihre Bytes;
--   · ein einzelnes `%` ohne zwei Hex    → bleibt `%`;
--   · alles ohne `%`                     → wie es ist.
-- Eine Alternation ohne Quantor ist in Postgres gierig (längster Treffer):
-- An `%41` gewinnt die Hex-Gruppe gegen das einzelne `%`. Das ergibt genau
-- die Regel oben — `prozentDekodiert` im Browser liefert dieselben Ergebnisse
-- (siehe BEISPIELE unten, u. a. `100%zz` und `kaputt%FF`).
-- `with ordinality` hält die Reihenfolge fest; `string_agg` ohne ORDER BY
-- gäbe sie nicht zu.
create or replace function public.datei_dekodiert_roh(p text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select coalesce(
    convert_from(
      string_agg(
        case
          when m.stueck[1] ~ '^%[0-9A-Fa-f]{2}'
            then decode(replace(m.stueck[1], '%', ''), 'hex')
          else convert_to(m.stueck[1], 'UTF8')
        end,
        ''::bytea order by m.nr
      ),
      'UTF8'
    ),
    p
  )
  from regexp_matches(p, '((?:%[0-9A-Fa-f]{2})+|%|[^%]+)', 'g') with ordinality as m(stueck, nr);
$$;

create or replace function public.datei_dekodiert(p text)
returns text
language plpgsql
immutable
set search_path = public
as $$
begin
  if p is null or strpos(p, '%') = 0 then
    return p;
  end if;
  begin
    return public.datei_dekodiert_roh(p);
  exception when others then
    -- Ungültiges UTF-8: roh lassen, wie im Browser.
    return p;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Aus einer Adresse den Schlüssel `<eimer>/<pfad>` machen.
--
-- Gespeichert sind vollständige Adressen, teils mit Zwischenspeicher-Brecher
-- (`?v=3`), teils aus fremden Eimern (Umzüge PROJ-52/53 haben Zeilen kopiert,
-- keine Dateien). Verglichen wird deshalb nur der Teil, der die Datei wirklich
-- bezeichnet.
--
-- DIESELBE REGEL WIE `dateiOrtAus` IM BROWSER, in dieser Reihenfolge:
--   1. Leerraum (Leerzeichen, Tab, CR, LF) an beiden Enden weg;
--   2. alles ab `#`, dann alles ab `?` weg;
--   3. hinter `/storage/v1/object|render/image/public|sign|authenticated/`
--      muss `<eimer>/<mindestens ein Zeichen>` stehen, sonst NULL;
--   4. das Ganze dekodieren (Abschnitt 1).
-- EINZIGER BEWUSSTER UNTERSCHIED: Der Browser prüft zusätzlich, dass die
-- Adresse zum eigenen Projekt gehört, und lehnt `..` ab. Hier nicht — eine
-- Datenbankzeile mit fremder Adresse zählt dann mit. Das ist die sichere
-- Richtung: zu viel gezählt heißt verwaist, nicht kaputt.
--
-- Laufen beide Regeln sonst auseinander, zählt die Funktion zu wenig, und
-- genau das darf nicht passieren. Deshalb stehen die Beispiele unten, und
-- `src/lib/datei-freigeben.test.ts` prüft, dass sie mit
-- `src/lib/datei-schluessel-beispiele.json` übereinstimmen und dass die
-- Browser-Zerlegung genau diese Schlüssel liefert.
--
-- Auf einem Branch gegenprüfen: für jede BEISPIEL-Zeile
--   select public.datei_schluessel('<adresse>');   -- muss <schlüssel> sein
--
-- BEISPIELE-ANFANG
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/character-images/u1/c1/v1/123-ab.png => character-images/u1/c1/v1/123-ab.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/generated-images/u1/j1/0.png?v=3 => generated-images/u1/j1/0.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/prompt-media/u1/p1/x.jpg?v=1&t=2#oben => prompt-media/u1/p1/x.jpg
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/generated-images/u1/j1/0.png#a?b => generated-images/u1/j1/0.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/sign/outfit-images/u1/o1/a.png?token=eyJ => outfit-images/u1/o1/a.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/authenticated/prompt-covers/u1/a.png => prompt-covers/u1/a.png
-- BEISPIEL https://abc.supabase.co/storage/v1/render/image/public/visual-assets/u1/a.png?width=200 => visual-assets/u1/a.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/fashion-assets/u1/f1/v1/bild.jpg => fashion-assets/u1/f1/v1/bild.jpg
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/prompt-media/u1/mein%20bild.png => prompt-media/u1/mein bild.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/prompt-media/u1/K%C3%A4se.png => prompt-media/u1/Käse.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/prompt-media/u1/k%c3%a4se.png => prompt-media/u1/käse.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/prompt-media/u1/100%zz.png => prompt-media/u1/100%zz.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/prompt-media/u1/kaputt%FF.png => prompt-media/u1/kaputt%FF.png
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/prompt-media/ => NULL
-- BEISPIEL https://abc.supabase.co/storage/v1/object/public/prompt-media => NULL
-- BEISPIEL https://abc.supabase.co/bild.jpg => NULL
-- BEISPIELE-ENDE
-- ---------------------------------------------------------------------------
create or replace function public.datei_schluessel(p_url text)
returns text
language sql
immutable
set search_path = public
as $$
  select public.datei_dekodiert(
    substring(
      split_part(split_part(btrim(p_url, E' \t\r\n'), '#', 1), '?', 1)
      from '/storage/v1/(?:object|render/image)/(?:public|sign|authenticated)/([^/]+/.+)$'
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Verweise zählen.
--
-- SECURITY INVOKER, NICHT DEFINER — und das ist eine bewusste Abwägung:
--
--  · Mit INVOKER sieht die Funktion genau die Zeilen, die der Aufrufer auch
--    per REST sehen dürfte. Die Zeilenregeln (RLS) beschränken das auf den
--    angemeldeten Nutzer. Sie kann also nie mehr verraten als die Tabellen
--    selbst, und es braucht keinen Filter auf `user_id` im Funktionsrumpf,
--    der beim nächsten Umbau vergessen werden könnte.
--  · Die Zählung braucht ALLE Zeilen DESSELBEN Nutzers — genau die liefert RLS.
--  · Der Preis: Verweist die Zeile eines ANDEREN Nutzers auf dieselbe Datei,
--    sieht die Funktion sie nicht und zählt zu wenig. Heute ist der Trésor
--    eine Ein-Nutzer-Anwendung, und die Speicherregeln erlauben das Löschen
--    ohnehin nur im eigenen Ordner (`<nutzer>/...`, siehe proj-37). Wird das
--    Zusammenlegen je nutzerübergreifend, muss diese Stelle neu entschieden
--    werden.
--  · DEFINER hätte umgekehrt RLS umgangen. proj-37 zeigt, was das kostet:
--    EXECUTE geht per Vorgabe an PUBLIC, und der anon-Schlüssel steht in jedem
--    Browser-Bündel.
--
-- DIE ZAHL IST EINE ANTWORT AUF „WIRD NOCH GEBRAUCHT?", KEINE STATISTIK.
-- Eine Zeile, deren `url` UND `storage_path` auf die Datei zeigen, zählt
-- doppelt. Das ist egal: Die App fragt nur „> 0?". Wo die Regel unscharf ist,
-- zählt sie lieber zu viel als zu wenig — zu viel heißt eine verwaiste Datei,
-- zu wenig heißt ein kaputtes Bild.
--
-- KERNSTELLEN UND ALTE STELLEN — warum der Unterschied eine Ausnahme wert ist:
--
-- `information_schema.columns` zeigt nur, worauf die aufrufende Rolle Rechte
-- hat. Fehlt das Recht, verschwindet eine Tabelle STILL aus der Liste, und die
-- Zählung ergäbe 0 — „darf weg". Ebenso still liefert eine Tabelle mit RLS,
-- aber ohne SELECT-Regel, keine einzige Zeile.
--
-- Deshalb: Fehlt eine KERNSTELLE, ist sie nicht lesbar, oder hat sie RLS ohne
-- eine Regel für SELECT, bricht die Funktion mit einer Ausnahme ab. Die App
-- löscht dann nichts. Nur die ALTEN Stellen dürfen fehlen.
--
-- Kernstellen (im Repo belegt, von der App gelesen oder geschrieben):
--   character_images.url, .storage_path      outfit_images.url, .storage_path
--   location_images.url, .storage_path       pose_action_images.url, .storage_path
--   prompt_media.url
--   characters, outfits, locations, pose_actions, prompts, collections,
--     scene_presets, visual_assets: jeweils .cover_image_url
--   outfits.crop_image_url                   (proj-53)
--   scene_presets.config                     (jsonb, refs.* mit Bildadressen)
--   image_jobs.result_paths, .source_path, .reference_urls
--
-- Optionale Stellen (dürfen fehlen, werden gezählt, wenn da):
--   characters.crop_image_url, locations.crop_image_url,
--   pose_actions.crop_image_url
--     — die Chrome-Erweiterung schreibt sie (CharacterCaptureScreen.tsx:183,
--       LocationCaptureScreen.tsx:137, PoseCaptureScreen.tsx:138), und laut
--       Messung in der echten Datenbank vom 15.09.2026 gibt es sie dort. Sie
--       stehen trotzdem NICHT in der Kernliste: Im Schema des Repos sind sie
--       nur für `outfits` angelegt (proj-53). Eine Datenbank, die aus dem Repo
--       aufgebaut wird (Branch, lokal), hätte sie nicht — als Kernstelle ließe
--       ihr Fehlen dort jede Zählung scheitern, und die App löschte nie mehr
--       etwas. (Bis 15.09.2026 stand hier „im Repo nirgends belegt" — das war
--       falsch, die Erweiterung wurde übersehen.)
--   fashion_assets (.cover_image_url, .crop_image_url), fashion_asset_images,
--   character_/outfit_/location_archetypes (.cover_image_url) und
--   *_archetype_images — als Sicherheitsnetz stehen geblieben (PROJ-52/53).
--
-- Die Prüfung der Regeln ist bewusst grob: Es muss irgendeine Regel für
-- SELECT oder ALL geben. Ob sie für die aufrufende Rolle gilt, prüft sie
-- nicht — eine falsche Regel fällt damit nicht auf, eine fehlende schon.
--
-- GEMESSEN AM 15.09.2026, gegen die echte Datenbank in einer Transaktion mit
-- Rollback, als Marks Nutzer mit der Rolle `authenticated` (T8): Nach
-- `revoke select on prompts from authenticated` bricht die Zählung ab — aber
-- NICHT mit der eigenen Meldung „Kernstelle … nicht sichtbar", sondern mit
-- `permission denied for table prompts`. Die Spalte bleibt in
-- `information_schema` offenbar sichtbar; erst die Zählabfrage scheitert.
-- Das Ergebnis ist dasselbe: Abbruch, es wird nichts gelöscht. Im Browser
-- erscheint es als „Grund: 42501: permission denied …", nicht als „Funktion
-- fehlt" (geprüft in src/lib/datei-freigeben.test.ts). Die eigene Meldung
-- greift also nur, wenn die Spalte wirklich fehlt; für fehlende Rechte ist
-- der Abbruch von Postgres selbst die Sicherung.
-- ---------------------------------------------------------------------------
create or replace function public.datei_verweise(p_bucket text, p_pfad text)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_pfad       text;
  v_schluessel text;
  v_summe      integer := 0;
  v_anzahl     integer;
  v_stelle     record;
begin
  if coalesce(p_bucket, '') = '' or coalesce(p_pfad, '') = '' then
    -- Eine leere Anfrage ist ein Fehler des Aufrufers, keine Datei ohne
    -- Verweise. Mit 0 zu antworten hieße: „darf weg".
    raise exception 'datei_verweise: Eimer und Pfad sind Pflicht';
  end if;

  -- Der Browser schickt den Pfad dekodiert. Dekodiert wird hier trotzdem, damit
  -- ein anderer Aufrufer mit kodiertem Pfad nicht zu wenig zählt.
  v_pfad := public.datei_dekodiert(p_pfad);
  v_schluessel := p_bucket || '/' || v_pfad;

  for v_stelle in
    select s.tabelle, s.spalte, s.art, s.kern,
           c.column_name is not null as sichtbar,
           coalesce(k.relrowsecurity, false) as mit_rls,
           exists (
             select 1 from pg_policies p
             where p.schemaname = 'public'
               and p.tablename  = s.tabelle
               and p.cmd in ('SELECT', 'ALL')
           ) as hat_leseregel
    from (values
      -- Bildtabellen: Adresse und (unzuverlässiger) Speicherpfad
      ('character_images',           'url',             'url',                  true),
      ('character_images',           'storage_path',    'pfad',                 true),
      ('outfit_images',              'url',             'url',                  true),
      ('outfit_images',              'storage_path',    'pfad',                 true),
      ('location_images',            'url',             'url',                  true),
      ('location_images',            'storage_path',    'pfad',                 true),
      ('pose_action_images',         'url',             'url',                  true),
      ('pose_action_images',         'storage_path',    'pfad',                 true),
      ('prompt_media',               'url',             'url',                  true),
      -- Titelbilder
      ('characters',                 'cover_image_url', 'url',                  true),
      ('outfits',                    'cover_image_url', 'url',                  true),
      ('locations',                  'cover_image_url', 'url',                  true),
      ('pose_actions',               'cover_image_url', 'url',                  true),
      ('prompts',                    'cover_image_url', 'url',                  true),
      ('collections',                'cover_image_url', 'url',                  true),
      ('scene_presets',              'cover_image_url', 'url',                  true),
      ('visual_assets',              'cover_image_url', 'url',                  true),
      -- Zuschnitte
      ('outfits',                    'crop_image_url',  'url',                  true),
      ('characters',                 'crop_image_url',  'url',                  false),
      ('pose_actions',               'crop_image_url',  'url',                  false),
      ('locations',                  'crop_image_url',  'url',                  false),
      -- Szenen-Vorlagen: Bildadressen stecken in `config.refs.*`, auch im
      -- alten Format `refs.*_archetype` (scene-preset-types.ts). Durchsucht
      -- wird der ganze Text — jede künftige Stelle im JSON zählt damit mit.
      ('scene_presets',              'config',          'json_text',            true),
      -- Aufträge
      ('image_jobs',                 'result_paths',    'pfad_liste_generated', true),
      ('image_jobs',                 'source_path',     'pfad_generated',       true),
      ('image_jobs',                 'reference_urls',  'url_liste',            true),
      -- Alte Tabellen, als Sicherheitsnetz stehen geblieben (PROJ-52/53)
      ('fashion_assets',             'cover_image_url', 'url',                  false),
      ('fashion_assets',             'crop_image_url',  'url',                  false),
      ('fashion_asset_images',       'url',             'url',                  false),
      ('fashion_asset_images',       'storage_path',    'pfad',                 false),
      ('character_archetypes',       'cover_image_url', 'url',                  false),
      ('outfit_archetypes',          'cover_image_url', 'url',                  false),
      ('location_archetypes',        'cover_image_url', 'url',                  false),
      ('character_archetype_images', 'url',             'url',                  false),
      ('character_archetype_images', 'storage_path',    'pfad',                 false),
      ('outfit_archetype_images',    'url',             'url',                  false),
      ('outfit_archetype_images',    'storage_path',    'pfad',                 false),
      ('location_archetype_images',  'url',             'url',                  false),
      ('location_archetype_images',  'storage_path',    'pfad',                 false)
    ) as s(tabelle, spalte, art, kern)
    left join information_schema.columns c
      on  c.table_schema = 'public'
      and c.table_name   = s.tabelle
      and c.column_name  = s.spalte
    left join pg_class k
      on  k.relname = s.tabelle
      and k.relnamespace = 'public'::regnamespace
      and k.relkind in ('r', 'p')
  loop
    if not v_stelle.sichtbar then
      if v_stelle.kern then
        raise exception 'datei_verweise: Kernstelle %.% ist nicht sichtbar (fehlt oder keine Leserechte) — nichts wird freigegeben',
          v_stelle.tabelle, v_stelle.spalte;
      end if;
      continue;
    end if;

    if v_stelle.kern and v_stelle.mit_rls and not v_stelle.hat_leseregel then
      raise exception 'datei_verweise: Kerntabelle % hat RLS, aber keine Regel für SELECT — die Zählung sähe keine Zeile',
        v_stelle.tabelle;
    end if;

    v_anzahl := 0;

    if v_stelle.art = 'url' then
      -- `strpos` als Vorfilter statt LIKE: Pfade enthalten `_`, und das ist in
      -- LIKE ein Platzhalter. Kodierte Adressen (`%`) fallen nicht durch den
      -- Vorfilter, weil ihr Rohtext den dekodierten Schlüssel nicht enthält.
      execute format(
        'select count(*) from public.%I
          where (strpos(%I, $1) > 0 or strpos(%I, ''%%'') > 0)
            and public.datei_schluessel(%I) = $1',
        v_stelle.tabelle, v_stelle.spalte, v_stelle.spalte, v_stelle.spalte)
      into v_anzahl using v_schluessel, v_pfad;

    elsif v_stelle.art = 'pfad' then
      -- `storage_path` trägt keinen Eimer. Eine Zeile zählt deshalb bei
      -- gleichem Pfad, egal in welchem Eimer — bewusst zu viel statt zu wenig.
      execute format(
        'select count(*) from public.%I
          where %I = $2 or (strpos(%I, ''%%'') > 0 and public.datei_dekodiert(%I) = $2)',
        v_stelle.tabelle, v_stelle.spalte, v_stelle.spalte, v_stelle.spalte)
      into v_anzahl using v_schluessel, v_pfad;

    elsif v_stelle.art = 'pfad_liste_generated' then
      -- Ergebnispfade sind laut proj-37 immer Pfade in generated-images.
      if p_bucket = 'generated-images' then
        execute format(
          'select count(*) from public.%I t
            where exists (
              select 1 from unnest(t.%I) as u(p)
              where u.p = $2 or public.datei_dekodiert(u.p) = $2)',
          v_stelle.tabelle, v_stelle.spalte)
        into v_anzahl using v_schluessel, v_pfad;
      end if;

    elsif v_stelle.art = 'pfad_generated' then
      -- Quelle einer Vergrößerung oder Bearbeitung: ein Ergebnispfad aus
      -- generated-images. Ohne diese Zeile risse das Löschen eines Auftrags
      -- die Vorlage unter einer noch wartenden Vergrößerung weg.
      if p_bucket = 'generated-images' then
        execute format(
          'select count(*) from public.%I
            where %I = $2 or public.datei_dekodiert(%I) = $2',
          v_stelle.tabelle, v_stelle.spalte, v_stelle.spalte)
        into v_anzahl using v_schluessel, v_pfad;
      end if;

    elsif v_stelle.art = 'url_liste' then
      execute format(
        'select count(*) from public.%I t
          where exists (
            select 1 from unnest(t.%I) as u(adresse)
            where (strpos(u.adresse, $1) > 0 or strpos(u.adresse, ''%%'') > 0)
              and public.datei_schluessel(u.adresse) = $1)',
        v_stelle.tabelle, v_stelle.spalte)
      into v_anzahl using v_schluessel, v_pfad;

    elsif v_stelle.art = 'json_text' then
      -- JEDER STRING-WERT EINZELN, NICHT DER GANZE TEXT.
      --
      -- Bis 15.09.2026 wurde `config::text` als Ganzes dekodiert. Eine einzige
      -- ungültige `%`-Folge irgendwo im JSON ließ dann den GANZEN Text roh —
      -- und eine kodiert gespeicherte Adresse an ganz anderer Stelle wurde
      -- nicht mehr gefunden. Zu wenig gezählt, Datei gelöscht.
      --
      -- Jetzt wird jeder String-Wert (in jeder Tiefe, `strict $.**`) für sich
      -- geprüft. Jede dieser Antworten „ja" zählt:
      --   0. Rückfall vorab: Der ganze Rohtext enthält den Schlüssel.
      --   1. Der String IST eine Speicheradresse dieser Datei
      --      (`datei_schluessel`, derselbe Weg wie bei jeder anderen Spalte).
      --   2. Der String enthält `/storage/v1/` und — dekodiert — den Schlüssel
      --      irgendwo (eine Adresse mitten in Freitext).
      --   3. Der String enthält den Schlüssel roh.
      -- Zu viel zählen ist harmlos, zu wenig nicht.
      --
      -- WARUM WEG 2 NUR BEI `/storage/v1/` (15.09.2026, Critic S2): Ohne diese
      -- Bedingung dekodierte er JEDEN String mit `%` — Freitexte, Prompts,
      -- `data:`-Adressen von mehreren MB. Eine Speicheradresse enthält
      -- `/storage/v1/` immer im Klartext; `%2F` statt `/` erzeugt weder
      -- `getPublicUrl` noch ein Browser.
      --
      -- Was bleibt: Ein einzelner String mit ungültiger `%`-Folge UND kodiert
      -- geschriebener Adresse wird nicht erkannt. Dafür müsste die Adresse
      -- selbst schon kaputt kodiert sein — sie zeigte dann auch im Browser
      -- nicht auf die Datei.
      execute format(
        'select count(*) from public.%I t
          where strpos(t.%I::text, $1) > 0
             or exists (
               select 1
               from jsonb_path_query(t.%I, ''strict $.**'') as w(wert)
               where jsonb_typeof(w.wert) = ''string''
                 and (   public.datei_schluessel(w.wert #>> ''{}'') = $1
                      or (    strpos(w.wert #>> ''{}'', ''/storage/v1/'') > 0
                          and strpos(public.datei_dekodiert(w.wert #>> ''{}''), $1) > 0)
                      or strpos(w.wert #>> ''{}'', $1) > 0))',
        v_stelle.tabelle, v_stelle.spalte, v_stelle.spalte)
      into v_anzahl using v_schluessel, v_pfad;
    end if;

    v_summe := v_summe + coalesce(v_anzahl, 0);
  end loop;

  return v_summe;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Ausführungsrechte.
--
-- Postgres gibt EXECUTE per Vorgabe an PUBLIC. Ohne Anmeldung gibt es nichts
-- zu zählen (RLS lieferte ohnehin 0 — und 0 hieße „darf weg"). Deshalb nur
-- für angemeldete Nutzer.
-- ---------------------------------------------------------------------------
revoke execute on function public.datei_verweise(text, text) from public, anon;
grant  execute on function public.datei_verweise(text, text) to authenticated, service_role;

revoke execute on function public.datei_schluessel(text) from public, anon;
grant  execute on function public.datei_schluessel(text) to authenticated, service_role;

revoke execute on function public.datei_dekodiert(text) from public, anon;
grant  execute on function public.datei_dekodiert(text) to authenticated, service_role;

revoke execute on function public.datei_dekodiert_roh(text) from public, anon;
grant  execute on function public.datei_dekodiert_roh(text) to authenticated, service_role;
