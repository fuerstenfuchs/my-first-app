-- PROJ-25B — Gesichtsausdruck & Szenenbedingungen
-- Im Supabase SQL Editor ausführen (Dashboard → SQL Editor → New query)

-- 1) asset_type-Constraint um 'expression' erweitern
ALTER TABLE visual_assets DROP CONSTRAINT IF EXISTS visual_assets_asset_type_check;
ALTER TABLE visual_assets ADD CONSTRAINT visual_assets_asset_type_check
  CHECK (asset_type IN ('camera', 'lighting', 'expression'));

-- 2) Standard-Gesichtsausdrücke seeden (für den eingeloggten Nutzer)
INSERT INTO visual_assets (user_id, asset_type, name, description, category, tags)
SELECT u.id, 'expression', v.name, v.description, 'alle', ARRAY[]::text[]
FROM auth.users u
CROSS JOIN (VALUES
  ('Neutral',               'Neutral facial expression, relaxed and calm.'),
  ('Freundliches Lächeln',  'Friendly, warm smile.'),
  ('Großes Lächeln',        'Big, joyful smile, visible teeth.'),
  ('Nachdenklich',          'Thoughtful, contemplative expression.'),
  ('Traurig',               'Sad expression, downturned mouth.'),
  ('Wütend',                'Angry expression, furrowed brow.'),
  ('Überrascht',            'Surprised expression, wide eyes, raised eyebrows.'),
  ('Entschlossen',          'Determined, focused expression.'),
  ('Verliebt',              'Loving, affectionate expression, soft eyes.'),
  ('Gelangweilt',           'Bored expression, half-lidded eyes.'),
  ('Stolz',                 'Proud expression, confident posture.'),
  ('Verwirrt',              'Confused expression, furrowed brow, tilted head.'),
  ('Konzentriert',          'Concentrated, focused expression.')
) AS v(name, description)
WHERE u.email = 'markglass@gmx.de'
  AND NOT EXISTS (
    SELECT 1 FROM visual_assets va
    WHERE va.user_id = u.id AND va.asset_type = 'expression' AND va.name = v.name
  );
