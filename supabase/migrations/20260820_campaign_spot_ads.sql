-- Ad-framed spot pages get their own axes in the campaign counter.
--
-- The destination for a paid click is no longer only /lp/<n>/<city>. It can be
-- the product's own spot page in an ad frame,
-- /explore/spot/<slug>?ad=<wall> (see src/app/explore/spot/[slug]/ad-mode.ts).
-- Two facts about such a click have nowhere to go in the existing key:
--
--   WHICH SPOT. `target_city` is as fine as the table gets, so every Seattle
--   spot would land in one row. "Which spot earned the click" is the first
--   question anyone will ask of a per-spot campaign, and a table that has
--   already folded the spots together cannot answer it afterwards.
--
--   WHICH WALL. The frame can be run with the paywall at today, at two days,
--   or open, chosen per ad set on the URL. That is the experiment. Without a
--   column the three variants are indistinguishable in the results, which
--   makes running them pointless.
--
-- Both are FORWARD-ONLY. Nothing can be recovered for rows already counted,
-- which is why this lands before any spend rather than after the first
-- interesting week.
--
-- Cardinality: `target_spot` is the widest column added here, one value per
-- advertised spot. It multiplies rows only for traffic that actually carries
-- it; every /lp row keeps an empty string and its key shape is unchanged.
--
-- Migration CI has been unauthorized for a while, so merging this file does
-- not apply it. Applied to the ReelCaster project via MCP alongside this
-- commit.

alter table public.campaign_events_daily
  add column if not exists target_spot text not null default '',
  add column if not exists wall        text not null default '';

comment on column public.campaign_events_daily.target_spot is
  'Spot slug for an ad-framed spot page. Empty on /lp landing pages.';
comment on column public.campaign_events_daily.wall is
  'Paywall position the ad frame was running: today, day2 or open. Empty on /lp landing pages.';

-- The key has to widen with them, or two spots sharing a city, a source and a
-- device would collide into one bucket and silently sum.
--
-- Safe on the existing rows: both columns default to the empty string, so
-- every row already counted keeps a unique key and nothing merges.
alter table public.campaign_events_daily
  drop constraint if exists campaign_events_daily_pkey;

alter table public.campaign_events_daily
  add primary key (
    day, landing, angle, target_city, target_spot, wall,
    utm_source, utm_medium, utm_campaign, click_type,
    geo_country, geo_region, geo_city,
    device, os, cta
  );

-- ── The writer ───────────────────────────────────────────────────────────
--
-- Dropped and recreated rather than replaced: `create or replace` cannot
-- change a signature, and creating the wider one alongside the old would make
-- a fifteen-argument call ambiguous rather than either function.
--
-- The two new parameters carry DEFAULTS so the currently deployed frontend,
-- which knows nothing about them, keeps counting through the deploy gap. The
-- rows it writes have empty strings in both, which is exactly what a landing
-- page means.
drop function if exists public.bump_campaign_counter(
  date, text, text, text, text, text, text, text, text, text, text, text, text, text, text
);

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
  p_kind         text,
  p_target_spot  text default '',
  p_wall         text default ''
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
    day, landing, angle, target_city, target_spot, wall,
    utm_source, utm_medium, utm_campaign, click_type,
    geo_country, geo_region, geo_city,
    device, os, cta,
    hits, cta_clicks
  )
  values (
    p_day, p_landing, coalesce(p_angle, ''), coalesce(p_target_city, ''),
    coalesce(p_target_spot, ''), coalesce(p_wall, ''),
    coalesce(p_utm_source, ''), coalesce(p_utm_medium, ''),
    coalesce(p_utm_campaign, ''), coalesce(p_click_type, ''),
    coalesce(p_geo_country, ''), coalesce(p_geo_region, ''),
    coalesce(p_geo_city, ''),
    coalesce(p_device, ''), coalesce(p_os, ''), coalesce(p_cta, ''),
    case when p_kind = 'hit' then 1 else 0 end,
    case when p_kind = 'cta_click' then 1 else 0 end
  )
  on conflict (
    day, landing, angle, target_city, target_spot, wall,
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
  date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

-- ── Conversions have to land on the same row ─────────────────────────────
--
-- Counters know their own landing key; a conversion only has the paths it was
-- carrying. An ad-framed spot page's path is the product's own
-- /explore/spot/<slug>, so without this every trial it earns would report
-- under "Not a landing page" while its hits and clicks sat in the spot row,
-- and the page would show a landing page that nobody ever converted on.
--
-- Only the PAID landing path is read for this, never the first-touch entry
-- path. `capturePaidTouch` writes that cookie only on a visit carrying utm
-- tags or a click id, so a spot path in it means an ad brought them. The entry
-- path carries no such guarantee: mapping it would file every organic visitor
-- who ever read a spot page under the ad, which would credit the campaign with
-- sales it did not make.
create or replace function public.campaign_landing_key(p_landing_path text, p_entry_path text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_landing_path, '') ~ '^/lp/[0-9]{1,2}(/|$)'
      then 'lp' || (regexp_match(p_landing_path, '^/lp/([0-9]{1,2})'))[1]
    when coalesce(p_landing_path, '') ~ '^/explore/spot/'
      then 'spot'
    when coalesce(p_entry_path, '') ~ '^/lp/[0-9]{1,2}(/|$)'
      then 'lp' || (regexp_match(p_entry_path, '^/lp/([0-9]{1,2})'))[1]
    else ''
  end;
$$;

-- ── The drill-down gains the two axes ────────────────────────────────────
--
-- Spot and wall are counter-side only. Conversions carry neither: Stripe knows
-- which button was pressed no better than it knows which spot was advertised.
-- They return zero in these two panels, the same treatment the cta panel
-- already gets, and the wall's conversion side is answerable from
-- user_settings.attr_trial_from, which stores it as `spot-ad-<wall>`.
--
-- Both panels are empty for a /lp landing, since every /lp row carries an
-- empty string in both columns and blank values are dropped rather than
-- grouped under one "unknown" bar.
create or replace function public.campaign_breakdown(
  since_date date,
  p_landing  text,
  p_source   text,
  p_campaign text default null
)
returns table (
  dimension  text,
  value      text,
  hits       bigint,
  cta_clicks bigint,
  trials     bigint,
  purchases  bigint
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
    -- Hit rows carry no button, so they are excluded here rather than filed
    -- under a blank one. This panel answers "which button", and the hits it
    -- would otherwise swallow are already the denominator on every other panel.
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
