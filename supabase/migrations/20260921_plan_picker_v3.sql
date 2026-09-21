-- plan_picker_v3: how to draw the plan cards, on the phone trial sheet.
--   b  Yearly + Monthly cards, as in v1 and v2 (control)
--   c  the same cards drawn like a forecast day tile: the chosen card filled
--      brand blue with white type, the Save badge as the best day's gold tab
-- The one-button arm is retired on the phone (Casey, 2026-09-21): every phone
-- reader gets cards, and with no arm the sheet draws b. v2 (button vs cards)
-- concludes for the cards when v3 starts; desktop asks v2's question again on
-- its own in desktop_plan_picker_v1. testimonial_none_v1 concludes the same
-- day for no quote on the phone sheet; desktop, plan choice and Pro upsell
-- keep the quote.
--
-- Code: src/app/components/split-test/use-plan-picker.ts (look 'tile' = c),
-- drawn by src/app/components/paywall/plan-picker.tsx. Surface `sheet_plan`.
-- Needs NEXT_PUBLIC_STRIPE_MONTHLY_ON and STRIPE_MONTHLY_PRICE_ID, as before.
--
-- Inserted as DRAFT (first as a three-arm row; this is the row as it runs).
-- Once the FE that reads it is live on prod:
--   update split_tests set status='concluded', stopped_at=now(), winner='b'
--   where key in ('plan_picker_v2', 'testimonial_none_v1');
--   update split_tests set status='running', started_at=now()
--   where key in ('plan_picker_v3', 'desktop_plan_picker_v1');

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, example_path)
values (
  'plan_picker_v3',
  'Trial modal: yearly/monthly cards vs day-tile cards',
  'treatment',
  'draft',
  'Drawing the chosen plan card like the selected forecast day (solid brand fill, gold Save tab like BEST) converts better per session than the plain cards.',
  'paid_conversion',
  false,
  '/fishing/us/wa/seattle?ad=today'
)
on conflict (key) do update set name = excluded.name, hypothesis = excluded.hypothesis
  where split_tests.status = 'draft';

delete from public.split_test_variants where test_key = 'plan_picker_v3' and variant = 'a';

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('plan_picker_v3', 'b', 'Yearly + Monthly cards', 50, true,  '{"picker":true,"look":"card"}'),
  ('plan_picker_v3', 'c', 'Day-tile cards',         50, false, '{"picker":true,"look":"tile"}')
on conflict (test_key, variant) do update
  set label = excluded.label, weight = excluded.weight, is_control = excluded.is_control;
