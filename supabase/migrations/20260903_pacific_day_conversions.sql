-- Conversion windows start and end on the Pacific day, the same day the hit
-- counters already stamp.
--
-- THE BUG. campaign_summary and its siblings take a `date` and compared it to
-- marketing_conversions.occurred_at, a timestamptz, with a bare cast. The
-- database runs in UTC, so '2026-09-03'::timestamptz is midnight UTC, which is
-- 5pm Pacific on the 2nd. The hits half of the same functions filters
-- campaign_events_daily.day, which the frontend stamps in Pacific time (see
-- src/lib/pacific-day.ts). So on the Paid campaigns page, "Today" meant
-- Pacific midnight for hits and presses and 5pm yesterday for trials, offer
-- seen and purchases. Two trials that started on the evening of Sep 2 Pacific
-- read as Sep 3 on that page and as Sep 2 on every other admin page.
--
-- THE FIX. A date bound becomes Pacific midnight of that date before it is
-- compared. `since_date::timestamp at time zone 'America/Los_Angeles'` is a
-- timestamptz, so the comparison stays a plain range on occurred_at. An
-- inclusive upper bound on a day (`<= mature_before`) becomes "before Pacific
-- midnight of the day after". paywall_funnel already bucketed this way, with
-- the `(occurred_at at time zone ...)::date` form; it is the precedent and is
-- not touched here.
--
-- Five functions change: campaign_summary, campaign_breakdown,
-- marketing_performance, paywall_views_daily and split_test_conversions. No
-- signature or return type changes, so CREATE OR REPLACE keeps each one's
-- grants. They are restated at the end regardless.

create or replace function public.campaign_summary(since_date date)
returns table(
  landing text,
  source text,
  campaign text,
  hits bigint,
  cta_clicks bigint,
  paywall_views bigint,
  trials bigint,
  purchases bigint,
  revenue_cents bigint
)
language sql
stable security definer
set search_path to 'public'
as $function$
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
      count(*) filter (where c.event_type = 'paywall_view') as paywall_views,
      count(*) filter (where c.event_type = 'trial_start') as trials,
      count(*) filter (where c.event_type = 'purchase')    as purchases,
      coalesce(sum(c.value_cents) filter (where c.event_type = 'purchase'), 0) as revenue_cents
    from marketing_conversions c
    -- Pacific midnight of since_date, matching campaign_events_daily.day.
    where c.occurred_at >= (since_date::timestamp at time zone 'America/Los_Angeles')
      -- Signups are counted in marketing_performance, not here.
      and c.event_type <> 'signup'
    group by 1, 2, 3
  )
  select
    coalesce(ev.landing, cv.landing)   as landing,
    coalesce(ev.source, cv.source)     as source,
    coalesce(ev.campaign, cv.campaign) as campaign,
    coalesce(ev.hits, 0)               as hits,
    coalesce(ev.cta_clicks, 0)         as cta_clicks,
    coalesce(cv.paywall_views, 0)      as paywall_views,
    coalesce(cv.trials, 0)             as trials,
    coalesce(cv.purchases, 0)          as purchases,
    coalesce(cv.revenue_cents, 0)      as revenue_cents
  from ev
  full outer join cv
    on ev.landing = cv.landing
   and ev.source = cv.source
   and ev.campaign = cv.campaign
  order by coalesce(ev.hits, 0) desc, coalesce(cv.purchases, 0) desc;
$function$;

create or replace function public.campaign_breakdown(
  since_date date, p_landing text, p_source text, p_campaign text default null
)
returns table(
  dimension text,
  value text,
  hits bigint,
  cta_clicks bigint,
  trials bigint,
  purchases bigint
)
language sql
stable security definer
set search_path to 'public'
as $function$
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
    -- Pacific midnight of since_date, matching campaign_events_daily.day.
    where c.occurred_at >= (since_date::timestamp at time zone 'America/Los_Angeles')
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
$function$;

-- The click cohort. `since_date` and `mature_before` are Pacific days computed
-- by the caller (ptToday minus N), and marketing_ad_spend.day is the
-- advertiser's local day, so the conversion side has to read the same clock.
create or replace function public.marketing_performance(since_date date, mature_before date)
returns table(
  platform text,
  campaign_id text,
  campaign_name text,
  currency text,
  spend_cents bigint,
  mature_spend_cents bigint,
  impressions bigint,
  clicks bigint,
  paywall_views bigint,
  signups bigint,
  trials bigint,
  purchases bigint,
  revenue_cents bigint,
  mature_paywall_views bigint,
  mature_signups bigint,
  mature_trials bigint,
  mature_purchases bigint,
  mature_revenue_cents bigint,
  unknown_click_date bigint
)
language sql
stable security definer
set search_path to 'public'
as $function$
  with bounds as (
    select
      (since_date::timestamp at time zone 'America/Los_Angeles')            as since_ts,
      ((mature_before + 1)::timestamp at time zone 'America/Los_Angeles')   as mature_end_ts
  ),
  spend as (
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
      count(*) filter (where mc.event_type = 'paywall_view')::bigint as c_paywall_views,
      count(*) filter (where mc.event_type = 'signup')::bigint      as c_signups,
      count(*) filter (where mc.event_type = 'trial_start')::bigint as c_trials,
      count(*) filter (where mc.event_type = 'purchase')::bigint    as c_purchases,
      coalesce(sum(mc.value_cents) filter (where mc.event_type = 'purchase'), 0)::bigint
                                                                    as c_revenue_cents,
      count(*) filter (
        where mc.event_type = 'paywall_view'
          and coalesce(mc.click_at, mc.occurred_at) < b.mature_end_ts
      )::bigint as c_mature_paywall_views,
      count(*) filter (
        where mc.event_type = 'signup'
          and coalesce(mc.click_at, mc.occurred_at) < b.mature_end_ts
      )::bigint as c_mature_signups,
      count(*) filter (
        where mc.event_type = 'trial_start'
          and coalesce(mc.click_at, mc.occurred_at) < b.mature_end_ts
      )::bigint as c_mature_trials,
      count(*) filter (
        where mc.event_type = 'purchase'
          and coalesce(mc.click_at, mc.occurred_at) < b.mature_end_ts
      )::bigint as c_mature_purchases,
      coalesce(sum(mc.value_cents) filter (
        where mc.event_type = 'purchase'
          and coalesce(mc.click_at, mc.occurred_at) < b.mature_end_ts
      ), 0)::bigint as c_mature_revenue_cents,
      count(*) filter (
        where mc.click_at is null
          and mc.event_type in ('trial_start', 'purchase')
      )::bigint as c_unknown_click_date
    from marketing_conversions mc
    cross join bounds b
    where coalesce(mc.click_at, mc.occurred_at) >= b.since_ts
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
    coalesce(conv.c_paywall_views, 0)                 as paywall_views,
    coalesce(conv.c_signups, 0)                       as signups,
    coalesce(conv.c_trials, 0)                        as trials,
    coalesce(conv.c_purchases, 0)                     as purchases,
    coalesce(conv.c_revenue_cents, 0)                 as revenue_cents,
    coalesce(conv.c_mature_paywall_views, 0)          as mature_paywall_views,
    coalesce(conv.c_mature_signups, 0)                as mature_signups,
    coalesce(conv.c_mature_trials, 0)                 as mature_trials,
    coalesce(conv.c_mature_purchases, 0)              as mature_purchases,
    coalesce(conv.c_mature_revenue_cents, 0)          as mature_revenue_cents,
    coalesce(conv.c_unknown_click_date, 0)            as unknown_click_date
  from spend
  full outer join conv
    on spend.p_platform = conv.c_platform
   and spend.p_campaign_id = conv.c_campaign_id;
$function$;

-- Already grouped by the Pacific day; only the lower bound was UTC, which let
-- the last seven hours of the day before since_date through as a partial day.
create or replace function public.paywall_views_daily(since_date date)
returns table(
  day text,
  geo_country text,
  geo_region text,
  device text,
  os text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  click_type text,
  entry_path text,
  paywall_feature text,
  views bigint
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    to_char(c.occurred_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD') as day,
    c.geo_country,
    c.geo_region,
    c.device,
    c.os,
    c.utm_source,
    c.utm_medium,
    c.utm_campaign,
    c.click_type,
    c.entry_path,
    c.paywall_feature,
    count(*)::bigint as views
  from marketing_conversions c
  where c.event_type = 'paywall_view'
    and c.occurred_at >= (since_date::timestamp at time zone 'America/Los_Angeles')
  group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
  order by 1 desc;
$function$;

-- The exposure counter it is compared against (split_test_events_daily.day) is
-- stamped with pacificDay().
create or replace function public.split_test_conversions(p_since date)
returns table(
  test_key text,
  variant text,
  currency text,
  event_type text,
  conversions bigint,
  value_cents bigint
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    s.key,
    s.value,
    coalesce(mc.currency, ''),
    mc.event_type,
    count(*)::bigint,
    coalesce(sum(mc.value_cents), 0)::bigint
  from public.marketing_conversions mc
  cross join lateral jsonb_each_text(mc.split_tests) as s(key, value)
  where mc.occurred_at >= (p_since::timestamp at time zone 'America/Los_Angeles')
  group by s.key, s.value, coalesce(mc.currency, ''), mc.event_type
$function$;

-- Grants.
--
-- All of these are SECURITY DEFINER over the whole of marketing_conversions
-- and are read only by the bluecaster admin, through the service role. CREATE
-- OR REPLACE keeps an existing ACL, but the intended one is written down here
-- so a later DROP cannot lose it quietly (see 20260901_paywall_view_conversion
-- for why that matters: this project's default privileges hand EXECUTE to anon
-- and authenticated on every new function).
--
-- Two of these had exactly that leak from the day they were created:
-- split_test_conversions and paywall_funnel were executable by public, anon and
-- authenticated. Neither has a caller outside the service role, in this repo or
-- in bluecaster, so both are closed here. paywall_funnel's body is otherwise
-- untouched.
revoke execute on function public.campaign_summary(date) from public, anon, authenticated;
revoke execute on function public.campaign_breakdown(date, text, text, text) from public, anon, authenticated;
revoke execute on function public.marketing_performance(date, date) from public, anon, authenticated;
revoke execute on function public.paywall_views_daily(date) from public, anon, authenticated;
revoke execute on function public.split_test_conversions(date) from public, anon, authenticated;
revoke execute on function public.paywall_funnel(date, date, text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.campaign_summary(date) to service_role;
grant execute on function public.campaign_breakdown(date, text, text, text) to service_role;
grant execute on function public.marketing_performance(date, date) to service_role;
grant execute on function public.paywall_views_daily(date) to service_role;
grant execute on function public.split_test_conversions(date) to service_role;
grant execute on function public.paywall_funnel(date, date, text, text, text, text, text) to service_role;
