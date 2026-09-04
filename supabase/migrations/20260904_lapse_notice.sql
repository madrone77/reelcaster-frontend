-- The note sent when a declined card's grace window closes and Pro switches
-- off, and the stamp that keeps it to exactly one send per window.
--
-- Pro lapses in two ways and neither of them emails anybody today:
--   1. Our 7-day grace_until passes while Stripe is still retrying. Nothing
--      fires; entitlement.ts just stops answering yes. The cron at
--      /api/cron/grace-reminders sweeps for these.
--   2. Stripe gives up retrying and cancels the subscription with
--      cancellation_details.reason = 'payment_failed'. The webhook sends.
-- Both claim the send with a conditional UPDATE on this column, so a window
-- that lapses by clock and is then cancelled by Stripe produces one email.
--
-- The webhook resets this to NULL whenever it opens a NEW grace window, and
-- clears it when payment recovers, so a later decline gets its own notice.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS lapse_notice_sent_at timestamptz;

COMMENT ON COLUMN user_settings.lapse_notice_sent_at IS
  'When the "Pro has switched off" notice for the current declined-card window was sent. Claimed with a conditional UPDATE by the cron and the Stripe webhook so exactly one send happens per window. Reset to NULL when a new window opens or the send fails, so the next run retries.';

-- The cron scans for grace windows that have already closed and have not been
-- notified. Partial: a notified, recovered, or cancelled row is never a
-- candidate again.
CREATE INDEX IF NOT EXISTS user_settings_lapse_notice_due_idx
  ON user_settings (grace_until)
  WHERE subscription_status IN ('past_due', 'unpaid')
    AND grace_until IS NOT NULL
    AND lapse_notice_sent_at IS NULL;
