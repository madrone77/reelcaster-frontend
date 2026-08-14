-- New-user welcome modal: the three-step "how ReelCaster works" tour.
--
-- Distinct from pro_welcome_seen_at (added 20260727), which gates the Pro
-- upgrade wizard. Every new account is owed this one, Pro or free, and the two
-- are queued rather than stacked: /api/welcome hands out the new-user tour
-- first and the Pro wizard only once this column is set.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS welcome_seen_at timestamptz;

COMMENT ON COLUMN public.user_settings.welcome_seen_at IS
  'When the user closed the three-step new-user welcome tour. Null means they are still owed it. Set for every account that existed before the tour shipped, so it only greets genuinely new users.';

-- Backfill: accounts that predate the tour are treated as having seen it.
-- "New user" in the product sense means new, not "everyone at once on deploy
-- day". To show it to the whole existing base instead, run:
--   UPDATE public.user_settings SET welcome_seen_at = NULL;
UPDATE public.user_settings
   SET welcome_seen_at = now()
 WHERE welcome_seen_at IS NULL;
