-- A paid visitor opening the paywall becomes a fourth reportable conversion.
--
-- WHY. `marketing_conversions` has known three events: trial_start, purchase,
-- signup. Each is rarer than the last thing an ad network can learn from. Meta
-- wants roughly thirty conversions a month before its bidding models leave the
-- learning phase, and this account has produced twenty accounts in thirty days
-- and a handful of trials. Every event in the table is below the threshold, so
-- the optimiser has been bidding on noise.
--
-- A paywall open is the next rung up the funnel and it is an order of magnitude
-- more frequent: on the first day `paywall_events` was live it recorded 127
-- opens across 48 sessions. It is a weaker signal than a trial and it is meant
-- to be — the trade is deliberate, and it is only worth taking while the trial
-- count is under the learning threshold. The same argument, one rung lower, is
-- written out at the top of src/lib/signup-conversion.ts.
--
-- WHAT CHANGES HERE:
--   1. a dedupe key, because this is the first event with neither a
--      subscription nor an account behind it
--   2. the two check constraints that assumed every event had one of those
--   3. `marketing_performance` and `campaign_summary` report the new count, so
--      it lands beside spend in the admin instead of only in the upload queue

-- ── 1. The dedupe key ────────────────────────────────────────────────
--
-- The other three events dedupe on something the business already owns: a
-- subscription id, or an account id. An anonymous visitor opening a modal has
-- neither, and "once per session" has to be enforced somewhere or one undecided
-- reader opening the same wall three times becomes three conversions and Meta
-- learns to find people who bounce.
--
-- The value is built in src/lib/paywall-conversion.ts and is the rc_sess id
-- where there is one, falling back to the click id plus the Pacific day for a
-- browser that blocks cookies. It doubles as the Meta `event_id`, so the same
-- string is what stops a duplicate reaching the table AND what would dedupe it
-- against a browser event if one is ever added.
alter table marketing_conversions
  add column if not exists dedupe_key text;

comment on column marketing_conversions.dedupe_key is
  'Idempotency key for events with no subscription and no account behind them. Also the Meta event_id. Null on the three Stripe-and-account events, which key on their own ids.';

-- Partial, so the three existing event types are untouched and their null keys
-- do not collide with each other.
create unique index if not exists marketing_conversions_dedupe_once
  on marketing_conversions (dedupe_key)
  where dedupe_key is not null;

-- The drain reads pending rows oldest-first and this table is about to receive
-- a hundred times more rows than it has ever held. Without this the queue read
-- degrades into a scan of mostly-sent history.
create index if not exists marketing_conversions_type_time_idx
  on marketing_conversions (event_type, occurred_at desc);

-- ── 2. The constraints that assumed money ────────────────────────────

alter table marketing_conversions
  drop constraint if exists marketing_conversions_event_type_check;

alter table marketing_conversions
  add constraint marketing_conversions_event_type_check
  check (event_type in ('trial_start', 'purchase', 'signup', 'paywall_view'));

-- Each event type is now named explicitly rather than defined as "not signup".
-- A fifth event added later will fail this check until somebody states what
-- keys it, which is the point: the previous shape silently required a Stripe
-- subscription id of anything new, and a paywall open has none.
alter table marketing_conversions
  drop constraint if exists marketing_conversions_keyed;

alter table marketing_conversions
  add constraint marketing_conversions_keyed check (
    (event_type = 'signup' and user_id is not null)
    or (event_type = 'paywall_view' and dedupe_key is not null)
    or (event_type in ('trial_start', 'purchase') and stripe_subscription_id is not null)
  );

-- ── 3. The reports ───────────────────────────────────────────────────
--
-- Both RPCs already count by `filter (where event_type = ...)`, so the new rows
-- could not corrupt an existing number. What they WOULD do is arrive as group
-- rows with every count at zero, because both full-outer-join their conversion
-- side onto a spend or hits side. Counting them turns those rows from noise
-- into the number the campaign is being judged on.

drop function if exists public.marketing_performance(date, date);

create function public.marketing_performance(since_date date, mature_before date)
returns table(
  platform text,
  campaign_id text,
  campaign_name text,
  currency text,
  spend_cents bigint,
  mature_spend_cents bigint,
  impressions bigint,
  clicks bigint,
  paywall_views bigint,
  signups bigint,
  trials bigint,
  purchases bigint,
  revenue_cents bigint,
  mature_paywall_views bigint,
  mature_signups bigint,
  mature_trials bigint,
  mature_purchases bigint,
  mature_revenue_cents bigint,
  unknown_click_date bigint
)
language sql
stable security definer
set search_path to 'public'
as $function$
  with spend as (
    select
      sp.platform                 as p_platform,
      sp.campaign_id              as p_campaign_id,
      max(sp.campaign_name)       as p_campaign_name,
      max(sp.currency)            as p_currency,
      sum(sp.spend_cents)::bigint as p_spend_cents,
      coalesce(sum(sp.spend_cents) filter (where sp.day <= mature_before), 0)::bigint
                                  as p_mature_spend_cents,
      sum(sp.impressions)::bigint as p_impressions,
      sum(sp.clicks)::bigint      as p_clicks
    from marketing_ad_spend sp
    where sp.day >= since_date
    group by sp.platform, sp.campaign_id
  ),
  conv as (
    select
      coalesce(mc.utm_source, '')   as c_platform,
      coalesce(mc.utm_campaign, '') as c_campaign_id,
      count(*) filter (where mc.event_type = 'paywall_view')::bigint as c_paywall_views,
      count(*) filter (where mc.event_type = 'signup')::bigint      as c_signups,
      count(*) filter (where mc.event_type = 'trial_start')::bigint as c_trials,
      count(*) filter (where mc.event_type = 'purchase')::bigint    as c_purchases,
      coalesce(sum(mc.value_cents) filter (where mc.event_type = 'purchase'), 0)::bigint
                                                                    as c_revenue_cents,
      -- A paywall view matures the instant it happens, like a signup: there is
      -- nothing left to wait for. Cohorted by click date all the same, so spend
      -- and views on one row describe the same clicks.
      count(*) filter (
        where mc.event_type = 'paywall_view'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      )::bigint as c_mature_paywall_views,
      count(*) filter (
        where mc.event_type = 'signup'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      )::bigint as c_mature_signups,
      count(*) filter (
        where mc.event_type = 'trial_start'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      )::bigint as c_mature_trials,
      count(*) filter (
        where mc.event_type = 'purchase'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      )::bigint as c_mature_purchases,
      coalesce(sum(mc.value_cents) filter (
        where mc.event_type = 'purchase'
          and coalesce(mc.click_at, mc.occurred_at)::date <= mature_before
      ), 0)::bigint as c_mature_revenue_cents,
      -- Scoped to the Stripe events on purpose, and now explicitly rather than
      -- by excluding signup. Nearly every signup is organic and so has no click
      -- date by definition; a paywall view can be recorded off a utm-tagged
      -- visit that carried no click id at all. Counting either here would turn
      -- a fault indicator into a number that is always large.
      count(*) filter (
        where mc.click_at is null
          and mc.event_type in ('trial_start', 'purchase')
      )::bigint as c_unknown_click_date
    from marketing_conversions mc
    where coalesce(mc.click_at, mc.occurred_at) >= since_date
    group by 1, 2
  )
  select
    coalesce(spend.p_platform,    conv.c_platform)    as platform,
    coalesce(spend.p_campaign_id, conv.c_campaign_id) as campaign_id,
    spend.p_campaign_name                             as campaign_name,
    spend.p_currency                                  as currency,
    coalesce(spend.p_spend_cents, 0)                  as spend_cents,
    coalesce(spend.p_mature_spend_cents, 0)           as mature_spend_cents,
    coalesce(spend.p_impressions, 0)                  as impressions,
    coalesce(spend.p_clicks, 0)                       as clicks,
    coalesce(conv.c_paywall_views, 0)                 as paywall_views,
    coalesce(conv.c_signups, 0)                       as signups,
    coalesce(conv.c_trials, 0)                        as trials,
    coalesce(conv.c_purchases, 0)                     as purchases,
    coalesce(conv.c_revenue_cents, 0)                 as revenue_cents,
    coalesce(conv.c_mature_paywall_views, 0)          as mature_paywall_views,
    coalesce(conv.c_mature_signups, 0)                as mature_signups,
    coalesce(conv.c_mature_trials, 0)                 as mature_trials,
    coalesce(conv.c_mature_purchases, 0)              as mature_purchases,
    coalesce(conv.c_mature_revenue_cents, 0)          as mature_revenue_cents,
    coalesce(conv.c_unknown_click_date, 0)            as unknown_click_date
  from spend
  full outer join conv
    on spend.p_platform = conv.c_platform
   and spend.p_campaign_id = conv.c_campaign_id;
$function$;

drop function if exists public.campaign_summary(date);

create function public.campaign_summary(since_date date)
returns table(
  landing text,
  source text,
  campaign text,
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
      sum(e.hits)                                       as hits,
      sum(e.cta_clicks)                                 as cta_clicks
    from campaign_events_daily e
    where e.day >= since_date
    group by 1, 2, 3
  ),
  cv as (
    select
      campaign_landing_key(c.landing_path, c.entry_path)  as landing,
      campaign_source_label(c.utm_source, c.click_type)   as source,
      coalesce(c.utm_campaign, '')                        as campaign,
      count(*) filter (where c.event_type = 'paywall_view') as paywall_views,
      count(*) filter (where c.event_type = 'trial_start') as trials,
      count(*) filter (where c.event_type = 'purchase')    as purchases,
      coalesce(sum(c.value_cents) filter (where c.event_type = 'purchase'), 0) as revenue_cents
    from marketing_conversions c
    where c.occurred_at >= since_date::timestamptz
      -- Signups are counted in marketing_performance, not here.
      and c.event_type <> 'signup'
    group by 1, 2, 3
  )
  select
    coalesce(ev.landing, cv.landing)   as landing,
    coalesce(ev.source, cv.source)     as source,
    coalesce(ev.campaign, cv.campaign) as campaign,
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
  order by coalesce(ev.hits, 0) desc, coalesce(cv.purchases, 0) desc;
$function$;

-- Restoring the grants the dropped functions had, exactly.
--
-- THIS IS NOT BOILERPLATE. Both functions are SECURITY DEFINER over the whole
-- of marketing_conversions, and both had EXECUTE granted to `service_role` and
-- nothing else. A newly created function does not inherit that: Postgres grants
-- EXECUTE to PUBLIC by default, and this project additionally grants it to
-- `anon` and `authenticated` through default privileges on the public schema.
-- Dropping and recreating a function here therefore hands every campaign's
-- revenue to anyone holding the publishable key, silently, and `\df+` in a
-- fresh session is the only place it shows. Revoked from all three by name.
revoke execute on function public.marketing_performance(date, date) from public, anon, authenticated;
revoke execute on function public.campaign_summary(date) from public, anon, authenticated;
grant execute on function public.marketing_performance(date, date) to service_role;
grant execute on function public.campaign_summary(date) to service_role;
