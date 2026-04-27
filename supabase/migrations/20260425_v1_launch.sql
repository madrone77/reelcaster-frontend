-- Migration: ReelCaster v1 Launch
-- Date: 2026-04-25
-- Scope: Single migration that unblocks all v1 phases.
--   1. Extends favorite_spots for "custom spot profile" enrichment.
--   2. Creates user_settings (subscription, phone, A/B variant, new unit prefs).
--      NOTE: existing 4 unit prefs (wind/temp/precip/height) remain in
--      auth.users.user_metadata where they live today.
--   3. Extends user_alert_profiles for the simple Score Alert flow + SMS delivery.
--   4. Creates waitlist_pins for uncovered-region demand capture.

-- ============================================================
-- 1. favorite_spots: custom spot profile enrichment columns
-- ============================================================

ALTER TABLE favorite_spots
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS expected_species text[],
  ADD COLUMN IF NOT EXISTS coverage_tier text,                  -- t1 | t2 | t3 | null
  ADD COLUMN IF NOT EXISTS access_notes text,
  ADD COLUMN IF NOT EXISTS tide_offset_minutes int,
  ADD COLUMN IF NOT EXISTS dfo_area text,
  ADD COLUMN IF NOT EXISTS suggested_species_fingerprint jsonb,
  ADD COLUMN IF NOT EXISTS is_pro_only boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS favorite_spots_user_slug_uniq
  ON favorite_spots (user_id, slug)
  WHERE slug IS NOT NULL;

COMMENT ON COLUMN favorite_spots.coverage_tier IS 't1/t2/t3 if inside a covered region; null otherwise. v1 only sets this from the BlueCaster /api/v1/spots/by-coordinates enrichment; sub-region tiers are deferred.';
COMMENT ON COLUMN favorite_spots.suggested_species_fingerprint IS 'JSONB cached from BlueCaster enrichment at create time. Shape: { species: [{slug, rank, confidence}], updated_at }.';

-- ============================================================
-- 2. user_settings: NEW table for v1 server-side state
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Subscription
  subscription_status text DEFAULT 'none',          -- none | active | cancelled | past_due
  subscription_tier text DEFAULT 'free',            -- free | pro_annual | pro_monthly
  subscription_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  -- Region
  primary_region_slug text,
  -- SMS / phone
  phone_e164 text,
  phone_verified boolean DEFAULT false,
  -- A/B + UI
  locked_day_variant text DEFAULT 'tease',          -- tease | hide
  has_dismissed_units_banner boolean DEFAULT false,
  -- New unit prefs (existing wind/temp/precip/height stay in auth.users.user_metadata)
  wave_height_unit text DEFAULT 'ft',               -- ft | m
  distance_unit text DEFAULT 'km',                  -- km | mi | nm
  pressure_unit text DEFAULT 'mb',                  -- mb | inHg
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own settings"
  ON user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own settings"
  ON user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own settings"
  ON user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on user_settings"
  ON user_settings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS user_settings_stripe_customer_idx
  ON user_settings(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

COMMENT ON TABLE user_settings IS 'Server-side-queryable user state for v1: subscription, region, phone, A/B variant, new unit prefs. Existing wind/temp/precip/height live in auth.users.user_metadata.';

-- ============================================================
-- 3. user_alert_profiles: extend for Score Alert + SMS
-- ============================================================

ALTER TABLE user_alert_profiles
  ADD COLUMN IF NOT EXISTS delivery_channels text[] DEFAULT ARRAY['email'],
  ADD COLUMN IF NOT EXISTS alert_kind text DEFAULT 'composite',   -- composite | score
  ADD COLUMN IF NOT EXISTS target_spot_id uuid,                   -- nullable; FK to favorite_spots OR null when targeting bluecaster spot
  ADD COLUMN IF NOT EXISTS target_bluecaster_spot_slug text,      -- when alert targets a published bluecaster spot
  ADD COLUMN IF NOT EXISTS target_species text,
  ADD COLUMN IF NOT EXISTS score_threshold int CHECK (score_threshold IS NULL OR (score_threshold >= 0 AND score_threshold <= 100));

CREATE INDEX IF NOT EXISTS user_alert_profiles_kind_idx
  ON user_alert_profiles(alert_kind, is_active)
  WHERE is_active = true;

COMMENT ON COLUMN user_alert_profiles.alert_kind IS 'composite = use full triggers JSONB (existing power-user flow). score = simple "score peaks above X today" (Phase 6 simple flow).';
COMMENT ON COLUMN user_alert_profiles.delivery_channels IS 'Subset of {email, sms}. SMS only delivered if user_settings.phone_verified = true.';

-- ============================================================
-- 4. waitlist_pins: NEW table for uncovered-region capture
-- ============================================================

CREATE TABLE IF NOT EXISTS waitlist_pins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  lat decimal(10,7) NOT NULL,
  lon decimal(10,7) NOT NULL,
  species text[],
  source text NOT NULL CHECK (source IN ('anon_pin','plus_upgrade_attempt','tier3_alert_attempt')),
  notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert waitlist pins"
  ON waitlist_pins FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can read waitlist pins"
  ON waitlist_pins FOR SELECT TO service_role
  USING (true);

CREATE INDEX IF NOT EXISTS waitlist_pins_created_at_idx ON waitlist_pins(created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_pins_source_idx ON waitlist_pins(source);

COMMENT ON TABLE waitlist_pins IS 'Demand-capture for uncovered regions. Aggregated for expansion prioritization. No public read.';
