# PHASE TWO — out of scope, found during the dashboard build pass

Items noticed but deliberately **not** fixed (scope freeze). Pick up in a later pass.

## Identity / display name
- `src/app/explore/components/explore-top-bar.tsx` — the avatar initials are still
  derived from the email local-part (`user.email.slice(0, 2)`). Same anti-pattern the
  build pass removed elsewhere (dashboard greeting, catch-form). Should use the stored
  first name (`storedFirstName`) / a real profile name instead.

## Regulations (task 6 backend)
- The confirmed-vs-expected confidence distinction ships via a new bluecaster payload
  contract (`upcomingRegChanges[]`); see the task-6 PR. Any spots without seeded
  `fishery_notice_changes` / `regulation_seasons` rows fall back to "expected"-only.
