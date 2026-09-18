-- The plan picker on the phone trial sheet. Arm a is today: one annual
-- button under "7 days free". Arm b: two cards under the title, Yearly
-- preselected with the free week and a "Save 35%" badge, Monthly billed
-- today with no trial. Same rows, same testimonial, same button under both.
--
-- Code: src/app/components/split-test/use-plan-picker.ts, read by
-- TrialSheetStripe in src/app/components/paywall/trial-sheet-stripe.tsx.
-- Phone sheet only. Surface: `sheet_plan`. Exposure = the sheet rendered
-- with an arm; cta_click = the buy button pressed on either card.
--
-- The picker also needs STRIPE_MONTHLY_PRICE_ID and
-- NEXT_PUBLIC_STRIPE_MONTHLY_ON=1 on the Vercel project; without them arm b
-- is never drawn and nothing is counted, whatever this row says.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='plan_picker_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='plan_picker_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'plan_picker_v1',
  'Phone sheet: one annual button vs yearly/monthly cards',
  'treatment',
  'draft',
  'A yearly card with a Save badge beside a monthly card gets more taps through to Stripe and more paid conversions per sheet exposure than the annual price standing alone, without the monthly card taking most of the buyers.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('plan_picker_v1', 'a', 'One annual button (today)', 50, true,  '{"picker":false}'),
  ('plan_picker_v1', 'b', 'Yearly + Monthly cards',    50, false, '{"picker":true}')
on conflict (test_key, variant) do nothing;
