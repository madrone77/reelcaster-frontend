-- abandon_email_v1: the one email a signed-out buyer gets after leaving checkout.
--   a  "You're almost done": one button back into checkout (control, today's email)
--   b  "Your free account is ready": a sign-in link that makes a free account
--      (no card), with the Pro checkout link underneath
-- Casey 2026-09-21: somebody who typed an email and backed out of Stripe should
-- still leave with an account.
--
-- An EMAIL test (surface_kind 'email'): the arm is picked when the email is
-- sent, never handed out by the rc_split cookie, so only people who were
-- actually emailed are in it. Exposure = the email sent (surface
-- `abandon_email`, session id = the reminder token); cta_click = a link in it
-- opened. The links write the arm into the cookie, so a trial started from
-- either email carries split_abandon_email_v1 to Stripe.
-- Code: src/lib/checkout-reminder.ts.
--
-- Also: the email now goes out the moment somebody taps Stripe's Back arrow
-- (trigger 'cancel'), not only 3 hours after the session expires ('expiry').
--
-- Inserted as DRAFT (everybody gets arm a, nobody is counted). Once the FE that
-- reads it is live on prod, in the same change that adds it to the Sentinel's
-- EXPECTED_SPLITS:
--   update split_tests set status='running', started_at=now()
--   where key='abandon_email_v1';

alter table public.checkout_reminder_emails
  add column if not exists variant text,
  add column if not exists trigger text,
  add column if not exists free_account_user_id uuid,
  add column if not exists free_account_at timestamptz;

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, example_path)
values (
  'abandon_email_v1',
  'Abandoned checkout email: finish checkout vs free account + Pro link',
  'email',
  'draft',
  'Giving a checkout abandoner a free account (no card) with the Pro link underneath wins back more trials than an email that only offers checkout again.',
  'paid_conversion',
  false,
  '/billing/cancel'
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('abandon_email_v1', 'a', 'Finish checkout', 50, true,  '{"free_account":false}'),
  ('abandon_email_v1', 'b', 'Free account + Pro link', 50, false, '{"free_account":true}')
on conflict (test_key, variant) do nothing;
