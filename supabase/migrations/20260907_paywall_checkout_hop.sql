-- Two more paywall_events kinds, for the step between "a Stripe session was
-- created" and "a trial landed" that nothing recorded (2026-09-06: ten
-- checkout starts in a row with no completed Stripe session, and no way to
-- tell a swallowed redirect from a buyer who reached Stripe and left).
--
--   checkout_redirect  the browser asked to leave for Stripe's URL. Written by
--                      the client the instant before location.href is set,
--                      with context.session = the Stripe Checkout session id.
--   checkout_stuck     three seconds later the same document was still the
--                      visible one. The client also draws the URL as a plain
--                      link at that point. See src/lib/checkout-redirect.ts.
--
-- Both take feature and surface from the rc_wall cookie on the server, the
-- same way checkout_start does, so the three rows for one buyer name one wall.
--
-- paywall_funnel() is untouched: it counts named kinds and ignores the rest.

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
      'checkout_stuck'
    )
  );
