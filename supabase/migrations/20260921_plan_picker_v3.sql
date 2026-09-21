-- plan_picker_v3: three arms on both shapes of the trial modal.
--   a  one annual button (today's control)
--   b  Yearly + Monthly cards, as in v1 and v2
--   c  the same cards drawn like a forecast day tile: the chosen card filled
--      brand blue with white type, the Save badge as the best day's gold tab
-- v1 was a draw; v2 (same arms as v1) is concluded as a draw when v3 starts.
--
-- Code: src/app/components/split-test/use-plan-picker.ts (look 'tile' = c),
-- drawn by src/app/components/paywall/plan-picker.tsx. Surfaces `sheet_plan`
-- and `dialog_plan`. Needs NEXT_PUBLIC_STRIPE_MONTHLY_ON and
-- STRIPE_MONTHLY_PRICE_ID, as before.
--
-- Inserted as DRAFT. Once the FE that reads v3 is live on prod:
--   update split_tests set status='concluded', stopped_at=now(), winner=null
--   where key='plan_picker_v2';
--   update split_tests set status='running', started_at=now()
--   where key='plan_picker_v3';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, example_path)
values (
  'plan_picker_v3',
  'Trial modal: one annual button vs yearly/monthly cards vs day-tile cards',
  'treatment',
  'draft',
  'Yearly beside Monthly converts better per session than the annual price alone, and drawing the chosen card like the selected forecast day (solid brand fill, gold Save tab like BEST) converts better than the plain cards.',
  'paid_conversion',
  false,
  '/fishing/us/wa/seattle?ad=today'
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('plan_picker_v3', 'a', 'One annual button (today)', 34, true,  '{"picker":false}'),
  ('plan_picker_v3', 'b', 'Yearly + Monthly cards',    33, false, '{"picker":true,"look":"card"}'),
  ('plan_picker_v3', 'c', 'Day-tile cards',            33, false, '{"picker":true,"look":"tile"}')
on conflict (test_key, variant) do nothing;
