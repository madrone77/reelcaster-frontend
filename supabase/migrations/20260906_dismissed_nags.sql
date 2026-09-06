-- Which in-app asks this account has said no to, keyed by surface.
--
-- The referral nag (a banner on the spot page, a line under the home city)
-- has an X that means "stop asking". That answer belongs to the person, not
-- the browser: dismissed on the phone at the dock should mean dismissed on
-- the laptop that evening. localStorage cannot say that, so it lives here.
--
-- One jsonb map rather than a column per nag, because the next nag would
-- otherwise be another migration for one timestamp. Values are ISO times.
-- Written only through /api/referrals/dismiss with the service role; the
-- shape is validated there, so nothing arbitrary lands in the row.

alter table public.user_settings
  add column if not exists dismissed_nags jsonb not null default '{}'::jsonb;

comment on column public.user_settings.dismissed_nags is
  'Map of nag surface ("spot", "dashboard") to the ISO time the account dismissed it. Empty object means nothing dismissed.';
