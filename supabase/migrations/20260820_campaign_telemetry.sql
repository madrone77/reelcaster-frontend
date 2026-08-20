-- Landing-page hits and CTA clicks, so a paid campaign can be judged before
-- anyone converts.
--
-- What existed before this: conversions (marketing_conversions) and ad spend
-- (marketing_ad_spend), and nothing in between. A campaign that bought a
-- thousand clicks and closed nobody was indistinguishable from one that bought
-- nothing at all, because our side of the funnel was never recorded. The ad
-- networks report impressions and clicks up to their own landing page, and
-- Stripe reports the sale seven days later; the two steps that decide whether
-- a landing page works, "did they arrive" and "did they reach for the button",
-- happened entirely inside our site and were counted nowhere.
--
-- COUNTERS, NOT AN EVENT LOG. There is no visitor id here, no user id, no
-- timestamp finer than the day, and no path. Every row is a bucket of
-- dimensions and two integers. That is a deliberate limit and it costs
-- something real: unique visitors cannot be derived from this table, and
-- neither can one person's route through the page. What it buys is a table
-- with nothing in it to leak, nothing to purge, and no retention policy to
-- write, which is the same trade paywall_impressions already makes.
--
-- CTR is cta_clicks / hits at whatever grouping is being read. Both counters
-- are written by the same client code under the same conditions, so the ratio
-- is honest even though the absolute numbers exclude anyone without
-- JavaScript. It is emphatically NOT the ad network's CTR: that one is
-- impressions to clicks and belongs to Google and Meta. This one starts where
-- theirs ends.
--
-- Cardinality is the thing to watch. A row exists only where a real hit landed,
-- so the table is sparse, but the key is fourteen columns wide and geo_city is
-- the widest of them. At the traffic these campaigns run today that is tens of
-- rows a day. If a campaign ever goes properly wide, geo_city is the column to
-- drop first: country and region answer "which market" on their own.
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

create table if not exists public.campaign_events_daily (
  day            date not null,

  -- Which landing page. "lp1".."lp6", matching the /lp/<n> route. Stored as
  -- the route key rather than a display name so renaming a page in the admin
  -- does not orphan its history.
  landing        text not null,

  -- Which pitch the link asked for (?a=), from _shared/lp-angles.ts. Empty
  -- when the link carried none, which resolves to the control angle on the
  -- page and is worth keeping distinct from an explicit ?a=control.
  angle          text not null default '',

  -- The city the landing page was serving, e.g. "victoria-bc". NOT where the
  -- visitor was: that is geo_city below, and the whole point of having both is
  -- that a Seattle page reaching Ontario readers is a targeting fault you
  -- cannot see with either column alone.
  target_city    text not null default '',

  utm_source     text not null default '',
  utm_medium     text not null default '',
  utm_campaign   text not null default '',

  -- Which network stamped a click id (gclid, fbclid, ...). The id ITSELF is
  -- never stored here: it is personal data and it is per-visitor, which would
  -- turn this counter into the event log it is deliberately not.
  click_type     text not null default '',

  geo_country    text not null default '',
  geo_region     text not null default '',
  geo_city       text not null default '',

  -- From the User-Agent, parsed server-side. See src/lib/device.ts.
  device         text not null default '',
  os             text not null default '',

  -- Which button. Empty on a hit row, set on a click row: "hero", "final",
  -- "sticky", "nav". Keeping both kinds in one table is what lets a single
  -- group-by return hits and clicks side by side without a join.
  cta            text not null default '',

  hits           bigint not null default 0,
  cta_clicks     bigint not null default 0,

  first_seen_at  timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  primary key (
    day, landing, angle, target_city,
    utm_source, utm_medium, utm_campaign, click_type,
    geo_country, geo_region, geo_city,
    device, os, cta
  )
);

comment on table public.campaign_events_daily is
  'Daily counters of landing-page hits and CTA clicks by campaign, location and device. No visitor id and no event log: counting is the whole job.';
comment on column public.campaign_events_daily.target_city is
  'The city the landing page served. Not the visitor location; that is geo_city.';
comment on column public.campaign_events_daily.cta is
  'Empty on hit rows, the button id on click rows. CTR is sum(cta_clicks)/sum(hits) at any grouping.';

-- Every reader is a dashboard scanning a recent window.
create index if not exists campaign_events_daily_day_idx
  on public.campaign_events_daily (day desc);

alter table public.campaign_events_daily enable row level security;
-- No policies, matching paywall_impressions and marketing_conversions: the
-- service role bypasses RLS and is the only intended reader or writer.

/**
 * Add one to a bucket, creating it if this is the first of its kind today.
 *
 * security definer because the caller is a service-role route today but the
 * function is the only supported way in: it is what guarantees a hit row and a
 * click row that describe the same visit land on the same key, which is the
 * whole basis of the CTR.
 */
create or replace function public.bump_campaign_counter(
  p_day          date,
  p_landing      text,
  p_angle        text,
  p_target_city  text,
  p_utm_source   text,
  p_utm_medium   text,
  p_utm_campaign text,
  p_click_type   text,
  p_geo_country  text,
  p_geo_region   text,
  p_geo_city     text,
  p_device       text,
  p_os           text,
  p_cta          text,
  p_kind         text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('hit', 'cta_click') then
    raise exception 'bump_campaign_counter: unknown kind %', p_kind;
  end if;

  insert into public.campaign_events_daily as c (
    day, landing, angle, target_city,
    utm_source, utm_medium, utm_campaign, click_type,
    geo_country, geo_region, geo_city,
    device, os, cta,
    hits, cta_clicks
  )
  values (
    p_day, p_landing, coalesce(p_angle, ''), coalesce(p_target_city, ''),
    coalesce(p_utm_source, ''), coalesce(p_utm_medium, ''),
    coalesce(p_utm_campaign, ''), coalesce(p_click_type, ''),
    coalesce(p_geo_country, ''), coalesce(p_geo_region, ''),
    coalesce(p_geo_city, ''),
    coalesce(p_device, ''), coalesce(p_os, ''), coalesce(p_cta, ''),
    case when p_kind = 'hit' then 1 else 0 end,
    case when p_kind = 'cta_click' then 1 else 0 end
  )
  on conflict (
    day, landing, angle, target_city,
    utm_source, utm_medium, utm_campaign, click_type,
    geo_country, geo_region, geo_city,
    device, os, cta
  )
  do update set
    hits       = c.hits + case when p_kind = 'hit' then 1 else 0 end,
    cta_clicks = c.cta_clicks + case when p_kind = 'cta_click' then 1 else 0 end,
    updated_at = now();
end;
$$;

comment on function public.bump_campaign_counter is
  'Increment one daily campaign bucket. The only supported writer for campaign_events_daily.';

revoke all on function public.bump_campaign_counter(
  date, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

-- ── Conversions get the same axes ────────────────────────────────────────
--
-- Without these, the campaign page could break hits and clicks down by device,
-- OS and location and then stop dead at the conversion, which is the number
-- that decides where money goes. "Do iOS clicks convert worse than Android"
-- is exactly the question this table is for, and it was unanswerable.
--
-- These describe the CHECKOUT request, not the ad click: they are read from
-- the headers of the request that created the Stripe session, carried through
-- subscription metadata, and written by the webhook. That is the device the
-- customer actually bought on. For the overwhelmingly common case of one
-- session on one phone it is also the device they clicked the ad on, but a
-- click on a phone and a purchase on a laptop is recorded as the laptop, which
-- is the honest answer to "what closed" and the wrong answer to "what was
-- targeted". The click-side answer lives in campaign_events_daily.
--
-- Forward-only. Every conversion recorded before this migration reads as
-- unknown, and no backfill is possible: the request that would have carried
-- the answer is long gone.
alter table public.marketing_conversions
  add column if not exists device      text,
  add column if not exists os          text,
  add column if not exists geo_country text,
  add column if not exists geo_region  text,
  add column if not exists geo_city    text;

comment on column public.marketing_conversions.device is
  'Form factor of the checkout request (mobile/tablet/desktop), from the User-Agent. Null for conversions predating 2026-08-20.';
comment on column public.marketing_conversions.os is
  'Platform of the checkout request (ios/android/windows/macos/linux/chromeos). Null for conversions predating 2026-08-20.';
comment on column public.marketing_conversions.geo_city is
  'Coarse edge-resolved location of the checkout request. No IP is stored. Null for conversions predating 2026-08-20.';
