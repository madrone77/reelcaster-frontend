-- Catch log revamp: photo-first wizard with auto analysis.
--
-- Adds first-class columns for what the review screen captures beyond the
-- original schema: draft status, the matched/created BlueCaster spot,
-- species identification confidence, the score snapshot taken at log time,
-- and the DFO management area label. Conditions stay in weather_snapshot
-- jsonb — the wizard writes a richer "v2" shape ({v:2, tide, current, wind,
-- pressure, water, sky}); v1 rows remain readable.

ALTER TABLE catch_logs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'logged'
    CHECK (status IN ('draft', 'logged')),
  ADD COLUMN IF NOT EXISTS spot_id uuid,
  ADD COLUMN IF NOT EXISTS spot_slug text,
  ADD COLUMN IF NOT EXISTS species_bc_id uuid,
  ADD COLUMN IF NOT EXISTS species_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS score numeric(5,1),
  ADD COLUMN IF NOT EXISTS score_status text NOT NULL DEFAULT 'none'
    CHECK (score_status IN ('scored', 'pending', 'none')),
  ADD COLUMN IF NOT EXISTS mgmt_area text,
  ADD COLUMN IF NOT EXISTS pool_observation_id uuid;

COMMENT ON COLUMN catch_logs.status IS
  'draft = saved from the wizard without publishing; logged = a real catch entry';
COMMENT ON COLUMN catch_logs.spot_id IS
  'BlueCaster fishing_spots.id the catch was matched/assigned to (no FK — cross-database reference)';
COMMENT ON COLUMN catch_logs.species_bc_id IS
  'BlueCaster species.id (uuid) — needed to re-fetch species-specific scores; species_id keeps the frontend text slug';
COMMENT ON COLUMN catch_logs.species_confidence IS
  'Vision model species confidence 0..1 at identification time';
COMMENT ON COLUMN catch_logs.score IS
  'Spot score (0-100 display scale) snapshotted at log time; NULL when unavailable';
COMMENT ON COLUMN catch_logs.score_status IS
  'scored = snapshot taken; pending = spot awaiting its first scoring run; none = score unavailable (e.g. catch time outside forecast window)';
COMMENT ON COLUMN catch_logs.mgmt_area IS
  'DFO management subarea label at the catch location, e.g. "DFO 19-3"';
COMMENT ON COLUMN catch_logs.pool_observation_id IS
  'BlueCaster catch_observations.id when the catch was committed to the intelligence pool';

CREATE INDEX IF NOT EXISTS idx_catch_logs_user_status_caught
  ON catch_logs (user_id, status, caught_at DESC);
