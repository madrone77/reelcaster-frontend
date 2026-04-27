# Phase 11 — SEO, polish, launch checklist

½ day.

## Files

- `src/app/sitemap.ts` (NEW or extend) — generate from BlueCaster published cities + spots. Use `getCityList()` + `getSpotList()` helpers in `src/lib/bluecaster.ts`.
- `src/app/robots.ts` (NEW or extend) — block `/my-spots`, `/account`, `/profile`, `/alerts`, `/admin`; allow rest.
- `src/lib/seo.ts` (NEW or extend) — OpenGraph + Twitter Card meta helper.

## Schema.org

- `/fishing` + `/fishing/<province>` → `WebPage` + `BreadcrumbList`.
- `/fishing/<province>/<city>` (existing) → `WebPage` + `Place` + `BreadcrumbList` + `FAQPage`.
- `/fishing/<province>/<city>/<spot>` (existing + Phase 2 additions) → `Place` + `Article` + `BreadcrumbList`.

## Redirects

- `/favorite-spots` → `/my-spots` (301).
- `/profile/custom-alerts` → `/alerts?tab=advanced` (301).
- `/profile` → `/account` (302) if rename happens.

## Launch checklist

Run through spec §"Launch Readiness Checklist" line by line:

- [ ] Auth: Google + email/password.
- [ ] Stripe: annual + 12 monthly Prices configured.
- [ ] At least 3 regions live (BC + WA + OR if WA/OR have content).
- [ ] Top 20+ spots have SEO intros + full data.
- [ ] Explore: map, pins, day strip, sidebar, timeline coordinated.
- [ ] Alerts: creation, list, cron, email, SMS all working.
- [ ] Custom spots: creation, tier detection, list.
- [ ] Pricing: graph, plans, deep-link CTAs.
- [ ] Account: 6 sections functional.
- [ ] Units: prefs working, banner shows + dismisses.
- [ ] Paywall: consistent across all upgrade moments.
- [ ] Email templates: welcome, alert (+ optional weekend forecast).
- [ ] Mobile responsive across primary surfaces.
- [ ] Analytics wired (PostHog events + user props).
- [ ] A/B variant ships as default.
- [ ] LCP < 1.5s on `/fishing/bc/victoria/pedder-bay` (Lighthouse mobile).

## Verification

- `curl /sitemap.xml` lists every published city + spot.
- `curl /robots.txt` blocks private routes.
- Google Rich Results test passes on city, spot, and FAQPage.
- Lighthouse mobile spot page LCP < 1.5s.
