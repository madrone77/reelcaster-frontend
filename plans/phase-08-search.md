# Phase 8 — Search

1 day.

## BlueCaster (1 endpoint)

`GET /api/v1/search?q=&type=spot|city|region&limit=20` (NEW):

- Wraps existing `/admin/search` query (Postgres FTS + pg_trgm on `places.name + cities.name + spots.name`).
- Public via `x-api-key`.
- Ranking: exact match → prefix → fuzzy. Distance from query lat/lng as tiebreaker if provided.
- File: `bluecaster/src/app/api/v1/search/route.ts`.

## Frontend

- `src/app/components/search/global-search.tsx` (NEW) — command-palette style (use shadcn `Command`), keyboard shortcut `cmd+k`.
- Mount in app shell header on all surfaces.
- Empty state per spec: "No spots found in [query]. ReelCaster is live in BC, WA, OR. [Request coverage]" → opens waitlist pin modal pre-filled with query string as species/notes.

## Verification

- "victoria" returns Victoria city + Pedder Bay + Sidney spots.
- "miami" returns empty + waitlist CTA.
- cmd+k opens, esc closes, arrow keys navigate.
