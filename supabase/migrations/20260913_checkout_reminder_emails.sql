-- The "almost done signing up" email, one row per address it went to.
--
-- WHAT THIS ANSWERS. A signed-out buyer types their email on our paywall, goes
-- to Stripe Checkout and leaves. No subscription means no webhook, and no
-- webhook means no account, so until now that person existed only as an
-- expired Checkout Session (and, if they got as far as the card form, a bare
-- Stripe customer with no ReelCaster account behind it). 50-odd real addresses
-- did that in the 30 days to 2026-09-13.
--
-- ONE EMAIL PER ADDRESS, EVER. The primary key is the address, and the sender
-- claims it by inserting. Two runs racing on the same person cannot both win,
-- and somebody who abandons checkout five times still hears from us once.
--
-- THE TOKEN is the only thing in the email's links. It brings the reader back
-- into a fresh checkout for this address (/api/stripe/checkout/resume) and it
-- unsubscribes them, without putting the address itself in a URL.
--
-- signed_up_user_id is stamped by the Stripe webhook when an account is
-- created from a checkout that the resume link started, which is what the
-- BlueCaster roster reads to tick "Email reminder". Coming back on their own,
-- without the link, does not count.
--
-- Written only by server code with the service role. RLS on, no policies.

create table if not exists public.checkout_reminder_emails (
  email text primary key,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  checkout_session_id text not null,
  region text,
  from_surface text,
  trial_offered boolean,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  -- First click on the resume link. Mail scanners that pre-fetch links can
  -- set this without a human, so read it as an upper bound.
  clicked_at timestamptz,
  unsubscribed_at timestamptz,
  signed_up_user_id uuid references auth.users (id) on delete set null,
  signed_up_at timestamptz,
  constraint checkout_reminder_emails_email_lower check (email = lower(email))
);

create index if not exists checkout_reminder_emails_signed_up_user_idx
  on public.checkout_reminder_emails (signed_up_user_id)
  where signed_up_user_id is not null;

alter table public.checkout_reminder_emails enable row level security;
