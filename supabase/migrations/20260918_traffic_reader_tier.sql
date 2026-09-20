-- The reader's tier on a page view: free or paying, not only signed in.
--
-- 20260909_traffic_auth_state.sql taught traffic_events_daily whether the
-- request came from a signed-in browser. The Analytics Overview now asks the
-- next question — of the readers on the map, how many are paying — and the
-- cookie the client mirrors (src/lib/auth-cookie.ts) carries it from this
-- change on. This migration lets the counter keep the answer instead of
-- folding it to '' as an unrecognised value.
--
--   'in'   — signed in, tier not carried. Every row from 20260909 until the
--            frontend started writing the tier, and any view the session
--            resolved on before the settings row landed.
--   'free' — signed in on a free account.
--   'pro'  — signed in on a trial or a paid plan.
--   'out'  — no signed-in marker.
--   ''     — nothing asked. Rows before 20260909.
--
-- No column change: auth_state is text and in the primary key already. Only
-- the function's fold changes, so the old 'in' rows and the new tiered rows
-- sit in the same table and any read of "signed in" is 'in' OR 'free' OR 'pro'.
--
-- Migration CI is unauthorized, so merging this file does not apply it.
-- Applied to the ReelCaster project via MCP alongside this commit.

create or replace function public.bump_traffic_counter(
  p_day           date,
  p_page_kind     text,
  p_page_slug     text,
  p_source_kind   text,
  p_referrer_host text,
  p_geo_country   text,
  p_geo_region    text,
  p_device        text,
  p_os            text,
  p_auth_state    text default ''
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.traffic_events_daily as t (
    day, page_kind, page_slug, source_kind, referrer_host,
    geo_country, geo_region, device, os, auth_state, views
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
    -- Anything the edge does not recognise is "not recorded" rather than a
    -- bucket nobody reads.
    case when p_auth_state in ('in', 'out', 'free', 'pro') then p_auth_state else '' end,
    1
  )
  on conflict (
    day, page_kind, page_slug, source_kind, referrer_host,
    geo_country, geo_region, device, os, auth_state
  )
  do update set
    views = t.views + 1,
    updated_at = now();
end;
$function$;

revoke all on function public.bump_traffic_counter(
  date, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
