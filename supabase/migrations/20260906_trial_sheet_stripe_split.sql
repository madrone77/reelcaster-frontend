-- The phone trial sheet: the sheet that won trial_sheet_pro_v1 (today)
-- against the same offer drawn the way Stripe Checkout draws the page after
-- it. A treatment test, no price in it; both arms charge the control price.
--
-- Arm a is src/app/components/paywall/trial-sheet-pro.tsx, unchanged.
-- Arm b is src/app/components/paywall/trial-sheet-stripe.tsx: Stripe's
-- header and offer block, Stripe's button in our blue, no email field (Stripe
-- takes the address with the card), the rows in Casey's order, a sheet that
-- fills the screen.
--
-- Inserted as running: a deploy that does not know the key serves arm a to
-- everyone and counts nothing, so this is live the moment the code is.
-- Stop it with: update split_tests set status='concluded', stopped_at=now()
-- where key='trial_sheet_stripe_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, started_at)
values (
  'trial_sheet_stripe_v1',
  'Phone trial sheet: full Pro list (today) vs the same sheet in Stripe Checkout''s clothes, no email field',
  'treatment',
  'running',
  'A sheet that reads as the first page of checkout, with one screen fewer between the tap and the card, lifts trial starts per exposure.',
  'paid_conversion',
  false,
  now()
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('trial_sheet_stripe_v1', 'a', 'Full Pro list + email field (today)', 50, true,  '{"sheet":"pro"}'),
  ('trial_sheet_stripe_v1', 'b', 'Stripe-style sheet, no email field',   50, false, '{"sheet":"stripe"}')
on conflict (test_key, variant) do nothing;
