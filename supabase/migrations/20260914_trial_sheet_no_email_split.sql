-- The phone trial sheet with and without its email field. Arm a is today: the
-- Stripe-styled sheet with the field over the button. Arm b is the same sheet
-- with the field removed, so the button opens Stripe and Stripe takes the
-- address with the card. Nothing else differs between the arms.
--
-- Why again: trial_sheet_stripe_v1 removed the field along with a whole new
-- sheet (2026-09-06), and FE #622 put it back a day later when Stripe
-- completions per tap fell from about 45% to about 10%. That read was one
-- afternoon, and sessions WITH an email finished 0 of 6 in the same window.
--
-- Code: src/app/components/split-test/use-trial-sheet-email.ts, read by
-- SheetBuy in src/app/components/paywall/trial-sheet-stripe.tsx. Surface
-- `sheet`, phone only. Exposure = the buy form rendered to a signed-out
-- reader on the pay-first path (the only reader the arms differ for);
-- cta_click = the buy button pressed.
--
-- Judged on trials per exposure and trial-to-paid, then Stripe completions
-- per checkout_redirect. NOT on presses: arm b wins presses by construction.
-- Stop rule agreed 2026-09-14: run at least 3 weeks; pull arm b early if its
-- Stripe completion stays under half of arm a's after ~30 checkouts per arm.
--
-- Held for FE #664 (existing-account / trial-used checks): arm b skips those
-- checks, so the webhook's duplicate-subscription refund must be live first.
--
-- Inserted as DRAFT. Flip to running only after #664 and this deploy are both
-- verified live:
--   update split_tests set status='running', started_at=now()
--   where key='trial_sheet_no_email_v2';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='trial_sheet_no_email_v2';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'trial_sheet_no_email_v2',
  'Phone trial sheet: email field (today) vs no email field',
  'treatment',
  'draft',
  'Removing the email field from the phone trial sheet, and changing nothing else, starts more trials per exposure without fewer of them paying.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('trial_sheet_no_email_v2', 'a', 'Email field (today)', 50, true,  '{"collect_email":true}'),
  ('trial_sheet_no_email_v2', 'b', 'No email field',      50, false, '{"collect_email":false}')
on conflict (test_key, variant) do nothing;
