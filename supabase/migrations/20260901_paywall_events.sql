-- The paywall event log, and the two columns that let it be joined to money.
--
-- WHAT WAS MISSING. `paywall_impressions` is a counter: one row per
-- day x feature x surface x tier holding two integers, with no visitor, no
-- session and no campaign on it. It answers "how often was this wall seen"
-- and nothing else. The conversion side, meanwhile, has known its campaign,
-- device and city per account for weeks (marketing_conversions, and the
-- attr_* columns on user_settings). So the numerator could be sliced by
-- campaign and the denominator could not, and the one question worth asking of
-- a paid click — what share of the people this ad sent to this wall bought —
-- had no denominator at all.
--
-- This table is that denominator. One row per event rather than a count, with
-- the same acquisition vocabulary the conversions table already uses, so the
-- two sides can be filtered on identical columns and divided.
--
-- THE COUNTER STAYS. `paywall_impressions` keeps being bumped by the same
-- request that writes here, keeps its history back to 2026-08-13, and keeps
-- being what /admin/reelcaster/paywalls reads. Nothing is migrated off it.
-- This table starts empty and starts today.
--
-- WHAT IS DELIBERATELY NOT IN A ROW.
--
--   No IP. The edge resolves the address to a city before our code runs and
--   only the city is kept, exactly as in the signup geo capture.
--
--   No click id. gclid and fbclid are network-issued identifiers for a person.
--   The conversion table carries them because the offline upload cannot work
--   without them; a wall impression has nothing to upload, so it keeps
--   `click_type` (which network sold the click) and drops the id.
--
--   No free text from the visitor. `journal` holds interaction KINDS
--   ("spot_open", "day_pick"), never what was searched for or typed.
--
-- THE SESSION ID is a rotating first-party id minted in middleware, 30 minutes
-- rolling, the same lifetime as the rc_wall cookie. It exists so a wall shown
-- three times to one person is not read as three people, and so a dismissal
-- and the signup that follows it can be joined. It is not a visitor id: a gap
-- of half an hour makes a new one, and nothing anywhere maps it to a person.
-- Kept for 180 days by `prune_paywall_events` below.
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

-- ── The log ──────────────────────────────────────────────────────────

create table if not exists public.paywall_events (
  id bigserial primary key,

  -- When, twice. `occurred_at` is the real instant and is what a journey is
  -- ordered by; `day` is the Pacific bucket, stamped by the writer, so this
  -- table groups on the same day boundary as every counter beside it and a
  -- report can put them on one axis. See src/lib/pacific-day.ts.
  occurred_at timestamptz not null default now(),
  day date not null,

  -- 'impression'    the wall was shown
  -- 'cta_click'     they reached for the offer on it
  -- 'dismiss'       they closed it without reaching
  -- 'checkout_start' a Stripe session was created off the back of it. Written
  --                  server-side by the checkout route, so it cannot be lost
  --                  to a navigation the way a client beacon can.
  kind text not null check (kind in ('impression', 'cta_click', 'dismiss', 'checkout_start')),

  -- What they were denied, and where they were standing. Raw slugs from the
  -- frontend's plan-features.ts, passed through untranslated, same as the
  -- counter. A label map here would drift from that vocabulary the moment a
  -- wall is added.
  feature text not null,
  surface text not null default 'unknown',

  -- The spot in front of them when the wall opened, when there was one. The
  -- counter could never hold this and it is the first thing anyone asks about
  -- a wall on a map.
  spot_slug text,

  viewer_tier text not null default 'anon' check (viewer_tier in ('anon', 'free', 'pro')),

  -- Who, as loosely as the question can be answered. `user_id` only when they
  -- were already signed in; most walls are shown to visitors who are not.
  session_id text,
  user_id uuid references auth.users(id) on delete set null,

  -- What they had done before the wall opened. `engagement` is the click score
  -- from src/lib/upgrade-nag.ts (browse 1, gated 2); `journal` is the last few
  -- interaction kinds with their offsets in seconds. Together they separate
  -- "bounced into a lock" from "used the map for two minutes, then hit one".
  engagement integer,
  journal jsonb,

  -- How long the modal was open, in milliseconds. Only on 'dismiss', where the
  -- difference between a reflex close and a considered no is the whole signal.
  dwell_ms integer,

  -- ── Acquisition. Same names and same meanings as marketing_conversions, on
  -- purpose: the two tables get divided by each other. ──
  attribution_model text,
  click_type text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_path text,
  entry_path text,

  -- Read from the request on the server, never reported by the client. A
  -- number a visitor can edit is not a number.
  device text,
  os text,
  geo_country text,
  geo_region text,
  geo_city text,

  -- The price arm this reader was being quoted, so a wall's conversion rate
  -- can be read per arm rather than blended across a running test.
  split_tests jsonb,

  -- Wall-specific extras that do not earn a column: which locked day index was
  -- tapped, which species filter was on. Whitelisted by the writer.
  context jsonb
);

comment on table public.paywall_events is
  'One row per paywall impression, CTA click, dismissal or checkout start. The denominator for marketing_conversions. No IP, no click id, no free text. See supabase/migrations/20260901_paywall_events.sql.';

-- Every report on this table is "a window, then group by wall", so the day
-- leads. The second index serves the other direction: one wall, over time.
create index if not exists paywall_events_day_idx
  on public.paywall_events (day desc, feature, surface);

create index if not exists paywall_events_feature_idx
  on public.paywall_events (feature, surface, day desc);

-- Campaign slices are the point of the table, and utm_source is the coarsest
-- useful filter. Partial, because most rows are organic and a null row is
-- never the one being looked for.
create index if not exists paywall_events_campaign_idx
  on public.paywall_events (utm_source, utm_campaign, day desc)
  where utm_source is not null;

-- Stitching one visit together: impression, dismiss, second impression, click.
create index if not exists paywall_events_session_idx
  on public.paywall_events (session_id, occurred_at)
  where session_id is not null;

-- Service role only, like every other counter here. There is no policy, and
-- the absence is the point: the writer is a route holding the service key and
-- nothing in the browser reads this back.
alter table public.paywall_events enable row level security;

-- ── Retention ────────────────────────────────────────────────────────

-- Bounded on purpose. An unbounded delete on a table this write-heavy is how
-- the session_scores tail-delete ran for eight seconds and took the write path
-- with it; this one takes a slice, and the caller runs it again if it filled.
--
-- Not scheduled by this migration. Six months of rows is small, and a cron
-- that silently eats history is worse than a chore someone does deliberately.
create or replace function public.prune_paywall_events(
  p_days integer default 180,
  p_limit integer default 5000
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  removed integer;
begin
  with doomed as (
    select id
    from paywall_events
    where occurred_at < now() - make_interval(days => p_days)
    order by id
    limit p_limit
  )
  delete from paywall_events e
  using doomed d
  where e.id = d.id;

  get diagnostics removed = row_count;
  return removed;
end;
$$;

comment on function public.prune_paywall_events is
  'Deletes at most p_limit paywall_events older than p_days. Batched deliberately; call again while it returns p_limit.';

-- ── The join back to money ───────────────────────────────────────────

-- Which wall earned this conversion, on the conversion row itself.
--
-- The answer already existed, in two places and in neither usefully: on
-- user_settings.attr_trial_from, which is one row per person and write-once, and
-- in Stripe subscription metadata. Neither can be grouped alongside utm_campaign
-- and geo_city in one query, which is the query. These two columns are the
-- numerator's copy of the same vocabulary paywall_events uses for the
-- denominator, so a wall's conversion rate for one campaign in one city is a
-- filter on each side and a division.
--
-- Not backfilled: nothing in the existing rows carries a surface, and inventing
-- one would put a wall on conversions that may never have seen it.
alter table public.marketing_conversions
  add column if not exists paywall_feature text;

alter table public.marketing_conversions
  add column if not exists paywall_surface text;

-- How it was actually paid for, at the moment of purchase.
--
-- Stripe knows how someone pays RIGHT NOW and forgets how they paid first: swap
-- the card on file and an Apple Pay purchase retroactively becomes a card
-- purchase in every report. The webhook already stamps the original answer into
-- subscription metadata (`pay_method`, src/lib/payment-method.ts); this is that
-- value mirrored where it can be grouped by campaign and by wall without a
-- round trip to Stripe. Vocabulary is Stripe's: 'card', 'apple_pay',
-- 'google_pay', 'link'.
alter table public.marketing_conversions
  add column if not exists pay_method text;

create index if not exists marketing_conversions_paywall_idx
  on public.marketing_conversions (paywall_feature, paywall_surface)
  where paywall_feature is not null;

-- ── The funnel, as one query ─────────────────────────────────────────

-- What /admin/reelcaster/paywalls reads for its attribution view.
--
-- IT IS AN RPC AND NOT A CLIENT-SIDE ROLL-UP for a reason this codebase has
-- already paid for once: PostgREST answers an unbounded select with at most
-- 1000 rows and no error, so a page that fetches events and counts them in
-- TypeScript would silently report a fraction of a busy week as the whole of
-- it. Counting belongs on the side of the wire that has all the rows.
--
-- THE TWO HALVES ARE FILTERED THE SAME WAY AND JOINED, which is the entire
-- point. `paywall_events` supplies the denominator (this wall was shown to
-- this many people from this campaign, on this kind of device, in this city)
-- and `marketing_conversions` supplies the numerator, filtered on the same
-- named columns. A full outer join, because both directions happen: a wall
-- shown and never converted is the row most worth reading, and a conversion
-- credited to a wall whose impressions predate this table is real too.
--
-- WHERE THE TWO DISAGREE, and it is worth knowing before dividing them:
--
--   The event's device and city are the ones it was SHOWN on. The conversion's
--   are the ones checkout was completed on. Someone who taps an ad on a phone
--   and pays on a laptop is a mobile impression and a desktop conversion, and
--   no filter can make both true at once.
--
--   `sessions` counts distinct session ids, so it is people-ish rather than
--   views. A browser blocking cookies has no session id and contributes to
--   `impressions` but not to `sessions`, which is why both are returned and
--   the page shows both.
--
-- Days are Pacific on both sides. paywall_events stamps the bucket at write
-- time; marketing_conversions keeps a real timestamp, so it is converted here
-- rather than compared against UTC and quietly shifted by eight hours.
create or replace function public.paywall_funnel(
  p_since date,
  p_until date default null,
  p_source text default null,
  p_device text default null,
  p_os text default null,
  p_city text default null,
  p_country text default null
)
returns table (
  feature text,
  surface text,
  impressions bigint,
  sessions bigint,
  dismissals bigint,
  cta_clicks bigint,
  checkout_starts bigint,
  signups bigint,
  trials bigint,
  purchases bigint,
  wallet_conversions bigint
)
language sql
stable
security definer
set search_path to 'public'
as $$
  with e as (
    select
      pe.feature,
      pe.surface,
      count(*) filter (where pe.kind = 'impression') as impressions,
      count(distinct pe.session_id) filter (where pe.kind = 'impression') as sessions,
      count(*) filter (where pe.kind = 'dismiss') as dismissals,
      count(*) filter (where pe.kind = 'cta_click') as cta_clicks,
      count(*) filter (where pe.kind = 'checkout_start') as checkout_starts
    from paywall_events pe
    where pe.day >= p_since
      and (p_until is null or pe.day <= p_until)
      and (p_source is null or pe.utm_source = p_source)
      and (p_device is null or pe.device = p_device)
      and (p_os is null or pe.os = p_os)
      and (p_city is null or pe.geo_city = p_city)
      and (p_country is null or pe.geo_country = p_country)
    group by 1, 2
  ),
  c as (
    select
      mc.paywall_feature as feature,
      coalesce(nullif(mc.paywall_surface, ''), 'unknown') as surface,
      count(*) filter (where mc.event_type = 'signup') as signups,
      count(*) filter (where mc.event_type = 'trial_start') as trials,
      count(*) filter (where mc.event_type = 'purchase') as purchases,
      -- A wallet is not a card: Stripe reads both as type 'card' and only
      -- `card.wallet.type` separates them, which is what pay_method holds.
      count(*) filter (
        where mc.event_type <> 'signup'
          and mc.pay_method is not null
          and mc.pay_method <> 'card'
      ) as wallet_conversions
    from marketing_conversions mc
    where mc.paywall_feature is not null
      and (mc.occurred_at at time zone 'America/Los_Angeles')::date >= p_since
      and (p_until is null or (mc.occurred_at at time zone 'America/Los_Angeles')::date <= p_until)
      and (p_source is null or mc.utm_source = p_source)
      and (p_device is null or mc.device = p_device)
      and (p_os is null or mc.os = p_os)
      and (p_city is null or mc.geo_city = p_city)
      and (p_country is null or mc.geo_country = p_country)
    group by 1, 2
  )
  select
    coalesce(e.feature, c.feature) as feature,
    coalesce(e.surface, c.surface) as surface,
    coalesce(e.impressions, 0) as impressions,
    coalesce(e.sessions, 0) as sessions,
    coalesce(e.dismissals, 0) as dismissals,
    coalesce(e.cta_clicks, 0) as cta_clicks,
    coalesce(e.checkout_starts, 0) as checkout_starts,
    coalesce(c.signups, 0) as signups,
    coalesce(c.trials, 0) as trials,
    coalesce(c.purchases, 0) as purchases,
    coalesce(c.wallet_conversions, 0) as wallet_conversions
  from e
  full outer join c on c.feature = e.feature and c.surface = e.surface
  order by 3 desc, 6 desc;
$$;

comment on function public.paywall_funnel is
  'Per wall: impressions, sessions, dismissals, CTA clicks and checkout starts from paywall_events, joined to signups, trials and purchases from marketing_conversions, both filtered on the same campaign/device/geo slice.';

-- The slice pickers on the admin page. Returned from the data rather than
-- hardcoded, so a new campaign or a new city appears without a deploy.
create or replace function public.paywall_event_facets(p_since date)
returns table (kind text, value text, events bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select 'source', utm_source, count(*) from paywall_events
    where day >= p_since and utm_source is not null group by 2
  union all
  select 'device', device, count(*) from paywall_events
    where day >= p_since and device is not null group by 2
  union all
  select 'os', os, count(*) from paywall_events
    where day >= p_since and os is not null group by 2
  union all
  select 'city', geo_city, count(*) from paywall_events
    where day >= p_since and geo_city is not null group by 2
  order by 1, 3 desc;
$$;
