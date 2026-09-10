-- What Stripe already knows about a member, kept where it can be queried.
--
-- WHAT THIS ANSWERS. Almost nobody fills in a profile: of 68 accounts, 31 have
-- named a region, 23 finished onboarding, 0 have answered "how did you hear
-- about us". Meanwhile Stripe holds a real name for 35 of the 52 customers, a
-- country for 37, a postal code for 32, a locale for nearly all of them, and a
-- cancellation reason for 6 of the 7 subscriptions that have ended. None of it
-- was stored anywhere, so no report could group by it and no email could use
-- it.
--
-- WHY COLUMNS AND NOT A LIVE READ. BlueCaster's admin already resolves some of
-- this at render time (lib/reelcaster-user-location.ts pulls billing country,
-- capped at 200 customers per page), and that approach cannot go further: the
-- roster deliberately drops the cardholder name because a second pass over the
-- customer list on every render costs too much, and SQL cannot group by a value
-- that only exists inside a React render. Mirroring into columns makes the
-- whole set sortable, filterable and countable, and removes an API call from
-- the page.
--
-- WHY THE bill_ PREFIX. These are facts about the CARD, not about the person.
-- A cardholder can be a spouse and a billing address can be an office, so this
-- block never merges into the profile fields the member owns: phone_e164 stays
-- the Twilio-verified number, and the home city stays what they chose. Same
-- separation the attr_*, paid_* and geo_* blocks already keep, for the same
-- reason.
--
-- WRITE PATH. src/lib/billing-profile.ts, called from the Stripe webhook after
-- the entitlement upsert, on every subscription event. Existing customers are
-- filled in by scripts/backfill-billing-profile.ts. A member never writes here
-- (see the column-level revoke at the bottom).
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

alter table public.user_settings
  -- Who and where, off the Stripe customer.
  add column if not exists bill_name text,
  add column if not exists bill_city text,
  add column if not exists bill_region text,
  add column if not exists bill_postal text,
  add column if not exists bill_country text,
  add column if not exists bill_locale text,
  -- The card itself. Funding separates a debit buyer from a credit one, and
  -- the issuing country is the only hard signal of which market someone banks
  -- in, as against which market their IP put them in.
  add column if not exists bill_card_brand text,
  add column if not exists bill_card_funding text,
  add column if not exists bill_card_country text,
  -- Money, summed from paid invoices rather than inferred from the tier, so a
  -- comped year and a split-test price cannot inflate it.
  add column if not exists bill_lifetime_cents integer,
  add column if not exists bill_lifetime_currency text,
  add column if not exists bill_paid_invoices integer,
  add column if not exists bill_first_paid_at timestamptz,
  -- Negative is a credit. The referral payout can land here as Stripe credit
  -- rather than a comp extension, and this is the only place that shows it.
  add column if not exists bill_balance_cents integer,
  -- Why they left. reason is Stripe's own classification (payment_failed vs
  -- cancellation_requested), which is the involuntary/voluntary split; feedback
  -- and comment are what the member said in the portal.
  add column if not exists bill_cancel_reason text,
  add column if not exists bill_cancel_feedback text,
  add column if not exists bill_cancel_comment text,
  add column if not exists bill_synced_at timestamptz;

comment on column public.user_settings.bill_name is
  'Cardholder name on the Stripe customer. Evidence about who paid, not an identification of the account holder.';
comment on column public.user_settings.bill_country is
  'Two-letter country on the Stripe billing address. Where the card is registered, which is usually but not always where the person is.';
comment on column public.user_settings.bill_cancel_feedback is
  'Stripe portal cancellation survey answer (too_expensive, unused, ...). Describes the most recent cancellation and is never cleared, so it can sit beside an active subscription on a member who came back.';
comment on column public.user_settings.bill_synced_at is
  'When src/lib/billing-profile.ts last mirrored Stripe into this row. Null means never synced, not "Stripe holds nothing".';

-- Segmenting the roster by market is the whole point, and both of these are
-- low-cardinality over a table this size, so the planner will use them for the
-- country/region counts on the admin pages.
create index if not exists user_settings_bill_country_idx
  on public.user_settings (bill_country)
  where bill_country is not null;

create index if not exists user_settings_bill_region_idx
  on public.user_settings (bill_region)
  where bill_region is not null;

-- RLS lets a member UPDATE their own user_settings row, which is right for
-- their unit preferences and wrong for this block: with only a row policy in
-- force, anyone holding the anon key could rewrite their own billing country
-- or lifetime value and quietly poison a market report.
--
-- A trigger rather than column privileges. Revoking UPDATE on these columns
-- alone does nothing while a table-level grant stands, and the fix Postgres
-- wants for that -- revoke the table, re-grant every allowed column -- would
-- mean naming all 76 columns here and re-naming each new one forever, with a
-- member's preferences silently unsaveable the first time somebody forgot.
--
-- INVOKER security, and that is the whole trick. `security definer` reads
-- current_user as the function's OWNER, which is postgres, which is a role this
-- guard treats as allowed -- so the definer version waved through every spoof it
-- was written to stop (verified against the live table before this landed).
-- Nothing in here touches a privileged object, so running as the caller is both
-- correct and what makes the role test mean anything.
--
-- Coerces rather than raises. Every client write goes through supabase-js and
-- names only the columns it means to change, so nothing in the app can trip
-- this; a request that does send one gets its other columns saved and this
-- block left alone, which is a better outcome than a 400 on a units toggle.
--
-- Guards INSERT as well, because a member may create their own settings row
-- (the "Users insert own settings" policy) and could otherwise seed this block
-- on the way in, where there is no prior value to restore.
create or replace function public.user_settings_keep_billing_mirror()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  -- Service role bypasses: PostgREST sets the role per request, so the webhook
  -- and the backfill arrive here as service_role and must be able to write.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- No prior row to restore from: an insert simply cannot carry this block.
  if tg_op = 'INSERT' then
    new.bill_name := null;
    new.bill_city := null;
    new.bill_region := null;
    new.bill_postal := null;
    new.bill_country := null;
    new.bill_locale := null;
    new.bill_card_brand := null;
    new.bill_card_funding := null;
    new.bill_card_country := null;
    new.bill_lifetime_cents := null;
    new.bill_lifetime_currency := null;
    new.bill_paid_invoices := null;
    new.bill_first_paid_at := null;
    new.bill_balance_cents := null;
    new.bill_cancel_reason := null;
    new.bill_cancel_feedback := null;
    new.bill_cancel_comment := null;
    new.bill_synced_at := null;
    return new;
  end if;

  new.bill_name := old.bill_name;
  new.bill_city := old.bill_city;
  new.bill_region := old.bill_region;
  new.bill_postal := old.bill_postal;
  new.bill_country := old.bill_country;
  new.bill_locale := old.bill_locale;
  new.bill_card_brand := old.bill_card_brand;
  new.bill_card_funding := old.bill_card_funding;
  new.bill_card_country := old.bill_card_country;
  new.bill_lifetime_cents := old.bill_lifetime_cents;
  new.bill_lifetime_currency := old.bill_lifetime_currency;
  new.bill_paid_invoices := old.bill_paid_invoices;
  new.bill_first_paid_at := old.bill_first_paid_at;
  new.bill_balance_cents := old.bill_balance_cents;
  new.bill_cancel_reason := old.bill_cancel_reason;
  new.bill_cancel_feedback := old.bill_cancel_feedback;
  new.bill_cancel_comment := old.bill_cancel_comment;
  new.bill_synced_at := old.bill_synced_at;

  return new;
end;
$function$;

drop trigger if exists user_settings_keep_billing_mirror on public.user_settings;

create trigger user_settings_keep_billing_mirror
  before insert or update on public.user_settings
  for each row
  execute function public.user_settings_keep_billing_mirror();
