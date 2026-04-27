# Phase 7 — Custom spots: `/my-spots` + `[slug]` detail

1 day.

## Routes

- `src/app/my-spots/page.tsx` (NEW or moved from `/favorite-spots`)
- `src/app/my-spots/[slug]/page.tsx` (NEW) — owner-only, `noindex`.
- 301: `/favorite-spots` → `/my-spots`.

## BlueCaster (1 endpoint)

`GET /api/v1/spots/by-coordinates?lat=&lng=&radius_km=` (NEW):

- PostGIS `ST_DWithin` over `fishing_spots`. Returns nearest published spots, best-fit `city`, nearest `tidal_station`, `dfo_area` if known, plus a "suggested species fingerprint" (top species for the city). Falls back to nullable fields where no match.
- File: `bluecaster/src/app/api/v1/spots/by-coordinates/route.ts`.

## Creation flow

1. User clicks "Add custom spot" on `/my-spots`.
2. Mapbox picker (existing `MapPicker`) → user picks lat/lng + name + notes.
3. Frontend calls `GET /api/v1/spots/by-coordinates?lat=&lng=` → fills `tide_offset_minutes`, `dfo_area`, `suggested_species_fingerprint`, `coverage_tier`.
4. POST `/api/favorite-spots` writes the row.
5. Tier gate in API handler:
   - Free + uncovered region → modal "Add to waitlist instead" (Phase 9).
   - Free + covered → allow up to 5 spots.
   - Paid + any region → unlimited; `coverage_tier='t3'` if outside covered list.

## Detail page

- `src/app/my-spots/[slug]/page.tsx` — owner-only (RLS already enforces).
- `noindex` meta.
- Reuse Phase 2 components: `<DayStrip>`, `<TwentyFourHourChart>`, `<BreakdownPanel>`.
- Forecast fetched from `GET /api/v1/spots/by-coordinates` for context + `GET /api/v1/fishing-spots/<nearest_id>/score?days=14` for scoring.

## Verification

- Create spot in BC → enrichment populates tide_offset + dfo_area.
- Create spot in Florida as paid user → `coverage_tier='t3'`, still works.
- Create spot in Florida as free user → waitlist modal.
- Detail page renders 14-day forecast scoped to nearest published spot.
- `/favorite-spots` 301s to `/my-spots`.
- robots.txt blocks `/my-spots` from crawl.
