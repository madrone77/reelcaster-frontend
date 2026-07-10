# Scripts

Utility scripts for one-off migrations, seeding, and integration checks.
(The fishing-report / DFO scraping scripts were removed in the 2026-07 cleanup
along with the scraping system itself.)

| Script | Purpose |
|--------|---------|
| `seed-demo-users.ts` | Create `free@reelcaster.test` + `pro@reelcaster.test` for the e2e suite (see CLAUDE.md → Journey testing) |
| `migrate-notification-preferences.ts` | One-time migration of notification preference rows |
| `run-favorite-spots-migration.ts` | One-time favorite-spots data migration |
| `run-migration-api.ts` | Helper to run SQL migrations through the API |
| `test-marine-api.ts` | Manual integration check against the marine data API |
| `test-twilio-sms.ts` | Manual Twilio SMS send check |
| `migrations/` | SQL migration files used by the runners above |

Run any script with:

```bash
pnpm tsx scripts/<name>.ts
```
