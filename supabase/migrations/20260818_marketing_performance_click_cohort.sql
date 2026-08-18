-- Cohort conversions to the day of the CLICK, not the day of the conversion.
--
-- The bug this fixes: the trial is 7 days, so a purchase lands roughly a week
-- after the money that bought it was spent. Filtering conversions on
-- occurred_at therefore compares this week's spend against last week's clicks.
-- On flat spend that washes out. The moment budgets move it does not, and it
-- fails in the direction that flatters: raise spend and CAC looks great for a
-- week, because the new spend is counted against conversions the old spend
-- bought.
--
-- Worse, a window can contain a purchase whose click and spend fall outside it.
-- Under the old rule that row read as a customer acquired for $0. Verified
-- against seeded data before this shipped: old rule reported 1 purchase against
-- $0 spend, the cohorted rule correctly reports nothing.
--
-- Maturity is the other half. A click from fewer than ~9 days ago CANNOT have
-- produced a purchase yet (7-day trial, plus a day for the invoice), so its
-- cohort is still filling. Reporting CAC over an immature cohort makes every
-- recent campaign look terrible. The mature_* columns are the honest numerator
-- and denominator; the plain ones are the full window including conversions
-- still in flight. The caller passes the cut-off rather than it being baked in
-- here, because it is derived from TRIAL_DAYS in the frontend.
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

-- Signature changes, so the old one has to go: create-or-replace with a new
-- argument list makes an OVERLOAD, and PostgREST would keep resolving the
-- single-argument version.
drop function if exists public.marketing_performance(date);

create or replace function public.marketing_performance(
  since_date    date,
  mature_before date
)
returns table (
  platform             text,
  campaign_id          text,
  campaign_name        text,
  currency             text,
  spend_cents          bigint,
  mature_spend_cents   bigint,
  impressions          bigint,
  clicks               bigint,
  trials               bigint,
  purchases            bigint,
  revenue_cents        bigint,
  mature_trials        bigint,
  mature_purchases     bigint,
  mature_revenue_cents bigint,
  unknown_click_date   bigint
)
language sql
stable
security definer
set search_path = public
as $$
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
      count(*) filter (where mc.event_type = 'trial_start')::bigint as c_trials,
      count(*) filter (where mc.event_type = 'purchase')::bigint    as c_purchases,
      coalesce(sum(mc.value_cents) filter (where mc.event_type = 'purchase'), 0)::bigint
                                                                    as c_revenue_cents,
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
      count(*) filter (where mc.click_at is null)::bigint as c_unknown_click_date
    from marketing_conversions mc
    -- Falls back to occurred_at when the click date is unknown: organic
    -- conversions have no click, and paid ones predating click_at capture
    -- carry none either. That degrades to the old behaviour for those rows
    -- rather than dropping them, and c_unknown_click_date reports how many
    -- are being approximated that way.
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
    coalesce(conv.c_trials, 0)                        as trials,
    coalesce(conv.c_purchases, 0)                     as purchases,
    coalesce(conv.c_revenue_cents, 0)                 as revenue_cents,
    coalesce(conv.c_mature_trials, 0)                 as mature_trials,
    coalesce(conv.c_mature_purchases, 0)              as mature_purchases,
    coalesce(conv.c_mature_revenue_cents, 0)          as mature_revenue_cents,
    coalesce(conv.c_unknown_click_date, 0)            as unknown_click_date
  from spend
  full outer join conv
    on spend.p_platform = conv.c_platform
   and spend.p_campaign_id = conv.c_campaign_id;
$$;

revoke execute on function public.marketing_performance(date, date) from public;
revoke execute on function public.marketing_performance(date, date) from anon;
revoke execute on function public.marketing_performance(date, date) from authenticated;
