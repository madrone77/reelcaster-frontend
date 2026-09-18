-- Daily, weekly and monthly active accounts for each of the last p_days
-- Pacific days, reconstructed from the auth audit log. Every sign-in, sign-up
-- and token refresh writes an audit row with the actor's id, and a session
-- refreshes its token roughly hourly while the app is open, so an account
-- with any of those rows on a day was there that day. This is what lets the
-- bluecaster admin Users page draw DAU / WAU / MAU over time for days before
-- its nightly snapshot existed. Recovery requests and confirmations are left
-- out (the actor is not signed in). p_exclude drops internal accounts.
-- Service-role only, like admin_user_activity. Applied to prod 2026-09-18.
create or replace function public.admin_active_users_daily(
  p_days integer default 180,
  p_exclude uuid[] default null
)
returns table(day date, dau integer, wau integer, mau integer)
language sql
security definer
set search_path to 'public', 'auth'
as $$
  with ev as (
    select distinct
      (e.payload->>'actor_id')::uuid as uid,
      (e.created_at at time zone 'America/Los_Angeles')::date as day
    from auth.audit_log_entries e
    where e.payload->>'action' in (
      'login', 'token_refreshed', 'user_signedup', 'logout',
      'user_modified', 'identity_linked', 'user_updated_password'
    )
      and e.payload->>'actor_id' ~ '^[0-9a-fA-F-]{36}$'
      and e.created_at >= now() - (p_days + 30) * interval '1 day'
      and (p_exclude is null or (e.payload->>'actor_id')::uuid <> all(p_exclude))
  ),
  days as (
    select d::date as day
    from generate_series(
      (now() at time zone 'America/Los_Angeles')::date - (p_days - 1),
      (now() at time zone 'America/Los_Angeles')::date,
      interval '1 day'
    ) d
  )
  select
    d.day,
    (select count(distinct uid) from ev where ev.day = d.day)::int as dau,
    (select count(distinct uid) from ev where ev.day > d.day - 7 and ev.day <= d.day)::int as wau,
    (select count(distinct uid) from ev where ev.day > d.day - 30 and ev.day <= d.day)::int as mau
  from days d
  order by d.day;
$$;

revoke all on function public.admin_active_users_daily(integer, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_active_users_daily(integer, uuid[]) to service_role;
