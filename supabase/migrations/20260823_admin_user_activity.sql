-- When was this angler last actually here, and what did they last do?
--
-- The admin roster has always shown `last_sign_in_at`, which is not the
-- question. It is the last time someone typed a password: an account that
-- signed in once in May and has read the forecast every morning since reads
-- as five months dormant. `auth.sessions` knows better -- the row is touched
-- every time the refresh token rotates, so its timestamp tracks USE.
--
-- That table lives in the `auth` schema, which PostgREST does not expose, so
-- this is the seam: one SECURITY DEFINER function, read-only, service_role
-- only, in the same shape as `campaign_summary` and `marketing_performance`.
-- BlueCaster admin calls it through lib/reelcaster-user-activity.ts.
--
-- Two different answers come back together, because support needs both and
-- they disagree in a way that is itself the signal:
--   * last_seen_at  -- were they here at all
--   * last_*_at     -- did they DO anything while here
-- A Pro who is seen daily and has done nothing in six weeks is a churn risk;
-- one who was last seen in June is already gone.
--
-- No IP. `auth.sessions.ip` is deliberately not returned: the roster's
-- Location column is fed by the coarse edge geo stamped at signup, and a
-- per-session IP trail is a different, more invasive thing than this page
-- needs to answer a support ticket.

create or replace function public.admin_user_activity(p_user_ids uuid[] default null)
returns table (
  user_id uuid,
  -- Newest touch on any live session. Null when every session has expired or
  -- been signed out, which is NOT "never here" -- the caller falls back to
  -- last_sign_in_at and says which it used.
  last_seen_at timestamptz,
  -- Live sessions, i.e. roughly how many devices they are signed in on.
  session_count int,
  -- User agent of the most recently touched session, so "the map is blank"
  -- can be read against the browser it was blank in.
  last_user_agent text,
  last_catch_at timestamptz,
  -- Newest across BOTH saved-spot tables. `user_favorite_spots` is what the
  -- product writes today; `favorite_spots` is the older store, dead since
  -- April but not empty, and an account whose only saved spot predates the
  -- cutover still saved a spot.
  last_saved_at timestamptz,
  last_alert_at timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  with ids as (
    select u.id
    from auth.users u
    where p_user_ids is null or u.id = any(p_user_ids)
  ),
  -- GREATEST ignores nulls in Postgres, so a session that has never been
  -- refreshed still reports its created_at rather than collapsing to null.
  touched as (
    select
      s.user_id,
      s.user_agent,
      greatest(s.updated_at, s.created_at, (s.refreshed_at at time zone 'utc')) as at
    from auth.sessions s
    where p_user_ids is null or s.user_id = any(p_user_ids)
  ),
  sess as (
    select t.user_id, max(t.at) as at, count(*)::int as n
    from touched t
    group by t.user_id
  ),
  agent as (
    select distinct on (t.user_id) t.user_id, t.user_agent
    from touched t
    order by t.user_id, t.at desc nulls last
  ),
  catches as (
    select c.user_id, max(c.created_at) as at
    from public.catch_logs c
    where p_user_ids is null or c.user_id = any(p_user_ids)
    group by c.user_id
  ),
  -- created_at only, never updated_at: the admin support actions on this very
  -- page toggle alerts and re-save settings, and those writes bump updated_at.
  -- Counting them would make our own support work read back as the angler's.
  saved as (
    select v.user_id, max(v.at) as at
    from (
      select f.user_id, f.created_at as at
      from public.user_favorite_spots f
      where p_user_ids is null or f.user_id = any(p_user_ids)
      union all
      select f.user_id, f.created_at
      from public.favorite_spots f
      where p_user_ids is null or f.user_id = any(p_user_ids)
    ) v
    group by v.user_id
  ),
  alerts as (
    select a.user_id, max(a.created_at) as at
    from public.user_alert_profiles a
    where p_user_ids is null or a.user_id = any(p_user_ids)
    group by a.user_id
  )
  select
    ids.id,
    sess.at,
    coalesce(sess.n, 0),
    agent.user_agent,
    catches.at,
    saved.at,
    alerts.at
  from ids
  left join sess    on sess.user_id    = ids.id
  left join agent   on agent.user_id   = ids.id
  left join catches on catches.user_id = ids.id
  left join saved   on saved.user_id   = ids.id
  left join alerts  on alerts.user_id  = ids.id;
$$;

comment on function public.admin_user_activity(uuid[]) is
  'Admin-only: last-seen (auth.sessions) and last-action timestamps per user. service_role only, read-only, returns no IP.';

-- SECURITY DEFINER over auth.sessions is exactly the grant that must not be
-- reachable from a browser. Only the service-role key may call it.
revoke all on function public.admin_user_activity(uuid[]) from public;
revoke all on function public.admin_user_activity(uuid[]) from anon;
revoke all on function public.admin_user_activity(uuid[]) from authenticated;
grant execute on function public.admin_user_activity(uuid[]) to service_role;
