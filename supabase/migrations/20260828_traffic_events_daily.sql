-- Where the traffic we did NOT buy comes from, and what it lands on.
--
-- What existed before this. Paid traffic has had a denominator since
-- 20260820_campaign_telemetry: campaign_events_daily counts a hit on every
-- ad-framed page. Organic traffic has had nothing. The ingest route behind that
-- table validates `landing` against /^(lp[0-9]{1,2}|spot|explore)$/, so a visit
-- to the home page, a city page, a species guide or a licence guide is rejected
-- and counted nowhere. The consequence shows up the moment anyone asks an
-- ordinary question: 6 of the 14 attributed accounts entered at `/`, 5 of them
-- with no referrer at all, and there was no way to tell whether that was 5
-- people out of 50 or 5 out of 5000.
--
-- WHY THIS IS A SECOND TABLE AND NOT MORE COLUMNS ON campaign_events_daily.
-- That table's primary key is built around a campaign: landing key, angle,
-- target city, four UTM fields. Its top-level question is which KIND of bought
-- page works. This one's key is built around a page and a source, and its
-- question is who arrives without being paid for. Folding them together would
-- make every city page look like a landing page in a report whose whole point
-- is the difference.
--
-- COUNTED ON THE SERVER, WHICH IS THE POINT. The existing counter is a
-- client-side beacon, so an ad-blocked or no-JavaScript reader is invisible to
-- it. That population is not evenly spread: it is heavily concentrated in
-- exactly the organic search audience this table exists to measure, and
-- building the organic denominator on the instrumentation that cannot see them
-- would have been self-defeating. This one is written from middleware, off the
-- request, the same move 20260824's server-side attribution made for the
-- cookies.
--
-- The cost of that choice is bots. A JavaScript beacon gets crawler filtering
-- for free because crawlers do not run scripts; middleware does not. Two guards
-- stand in: the self-declaring ones are dropped by isBotUserAgent, and the
-- counter requires `sec-fetch-dest: document`, which real browsers always send
-- on a navigation and most crawlers send not at all. Undeclared headless
-- traffic still gets through, which is why the admin says "views" and never
-- "people".
--
-- COUNTERS, NOT AN EVENT LOG. No visitor id, no user id, no IP, no timestamp
-- finer than the day. Same trade as paywall_impressions and
-- campaign_events_daily: nothing in it to leak, nothing to purge, no retention
-- policy to write. Unique visitors cannot be derived from this table and are
-- not meant to be.
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

create table if not exists public.traffic_events_daily (
  day             date not null,

  -- What KIND of page. See PageKind in src/lib/traffic-source.ts. Signed-in
  -- surfaces are not in the vocabulary at all: a dashboard reload is not an
  -- arrival, and counting them would let a handful of daily-active users
  -- out-vote every search reader in the table.
  page_kind       text not null,

  -- What distinguishes this page from others of its kind: "wa/seattle-wa",
  -- "point-robinson-e2e269", "6/seattle-wa". Empty for the pages there is only
  -- one of. NOT the full path -- the prefix is already carried by page_kind and
  -- storing it twice only widens the key.
  page_slug       text not null default '',

  -- How they got here: search | ai | social | referral | paid | internal |
  -- direct. See SourceKind in src/lib/traffic-source.ts.
  --
  -- `paid` is decided from the same parameters the rc_paid cookie uses, so a
  -- view counted as paid here and a signup credited as paid in user_settings
  -- cannot disagree. It also means the organic report is a filter on this
  -- column rather than a separate pipeline, and the two can never double count.
  --
  -- `internal` is a hard reload or a middle-click on one of our own links.
  -- Client-side navigation never reaches middleware, but those do, carrying our
  -- own host as the referrer. Without this bucket they would land in `direct`
  -- and make the largest number in the report mean "somebody pressed reload".
  source_kind     text not null,

  -- The referring host, collapsed through the alias list so l.facebook.com and
  -- lm.facebook.com are one channel. Empty for direct and internal.
  referrer_host   text not null default '',

  geo_country     text not null default '',
  geo_region      text not null default '',

  -- From the User-Agent, parsed server-side. See src/lib/device.ts.
  device          text not null default '',
  os              text not null default '',

  views           bigint not null default 0,

  first_seen_at   timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  primary key (
    day, page_kind, page_slug, source_kind, referrer_host,
    geo_country, geo_region, device, os
  )
);

comment on table public.traffic_events_daily is
  'Daily counters of page views by page, source, location and device, written server-side from middleware. No visitor id and no event log: counting is the whole job. Organic is source_kind <> ''paid'' and <> ''internal''.';
comment on column public.traffic_events_daily.source_kind is
  'search | ai | social | referral | paid | internal | direct. Organic reports exclude paid and internal.';
comment on column public.traffic_events_daily.page_slug is
  'The identifying tail only, not the full path; the prefix is page_kind.';

-- geo_city is deliberately absent. campaign_events_daily carries it and its own
-- comment already names it as the first column to drop if that table goes wide.
-- This one counts every page rather than a handful of landing pages, so it
-- starts where the other one would end up.

-- Every reader is a dashboard scanning a recent window.
create index if not exists traffic_events_daily_day_idx
  on public.traffic_events_daily (day desc);

-- The organic report groups by page within a window, and the paid rows are the
-- majority of what it has to skip to get there.
create index if not exists traffic_events_daily_day_kind_idx
  on public.traffic_events_daily (day desc, source_kind, page_kind);

alter table public.traffic_events_daily enable row level security;
-- No policies, matching campaign_events_daily and paywall_impressions: the
-- service role bypasses RLS and is the only intended reader or writer.

/**
 * Add one view to a bucket, creating it if this is the first of its kind today.
 *
 * security definer for the same reason bump_campaign_counter is: the function
 * is the only supported way in, and it is what guarantees every writer agrees
 * on the shape of a key.
 */
create or replace function public.bump_traffic_counter(
  p_day           date,
  p_page_kind     text,
  p_page_slug     text,
  p_source_kind   text,
  p_referrer_host text,
  p_geo_country   text,
  p_geo_region    text,
  p_device        text,
  p_os            text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.traffic_events_daily as t (
    day, page_kind, page_slug, source_kind, referrer_host,
    geo_country, geo_region, device, os, views
  )
  values (
    p_day,
    coalesce(p_page_kind, ''),
    coalesce(p_page_slug, ''),
    coalesce(p_source_kind, ''),
    coalesce(p_referrer_host, ''),
    coalesce(p_geo_country, ''),
    coalesce(p_geo_region, ''),
    coalesce(p_device, ''),
    coalesce(p_os, ''),
    1
  )
  on conflict (
    day, page_kind, page_slug, source_kind, referrer_host,
    geo_country, geo_region, device, os
  )
  do update set
    views = t.views + 1,
    updated_at = now();
end;
$function$;

revoke all on function public.bump_traffic_counter(
  date, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

/**
 * The organic report, in one call: views by page and source over a window.
 *
 * Paid and internal are excluded here rather than in the caller, so every
 * reader of "organic" agrees on what the word means. A page with views and no
 * signups is the row most worth seeing, so this is a plain aggregate and the
 * admin joins signups onto it by entry path.
 */
create or replace function public.traffic_summary(since_date date)
returns table (
  page_kind     text,
  page_slug     text,
  source_kind   text,
  referrer_host text,
  views         bigint
)
language sql
stable
set search_path to 'public'
as $function$
  select
    t.page_kind,
    t.page_slug,
    t.source_kind,
    t.referrer_host,
    sum(t.views)::bigint as views
  from public.traffic_events_daily t
  where t.day >= since_date
    and t.source_kind not in ('paid', 'internal')
  group by t.page_kind, t.page_slug, t.source_kind, t.referrer_host
  order by views desc;
$function$;
