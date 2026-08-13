-- Signup + trial conversion attribution.
--
-- Two questions this answers, both from bluecaster /admin/reelcaster/analytics:
--   1. Which paywall did this account convert on?
--   2. How did they get into the app in the first place?
--
-- Attribution is WRITE-ONCE. A user can hit five walls before converting; the
-- one that matters is the one they were looking at when they converted, and
-- re-running any of these writers must never rewrite history. Every writer
-- guards on `... is null`.
--
-- Signup and trial are separate pairs on purpose: the wall that earns a free
-- account is often not the wall that earns a card.
--
-- Already applied to the ReelCaster project by hand; migration CI has been
-- unauthorized for a while, so merging this file does not apply it.

alter table public.user_settings
  -- First touch. Written once, on the first page view of a new visitor.
  add column if not exists attr_entry_path    text,
  add column if not exists attr_referrer      text,
  add column if not exists attr_utm_source    text,
  add column if not exists attr_utm_medium    text,
  add column if not exists attr_utm_campaign  text,
  -- Last touch, anon -> free account. `feature` is a NagFeatureId from
  -- src/lib/plan-features.ts; `from` is the surface that opened the modal.
  add column if not exists attr_signup_feature text,
  add column if not exists attr_signup_from    text,
  add column if not exists attr_signup_at      timestamptz,
  -- Last touch, anon/free -> Pro trial. Written by the Stripe webhook from
  -- subscription metadata, which is the only carrier that survives the
  -- redirect out to Stripe's hosted checkout and back.
  add column if not exists attr_trial_feature  text,
  add column if not exists attr_trial_from     text,
  add column if not exists attr_trial_at       timestamptz;

-- Denominators. Counts of signups per feature are unreadable without knowing
-- how many people saw each wall, so the wall impressions and CTA clicks roll
-- up daily here. Deliberately NOT an event log: no visitor id, no user id, no
-- PII, so there is nothing to retain or purge.
create table if not exists public.paywall_impressions (
  day          date   not null,
  feature      text   not null,
  surface      text   not null default '',
  viewer_tier  text   not null default 'anon',
  impressions  bigint not null default 0,
  cta_clicks   bigint not null default 0,
  primary key (day, feature, surface, viewer_tier)
);

comment on table public.paywall_impressions is
  'Daily rollup of paywall wall views and CTA clicks. Denominator for the conversion panels in bluecaster /admin/reelcaster/analytics.';

alter table public.paywall_impressions enable row level security;
-- No policies: the service role bypasses RLS and is the only intended writer.
-- Without this, the anon key could read and inflate competitor-ish signal for
-- anyone who opened devtools.

create or replace function public.bump_paywall_counter(
  p_day         date,
  p_feature     text,
  p_surface     text,
  p_viewer_tier text,
  p_kind        text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('impression', 'cta_click') then
    raise exception 'bump_paywall_counter: unknown kind %', p_kind;
  end if;

  insert into paywall_impressions (day, feature, surface, viewer_tier, impressions, cta_clicks)
  values (
    p_day,
    p_feature,
    coalesce(nullif(p_surface, ''), 'unknown'),
    coalesce(nullif(p_viewer_tier, ''), 'anon'),
    case when p_kind = 'impression' then 1 else 0 end,
    case when p_kind = 'cta_click'  then 1 else 0 end
  )
  on conflict (day, feature, surface, viewer_tier) do update
    set impressions = paywall_impressions.impressions + excluded.impressions,
        cta_clicks  = paywall_impressions.cta_clicks  + excluded.cta_clicks;
end;
$$;

-- The route calls this with the service role. Nothing else should be able to.
revoke execute on function public.bump_paywall_counter(date, text, text, text, text) from public;
revoke execute on function public.bump_paywall_counter(date, text, text, text, text) from anon;
revoke execute on function public.bump_paywall_counter(date, text, text, text, text) from authenticated;
