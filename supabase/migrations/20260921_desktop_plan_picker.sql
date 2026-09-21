-- desktop_plan_picker_v1: the plan cards on the desktop trial dialog only.
--   a  the single annual button (control), customer quote beside it
--   b  Yearly + Monthly cards, customer quote beside it
-- plan_picker_v2 asked this on both shapes; the phone has moved on to
-- plan_picker_v3 (cards vs day-tile cards), and desktop had too few readers
-- to answer (about 20 dialog views, no trials, 2026-09-19 to 09-21), so it
-- asks again here, desktop alone. Surface `dialog_plan`.
-- Code: src/app/components/split-test/use-plan-picker.ts.
--
-- Inserted as DRAFT. Once the FE that reads it is live on prod, in the same
-- change that starts plan_picker_v3:
--   update split_tests set status='running', started_at=now()
--   where key='desktop_plan_picker_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, example_path)
values (
  'desktop_plan_picker_v1',
  'Desktop trial dialog: one annual button vs yearly/monthly cards (quote on both)',
  'treatment',
  'draft',
  'On the desktop trial dialog, a yearly card with a Save badge beside a monthly card converts better per session than the annual price alone.',
  'paid_conversion',
  false,
  '/fishing/us/wa/seattle?ad=today'
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('desktop_plan_picker_v1', 'a', 'One annual button', 50, true,  '{"picker":false}'),
  ('desktop_plan_picker_v1', 'b', 'Yearly + Monthly cards', 50, false, '{"picker":true}')
on conflict (test_key, variant) do nothing;
