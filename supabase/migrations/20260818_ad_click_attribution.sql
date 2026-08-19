-- Ad-level acquisition attribution.
--
-- Extends 20260813_signup_conversion_attribution.sql from "how did they find
-- us" to "which ad did we buy that brought them", which is the grain needed to
-- rank ad sets by cost per paying customer rather than by signup volume.
--
-- Two attribution models are stored side by side, on purpose:
--
--   attr_*  FIRST touch, write-once. Unchanged in meaning from 20260813.
--   paid_*  LAST touch on a click we paid for.
--
-- Keeping only first touch systematically undercredits paid: someone who lands
-- on a city page in January, clicks a Meta ad in March, and subscribes reads as
-- organic, and the bias grows as SEO improves. Keeping only last-paid does the
-- opposite and hands every organic discovery to whichever ad happened to be
-- last. Neither is correct alone, so both are recorded and the dashboard shows
-- the gap rather than picking a winner behind the reader's back.
--
-- Click ids (gclid, gbraid, wbraid, fbclid, msclkid) are stored as one value
-- plus its type rather than one column per network. A visit is one click, so
-- only one is ever populated, and a new network becomes a new enum value
-- instead of a new migration.
--
-- gbraid/wbraid are not padding: on iOS, Google suppresses gclid and sends one
-- of those instead, so a gclid-only schema silently drops most mobile traffic.
--
-- The *_params jsonb bags hold the long tail (city, species, spot, variant,
-- offer, adgroup, net, match, dev, loc, plc). Bagged rather than promoted to
-- columns because that list will keep growing and the dashboard groups by them
-- occasionally, not constantly. See EXTRA_PARAMS in src/lib/attribution.ts.
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

alter table public.user_settings
  -- First touch, extended.
  add column if not exists attr_utm_content  text,
  add column if not exists attr_utm_term     text,
  add column if not exists attr_click_id     text,
  add column if not exists attr_click_type   text,
  add column if not exists attr_params       jsonb,
  -- The landing query string verbatim, capped at 400 chars by the writer.
  -- Insurance: whatever parameter list we standardise on today will be missing
  -- one we want later, and this is what lets that one be back-filled across
  -- visits already recorded instead of starting the clock over.
  add column if not exists attr_raw_query    text,

  -- Last paid touch. Overwritten in the cookie until conversion freezes it.
  add column if not exists paid_utm_source   text,
  add column if not exists paid_utm_medium   text,
  add column if not exists paid_utm_campaign text,
  add column if not exists paid_utm_content  text,
  add column if not exists paid_utm_term     text,
  add column if not exists paid_click_id     text,
  add column if not exists paid_click_type   text,
  add column if not exists paid_params       jsonb,
  add column if not exists paid_landing_path text,
  add column if not exists paid_at           timestamptz;

comment on column public.user_settings.attr_click_id is
  'Network-issued click id at FIRST touch. Opaque and case-sensitive: never lower-cased, or the offline conversion upload stops matching.';
comment on column public.user_settings.attr_click_type is
  'Which network issued attr_click_id: gclid | gbraid | wbraid | fbclid | msclkid.';
comment on column public.user_settings.paid_at is
  'When the last paid click landed. Null for accounts that never arrived on one, which is how organic is told apart from unknown.';

-- No indexes. user_settings holds one row per user and every query here is the
-- dashboard scanning the whole table for a rollup; an index would be write cost
-- with no read to pay for it.
