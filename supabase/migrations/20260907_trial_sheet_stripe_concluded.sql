-- trial_sheet_stripe_v1 is decided: arm b (the Stripe-styled sheet with no
-- email field) won, 17 taps through to checkout in 60 exposures against 3 in
-- 53 for the Pro-list control, and the modal now renders that sheet on every
-- phone with no arm read at all
-- (src/app/components/paywall/pro-trial-modal.tsx; trial-sheet-pro.tsx is
-- deleted). Concluding removes the key from every rc_split cookie, which is
-- harmless because nothing reads it.
--
-- Apply this AFTER the deploy: a concluded test on the old code falls back to
-- the control sheet.

update public.split_tests
   set status = 'concluded',
       winner = 'b',
       stopped_at = now(),
       updated_at = now()
 where key = 'trial_sheet_stripe_v1'
   and status <> 'concluded';
