# Phase 2 — Spot page: 14-day forecast + 24hr chart + paywall stub

**Public.** Paywall is a stub UI in this phase; Stripe lands in Phase 5. 2 days.

## BlueCaster (1 endpoint)

Extend `GET /api/v1/fishing-spots/[id]/score`:

- New params: `days=1..14` (default 1), `hourly=true|false` (default false), `species=<id>` (existing).
- Implementation: loop the existing scorer over `days * 24` hour slots. Read from `session_scores` first (already partial), fill missing with on-demand compute. Cache filled rows back into `session_scores` keyed by `(spot_id, species_id, hour_utc)` — leverages existing 6× daily score-sessions cron.
- Response shape:

  ```json
  {
    "spot_id": "...",
    "species_id": "...",
    "days": [
      {
        "date": "2026-04-25",
        "peak_hour": 11,
        "peak_score": 82,
        "hourly": [
          { "hour_utc": "2026-04-25T08:00Z", "score": 41, "factors": { "tide": 0.6, "pressure": 0.2, "moon": 0.1, "season": 0.1 } }
        ]
      }
    ]
  }
  ```

- File: `bluecaster/src/app/api/v1/fishing-spots/[id]/score/route.ts` — extend handler. No new table.

## Frontend

### Components (new)

- `src/app/components/forecast/day-strip.tsx` — horizontal scroll, day cards (date, color swatch from peak score, peak score, peak time). Lock state for free user on days 2–14 (Variant A: color visible, score blurred + lock icon).
- `src/app/components/forecast/twenty-four-hour-chart.tsx` — SVG chart. Layers: score line, peak window band (75th percentile), tide curve secondary axis, daylight wash, hour gridlines (6/12/18/00), "now" marker, scrub marker. Pointer events desktop, touch events mobile. Emits `onHourChange(hour)`.
- `src/app/components/forecast/breakdown-panel.tsx` — fixed right column (desktop) / stacked (mobile). Reads `factors` object, renders rows: factor name, human-language state, contribution arrow.
- `src/lib/factor-language.ts` (NEW) — lookup tables per spec §5: Tide (9 states), Pressure (5), Season (N), Moon (8). Function `humanize(factor: string, value: number, raw: any): string`.

### Updates

- `src/app/fishing/[...slug]/page.tsx` — for spot pages (3-segment slugs):
  - Server-side fetch `score?days=14&hourly=true&species=<primary>`.
  - Render existing hero + add `<DayStrip>` (10 days for free, 14 for paid based on `subscription_tier`).
  - Render `<TwentyFourHourChart>` + `<BreakdownPanel>` synced via React state.
  - Defer chart hydration: `const TwentyFourHourChart = dynamic(() => ..., { ssr: false })`.

### Paywall stub

- `src/app/components/forecast/paywall-modal.tsx` (NEW) — modal "Unlock 14-day forecast — Pro Intel from $5/mo" → CTA `/pricing?from=spot&day=N&species=X`.
- `/pricing` is a placeholder page in this phase: static plan-comparison cards, no Stripe yet. Phase 5 replaces it.
- Tier read: server-side via `user_settings.subscription_tier`. Default `'free'` until Phase 5.

## Verification

- `/fishing/bc/victoria/pedder-bay` SSR LCP < 1.5s on Lighthouse mobile.
- 24hr chart hover/scrub updates breakdown panel within one frame.
- Free user sees days 1 unlocked, 2–14 locked with color tease + lock icon. Click → paywall modal.
- Paid user (manual `subscription_tier='pro_annual'` UPDATE in supabase) sees all 14 days.
- `factor-language.ts` returns "Early ebb" / "1012mb, falling" / etc. for sample inputs.
