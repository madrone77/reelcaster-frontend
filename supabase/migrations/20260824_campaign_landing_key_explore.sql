-- APPLIED TO PRODUCTION 2026-08-24 (pehcvwiwtubzfgahuzuz) via Supabase MCP.
--
-- The ad-framed Explore map was countable but not attributable.
--
-- campaign_events_daily files a visit to /explore?ad=<wall> under landing
-- 'explore' (see LANDING_SHAPE in src/app/api/attribution/campaign/route.ts).
-- This function, which maps a CONVERSION back onto the same vocabulary, had no
-- /explore branch, so every sale that landed there fell through to '' and
-- appeared in the report under "Not a landing page" instead of joining its own
-- hits.
--
-- The effect was worst on exactly the traffic the report exists to measure:
-- the only fully tagged paid trial taken so far, an Instagram click that
-- landed on /explore, sat in the unattributed block.
--
-- Order matters. /explore/spot/<slug> is tested first and stays 'spot',
-- because a named piece of water and the whole roster are different ads and
-- separating them is the top line of the report.
--
-- The /explore branch is deliberately on the PAID landing path only, never on
-- the first-touch entry path. landing_path comes from rc_paid and exists only
-- when a click was bought. entry_path is where the relationship started, and
-- for most organic anglers that is /explore too. Adding it to the fallback
-- would file the whole organic base under "Explore map, ad frame".
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
    when coalesce(p_landing_path, '') ~ '^/lp/[0-9]{1,2}(/|$)'
      then 'lp' || (regexp_match(p_landing_path, '^/lp/([0-9]{1,2})'))[1]
    when coalesce(p_landing_path, '') ~ '^/explore/spot/'
      then 'spot'
    when coalesce(p_landing_path, '') ~ '^/explore(/|$)'
      then 'explore'
    when coalesce(p_entry_path, '') ~ '^/lp/[0-9]{1,2}(/|$)'
      then 'lp' || (regexp_match(p_entry_path, '^/lp/([0-9]{1,2})'))[1]
    else ''
  end;
$function$;
