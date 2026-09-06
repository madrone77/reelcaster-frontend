-- trial_sheet_pro_v1 is decided: arm b (full Pro list + testimonial) won,
-- 5 trials in 140 exposures against 1 in 100 for the control, and the modal
-- now renders that sheet on every phone with no arm read at all
-- (src/app/components/paywall/pro-trial-modal.tsx). Concluding removes the
-- key from every rc_split cookie, which is now harmless because nothing
-- reads it.
--
-- On 2026-09-06 the weights were set to a=0 / b=100 with the row still
-- running, so b reached every new visitor before this code deployed. Apply
-- this AFTER the deploy: a concluded test on the old code falls back to the
-- control sheet.

update public.split_tests
   set status = 'concluded',
       winner = 'b',
       stopped_at = now(),
       updated_at = now()
 where key = 'trial_sheet_pro_v1'
   and status <> 'concluded';
