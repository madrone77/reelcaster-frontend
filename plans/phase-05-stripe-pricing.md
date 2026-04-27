# Phase 5 — Stripe + real `/pricing`

2 days. Replaces the Phase 2 placeholder.

## Stripe setup (manual, dashboard)

- Product: "ReelCaster Pro Intel".
- 1 Price: `$79/yr recurring` → `STRIPE_PRICE_ANNUAL`.
- 12 Prices: monthly recurring per calendar month → `STRIPE_PRICE_MONTHLY_<MMM>`. Values per user direction:
  - Low: $5 (Dec/Jan/Feb)
  - Mid: $10 (Mar/Apr/Oct/Nov)
  - High: $15 (May/Jun/Jul/Aug/Sep)
  - Final values to confirm with Casey (open question §spec).

## Files

- `src/lib/stripe.ts` (NEW) — server Stripe client.
- `src/lib/pricing.ts` (NEW) — month → Price ID resolver. `getActiveMonthlyPrice(date = new Date())`.
- `src/app/pricing/page.tsx` — replace stub with full page (recharts seasonal-curve SVG, plan cards, deep-link param highlighting).
- `src/app/components/pricing/season-pricing-graph.tsx` (NEW) — interactive SVG showing 12-month price curve.
- `src/app/api/stripe/checkout/route.ts` (NEW) — POST creates Checkout Session with chosen Price + customer + region metadata.
- `src/app/api/stripe/webhook/route.ts` (NEW) — handles:
  - `checkout.session.completed` → upsert `user_settings.subscription_tier`, `subscription_status='active'`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_period_end`.
  - `customer.subscription.updated` → keep period_end + status in sync.
  - `customer.subscription.deleted` → `subscription_status='cancelled'`, leave tier until period_end.
  - `invoice.payment_failed` → `subscription_status='past_due'`.
  - Idempotent via Stripe event ID dedupe (track in a small `stripe_events` table or use Supabase upsert by event_id).
- `src/app/api/stripe/portal/route.ts` (NEW) — POST returns Customer Portal URL for the current user.

## Region gating at checkout

- "Where do you fish?" dropdown: BC / WA / OR / Other.
- Pre-fill from Vercel `request.geo.region`.
- "Other" → bypass Stripe, redirect to waitlist pin modal (Phase 9).
- Selected region → `user_settings.primary_region_slug`.

## Verification

- Test card 4242 4242 4242 4242 → checkout completes → webhook fires → `subscription_tier='pro_annual'`.
- Spot page (Phase 2) day strip unlocks days 2–14 immediately after checkout success redirect.
- Stripe Customer Portal link from `/account` opens billing UI.
- Subscription cancelled → tier remains until `subscription_period_end`, then flips to free.
- "Other" region → waitlist modal, no Checkout Session created.
