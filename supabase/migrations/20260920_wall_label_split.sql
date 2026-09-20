-- The Pro trial modal names the lock that was pressed. Arm a is today: the
-- desktop dialog leads "See the next 14 days at <spot>" whatever was
-- pressed, the phone sheet leads straight into "Try ReelCaster Pro". Arm b
-- puts one line over the offer on both shapes, per wall: "Unlock all
-- spots" for a padlocked pin, "Unlock the full 14-day forecast" for a
-- locked day, "Unlock score alerts" for the bell, and so on for every lock
-- in the product (src/lib/plan-features.ts WALL_UNLOCK_LABELS).
--
-- Code: src/app/components/split-test/use-wall-label.ts, read by
-- src/app/components/paywall/pro-trial-modal.tsx (dialog) and
-- trial-sheet-stripe.tsx (sheet). Exposure = the modal opened with an arm;
-- cta_click = the buy button pressed. Surface is `<shape>_<feature>` so the
-- read is per lock.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='wall_label_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='wall_label_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, example_path)
values (
  'wall_label_v1',
  'Trial modal: names the lock pressed vs plain offer',
  'treatment',
  'draft',
  'A trial modal that leads with what the pressed lock unlocks ("Unlock all spots", "Unlock the full 14-day forecast") starts more trials per exposure than the same modal leading with the plan.',
  'paid_conversion',
  false,
  '/fishing/us/wa/seattle?ad=today'
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('wall_label_v1', 'a', 'Plain offer',        50, true,  '{"label":false}'),
  ('wall_label_v1', 'b', 'Names the lock',     50, false, '{"label":true}')
on conflict (test_key, variant) do nothing;
