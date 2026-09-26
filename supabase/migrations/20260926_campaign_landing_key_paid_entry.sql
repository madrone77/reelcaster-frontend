-- APPLIED TO PRODUCTION 2026-09-26 (pehcvwiwtubzfgahuzuz) via Supabase MCP.
--
-- A bought click's trial with no landing path counted under no landing page.
--
-- 20260926_campaign_summary_by_city.sql taught campaign_landing_key the framed
-- city page and spot page, but tested those shapes on the PAID landing path
-- only, so an organic reader whose first page was a city page would not be
-- pulled into the paid funnel through the entry-path fallback. That kept out
-- more than organic readers. A conversion attributed by FIRST touch carries
-- the bought click's utm_source, click id and campaign, and its entry_path,
-- but no landing_path: rc_paid was never written or had lapsed by the time
-- the trial began. Five paid conversions on 24 to 26 Sep read that way
-- (rows 1758, 1795, 1821, 1852, 1864: four on /fishing/us/wa/seattle, one on
-- /fishing/us/wa/tacoma), and every one keyed to '' and sat in "Not a landing
-- page" beside the very row that counted its click. On the city_quiz split
-- that read as the city page never producing a trial.
--
-- The rule stands, with the gate it always meant: the entry path may name a
-- city or spot page only for a conversion that was BOUGHT. The three RPCs
-- that key conversions know the source (campaign_source_label of the row's
-- utm_source and click id), so they pass it, and a three-argument
-- campaign_landing_key applies the city and spot shapes to the entry path
-- when the source is anything but 'untagged'. The two-argument function is
-- unchanged, so every other caller keeps the paid-landing-only reading.
--
-- /explore stays on the landing path alone in both forms, for the reason in
-- 20260824_campaign_landing_key_explore.sql: for most anglers, bought or not,
-- /explore is where the relationship started.

create or replace function public.campaign_landing_key(
  p_landing_path text,
  p_entry_path text,
  p_source text
)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when campaign_landing_key(p_landing_path, p_entry_path) <> ''
      then campaign_landing_key(p_landing_path, p_entry_path)
    -- An organic conversion's entry path is not a paid landing.
    when coalesce(p_source, 'untagged') = 'untagged' then ''
    when lower(coalesce(p_entry_path, '')) ~ '^/fishing/[a-z]{2}/[a-z]{2}/[a-z0-9-]+/(?!(species|ad)(/|$))[a-z0-9-]+/?$' then 'spot'
    when lower(coalesce(p_entry_path, '')) ~ '^/fishing/[a-z]{2}/[a-z]{2}/[a-z0-9-]+/?$' then 'city'
    else ''
  end;
$function$;

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
      campaign_landing_key(c.landing_path, c.entry_path, campaign_source_label(c.utm_source, c.click_type)) as landing,
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

create or replace function public.campaign_summary_by_city(since_date date)
returns table(
  landing text,
  source text,
  campaign text,
  city text,
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
      e.target_city                                     as city,
      sum(e.hits)                                       as hits,
      sum(e.cta_clicks)                                 as cta_clicks
    from campaign_events_daily e
    where e.day >= since_date
    group by 1, 2, 3, 4
  ),
  cv as (
    select
      campaign_landing_key(c.landing_path, c.entry_path, campaign_source_label(c.utm_source, c.click_type)) as landing,
      campaign_source_label(c.utm_source, c.click_type)   as source,
      coalesce(c.utm_campaign, '')                        as campaign,
      coalesce(nullif(campaign_path_city(c.landing_path), ''), campaign_path_city(c.entry_path)) as city,
      count(*) filter (where c.event_type = 'paywall_view') as paywall_views,
      count(*) filter (where c.event_type = 'trial_start') as trials,
      count(*) filter (where c.event_type = 'purchase')    as purchases,
      coalesce(sum(c.value_cents) filter (where c.event_type = 'purchase'), 0) as revenue_cents
    from marketing_conversions c
    where c.occurred_at >= (since_date::timestamp at time zone 'America/Los_Angeles')
      and c.event_type <> 'signup'
    group by 1, 2, 3, 4
  )
  select
    coalesce(ev.landing, cv.landing)   as landing,
    coalesce(ev.source, cv.source)     as source,
    coalesce(ev.campaign, cv.campaign) as campaign,
    coalesce(ev.city, cv.city)         as city,
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
   and ev.city = cv.city
  order by coalesce(ev.hits, 0) desc, coalesce(cv.purchases, 0) desc;
$function$;

create or replace function public.campaign_breakdown(
  since_date date,
  p_landing text,
  p_source text,
  p_campaign text default null
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
      and campaign_landing_key(c.landing_path, c.entry_path, campaign_source_label(c.utm_source, c.click_type)) = p_landing
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

revoke all on function public.campaign_landing_key(text, text, text) from public, anon, authenticated;
grant execute on function public.campaign_landing_key(text, text, text) to service_role;
