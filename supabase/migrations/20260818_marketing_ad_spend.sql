-- Ad spend, at the grain the ad platforms report it.
--
-- The denominator. Without this table there is no cost per acquisition
-- anywhere in the product, only conversion counts, and a campaign that
-- converts well can still be the one losing the most money.
--
-- Lives in the ReelCaster project rather than BlueCaster's on purpose: CAC is
-- spend divided by conversions, and marketing_conversions is here. Splitting
-- the two across projects would put a network hop in the middle of a division.
--
-- Names are denormalised onto every row instead of living in a dimension
-- table. They are refreshed on each ingest, the row count is tiny, and it
-- means a report never needs a join to be readable. The ID is what joins;
-- the name is only ever for a human to read.
--
-- Idempotent by construction. The ingest re-pulls a trailing window every run
-- because BOTH platforms restate recent spend for days afterwards as they
-- strip invalid clicks, so yesterday's number is not final. The unique key
-- makes a re-pull an update rather than a duplicate.
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

create table if not exists public.marketing_ad_spend (
  id            bigint generated always as identity primary key,
  day           date    not null,
  platform      text    not null check (platform in ('google', 'meta')),

  -- Empty string rather than null, because a unique constraint treats nulls as
  -- distinct: with nulls, re-ingesting a campaign-level row would insert a
  -- second copy every single run instead of updating the first.
  campaign_id   text    not null default '',
  campaign_name text,
  adset_id      text    not null default '',
  adset_name    text,
  ad_id         text    not null default '',
  ad_name       text,

  impressions   bigint  not null default 0,
  clicks        bigint  not null default 0,
  spend_cents   bigint  not null default 0,

  -- Per row, never assumed. Google reports in the ad account's currency and
  -- Meta in its own; adding CAD to USD produces a number that looks like money
  -- and is not.
  currency      text    not null,

  ingested_at   timestamptz not null default now(),

  constraint marketing_ad_spend_grain unique (day, platform, campaign_id, adset_id, ad_id)
);

comment on table public.marketing_ad_spend is
  'Daily ad spend per ad, from the Google Ads and Meta reporting APIs. The denominator for CAC. Re-pulled on a trailing window because both platforms restate recent spend.';
comment on column public.marketing_ad_spend.spend_cents is
  'Minor units of `currency`. Google reports cost_micros (÷10000); Meta reports a decimal string of major units (×100).';

create index if not exists marketing_ad_spend_day_idx
  on public.marketing_ad_spend (day desc);
create index if not exists marketing_ad_spend_campaign_idx
  on public.marketing_ad_spend (platform, campaign_id);

alter table public.marketing_ad_spend enable row level security;
-- No policies, matching marketing_conversions: service role only. Spend is
-- commercially sensitive and the anon key must never see it.

-- ── The rollup CAC is read from ──────────────────────────────────────
--
-- A FULL OUTER JOIN, which is the entire point. An INNER join would hide the
-- two rows that matter most: a campaign burning money with zero conversions,
-- and conversions arriving against a campaign id that no spend row matches
-- (which means the ad links are mis-tagged and the join key is wrong).
--
-- The join is campaign ID to utm_campaign, which works because the ad links
-- are built with the platform's own macro substituting the id. See
-- /admin/reelcaster/links in bluecaster.
create or replace function public.marketing_performance(since_date date)
returns table (
  platform       text,
  campaign_id    text,
  campaign_name  text,
  currency       text,
  spend_cents    bigint,
  impressions    bigint,
  clicks         bigint,
  trials         bigint,
  purchases      bigint,
  revenue_cents  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with spend as (
    select
      sp.platform                        as p_platform,
      sp.campaign_id                     as p_campaign_id,
      max(sp.campaign_name)              as p_campaign_name,
      max(sp.currency)                   as p_currency,
      sum(sp.spend_cents)::bigint        as p_spend_cents,
      sum(sp.impressions)::bigint        as p_impressions,
      sum(sp.clicks)::bigint             as p_clicks
    from marketing_ad_spend sp
    where sp.day >= since_date
    group by sp.platform, sp.campaign_id
  ),
  conv as (
    select
      coalesce(mc.utm_source, '')        as c_platform,
      coalesce(mc.utm_campaign, '')      as c_campaign_id,
      count(*) filter (where mc.event_type = 'trial_start')::bigint as c_trials,
      count(*) filter (where mc.event_type = 'purchase')::bigint    as c_purchases,
      coalesce(
        sum(mc.value_cents) filter (where mc.event_type = 'purchase'), 0
      )::bigint                          as c_revenue_cents
    from marketing_conversions mc
    where mc.occurred_at >= since_date
    group by 1, 2
  )
  select
    coalesce(spend.p_platform,    conv.c_platform)    as platform,
    coalesce(spend.p_campaign_id, conv.c_campaign_id) as campaign_id,
    spend.p_campaign_name                             as campaign_name,
    spend.p_currency                                  as currency,
    coalesce(spend.p_spend_cents, 0)                  as spend_cents,
    coalesce(spend.p_impressions, 0)                  as impressions,
    coalesce(spend.p_clicks, 0)                       as clicks,
    coalesce(conv.c_trials, 0)                        as trials,
    coalesce(conv.c_purchases, 0)                     as purchases,
    coalesce(conv.c_revenue_cents, 0)                 as revenue_cents
  from spend
  full outer join conv
    on spend.p_platform = conv.c_platform
   and spend.p_campaign_id = conv.c_campaign_id;
$$;

revoke execute on function public.marketing_performance(date) from public;
revoke execute on function public.marketing_performance(date) from anon;
revoke execute on function public.marketing_performance(date) from authenticated;

-- Defense in depth. RLS with zero policies already denies these to anon and
-- authenticated, so this changes nothing today. It matters tomorrow: with the
-- SELECT grant still in place, adding a single permissive policy for some
-- unrelated reason would immediately expose click ids (personal data) and ad
-- spend (commercially sensitive) to the anon key.
--
-- service_role bypasses RLS and is unaffected, and it is the only intended
-- reader. bump_paywall_counter is SECURITY DEFINER and likewise unaffected.
--
-- NOTE: paywall_impressions (migration 20260813) has the same latent grant and
-- was deliberately left alone here, being outside this change.
revoke all on public.marketing_conversions from anon, authenticated;
revoke all on public.marketing_ad_spend    from anon, authenticated;
