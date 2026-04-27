# Phase 10 — Account, units, A/B variant, PostHog

1 day.

## /account (replace existing /profile UX)

`src/app/profile/page.tsx` already exists. Refactor into 6 sections per spec:

1. **Profile** — name, email, avatar.
2. **Subscription** — current tier, period end, "Manage billing" → Phase 5 portal endpoint.
3. **Units** — 6 prefs: wind, temp, tide height, wave height, distance, pressure. Locale-aware defaults.
4. **Notifications** — alert delivery channels, phone verify CTA.
5. **Region** — `primary_region_slug` (BC/WA/OR/Other).
6. **Danger** — cancel subscription + delete account.

Optional: rename URL `/profile` → `/account` with redirect (spec uses `/account`).

## Units

- `src/app/utils/formatters.ts` (existing) — extend to handle wave_height, distance, pressure.
- `src/lib/user-preferences.ts` (existing) — surface 6 new unit prefs.
- Strict abbreviation constants in `src/lib/units.ts` (NEW): wind {kph, mph, kn}, temp {°C, °F}, height {m, ft}, distance {km, mi, nm}, pressure {mb, inHg}.
- Locale defaults: Canada → metric except wind=knots, height=feet; US → mph, °F, ft, mi, inHg, height=ft.
- Units banner: shows on first regional/spot page visit; dismiss → `has_dismissed_units_banner=true`.

## A/B variant

- Default `locked_day_variant='tease'` already set in Phase 0 migration.
- On first sign-in (or first row creation), hash `user.id` to 50/50 in `auth-context.tsx`. Sticky forever.
- Phase 2 day-strip already reads it; no changes there.
- Ship Variant A at launch; flip the test 2–4 weeks post-launch via a single SQL update.

## PostHog

- `src/lib/analytics.ts` (existing — currently calls Mixpanel). Swap to `posthog-js` + `posthog-node`.
- Auto-capture handles page views, UTM, referrer.
- Custom events per spec:
  - `upgrade_cta_clicked` (feature, surface)
  - `alert_create_started/completed/abandoned`
  - `signup_started/completed` (auth method)
  - `subscription_started/completed`
  - `custom_spot_created`
  - `waitlist_pin_submitted`
- User properties: `tier`, `region`, `days_since_signup`, `active_alert_count`. Set on auth events.

## Verification

- Toggle wind unit kph→mph → all forecasts/alerts re-render in mph.
- A/B: 2 fresh sign-ups → ~50/50 split on `locked_day_variant`. Check distribution after 100 sign-ups.
- PostHog dashboard shows `upgrade_cta_clicked` events with feature + surface tags.
