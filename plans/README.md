# ReelCaster v1 Launch Plans

Per-phase execution checklists for the v1 launch. Master plan lives outside the repo at `~/.claude/plans/polymorphic-churning-quilt.md`.

**Order (public pages before payment, per direction):**

| # | Phase | Days | Status |
|---|---|---|---|
| 0 | Foundations: plan folder, envs, migration | 0.5 | in progress |
| 1 | `/fishing` index + `/fishing/bc` province page | 0.5 | pending |
| 2 | Spot page upgrade: 14-day forecast + 24hr chart + paywall stub | 2 | pending |
| 3 | `/explore` upgrade | 2 | pending |
| 4 | Auth: Google OAuth | 1 | pending |
| 5 | Stripe + real `/pricing` | 2 | pending |
| 6 | Alerts: simple Score flow + Twilio SMS + `/alerts` | 1 | pending |
| 7 | Custom spots: `/my-spots` + `[slug]` detail | 1 | pending |
| 8 | Search | 1 | pending |
| 9 | Waitlist pins | 0.5 | pending |
| 10 | Account, units, A/B variant, PostHog | 1 | pending |
| 11 | SEO, polish, launch checklist | 0.5 | pending |

**Total budget:** ~12 working days.

**Confirmed decisions (set during plan):**

- Extend `favorite_spots`, no new `custom_spots` table.
- Keep existing custom-alert engine; add a simple "Score above X" preset on top.
- Full Twilio SMS in v1 (provisioning + opt-in + STOP/HELP).
- Region gating leverages BlueCaster's `/api/v1/hierarchy`; static `COVERED_PROVINCES` list, no PostGIS.
- PostHog replaces Mixpanel.
- Stripe: 1 yearly Price + 12 monthly Prices keyed by month.
- T1/T2/T3 sub-region tiers deferred to v1.1.

**New BlueCaster endpoints (3 total, no new tables):**

- Extend `GET /api/v1/fishing-spots/[id]/score?days=14&hourly=true&species=<id>`
- New `GET /api/v1/spots/by-coordinates?lat=&lng=&radius_km=`
- New `GET /api/v1/search?q=&type=`
