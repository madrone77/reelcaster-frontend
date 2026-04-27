# Phase 9 — Waitlist pins

½ day.

## Files

- `src/app/components/waitlist/waitlist-pin-modal.tsx` (NEW) — modal: map (reuse `MapPicker`), location, species multi-select, email (pre-filled if signed in), submit.
- `src/app/api/waitlist-pins/route.ts` (NEW) — POST inserts into `waitlist_pins` (Phase 0 migration). No auth required. Captures `source` from request body.

## Trigger points

| Surface | Trigger | `source` |
|---|---|---|
| `/explore` overlay | Long-press / right-click on uncovered region | `anon_pin` |
| Search empty state | "Request coverage" CTA | `anon_pin` |
| `/pricing` checkout | "Other" province choice | `plus_upgrade_attempt` |
| `/my-spots` create | Free user in uncovered region | `anon_pin` |
| Score Alert form | Paid user creating alert in uncovered region | `tier3_alert_attempt` |

## Verification

- POST modal as anon → row inserted with `source='anon_pin'`.
- Aggregation query (admin only): `SELECT split_part(reverse(split_part(reverse(<region>),'/', 1)),'/',1), species, count(*) FROM waitlist_pins ...` returns volume by region.
