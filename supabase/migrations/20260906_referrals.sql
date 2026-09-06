-- Give a month, get a month.
--
-- Every account can hand out a link, reelcaster.com/r/<code>. A friend who
-- makes a NEW account through it gets 30 days of Pro on the spot, with no card
-- and no admin in the loop. The person who sent the link gets a month too:
-- 30 more days of comped Pro if nobody is paying for their account, or one
-- twelfth of their year as a Stripe customer balance credit if somebody is.
--
-- Why this is not the /first offer flow: /first is approved by hand because a
-- forwarded URL that grants Pro on its own is a paywall bypass. A referral
-- grants 30 days, not 365, and only to a brand new account that names a real
-- existing account as its sponsor, so the guards in src/lib/referrals.ts stand
-- in for the approval. A hand-approved referral is not a growth loop.
--
-- The friend's month rides the ordinary comp columns from
-- 20260727_pro_comp_and_welcome, so no entitlement gate learns anything new
-- and expire_lapsed_comps() sweeps it a month later like any other comp.
--
-- The referrer's month needs a ledger, because months stack: `comp_expires_at`
-- is one date and cannot say how many credits made it. referral_credits is
-- that ledger, one row per friend, which is also the one-credit-per-friend
-- guard (unique on the friend).

alter table public.user_settings
  add column if not exists referral_code text,
  add column if not exists referred_by uuid,
  add column if not exists referred_at timestamptz;

comment on column public.user_settings.referral_code is
  'This account''s share code, the <code> in reelcaster.com/r/<code>. Minted lazily the first time the account asks for its link.';
comment on column public.user_settings.referred_by is
  'The account whose link this one was created through. Write-once, new accounts only; see src/lib/referrals.ts for the guards.';
comment on column public.user_settings.referred_at is
  'When the referral was recorded. Also the write-once guard for referred_by.';

-- Two accounts cannot share a code; the mint path retries on this.
create unique index if not exists user_settings_referral_code_key
  on public.user_settings (referral_code)
  where referral_code is not null;

-- "Who did this account bring in": the admin roster and the cap both read it.
create index if not exists user_settings_referred_by_idx
  on public.user_settings (referred_by)
  where referred_by is not null;

create table if not exists public.referral_credits (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null,
  -- Unique: a friend earns their sponsor exactly one month, however many
  -- browsers they sign in on afterwards.
  referred_user_id uuid not null unique,
  created_at timestamptz not null default now(),
  -- How the referrer's month was paid out. 'comp_extension' pushed
  -- comp_expires_at forward; 'stripe_credit' posted a customer balance credit;
  -- 'capped' means the referrer had already earned the year's twelve and this
  -- one is recorded but worth nothing.
  applied_as text not null check (applied_as in ('comp_extension', 'stripe_credit', 'capped')),
  applied_at timestamptz,
  -- Stripe credit only. Negative in Stripe's terms, stored positive here.
  amount_cents integer,
  currency text,
  stripe_balance_transaction_id text,
  -- The "your month landed" email, claimed the same way every other send is.
  notified_at timestamptz
);

comment on table public.referral_credits is
  'One row per referred friend: the month their sponsor earned and how it was paid out. Service role only.';

create index if not exists referral_credits_referrer_idx
  on public.referral_credits (referrer_user_id, created_at desc);

-- Nobody reads or writes this from a browser. RLS on, zero policies, so the
-- anon and authenticated roles get nothing and only the service role (which
-- bypasses RLS) can touch it. Same posture as trial_grants.
alter table public.referral_credits enable row level security;
revoke all on public.referral_credits from anon, authenticated;

-- The three new user_settings columns join the not-client-writable list.
-- Without this a signed-in user could point referred_by at a friend and hand
-- them a credit, or rewrite referral_code to somebody else's and hijack their
-- link. Recreated wholesale, as every previous change to this function was:
-- this is the 20260814_first_year_offer version with three lines added.
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
     or new.comp_reason              is distinct from old.comp_reason
     or new.offer_code               is distinct from old.offer_code
     or new.offer_code_at            is distinct from old.offer_code_at
     or new.offer_granted_at         is distinct from old.offer_granted_at
     or new.referral_code            is distinct from old.referral_code
     or new.referred_by              is distinct from old.referred_by
     or new.referred_at              is distinct from old.referred_at then
    raise exception 'billing columns on user_settings are not client-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
