# Phase 3 — `/explore` upgrade

**Public.** Reuse existing forecast-map foundation. 2 days.

## Route

- `src/app/explore/page.tsx` (NEW)

## Foundation

Reuse `src/app/components/forecast/forecast-map.tsx`. Theme-update only — keep `rc-*` dark palette.

## State

Coordinated, URL-encoded:

```
/explore?spot=pedder-bay&day=2026-04-26&hour=14&species=chinook&min_score=60
```

## Layout

- **Top:** species filter chips (multi-select). Updates pin colors + day-strip scores.
- **Map (center):** Mapbox with clustered pins (existing). Pin color = peak score for selected day/species. Hover/click pin → sets `?spot=<slug>`.
- **Right sidebar (desktop) / bottom sheet (mobile):** conditions + breakdown panel (reuse Phase 2 `<BreakdownPanel>`) + spot metadata.
- **Below map:** day strip (reuse Phase 2 `<DayStrip>` in horizontal scroll mode).
- **Bottom:** scrubbable 24hr score curve (reuse Phase 2 `<TwentyFourHourChart>`).
- **Filters drawer:** score threshold slider (filters pins below), layer toggles (Spots / Tide stations / Lightstations / DFO areas).
- **Coverage overlay:** static GeoJSON of non-covered regions grayed out. Long-press / right-click on overlaid region → opens waitlist pin modal (Phase 9).

## Reused data

- Pins: `GET /api/v1/hierarchy` (existing) → spots with lat/lng.
- Per-pin score: `GET /api/v1/fishing-spots/[id]/score?days=14&hourly=true` (Phase 2 endpoint).
- Tide stations / lightstations / DFO areas: existing `/fishing-spots/[id]/conditions` payload, or static GeoJSON if BlueCaster doesn't have it yet.

## Performance

- Viewport-only pin rendering (cull off-screen).
- Memoize unit conversions per session.
- Mapbox clustering for pin-heavy views.

## Verification

- Deep link `/explore?spot=pedder-bay&day=2026-04-26&hour=14` reproduces full state on cold load.
- Long-press on Florida region opens waitlist pin modal pre-filled with the long-press lat/lng.
- Mobile bottom sheet pattern works on iOS Safari + Android Chrome.
