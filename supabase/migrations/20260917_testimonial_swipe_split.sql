-- The customer quote in the paywall modals. Arm a is today: one quote, Bob's
-- with five stars, or Nick's (no stars) for a Washington reader. Arm b: a
-- swipe row of both quotes, the reader's region's first, no stars on either.
--
-- Code: src/app/components/split-test/use-testimonial-swipe.ts, read by
-- <Testimonial> in src/app/components/paywall/testimonial.tsx, which the trial
-- sheet, plan choice sheet, Pro upsell and desktop plan matrix all render.
-- Surface: `testimonial`. Exposure = the quote block rendered with an arm. No
-- cta_click; the primary metric is paid conversion.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='testimonial_swipe_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='testimonial_swipe_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'testimonial_swipe_v1',
  'Paywall testimonial: one quote vs swipe through both',
  'treatment',
  'draft',
  'Two real anglers, the reader''s local one first, in a swipe row with no stars, start more trials per exposure than one quote with stars.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('testimonial_swipe_v1', 'a', 'One quote (today)', 50, true,  '{"testimonial":"single"}'),
  ('testimonial_swipe_v1', 'b', 'Swipe both, no stars', 50, false, '{"testimonial":"swipe"}')
on conflict (test_key, variant) do nothing;
