# Section integration tests

Section-presence tests for every public page built during the Phase 0–7 funnel
consolidation. Each spec asserts that the major sections of a page render via
their stable `data-testid` selectors, and that conditional sections are either
present-with-data or explicitly hidden when the upstream data is empty.

These specs cover **public pages only** (no auth required). Auth-gated specs
for Dashboard / Profile / Billing live elsewhere and require a populated
`.env.test`.

## Running

The frontend dev server on port 3004 is auto-started by Playwright's
`webServer` config. Bluecaster on port 3001 is a manual prerequisite:

```sh
# Terminal 1 — Bluecaster
cd bluecaster
npm run dev   # starts on :3001

# Terminal 2 — Frontend + tests
cd reelcaster-frontend
pnpm test:e2e e2e/sections/
```

To run a single spec:

```sh
pnpm test:e2e e2e/sections/city-page.spec.ts
```

To watch a spec headed:

```sh
pnpm test:e2e:headed e2e/sections/city-page.spec.ts
```

## What each spec covers

| Spec | URL(s) | Asserts |
|---|---|---|
| `marketing-home.spec.ts` | `/` | Marketing chrome, hero, how-it-works, featured cities (skips if BC empty), species preview (skips if empty), final CTA, SEO basics |
| `city-page.spec.ts` | `/fishing/bc/victoria-bc`, `/fishing/bc/vancouver-bc` | All 7 always-rendered city sections, plus CitySpots present in Victoria / absent in Vancouver. Conditional sections (conditions strip, species table, access points, local experts) asserted **absent** until the underlying BC data lands. |
| `province-index.spec.ts` | `/fishing/bc` | Marketing chrome, ≥1 city link |
| `spot-page.spec.ts` | `/fishing/bc/victoria-bc/james-island-909cc6` | Hero, score CTA, forecast strip, paywall teaser, signed-out banner. Asserts breakdown panel **absent** (authed-only). |
| `species.spec.ts` | `/species`, `/species/chinook-salmon` | Index list + ≥1 card; detail hero + CTA + optional seasonal calendar |
| `regulations.spec.ts` | `/regulations` | DFO list + GovernmentService JSON-LD |
| `plans.spec.ts` | `/plans`, `/plans?feature=alerts` | Feature callout absent on bare URL, present with `?feature=`; `/pricing` 308s to `/plans` |
| `4xx.spec.ts` | `/v1`, `/14-day-report`, `/map-test`, unknown city | Each returns HTTP 404 (not a soft 200 with inline error) |

## Data prerequisites

The specs degrade gracefully when data is missing — each per-page spec uses
`test.skip()` if the city/spot/species record isn't seeded. For the suite to
run **green**, the BC database needs:

- `city_pages` rows for `vancouver-bc` and `victoria-bc` with `status='published'`.
- `spot_pages` row for `james-island-909cc6` with `status='published'`.
- `cities/victoria-bc/spots` returns ≥1 spot (i.e., the BC `cities/[slug]/spots`
  filter accepts a spot when its `spot_pages.status='published'`).
- `species` table has `chinook-salmon`.

All of the above are true in the active Supabase project (`bluecaster`,
`szbrwccppikqkystlgmq`) as of 2026-05-07.

If a spec skips with a "not published" message, seed the missing row via the
Supabase MCP or the BC admin UI before re-running.

## Why the section-absent assertions matter

Several city-page sections deliberately render `null` today because Bluecaster
returns empty data:

- `section-city-conditions-strip` — `conditions_now` is hardcoded `null` in
  `bluecaster/app/api/v1/cities/[slug]/page/route.ts:171` (Phase 2 stub).
- `section-city-species-table` — `species_table` is `[]` because the spot-level
  species rollup hasn't been computed for the city.
- `section-city-access-points` — `city_access_points` table is empty for
  Vancouver and Victoria.
- `section-city-local-experts` — `city_charters` is empty.

The specs assert these are **absent today**. When someone backfills any of
those data sources, the corresponding `toHaveCount(0)` assertion will start
failing — that's the signal the data has landed and the assertion should flip
to `toBeVisible()`. Treat a failure here as a feature flag, not a regression.

## Scope notes

- **Auth-gated pages out of scope.** Dashboard, Profile, Billing, Alerts, and
  My-Spots have section testids in place from earlier phases but no
  section-presence specs. Adding them requires `.env.test` with seeded
  Supabase test users, which is its own follow-up.
- **No visual regression.** These specs check only that a testid exists and is
  visible. Pixel-level diffs are a separate concern.
- **Local only.** baseURL is `http://localhost:3004` (set via
  `playwright.config.ts`). Pointing at staging/prod is a CI workflow change,
  not part of this suite.
