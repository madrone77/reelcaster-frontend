-- Was the reader signed in when they asked for this page?
--
-- WHAT THIS ANSWERS. traffic_events_daily has counted every page request since
-- 20260828 without ever saying whether the request came from somebody with an
-- account. On a spot page that is the difference between the two populations
-- the page exists to serve: a search reader who has never signed in, and a
-- member coming back to check a mark. They read the same URL and until now
-- they were the same number.
--
-- WHY A TEXT COLUMN AND NOT A BOOLEAN. Three states, not two. Every row
-- written before this migration was counted by middleware that could not ask
-- the question, and a boolean would have to answer for them anyway: `false`
-- would silently file two weeks of members as signed out, and `null` cannot
-- sit in a primary key, because null <> null defeats the upsert's ON CONFLICT
-- and every view would insert a new row. Empty string is the same "not
-- recorded" convention geo_country, device and os already use here.
--
--   'in'  — the browser carried our signed-in marker.
--   'out' — it did not.
--   ''    — nothing asked. Rows before this migration, and any request served
--           by the previous middleware bundle during the deploy.
--
-- HOW THE EDGE KNOWS. It reads a cookie, `rc_auth`, mirrored from the auth
-- session by the client (src/lib/auth-cookie.ts). It cannot read the session
-- itself: supabase-js keeps it in localStorage, which middleware never sees.
-- The cookie carries no identity, only 1 or 0, so this stays a counter table
-- with nothing in it to leak — same trade as the day-grain rollup itself.
--
-- Migration CI has been unauthorized for a while, so merging this file does
-- not apply it. Applied to the ReelCaster project via MCP alongside this commit.

alter table public.traffic_events_daily
  add column if not exists auth_state text not null default '';

comment on column public.traffic_events_daily.auth_state is
  '''in'' | ''out'' | '''' (not recorded). Read at the edge from the rc_auth cookie, which the client mirrors from the auth session. Empty for every row before 2026-09-09.';

-- The key has to grow with it, or a signed-in and a signed-out view of the
-- same page on the same day collapse into one bucket and the split is lost on
-- the way in.
alter table public.traffic_events_daily
  drop constraint traffic_events_daily_pkey;

alter table public.traffic_events_daily
  add constraint traffic_events_daily_pkey primary key (
    day, page_kind, page_slug, source_kind, referrer_host,
    geo_country, geo_region, device, os, auth_state
  );

/**
 * Add one view to a bucket, now with the reader's auth state in the key.
 *
 * REPLACED RATHER THAN OVERLOADED, and the default on the new parameter is
 * what makes that safe. The old nine-argument function is dropped, so a
 * request still being served by the previous middleware bundle mid-deploy
 * sends nine named parameters, resolves to this one, and its view lands under
 * auth_state '' — counted, and honestly marked as not asked. Keeping both
 * functions would have made a nine-argument call ambiguous and errored on
 * every such request instead.
 */
drop function if exists public.bump_traffic_counter(
  date, text, text, text, text, text, text, text, text
);

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
    -- fourth bucket nobody reads.
    case when p_auth_state in ('in', 'out') then p_auth_state else '' end,
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
