-- Campaign results, by city.
--
-- Two things, both for the city_quiz split (bluecaster lib/lp-split-tests.ts),
-- which puts the framed city page up against the quiz for EVERY city with
-- paid traffic and has to be read per city:
--
-- 1. campaign_landing_key learns the public city page and the public spot
--    page. Since September the ads point at /fishing/<country>/<state>/<city>
--    (?ad=) and the page counts its hits under `city`, but a trial from it was
--    credited to NO landing key ('' → "Not a landing page"), because this
--    function only knew /lp and /explore paths. On the split row that read as
--    the city page never producing a trial. Only the PAID landing path is
--    tested for these shapes: rc_paid is written on a bought click alone, so
--    an organic reader who entered on a city page is not pulled into the
--    paid funnel through the entry-path fallback.
--
-- 2. campaign_summary_by_city: campaign_summary with the city as a column.
--    The counter has target_city; a conversion has only its paths, so the
--    city is read off the landing path (or the entry path) by
--    campaign_path_city. The two sides spell a city differently (the city
--    page says "seattle", the quiz says "seattle-wa") and the reader folds
--    them, so the join here is by the raw string and a city may appear as two
--    rows. Same grants as campaign_summary: service_role only.

create or replace function public.campaign_landing_key(
  p_landing_path text,
  p_entry_path text
)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when campaign_lp_key(p_landing_path) <> '' then campaign_lp_key(p_landing_path)
    when lower(coalesce(p_landing_path, '')) ~ '^/explore/spot/' then 'spot'
    when lower(coalesce(p_landing_path, '')) ~ '^/explore(/|$)'  then 'explore'
    -- /fishing/<country>/<state>/<city>/<spot>: the framed spot page. Not the
    -- species guides under the city, and not the /ad frame path itself.
    when lower(coalesce(p_landing_path, '')) ~ '^/fishing/[a-z]{2}/[a-z]{2}/[a-z0-9-]+/(?!(species|ad)(/|$))[a-z0-9-]+/?$' then 'spot'
    -- /fishing/<country>/<state>/<city>: the framed city page.
    when lower(coalesce(p_landing_path, '')) ~ '^/fishing/[a-z]{2}/[a-z]{2}/[a-z0-9-]+/?$' then 'city'
    else campaign_lp_key(p_entry_path)
  end;
$function$;

-- The city a landing path names, as the path spells it, or ''.
--
--   /fishing/us/wa/seattle          seattle       (the city page; a spot page
--   /fishing/us/wa/seattle/<spot>   seattle        names its city the same way)
--   /lp/q/seattle-wa                seattle-wa    (the quiz, full or bare slug)
--   /lp/5/seattle-wa                seattle-wa    (variant-first)
--   /lp/seattle/5                   seattle       (city-first)
--   /lp/seattle-wa                  seattle-wa    (the link builder's shape)
--   /lp/5, /lp/q, /explore          ''            (the city was in the query
--                                                  or nowhere)
create or replace function public.campaign_path_city(p_path text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select coalesce(
    (regexp_match(path, '^/fishing/[a-z]{2}/[a-z]{2}/([a-z0-9-]+)(/|$)'))[1],
    (regexp_match(path, '^/lp/q/([a-z0-9-]+)'))[1],
    (regexp_match(path, '^/lp/[0-9]{1,2}/([a-z0-9-]+)'))[1],
    (regexp_match(path, '^/lp/([a-z][a-z0-9-]*)/[0-9]{1,2}(/|$)'))[1],
    (regexp_match(path, '^/lp/(?!q(/|$))([a-z][a-z0-9-]*)/?$'))[2],
    ''
  )
  from (select lower(coalesce(p_path, '')) as path) p;
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
      campaign_landing_key(c.landing_path, c.entry_path)  as landing,
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

revoke all on function public.campaign_path_city(text) from public, anon, authenticated;
revoke all on function public.campaign_summary_by_city(date) from public, anon, authenticated;
grant execute on function public.campaign_path_city(text) to service_role;
grant execute on function public.campaign_summary_by_city(date) to service_role;
