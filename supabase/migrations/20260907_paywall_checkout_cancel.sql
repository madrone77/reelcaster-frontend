-- One more paywall_events kind, for the way back from Stripe.
--
--   checkout_cancel    Stripe's Back arrow landed the reader on /billing/cancel.
--                      Written once by that page on mount, feature and surface
--                      from the rc_wall cookie like the other hop kinds.
--
-- It is the denominator for the free-account offer that page now makes: of
-- the checkout starts that never became a trial, how many came back through
-- our door at all (a closed tab never does), and of those how many took a
-- free account instead. paywall_funnel() is untouched.

alter table public.paywall_events
  drop constraint paywall_events_kind_check;

alter table public.paywall_events
  add constraint paywall_events_kind_check check (
    kind in (
      'impression',
      'cta_click',
      'dismiss',
      'checkout_start',
      'checkout_redirect',
      'checkout_stuck',
      'checkout_cancel'
    )
  );
