-- The nudge two days before a declined card's grace window closes, and the
-- stamp that keeps it to exactly one send per window.
--
-- A declined day-7 charge on the annual plan costs the whole year. Today the
-- customer gets one email at the decline and then nothing until Pro quietly
-- lapses. This column backs /api/cron/grace-reminders, which sends a second
-- note when there are two days left. Claimed with a conditional UPDATE the
-- same way trial_reminder_sent_at is, so a retried or overlapping run cannot
-- send the note twice.
--
-- The webhook resets this to NULL whenever it opens a NEW grace window, and
-- clears it when payment recovers, so a decline a year from now gets its own
-- nudge.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS grace_reminder_sent_at timestamptz;

COMMENT ON COLUMN user_settings.grace_reminder_sent_at IS
  'When the grace-ending nudge for the current declined-card window was sent. Claimed with a conditional UPDATE by the cron so exactly one send happens per window. Reset to NULL when a new window opens or the send fails, so the next run retries.';

-- The cron scans for grace windows closing inside the next 2 days that have
-- not been nudged. Partial: a nudged, recovered, or cancelled row is never a
-- candidate again.
CREATE INDEX IF NOT EXISTS user_settings_grace_reminder_due_idx
  ON user_settings (grace_until)
  WHERE subscription_status IN ('past_due', 'unpaid')
    AND grace_until IS NOT NULL
    AND grace_reminder_sent_at IS NULL;
