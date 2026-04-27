# Phase 0 — Foundations

**Goal:** unblock every later phase. ½ day.

## Tasks

- [x] Create `reelcaster-frontend/plans/` and seed phase files (this folder).
- [ ] Add envs to `.env.example` (committed) — values stay in `.env.local`.
- [ ] Write the single v1 launch migration: `supabase/migrations/<date>_v1_launch.sql`.
- [ ] Apply the migration via Supabase MCP (or `supabase db push` locally).
- [ ] Verify the migration with a SELECT against each new column.

## Migration scope (one file)

**Extend `favorite_spots`:**

```sql
ALTER TABLE favorite_spots
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS expected_species text[],
  ADD COLUMN IF NOT EXISTS coverage_tier text,            -- t1 | t2 | t3 | null
  ADD COLUMN IF NOT EXISTS access_notes text,
  ADD COLUMN IF NOT EXISTS tide_offset_minutes int,
  ADD COLUMN IF NOT EXISTS dfo_area text,
  ADD COLUMN IF NOT EXISTS suggested_species_fingerprint jsonb,
  ADD COLUMN IF NOT EXISTS is_pro_only boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS favorite_spots_user_slug_uniq
  ON favorite_spots (user_id, slug) WHERE slug IS NOT NULL;
```

**New `user_settings` table** — server-side-queryable user state for v1. Existing unit prefs continue to live in `auth.users.user_metadata` (where they are today) and stay there; this table adds the *new* state Stripe webhooks, alert cron, and SSR rendering need to read.

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_status text DEFAULT 'none',          -- none | active | cancelled | past_due
  subscription_tier text DEFAULT 'free',            -- free | pro_annual | pro_monthly
  subscription_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  primary_region_slug text,
  phone_e164 text,
  phone_verified boolean DEFAULT false,
  locked_day_variant text DEFAULT 'tease',          -- tease | hide
  has_dismissed_units_banner boolean DEFAULT false,
  wave_height_unit text DEFAULT 'ft',
  distance_unit text DEFAULT 'km',
  pressure_unit text DEFAULT 'mb',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own settings"
  ON user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own settings"
  ON user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users insert own settings"
  ON user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access on user_settings"
  ON user_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS user_settings_stripe_customer_idx ON user_settings(stripe_customer_id);
```

**Extend `user_alert_profiles`:**

```sql
ALTER TABLE user_alert_profiles
  ADD COLUMN IF NOT EXISTS delivery_channels text[] DEFAULT ARRAY['email'],
  ADD COLUMN IF NOT EXISTS alert_kind text DEFAULT 'composite',  -- composite | score
  ADD COLUMN IF NOT EXISTS target_spot_id uuid,
  ADD COLUMN IF NOT EXISTS target_species text,
  ADD COLUMN IF NOT EXISTS score_threshold int;
```

**New `waitlist_pins`:**

```sql
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
```

## Env vars to add to `.env.example`

```
# Stripe (Phase 5)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_ANNUAL=
STRIPE_PRICE_MONTHLY_JAN=
STRIPE_PRICE_MONTHLY_FEB=
STRIPE_PRICE_MONTHLY_MAR=
STRIPE_PRICE_MONTHLY_APR=
STRIPE_PRICE_MONTHLY_MAY=
STRIPE_PRICE_MONTHLY_JUN=
STRIPE_PRICE_MONTHLY_JUL=
STRIPE_PRICE_MONTHLY_AUG=
STRIPE_PRICE_MONTHLY_SEP=
STRIPE_PRICE_MONTHLY_OCT=
STRIPE_PRICE_MONTHLY_NOV=
STRIPE_PRICE_MONTHLY_DEC=

# Twilio (Phase 6)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_VERIFY_SID=

# PostHog (Phase 10)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Google OAuth (Phase 4) — configured in Supabase dashboard, but document here for reference
# (no code envs needed; Supabase handles the OAuth client)

# BlueCaster (already exists, verify present)
BLUECASTER_API_BASE=
BLUECASTER_API_KEY=
```

## Verification

```bash
# After applying migration:
psql $DATABASE_URL -c "\d favorite_spots"        # confirm new columns
psql $DATABASE_URL -c "\d user_settings"         # confirm new table
psql $DATABASE_URL -c "\d user_alert_profiles"
psql $DATABASE_URL -c "\d waitlist_pins"
```

Or via Supabase MCP: `mcp__supabase__list_tables` and inspect.
