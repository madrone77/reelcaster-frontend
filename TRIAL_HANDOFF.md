# Handoff — finish the annual price so the 7-day trial can go live

**Branch:** `claude/pro-trial-annual` (reelcaster-frontend)
**Status:** code complete, typechecked, lint clean. Blocked on Stripe config + one migration.

The 7-day trial is annual-only by design: monthly stays instant-charge, so
"start your trial" and "buy the yearly plan" are the same decision for the
customer. That means **the whole trial flow is gated on an annual Price that
doesn't exist yet.**

---

## What's blocking

`src/lib/pricing.ts` has always shipped this:

```ts
export const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID ?? '';
```

In production that env var is unset, so `ANNUAL_PRICE_ID` is an empty string.
Before this branch, annual checkout handed Stripe an empty price and got an
opaque 400. Now it returns a clean `503 plan_unavailable` — but either way,
nobody can buy the annual plan or start a trial until the Price exists.

---

## Task 1 — Create the annual Price in Stripe

In the **live** Stripe account (and mirror it in test mode first):

- Product: the existing **ReelCaster Pro** product — do not create a second
  product, the monthly $5 price already hangs off it.
- New recurring Price: **$33.00 CAD, billing period = yearly.**
- Currency must match the existing monthly price's currency. Check
  `price_1TQpJa2a2BXhmPNuiKaaurSJ` (the live monthly) and match it exactly —
  a currency mismatch between the two prices will break plan switching in the
  customer portal.
- Copy the resulting `price_...` id.

Sanity check against the code: `src/lib/pricing.ts` derives all the marketing
copy from `MONTHLY_PRICE_CENTS = 500` and `ANNUAL_PRICE_CENTS = 3300`. If you
create the Price at any amount other than $33, the page will advertise a
discount that doesn't match the charge. Change the constant and the Price
together or not at all.

---

## Task 2 — Set env vars on Vercel

Project: **reelcaster-frontend**, scope `casey-1425s-projects`. Production +
Preview.

Verified against `vercel env ls production` on 2026-07-26:

| Var | State | Action |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✅ present (sensitive) | none |
| `STRIPE_WEBHOOK_SECRET` | ✅ present (sensitive) | none |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ present — **`pk_live_`** | none |
| `STRIPE_ANNUAL_PRICE_ID` | ❌ **absent** | set to the `price_...` from Task 1 |
| `STRIPE_MONTHLY_PRICE_ID` | ❌ absent | optional — code falls back to the hardcoded `price_1TQpJa2a2BXhmPNuiKaaurSJ` |

Note that sensitive variables do **not** appear in `vercel env pull` output. Use
`vercel env ls` to check presence, or you'll conclude a variable is missing when
it isn't.

⚠️ Production Stripe is **live mode**. The `$33/yr` price on the decoy
`reelcaster-frontend-web` project (`price_1TxXWJ2a2BXhmPNuDTgruits`) is
**test-mode** and must not be copied here — a live key rejects a test price, which
would turn a clean `503 plan_unavailable` into a hard Stripe error.

Env changes don't take effect until a redeploy. This project deploys via CLI,
not git:

```bash
vercel --prod --scope casey-1425s-projects
```

---

## Task 3 — Apply the migration

`supabase/migrations/20260726_pro_trial_and_grace.sql` — run it against the
ReelCaster Supabase project (`pehcvwiwtubzfgahuzuz`).

It adds four columns to `user_settings` (`has_used_trial`, `trial_started_at`,
`trial_ends_at`, `grace_until`) and creates `trial_grants`, the anti-abuse
ledger. `trial_grants` has RLS enabled with **no policies** — that's
deliberate, it's service-role only and must never be readable from the client.

All additive, no destructive statements, safe to run on the live DB.

---

## Task 4 — Add the Stripe webhook events

The webhook endpoint needs two events it isn't currently subscribed to:

- `customer.subscription.trial_will_end` — fires 3 days out and sends the
  "your trial ends Thursday, we'll charge $33" email. **This one is not
  optional.** A card-required trial that auto-charges needs clear advance
  notice of the date and amount under Canadian consumer-protection rules and
  the US FTC negative-option rule.
- `invoice.payment_succeeded` — closes the past-due grace window when a
  retry succeeds.

Existing subscribed events stay as they are.

---

## Task 4b — The sales + checkout pages

`/plans` is the sales page and `/plans/checkout` is the order summary. Both are
built and committed, and both **degrade honestly while the annual Price is
missing**: `/plans` drops all trial language and sells the monthly plan,
`/plans/checkout` shows paid terms. Once Tasks 1–3 are done they start selling
the trial on their own — no code change needed.

Two follow-ups that are decisions, not bugs:

- **Nothing links to `/plans` yet.** The header's "Start free trial" button
  goes to `/signup` and the footer's "Pro pricing" goes to `/pricing`. Pointing
  one or both at `/plans` is a funnel call worth making deliberately.
- **`/pricing` and `/plans` are both indexable** and sell the same thing, which
  splits SEO signal. `/plans` is the stronger page; the tidy fix is a permanent
  redirect `/pricing → /plans`, keeping `/pricing?plan=monthly` working since
  the monthly checkout flow and the billing emails point there.

Two implementation notes:

- `/plans/checkout` reads trial eligibility from `GET /api/stripe/checkout`
  **before** drawing the button, so the terms it shows are the terms the
  customer gets. Eligibility fails closed, so an unapplied migration shows paid
  terms rather than promising a trial the checkout would then break.
- Two routing gates had to be opened: `src/middleware.ts` (the coming-soon wall)
  and `src/app/components/auth/auth-gate.tsx` (which bounced signed-out visitors
  to a bare `/login`, dropping the return path). Any new route under `/plans` is
  already covered by both.

---

## Running the e2e suite

`.env.test` is gitignored and not in the repo. To recreate it:

```bash
npx vercel env pull /tmp/live.env --environment=production --yes
```

Then fill `.env.test` from `.env.test.example` using those values, plus
**Stripe TEST-mode keys only** (`sk_test_…`). The live project's Stripe secret
is marked sensitive in Vercel and is live-mode — never put it in `.env.test`.

Two purpose-made accounts exist for this, created 2026-07-26 with random
passwords: `playwright-free@reelcaster.test` and `playwright-pro@reelcaster.test`.

Also note the worktree needs real `node_modules` (`pnpm install`) — a symlinked
`node_modules` makes Turbopack fail with "Next.js package not found", and
`npx playwright install chromium` must match the Playwright version pnpm
resolves.

> ⚠️ **There is no separate test Supabase project.** `.env.test` points at
> production (`pehcvwiwtubzfgahuzuz`), and `e2e/fixtures/users.ts` DELETES alert
> profiles and favourites and overwrites subscription tier for whatever accounts
> `TEST_*_USER_EMAIL` names. Keep those on the two `playwright-*` accounts. A
> dedicated test project is the real fix — the repo's own
> `.env.test.example` says test users should not live in prod.

## Task 5 — Test-mode dry run before going live

With test-mode keys and a test annual Price:

1. **Happy path** — subscribe with `4242 4242 4242 4242`. Expect
   `subscription_status = 'trialing'`, `subscription_tier = 'pro_annual'`,
   `has_used_trial = true`, and one `trial_grants` row with a
   `card_fingerprint`. 14-day forecasts should unlock immediately.
2. **Re-trial, same account** — cancel, then subscribe again. Expect **no**
   trial (charged immediately) and no error shown to the customer. This is
   intentional: we never tell someone they've been flagged.
3. **Re-trial, plus-addressed email, same card** — new account as
   `you+2@gmail.com`, same test card. Expect the subscription cancelled with
   **no charge** and the "we couldn't start that trial" email. Confirm in the
   Stripe dashboard that no invoice was paid.
4. **Past-due grace** — use `4000 0000 0000 0341` (attaches fine, fails on
   charge). At trial end the invoice fails; expect `grace_until` set ~7 days
   out, Pro features still working, and the "update your card" email. Then
   hand-edit `grace_until` to a past timestamp and confirm Pro switches off
   without any cron running.
5. **Recovery** — update to a good card inside the window, confirm
   `grace_until` clears and status returns to `active`.

---

## What changed in the code, briefly

- `src/lib/entitlement.ts` — **new.** Single `resolveEntitlement()`. Six API
  routes used to hand-roll the tier check and had already drifted apart
  (`tier.startsWith('pro')` in three, explicit tier equality in the other
  three). That drift is how `map/forecast-14d` leaked all 14 days before
  2026-07-22. All six now call the one helper.
- `src/lib/trial.ts` — **new.** Eligibility checks and email normalization.
- `src/lib/email-templates/billing.ts` — **new.** Trial-ending, payment-failed,
  and duplicate-card emails.
- `src/app/api/stripe/checkout/route.ts` — attaches `trial_period_days: 7` on
  the annual plan when eligible; 503s when the price id is missing.
- `src/app/api/stripe/webhook/route.ts` — trial bookkeeping, fingerprint check,
  grace window. Now holds the paid tier through `past_due`/`unpaid` instead of
  dropping it instantly.

### One thing worth knowing about grace

Entitlement is resolved **at read time** against `grace_until`, not written
into `subscription_tier`. So an expired grace window lapses on its own — there
is no cron job or sweeper to schedule, and nothing to go stale if a webhook is
missed. The tradeoff is that `subscription_tier` in the DB reads `pro_annual`
for someone whose grace has lapsed; **don't query that column directly to
decide access.** Use `resolveEntitlement()`.

### Pre-existing issues, not from this branch

`npx tsc --noEmit` reports six errors on this branch, all pre-existing: four
missing optional deps (`exifr`, `heic2any`, `browser-image-compression`,
`country-flag-icons`, `@vercel/oidc`) and an apiVersion mismatch in
`src/lib/stripe.ts`. Note that prod builds with **pnpm** — `pnpm-lock.yaml` is
the source of truth — and the pinned `apiVersion` must match whatever stripe
version pnpm resolves, or the build breaks. Worth fixing separately.
