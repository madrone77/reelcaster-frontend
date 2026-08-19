-- Where in the world is this account?
--
-- The admin roster could place an angler only from what they had already DONE
-- — a saved spot, an alert, a catch, a custom spot — which places the people
-- who stayed and leaves everyone who signed up and bounced as a blank. That
-- is exactly backwards from what acquisition needs: the accounts worth
-- knowing the origin of are the ones with no behaviour yet.
--
-- The obvious fix, "look up their IP", is not available after the fact:
-- Supabase's hosted auth writes an empty `ip_address` on every row of
-- auth.audit_log_entries (all 4,304 of them, checked 2026-08-19), so no
-- historical IP exists to resolve. This captures the location at the moment
-- we can still see the request instead.
--
-- NO IP IS STORED, here or anywhere. Vercel's edge resolves the address to a
-- coarse place before our code runs and hands us the result in
-- x-vercel-ip-country / -country-region / -city / -latitude / -longitude. We
-- keep that result. The address itself never reaches the database, which is
-- both the privacy-preserving choice and the reason no third-party geo-IP
-- service is in this path.
--
-- Named `geo_*` rather than `signup_geo_*` deliberately. The writer is
-- write-once but NOT account-age gated, unlike attr_* beside it: attribution
-- answers "what earned this signup", which a months-later sign-in cannot
-- honestly claim, while this answers "where is this account", which is true
-- whenever we first observe it. That difference is what lets the accounts
-- predating this column fill in as their owners come back, instead of being
-- permanently blank. `geo_captured_at` is what says which it was — read it
-- next to `created_at` before treating a location as an origin.
--
-- Precision is city-level at best and often much worse: a mobile carrier can
-- put a Victoria angler in Vancouver, and a VPN can put them anywhere. Good
-- enough to answer "which market is this traffic from", never good enough to
-- act on for one individual.
--
-- Migration CI has been unauthorized for a while, so merging this file does
-- not apply it. Applied to the ReelCaster project via MCP alongside this
-- commit.

alter table public.user_settings
  add column if not exists geo_country     text,
  add column if not exists geo_region      text,
  add column if not exists geo_city        text,
  add column if not exists geo_lat         double precision,
  add column if not exists geo_lng         double precision,
  add column if not exists geo_captured_at timestamptz;

comment on column public.user_settings.geo_country is
  'ISO-3166-1 alpha-2 country from Vercel edge geo at first observation ("CA"). Never derived from a stored IP; no IP is stored.';
comment on column public.user_settings.geo_region is
  'Vercel x-vercel-ip-country-region: the subdivision code, "BC" / "WA". Not the same vocabulary as primary_region_slug, which the user picks.';
comment on column public.user_settings.geo_city is
  'Nearest city the edge resolved, URL-decoded by the writer. City-level accuracy at best; a carrier or VPN moves it freely.';
comment on column public.user_settings.geo_captured_at is
  'When the location was first observed. Write-once. Compare with created_at before calling it a signup location: an account older than this column was captured on a later sign-in.';

-- No indexes, for the same reason as the attr_* columns: one row per user, and
-- every reader is a dashboard scanning the table for a rollup.
