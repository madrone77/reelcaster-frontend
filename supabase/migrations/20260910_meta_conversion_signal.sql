-- Everything Meta can match a server-side conversion on, kept on the row.
--
-- StartTrial is now the event the Meta campaign bids on, which changes what
-- this table has to carry. Until today the only identifier that left here was
-- the click id, and `uploadToMeta` refused to send anything without one: of
-- the twelve purchases in the thirty days to 2026-09-10, eight had no click id
-- and were never uploaded at all. The four that were uploaded arrived seven
-- days and two to three MINUTES after the click, just outside Meta's longest
-- attribution window, so not one of them was ever credited to an ad.
--
-- Meta matches a server event on a whole bag of identifiers, not only the
-- click. These four columns are the ones we could hold and did not:
--
--   fbc                 the `_fbc` cookie as fbevents.js wrote it, which is
--                       the click id AND the click time in Meta's own format.
--                       Better than rebuilding it: our rebuild fell back to
--                       the conversion time when the click time was missing,
--                       claiming the click happened a week after it did.
--   client_ip           \ the two fields Meta weights next after email, and
--   client_user_agent   / the two a day-7 purchase has no browser to supply.
--   browser_reported_at when the pixel confirmed it fired its own copy.
--
-- The last one is the interesting one. The pixel on 1209354965605238 has a
-- Conversions API Gateway relaying every browser event to Meta as a server
-- event, so a browser event already reaches Meta twice and a third copy from
-- our uploader is the "Event not deduplicated" flag Ads Manager raised on
-- 2026-09-03. That is why trial_start has been excluded from our upload
-- entirely -- and it is also why a trial whose browser copy never fired (an
-- ad blocker, an in-app browser, a buyer who closed the tab before the
-- success page) reached Meta not once. Recording whether the browser actually
-- reported lets the uploader be the backstop for exactly those, and stay out
-- of the way otherwise.
--
-- Migration CI has been unauthorized for a while, so merging this file does
-- not apply it. Applied to the ReelCaster project via MCP alongside this
-- commit.

alter table public.marketing_conversions
  add column if not exists fbc                 text,
  add column if not exists client_ip           text,
  add column if not exists client_user_agent   text,
  add column if not exists browser_reported_at timestamptz;

comment on column public.marketing_conversions.fbc is
  'Meta _fbc cookie (fb.1.<click_ms>.<fbclid>) as the browser held it at checkout. Preferred over rebuilding from click_id + click_at.';
comment on column public.marketing_conversions.client_ip is
  'Client address of the checkout request, for the Conversions API user_data. Not used by any report.';
comment on column public.marketing_conversions.client_user_agent is
  'Raw user agent of the checkout request, for the Conversions API user_data. The parsed form is in device/os.';
comment on column public.marketing_conversions.browser_reported_at is
  'When the pixel confirmed it fired its own copy of this event. Null means the server upload is the only copy Meta will get.';

-- The uploader asks one question every drain: which trial_start rows are still
-- waiting on a browser copy. Partial, because that is a handful of rows out of
-- a table that grows by a few hundred paywall opens a week.
create index if not exists marketing_conversions_awaiting_browser
  on public.marketing_conversions (occurred_at)
  where upload_status = 'pending' and browser_reported_at is null;
