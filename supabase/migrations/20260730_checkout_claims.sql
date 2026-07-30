-- Anonymous checkout: account created after Stripe confirms payment.
--
-- A visitor can now pay without an account. The webhook creates their Supabase
-- user once Stripe confirms, and /billing/success exchanges the Stripe
-- `session_id` for a one-time magic link so they land signed in.
--
-- That exchange is the sensitive part: `session_id` travels in the success_url,
-- so it lands in browser history, referrer headers, and any screenshot of the
-- URL bar. Left unbounded it would be a permanent bearer credential for the
-- account. This table makes it single-use — the primary key IS the guard, so
-- two concurrent claims can't both win.

CREATE TABLE IF NOT EXISTS checkout_claims (
  -- Stripe Checkout Session id. PK, so the second insert loses. Deliberately
  -- not a surrogate key: the uniqueness is the whole point.
  session_id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkout_claims_user_idx ON checkout_claims (user_id);

-- Service-role only. RLS on with no policies = no client can read or write it.
ALTER TABLE checkout_claims ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE checkout_claims IS 'One-time-use ledger for exchanging a Stripe checkout session_id for a sign-in link. A row here means that session has already been redeemed.';

-- ============================================================
-- user_settings: remember how the account was born
-- ============================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS created_via_checkout boolean DEFAULT false;

COMMENT ON COLUMN user_settings.created_via_checkout IS 'True when the account was created by the Stripe webhook after an anonymous checkout, rather than by signup. These users have no password until they set one.';
