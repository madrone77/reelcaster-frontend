-- Complimentary Pro grants + the one-time "Welcome to Pro" modal.
--
-- A comp is an ordinary Pro subscription as far as every entitlement gate is
-- concerned: `subscription_tier` / `subscription_status` / `subscription_period_end`
-- are set exactly as Stripe would set them, so none of the six route-level
-- gates need to learn a new concept. `comp_expires_at` is the marker that says
-- "nobody is paying for this" — it drives the expiry sweep below and lets the
-- UI say "complimentary" instead of offering a Stripe portal that would 404.
--
-- Why a sweep rather than a read-time check: the gates only look at tier and
-- status, and a comped row has no Stripe subscription to ever flip it. Without
-- something that actively lapses the grant, "a free year" is a free forever.

alter table public.user_settings
  add column if not exists comp_expires_at timestamptz,
  add column if not exists comp_reason text,
  add column if not exists pro_welcome_seen_at timestamptz;

comment on column public.user_settings.comp_expires_at is
  'Non-null when Pro was granted rather than paid for. Carries the grant expiry; expire_lapsed_comps() drops the account back to free once it passes.';
comment on column public.user_settings.comp_reason is
  'Free-text note on why a comp was granted (e.g. "founding angler"). Internal only.';
comment on column public.user_settings.pro_welcome_seen_at is
  'Set the first time the user dismisses the Welcome to Pro modal. Null means the modal is still owed.';

-- Only sweep rows that are genuinely comped: an expiry has passed AND there is
-- no Stripe subscription behind the account. The stripe_subscription_id guard
-- means that if a comped user later actually subscribes, the sweep leaves them
-- alone even if the stale comp date is never cleared.
create or replace function public.expire_lapsed_comps()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  swept integer;
begin
  update public.user_settings
     set subscription_tier = 'free',
         subscription_status = 'none',
         subscription_period_end = null,
         comp_expires_at = null,
         updated_at = now()
   where comp_expires_at is not null
     and comp_expires_at < now()
     and stripe_subscription_id is null;

  get diagnostics swept = row_count;
  return swept;
end;
$$;

comment on function public.expire_lapsed_comps() is
  'Drops lapsed complimentary Pro grants back to free. Scheduled daily via pg_cron; safe to run by hand.';

revoke all on function public.expire_lapsed_comps() from public, anon, authenticated;

-- Daily at 08:10 UTC (~00:10 Pacific). Unscheduled first so re-running the
-- migration doesn't stack duplicate jobs.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('expire-lapsed-comps')
      where exists (select 1 from cron.job where jobname = 'expire-lapsed-comps');

    perform cron.schedule(
      'expire-lapsed-comps',
      '10 8 * * *',
      $cron$select public.expire_lapsed_comps();$cron$
    );
  end if;
end
$$;

-- Close the self-upgrade hole.
--
-- "Users update own settings" allowed an authenticated user to UPDATE any
-- column of their own row with nothing but the anon key — including
-- subscription_tier and subscription_status. That is the whole paywall, and it
-- was one PATCH away. Every legitimate write to this table already goes
-- through a route holding the service role key (which bypasses RLS entirely),
-- so narrowing the client policy costs the app nothing.
create or replace function public.user_settings_block_billing_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role bypasses RLS and owns every legitimate billing write.
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role' then
    return new;
  end if;
  -- Direct psql / migrations / cron run without a JWT at all.
  if current_setting('request.jwt.claims', true) is null then
    return new;
  end if;

  if new.subscription_tier    is distinct from old.subscription_tier
     or new.subscription_status      is distinct from old.subscription_status
     or new.subscription_period_end  is distinct from old.subscription_period_end
     or new.stripe_customer_id       is distinct from old.stripe_customer_id
     or new.stripe_subscription_id   is distinct from old.stripe_subscription_id
     or new.comp_expires_at          is distinct from old.comp_expires_at
     or new.comp_reason              is distinct from old.comp_reason then
    raise exception 'billing columns on user_settings are not client-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists user_settings_block_billing_self_edit on public.user_settings;
create trigger user_settings_block_billing_self_edit
  before update on public.user_settings
  for each row
  execute function public.user_settings_block_billing_self_edit();
