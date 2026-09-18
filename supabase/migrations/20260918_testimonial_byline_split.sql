-- The testimonial cards in the paywall modals. Arm a is today: five small
-- gold stars, the quote, the name in mono at the foot. Arm b is the shape the
-- row under the chart wears: a circle of initials beside the name with the
-- place under it, Trustpilot-style green tiles with the score, then the quote.
--
-- Code: src/app/components/split-test/use-testimonial-byline.ts, read by
-- <Testimonial> in src/app/components/paywall/testimonial.tsx, which the trial
-- sheet, plan choice sheet, Pro upsell and desktop plan matrix all render.
-- Surface: `testimonial`. Exposure = the card row rendered with an arm. No
-- cta_click; the primary metric is paid conversion.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='testimonial_byline_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='testimonial_byline_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'testimonial_byline_v1',
  'Paywall testimonial: pull quote vs review card with byline and tile stars',
  'treatment',
  'draft',
  'A card that opens with the angler (initials circle, name, place) and Trustpilot-style tile stars reads as a review rather than a pull quote and starts more trials per exposure.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('testimonial_byline_v1', 'a', 'Pull quote (today)', 50, true,  '{"testimonial":"quote"}'),
  ('testimonial_byline_v1', 'b', 'Byline + tile stars', 50, false, '{"testimonial":"byline"}')
on conflict (test_key, variant) do nothing;
