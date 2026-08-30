-- What this subscriber actually pays, so the notices that are required to
-- state it can stop inferring it from a list price.
--
-- Before a price test there was one annual amount and a tier told you what it
-- was. With two arms live, tier says 'pro_annual' for people paying different
-- numbers, and the trial-ending email is legally required to name the amount
-- about to be charged. The cron that sends it reads a database row, not a
-- Stripe subscription, so the amount has to be on the row.
--
-- Written by the Stripe webhook from the subscription item, which is the only
-- source that cannot disagree with what will be billed.
--
-- Migration CI has been unauthorized for a while, so merging this file does
-- not apply it. Applied to the ReelCaster project via MCP alongside this
-- commit.
alter table public.user_settings
  add column if not exists subscription_amount_cents integer,
  add column if not exists subscription_currency text;

comment on column public.user_settings.subscription_amount_cents is
  'The amount on this subscription, from Stripe. Null for rows that predate this column or were hand-set; callers fall back to the list price for the tier.';
comment on column public.user_settings.subscription_currency is
  'Billing currency of subscription_amount_cents: cad or usd.';
