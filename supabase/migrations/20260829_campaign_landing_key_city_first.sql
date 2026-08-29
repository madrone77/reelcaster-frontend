-- APPLIED TO PRODUCTION 2026-08-29 (pehcvwiwtubzfgahuzuz) via Supabase MCP.
--
-- The city-first landing pages counted their traffic and lost their trials.
--
-- Third time for the same class of mistake, and the first two are worth
-- naming because the shape repeats: a path parser that knows /lp/<n> and
-- nothing else. It cost the client counter every hit on /lp/seattle/1 (fixed
-- by the page naming itself), then the ingest route every one of those hits
-- again (fixed by widening LANDING_SHAPE), and now this function, which is
-- the CONVERSION side of the same vocabulary.
--
-- campaign_events_daily files a visit to /lp/seattle/1 under landing
-- 'lpseattle1', because that route names itself (src/app/lp/seattle/1/
-- lp-track.tsx) and the blends do the same (src/app/lp/_blend/). This
-- function mapped a conversion's landing_path back onto that vocabulary and
-- matched only '/lp/<digits>', so every trial taken from a city-first page
-- fell through to '' and sat in the report's "Not a landing page" block --
-- beside the very row that recorded its hits and its button press.
--
-- Both orders of the two segments now resolve:
--   /lp/7            → lp7          (the variant, no city)
--   /lp/7/seattle-wa → lp7          (variant first: the city is its own column)
--   /lp/seattle/1    → lpseattle1   (city first: the route names itself)
--   /lp/vancouver/3  → lpvancouver3
--
-- The city-first key is the city segment with punctuation stripped, then the
-- number, which is exactly how the four routes that exist today name
-- themselves. A future hyphenated city (/lp/port-alberni/2) would derive
-- 'lpportalberni2' here, so the page's own LANDING constant has to read the
-- same or the two halves split again. There is no way to enforce that from
-- Postgres; the report is where it would show, as a landing page with hits
-- and no trials next to one with trials and no hits.
--
-- Paths are lowercased first. Vercel's dynamic routes are case-insensitive,
-- so /LP/Seattle/1 serves the same page and files its hits under the same
-- constant, and only this side would have seen a different string.
--
-- Order still matters below: /explore/spot/<slug> is tested before /explore,
-- because a named piece of water and the whole roster are different ads. And
-- the /explore branches stay on the PAID landing path only, never on the
-- first-touch entry path, for the reason in
-- 20260824_campaign_landing_key_explore.sql: entry_path is where the
-- relationship started, and for most organic anglers that is /explore too.

-- The /lp half, on its own, so the landing path and the entry path cannot
-- drift apart the way the two copies of the shape test did.
create or replace function public.campaign_lp_key(p_path text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when parts is null then ''
    -- /lp/<n> and /lp/<n>/<city>: the variant is the number, and which city
    -- it served is a column of its own in the counter, not part of the key.
    when parts[1] ~ '^[0-9]{1,2}$' then 'lp' || parts[1]
    -- /lp/<city>/<n>: the city is part of the identity of the page.
    when parts[2] ~ '^[0-9]{1,2}$'
      then 'lp' || regexp_replace(parts[1], '[^a-z0-9]', '', 'g') || parts[2]
    else ''
  end
  from (
    select regexp_match(
      lower(coalesce(p_path, '')),
      '^/lp/([a-z0-9-]{1,24})(?:/([a-z0-9-]{1,24}))?'
    ) as parts
  ) m;
$function$;

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
    else campaign_lp_key(p_entry_path)
  end;
$function$;
