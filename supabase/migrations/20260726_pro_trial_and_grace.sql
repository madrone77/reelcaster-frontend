-- Pro 7-day trial (annual only) + past-due grace period.
--
--   1. user_settings gains trial bookkeeping and a grace deadline.
--   2. trial_grants records every trial ever handed out, keyed by both a
--      normalized-email hash and the Stripe card fingerprint, so one person
--      can't farm trials with plus-addressing or a fresh inbox.
--
-- Entitlement is no longer "subscription_tier says pro". It's resolved in
-- src/lib/entitlement.ts, which also honours grace_until. See that file.

-- ============================================================
-- 1. user_settings: trial + grace columns
-- ============================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS has_used_trial boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_until timestamptz;

COMMENT ON COLUMN user_settings.has_used_trial IS 'True once this account has consumed a 7-day trial. Checked before checkout so a re-subscribe is charged immediately instead of trialing again.';
COMMENT ON COLUMN user_settings.grace_until IS 'Set to now()+7d on invoice.payment_failed. While in the future, a past_due subscription still resolves as entitled. Cleared when payment succeeds.';

-- ============================================================
-- 2. trial_grants: one row per trial ever granted
-- ============================================================

CREATE TABLE IF NOT EXISTS trial_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- sha256 of the normalized email (lowercased, +tag stripped, dots removed
  -- for gmail-class domains). Not reversible, and enough to catch the common
  -- casey+1@ / c.a.sey@ dodges.
  email_hash text NOT NULL,
  -- Stripe PaymentMethod card fingerprint. Stable for the same physical card
  -- across different Stripe customers, which is what makes it useful here.
  -- Null until the webhook sees the subscription, since the card doesn't
  -- exist before checkout completes.
  card_fingerprint text,
  stripe_customer_id text,
  stripe_subscription_id text,
  -- granted            = trial is running or ran to completion
  -- revoked_duplicate  = card had already trialed under another account
  outcome text NOT NULL DEFAULT 'granted',
  created_at timestamptz DEFAULT now()
);

-- One trial per normalized email, ever.
CREATE UNIQUE INDEX IF NOT EXISTS trial_grants_email_uniq
  ON trial_grants (email_hash)
  WHERE outcome = 'granted';

-- One trial per physical card, ever. Partial so revoked rows don't keep
-- blocking a card that never actually got a free week.
CREATE UNIQUE INDEX IF NOT EXISTS trial_grants_card_uniq
  ON trial_grants (card_fingerprint)
  WHERE outcome = 'granted' AND card_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS trial_grants_user_idx ON trial_grants (user_id);
CREATE INDEX IF NOT EXISTS trial_grants_subscription_idx ON trial_grants (stripe_subscription_id);

-- Service-role only. RLS on with no policies = no client can read or write it;
-- every access goes through the Stripe routes using the service key.
ALTER TABLE trial_grants ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE trial_grants IS 'Anti-abuse ledger for the 7-day Pro trial. Service-role only — never queried from the client.';
