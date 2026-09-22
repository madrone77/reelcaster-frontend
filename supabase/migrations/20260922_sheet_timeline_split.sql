-- sheet_timeline_v1: the phone trial sheet, redrawn around a trial timeline.
--   a  the live Stripe-styled sheet (control)
--   b  blue Pro banner, a headline naming the place, cards and rows scrolling
--      under a pinned footer: Today / reminder email / trial ends, the email
--      field, the button (Casey's design, 2026-09-22)
--
-- Phone only, surface `sheet_timeline`. A wall that hands in its own href
-- draws the control and counts nothing. Runs alongside plan_picker_v3: arm b
-- never draws v3's picker, so v3 reads on arm a's readers alone.
--
-- Code: src/app/components/split-test/use-sheet-timeline.ts, drawn by
-- src/app/components/paywall/trial-sheet-timeline.tsx.
--
-- Inserted as DRAFT. Once the FE that reads it is live on prod:
--   update split_tests set status='running', started_at=now()
--   where key = 'sheet_timeline_v1';
-- and add it to EXPECTED_SPLITS in bluecaster lib/bluecaster/sentinel/truth.ts.

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, example_path)
values (
  'sheet_timeline_v1',
  'Phone trial sheet: Stripe-styled vs timeline sheet',
  'treatment',
  'draft',
  'A phone sheet with the button pinned and a Today / reminder / charge timeline above it gets more trials and sales per session than the Stripe-styled sheet.',
  'paid_conversion',
  false,
  '/fishing/us/wa/seattle?ad=today'
)
on conflict (key) do update set name = excluded.name, hypothesis = excluded.hypothesis
  where split_tests.status = 'draft';

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('sheet_timeline_v1', 'a', 'Stripe-styled sheet', 50, true,  '{"sheet":"stripe"}'),
  ('sheet_timeline_v1', 'b', 'Timeline sheet',      50, false, '{"sheet":"timeline"}')
on conflict (test_key, variant) do update
  set label = excluded.label, weight = excluded.weight, is_control = excluded.is_control;
