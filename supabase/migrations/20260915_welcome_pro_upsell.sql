-- The first-login Pro interstitial, shown once to an account that is not Pro.
--
-- Its own column rather than a reuse of `welcome_seen_at` or
-- `pro_welcome_seen_at`: the tour is shown to every account including buyers,
-- the Pro wizard only to accounts that already went Pro, and this only to the
-- ones that did not. A free account that dismisses this and buys Pro later
-- must still get the Pro wizard, which sharing a column would swallow.
--
-- Nullable with no default, like the two beside it: NULL means "still owed",
-- and the API route treats a missing user_settings row the same way.
alter table public.user_settings
  add column if not exists pro_upsell_seen_at timestamptz;

comment on column public.user_settings.pro_upsell_seen_at is
  'When the first-login Pro interstitial was dismissed or acted on. NULL = still owed. Set by POST /api/welcome {kind:"upsell"}.';
