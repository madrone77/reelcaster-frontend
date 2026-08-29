-- A free account is a conversion.
--
-- Until now marketing_conversions held only what Stripe told us about: a trial
-- start and the payment a week later. Both are keyed on a subscription, and the
-- table was shaped around that so tightly that a signup could not be stored in
-- it at all. That left the event we have the most of, and the only one an ad
-- network can currently learn from at this volume, with nowhere to live.
--
-- Three things change:
--
--   1. 'signup' becomes a third event type, with no subscription behind it.
--   2. Value gets a second column, because a signup is worth something and that
--      something is modeled rather than charged. value_cents stays Stripe's
--      alone: the revenue rollups sum it, and a guess in there would read as
--      money on a dashboard. See SIGNUP_MODELED_VALUE_CENTS in
--      src/lib/signup-conversion.ts for how the figure is arrived at and when
--      to replace it.
--   3. The three reporting functions are taught what to do with the new rows,
--      which for two of them is "ignore them".
--
-- NOT backfilled. Historic accounts stay out: an old signup cannot be uploaded
-- anywhere (Meta accepts 7 days), the admin already counts them from
-- user_settings, and inventing conversion rows dated to the day a migration ran
-- would put a spike in every cohort report. Signups from here on only.
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

-- ── The table ────────────────────────────────────────────────────────

alter table public.marketing_conversions
  drop constraint if exists marketing_conversions_event_type_check;

alter table public.marketing_conversions
  add constraint marketing_conversions_event_type_check
  check (event_type in ('trial_start', 'purchase', 'signup'));

alter table public.marketing_conversions
  alter column stripe_subscription_id drop not null;

-- Nullable for signups only. Dropping NOT NULL outright would let a trial row
-- with no subscription in, and that row could never be uploaded or deduplicated
-- because its event id is derived from the subscription id.
alter table public.marketing_conversions
  add constraint marketing_conversions_keyed
  check (
    (event_type = 'signup' and user_id is not null)
    or (event_type <> 'signup' and stripe_subscription_id is not null)
  );

alter table public.marketing_conversions
  add column if not exists modeled_value_cents integer not null default 0;

-- Idempotency for signups, which marketing_conversions_once cannot provide:
-- it keys on the subscription id, and in a unique constraint every NULL counts
-- as distinct, so a thousand signups would all insert happily.
--
-- This has to hold, because the writer is a route that runs on EVERY page load
-- for the first two days of an account's life. A partial index cannot be an
-- onConflict target in PostgREST, so the caller inserts and swallows 23505
-- rather than upserting.
create unique index if not exists marketing_conversions_signup_once
  on public.marketing_conversions (user_id)
  where event_type = 'signup';

comment on column public.marketing_conversions.modeled_value_cents is
  'What a free signup is modeled to be worth, for reporting only. Never money: nothing in billing or revenue reads it, and it is 0 on both Stripe events.';
comment on constraint marketing_conversions_keyed on public.marketing_conversions is
  'Every row has to be identifiable by something. A Stripe event is keyed by its subscription, a signup by its account, and the upload event id is built from whichever applies.';

-- ── The campaign report ──────────────────────────────────────────────
--
-- campaign_summary and campaign_breakdown answer "how did the ad landing pages
-- do", and their rows come from grouping every conversion in the window. Left
-- alone they would now grow one row per organic landing path, because signups
-- outnumber trials by a wide margin and most arrive with no campaign at all.
-- The paid report would fill with rows that are all zeros in every column it
-- shows. So both keep counting exactly what they counted before.

create or replace function public.campaign_summary(since_date date)
returns table(
  landing text, source text, campaign text,
  hits bigint, cta_clicks bigint, trials bigint, purchases bigint, revenue_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select
      e.landing,
      campaign_source_label(e.utm_source, e.click_type) as source,
      e.utm_campaign                                    as campaign,
      sum(e.hits)                                       as hits,
      sum(e.cta_clicks)                                 as cta_clicks
    from campaign_events_daily e
    where e.day >= since_date
    group by 1, 2, 3
  ),
  cv as (
    select
      campaign_landing_key(c.landing_path, c.entry_path)  as landing,
      campaign_source_label(c.utm_source, c.click_type)   as source,
      coalesce(c.utm_campaign, '')                        as campaign,
      count(*) filter (where c.event_type = 'trial_start') as trials,
      count(*) filter (where c.event_type = 'purchase')    as purchases,
      coalesce(sum(c.value_cents) filter (where c.event_type = 'purchase'), 0) as revenue_cents
    from marketing_conversions c
    where c.occurred_at >= since_date::timestamptz
      -- Signups are counted in marketing_performance, not here. See above.
      and c.event_type <> 'signup'
    group by 1, 2, 3
  )
  select
    coalesce(ev.landing, cv.landing)   as landing,
    coalesce(ev.source, cv.source)     as source,
    coalesce(ev.campaign, cv.campaign) as campaign,
    coalesce(ev.hits, 0)               as hits,
    coalesce(ev.cta_clicks, 0)         as cta_clicks,
    coalesce(cv.trials, 0)             as trials,
    coalesce(cv.purchases, 0)          as purchases,
    coalesce(cv.revenue_cents, 0)      as revenue_cents
  from ev
  full outer join cv
    on ev.landing = cv.landing
   and ev.source = cv.source
   and ev.campaign = cv.campaign
  order by coalesce(ev.hits, 0) desc, coalesce(cv.purchases, 0) desc;
$$;

create or replace function public.campaign_breakdown(
  since_date date, p_landing text, p_source text, p_campaign text default null
)
returns table(
  dimension text, value text, hits bigint, cta_clicks bigint, trials bigint, purchases bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ev_rows as (
    select *
    from campaign_events_daily e
    where e.day >= since_date
      and e.landing = p_landing
      and campaign_source_label(e.utm_source, e.click_type) = p_source
      and (p_campaign is null or e.utm_campaign = p_campaign)
  ),
  ev as (
    select 'location' as dimension,
           coalesce(nullif(concat_ws(' · ', nullif(geo_country, ''), nullif(geo_region, ''), nullif(geo_city, '')), ''), 'unknown') as value,
           sum(hits) as hits, sum(cta_clicks) as cta_clicks
    from ev_rows group by 2
    union all
    select 'cta', cta, sum(hits), sum(cta_clicks)
    from ev_rows where cta <> '' group by 2
    union all
    select 'device', coalesce(nullif(device, ''), 'unknown'), sum(hits), sum(cta_clicks)
    from ev_rows group by 2
    union all
    select 'os', coalesce(nullif(os, ''), 'unknown'), sum(hits), sum(cta_clicks)
    from ev_rows group by 2
    union all
    select 'spot', target_spot, sum(hits), sum(cta_clicks)
    from ev_rows where target_spot <> '' group by 2
    union all
    select 'wall', wall, sum(hits), sum(cta_clicks)
    from ev_rows where wall <> '' group by 2
  ),
  cv_rows as (
    select *
    from marketing_conversions c
    where c.occurred_at >= since_date::timestamptz
      and c.event_type <> 'signup'
      and campaign_landing_key(c.landing_path, c.entry_path) = p_landing
      and campaign_source_label(c.utm_source, c.click_type) = p_source
      and (p_campaign is null or coalesce(c.utm_campaign, '') = p_campaign)
  ),
  cv as (
    select 'location' as dimension,
           coalesce(nullif(concat_ws(' · ', nullif(geo_country, ''), nullif(geo_region, ''), nullif(geo_city, '')), ''), 'unknown') as value,
           count(*) filter (where event_type = 'trial_start') as trials,
           count(*) filter (where event_type = 'purchase') as purchases
    from cv_rows group by 2
    union all
    select 'device', coalesce(nullif(device, ''), 'unknown'),
           count(*) filter (where event_type = 'trial_start'),
           count(*) filter (where event_type = 'purchase')
    from cv_rows group by 2
    union all
    select 'os', coalesce(nullif(os, ''), 'unknown'),
           count(*) filter (where event_type = 'trial_start'),
           count(*) filter (where event_type = 'purchase')
    from cv_rows group by 2
  )
  select
    coalesce(ev.dimension, cv.dimension) as dimension,
    coalesce(ev.value, cv.value)         as value,
    coalesce(ev.hits, 0)                 as hits,
    coalesce(ev.cta_clicks, 0)           as cta_clicks,
    coalesce(cv.trials, 0)               as trials,
    coalesce(cv.purchases, 0)            as purchases
  from ev
  full outer join cv
    on ev.dimension = cv.dimension
   and ev.value = cv.value
  order by 1, coalesce(ev.hits, 0) desc, coalesce(cv.trials, 0) desc;
$$;

-- ── The cost report ──────────────────────────────────────────────────
--
-- This is where signups DO belong: cost per signup is the whole reason for
-- recording them, and it is the only cost figure that has a denominator worth
-- dividing by while trial volume is this thin.
--
-- Dropped and recreated rather than replaced, because a function's return type
-- cannot be changed in place. Adding columns is backwards compatible for the
-- readers, which pick fields out of a JSON object by name.
drop function if exists public.marketing_performance(date, date);

create function public.marketing_performance(since_date date, mature_before date)
returns table(
  platform text, campaign_id text, campaign_name text, currency text,
  spend_cents bigint, mature_spend_cents bigint, impressions bigint, clicks bigint,
  signups bigint, trials bigint, purchases bigint, revenue_cents bigint,
  mature_signups bigint, mature_trials bigint, mature_purchases bigint,
  mature_revenue_cents bigint, unknown_click_date bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with spend as (
    select
      sp.platform                 as p_platform,
      sp.campaign_id              as p_campaign_id,
      max(sp.campaign_name)       as p_campaign_name,
      max(sp.currency)            as p_currency,
      sum(sp.spend_cents)::bigint as p_spend_cents,
      coalesce(sum(sp.spend_cents) filter (where sp.day <= mature_before), 0)::bigint
                                  as p_mature_spend_cents,
      sum(sp.impressions)::bigint as p_impressions,
      sum(sp.clicks)::bigint      as p_clicks
    from marketing_ad_spend sp
    where sp.day >= since_date
    group by sp.platform, sp.campaign_id
  ),
  conv as (
    select
      coalesce(mc.utm_source, '')   as c_platform,
      coalesce(mc.utm_campaign, '') as c_campaign_id,
      count(*) filter (where mc.event_type = 'signup')::bigint      as c_signups,
      count(*) filter (where mc.event_type = 'trial_start')::bigint as c_trials,
      count(*) filter (where mc.event_type = 'purchase')::bigint    as c_purchases,
      coalesce(sum(mc.value_cents) filter (where mc.event_type = 'purchase'), 0)::bigint
                                                                    as c_revenue_cents,
      -- A signup matures the moment it happens: unlike a trial there is nothing
      -- left to wait for. It is still cohorted by click date, so that spend and
      -- signups on the same row describe the same clicks.
      count(*) filter (
        where mc.event_type = 'signup'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      )::bigint as c_mature_signups,
      count(*) filter (
        where mc.event_type = 'trial_start'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      )::bigint as c_mature_trials,
      count(*) filter (
        where mc.event_type = 'purchase'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      )::bigint as c_mature_purchases,
      coalesce(sum(mc.value_cents) filter (
        where mc.event_type = 'purchase'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      ), 0)::bigint as c_mature_revenue_cents,
      -- Scoped to the Stripe events on purpose. Nearly every signup is organic
      -- and so has no click date by definition, and counting those here would
      -- turn a fault indicator into a number that is always large.
      count(*) filter (
        where mc.click_at is null and mc.event_type <> 'signup'
      )::bigint as c_unknown_click_date
    from marketing_conversions mc
    -- COHORTED BY CLICK DATE, not conversion date. Spend on a day and the
    -- conversions it eventually produced now describe the same clicks. Under
    -- a 7-day trial the purchase lands a week after the money was spent, so
    -- filtering on occurred_at compares this week's spend against last week's
    -- clicks and lags every figure whenever budgets move.
    --
    -- Falls back to occurred_at when the click date is unknown: organic
    -- conversions have no click, and paid ones predating click_at capture
    -- carry none either. That degrades to the old behaviour for those rows
    -- rather than dropping them, and c_unknown_click_date reports how many
    -- are being approximated that way.
    where coalesce(mc.click_at, mc.occurred_at) >= since_date
    group by 1, 2
  )
  select
    coalesce(spend.p_platform,    conv.c_platform)    as platform,
    coalesce(spend.p_campaign_id, conv.c_campaign_id) as campaign_id,
    spend.p_campaign_name                             as campaign_name,
    spend.p_currency                                  as currency,
    coalesce(spend.p_spend_cents, 0)                  as spend_cents,
    coalesce(spend.p_mature_spend_cents, 0)           as mature_spend_cents,
    coalesce(spend.p_impressions, 0)                  as impressions,
    coalesce(spend.p_clicks, 0)                       as clicks,
    coalesce(conv.c_signups, 0)                       as signups,
    coalesce(conv.c_trials, 0)                        as trials,
    coalesce(conv.c_purchases, 0)                     as purchases,
    coalesce(conv.c_revenue_cents, 0)                 as revenue_cents,
    coalesce(conv.c_mature_signups, 0)                as mature_signups,
    coalesce(conv.c_mature_trials, 0)                 as mature_trials,
    coalesce(conv.c_mature_purchases, 0)              as mature_purchases,
    coalesce(conv.c_mature_revenue_cents, 0)          as mature_revenue_cents,
    coalesce(conv.c_unknown_click_date, 0)            as unknown_click_date
  from spend
  full outer join conv
    on spend.p_platform = conv.c_platform
   and spend.p_campaign_id = conv.c_campaign_id;
$$;

-- Recreated function, so the grants come back with it. SECURITY DEFINER and
-- open to anon would let the whole ad report be read from the browser.
revoke execute on function public.marketing_performance(date, date) from public;
revoke execute on function public.marketing_performance(date, date) from anon;
revoke execute on function public.marketing_performance(date, date) from authenticated;
