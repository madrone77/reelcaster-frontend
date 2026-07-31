# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReelCaster Frontend is a Next.js 15 application that provides fishing forecasts and historical data analysis for British Columbia, Canada. It integrates multiple APIs to deliver weather, marine conditions, tide data, and fishing statistics to help anglers make informed decisions.

## Deployment — READ BEFORE SHIPPING

**Merging to GitHub `main` deploys nothing.** There is no Vercel git integration
on this repo. Shipping is always an explicit CLI deploy (see `.claude/commands/deploy.md`).

| Scope | Vercel project | Serves |
|---|---|---|
| `casey-1425s-projects` | `reelcaster-frontend` (`prj_Qv3yU2f5mm26lPYiKOgHlKr6HIGU`) | **www.reelcaster.com** |
| `reelcaster-devs-projects` | `reelcaster-frontend-web` (`prj_WoRjjGtjUopMvMCKJkQbiYHPhuZw`) | `*.vercel.app` only — **decoy** |

The decoy has old production deploys and `-git-main-` aliases, and its project id
is the one quoted in the Vault section below — deploying there succeeds and
changes nothing on the live domain. Verify with `npx vercel ls`, which must print
`casey-1425s-projects/reelcaster-frontend`; `--scope` alone does not override an
existing wrong link.

Ship: clone `main` fresh → `pnpm install --frozen-lockfile` →
`npx vercel@latest link --yes --scope casey-1425s-projects --project reelcaster-frontend`
→ `npx vercel@latest deploy --prod --yes --scope casey-1425s-projects`. Fall back to
`vercel promote <url>` if the domain doesn't follow. Then verify with a real curl
against `www.reelcaster.com` — never claim it is live off a green build.

Repos: `madrone77/reelcaster-frontend` is canonical.
`reelcasterdev/reelcaster-frontend` is a stale mirror; this machine has no
credential for it and pushing there is not possible.

## Development Commands

```bash
# Development with Turbopack (fast refresh)
pnpm dev

# Production build
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

## Architecture Overview

### Tech Stack

- **Framework**: Next.js 15.3.4 with App Router
- **Language**: TypeScript with strict mode
- **UI Library**: shadcn/ui (New York style) with Radix UI primitives
- **Styling**: Tailwind CSS v4 with PostCSS
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Date Handling**: date-fns v4 and react-day-picker

### Project Structure

```
src/app/
├── components/         # Feature-specific components
│   ├── account/       # Profile/account cards
│   ├── alerts/        # Custom alert UI
│   ├── auth/          # AuthForm, AuthGate
│   ├── catch-log/     # Fish-on FAB + quick catch modal (legacy dark UI)
│   ├── common/        # Shared bits still used by AppShell pages
│   ├── forecast/      # AppShell page chrome (dashboard-header) — most of the old forecast UI was deleted 2026-07
│   ├── layout/        # AppShell, icon-sidebar, mobile tab bar, location panel
│   ├── location/      # Location selection helpers
│   ├── notifications/ # Notification preference forms
│   ├── paywall/, pricing/, search/, waitlist/, marketing/, ui/
├── explore/           # The Explore map + spot pages (primary surface)
├── utils/             # Legacy scoring engine (kept for alerts + notification emails)
├── profile/           # User profile pages
└── layout.tsx         # Root layout
```

### Key Routes

- `/explore` - Explore map (primary public surface); `/explore/spot/[slug]` - spot detail
- `/` - Marketing landing page (public since 2026-07-15; light rc-* design, sections in `src/app/(marketing)/components/`, static demo hero data, real seasonal prices from `src/lib/pricing.ts`, illustrations in `public/landing/`)
- `/pricing`, `/billing/*` - purchase flow; `/login`, `/signup`, `/auth/*` - auth flow
- `/about`, `/contact`, `/faq`, `/privacy`, `/terms` - info/legal pages (unwalled + restyled light 2026-07-15)
- `/support` - **The Port**, the Pro-only support portal (guides, knowledge base, billing, status, ticketing) — added 2026-07-30, see its own section below
- `/profile` (+ `catch-log`, `custom-alerts`, `forecast-emails`, `notification-settings`)
- `/alerts`, `/notifications`, `/log-catch` - kept alongside the explore soft-launch

The whole public surface (`/`, explore, pricing, auth, info pages) is on the light rc-* design system as of 2026-07-15; only signed-in AppShell pages (alerts, profile, billing) remain on the legacy dark theme.

Deleted 2026-07: `/dashboard`, `/fishing/*`, `/historical-reports`, `/my-spots`, `/favorite-spots`, `/settings/*`, all `/admin/*` pages; `/species`, `/species/[slug]`, `/regulations` (deleted 2026-07-15 — the regulations DATA chain `/api/regulations` + `dfo-notice-service.ts` survives for /explore and notification emails; species fetchers were removed from `src/lib/bluecaster.ts` but the `bluecaster-client.ts` species list used by the log-catch wizard is untouched).

## External APIs

The application integrates with multiple data sources:

1. **DFO API** (Department of Fisheries and Oceans)

   - Base URL: `https://open.canada.ca/data/api/3/action/datastore_search`
   - Provides fishing catch data and statistics

2. **Open Meteo API**

   - Forecast: `https://api.open-meteo.com/v1/forecast`
   - Historical: `https://archive-api.open-meteo.com/v1/archive`
   - Provides weather and marine conditions

3. **Tide API**

   - Uses proxy: `https://api.allorigins.win/get`
   - Original source: `https://www.dairiki.org/tides/`
   - Provides tide predictions

4. **iNaturalist API**

   - URL: `https://api.inaturalist.org/v1/observations`
   - Species observation data

5. **PACFIN**
   - URL: `https://pacfin.psmfc.org/`
   - Pacific Fisheries data

6. **OpenWeatherMap API** (Weather Tile Layers)
   - Tile URL: `https://tile.openweathermap.org/map/{layer}/{z}/{x}/{y}.png`
   - Provides visual weather overlays (temperature, precipitation, wind, clouds)
   - Used in forecast weather map for enhanced visualizations

## Explore relief map (`/explore`)

The Explore page renders a **bathymetric color-relief nautical chart** (ported from BlueCaster's `test/map/1` / "bathy-relief" system) instead of a generic base map — **no `NEXT_PUBLIC_MAPBOX_TOKEN` required**. It uses **MapLibre GL** (`react-map-gl/maplibre`, already-installed `maplibre-gl`), not Mapbox.

- **Self-hosted tiles**: relief raster (WebP) + depth contours + land are versioned PMTiles archives on BlueCaster's public Supabase CDN, served per-z/x/y by our own proxy `src/app/api/map/tiles/[set]/[z]/[x]/[y]/route.ts` (uses `pmtiles`; immutable 1-yr cache). Registry: `src/lib/map/tile-sets.ts` — **a BlueCaster re-bake (new version key) must be mirrored here** (bump the version const + the keys referenced in `relief-style.ts`).
- **Style**: `src/lib/map/relief-style.ts` — `buildReliefStyle(origin)` is a **verbatim port of BlueCaster's** `lib/bluecaster/map/relief-style.ts`, kept at full `/test/map/1` parity (relief + contours + contour-labels + land + DFO subarea grid + RCAs + WDFW (hidden) + marine structures + tide stations + US/CA border + multi-tier place labels). Keep it in sync with the BlueCaster source on any chart change. Called with `origin=""` so all URLs are root-relative same-origin. Glyphs (`public/fonts/Open Sans Semibold/`) + the overlay GeoJSON (`public/*_salish.geojson`, `public/region_places.geojson`) are copied from BlueCaster; **every symbol layer must set `text-font: ["Open Sans Semibold"]`** (only shipped fontstack). `next.config.ts` long-caches `/fonts/*` + `/:file.geojson`.
- **Markers**: native GL **clustered** circle/symbol layers (not DOM markers) — `src/app/explore/components/explore-map.tsx` + `src/app/explore/lib/spot-geojson.ts`. Pins match BlueCaster's MapExplorer 1:1: `scoreColor()` continuous 5-stop scale (`#059669`/`#65a30d`/`#ca8a04`/`#ea580c`/`#e11d48`, unscored `#9ca3af`), color/opacity/label/txtColor baked into feature props, zoom-interpolated radius (11→14→16), white numerals (unscored = grey `·`), cobalt `#1F40E0` selection stroke + hover stroke bump, cobalt count-stepped clusters. `getClusterExpansionZoom` + `easeTo` on cluster click. (The rail/drawer keep the light-editorial 4-tier `TIER_PILL` system — that's the reelcaster design language, intentionally separate from the map pins.)
- **Map controls** (`src/app/explore/components/map-controls.tsx`, floating bottom-center/left) — mirror BlueCaster's MapExplorer toggles, state owned by `explore-shell.tsx`:
  - **Relief** + **Labels** — flip `visibility` on the relief/contour layers and the `places-t*` layers (`setLayoutProperty` in `explore-map.tsx`).
  - **Currents** — bathy-relief **WebGL flow** (`src/app/explore/lib/use-currents-flow.ts`, a faithful port of BlueCaster's `app/bathy-relief/relief.html` `startFlow`, matching https://www.bluecaster.co/bathy-relief — **not** the simpler `useCurrentsArrows` DOM-canvas hook). Rendered as a MapLibre **custom (WebGL) layer** composed of two offscreen 2D canvases blitted as fullscreen quads each frame: (1) a smooth speed→colour **heatmap field** (absolute-knots ramp `[0,0.4,0.9,1.6,2.4,3.5]`, 50% opacity, bilinear-upscaled low-res grid) and (2) **white particle ribbons** (3800 particles, faint dark shadow, trail-fade 0.96) advected through the U/V field. The layer is inserted **before `subarea-lines-casing`** and the `land` fill is forced into the translucent pass (`fill-opacity` 0.999 while on, 1 when off) so currents **clip at the coastline** and render under place labels. Field over-fetched with 0.2 viewport padding so the heatmap overfills the screen. Data via the same-origin proxy `src/app/api/bluecaster/currents/field/route.ts` → BlueCaster's auth-free `/api/map/currents/field` (note: that path is **not** under `/api/v1`, so the proxy hits `BLUECASTER_API_URL/api/map/...` directly).
  - **Species filter** — re-scores pins + rail by a single species using `RailSpot.scoresBySpecies` (per-species peak, 0–100, added in `explore-data.ts`); options come from `ExploreData.species`. `displaySpots` in the shell applies it (overrides `score`/`bestSpeciesId`/`driverSpecies`, re-sorts).
  - **Near me** — geolocation button → client-side haversine over `data.locations` picks the nearest covered city → `setQuery({loc})` (reuses the city-fit effect). No API round-trip (BlueCaster has no by-coordinates endpoint). Handler in `explore-shell.tsx`.
- **Rich spot drawer intel** — `src/app/explore/components/spot-drawer.tsx` renders instantly from the in-memory `RailSpot`, then **progressively enriches** via `useSpotIntel` (`src/app/explore/lib/use-spot-intel.ts`, lazy + module-cached): BlueCaster's live **spot-page** (fills WATER from `seaTempC`, plus score drivers, regulation status, recent catch signals, season state), the anonymized **community catch pool** ("anglers here catch most on…" + top lures), and an on-demand **"why this score"** evidence panel (confidence bar + source tallies + top algo-variables). `RailSpot` already carries `id` (spot UUID) + `bestSpeciesId` (species UUID), so no slug→id lookup. PRESSURE + MOON stay placeholders (not in the spot-page payload). Same-origin proxies: `src/app/api/bluecaster/{spots/[slug]/spot-page,intel/evidence,pool/intelligence}/route.ts` → server fetchers in `src/lib/bluecaster.ts`; client fetchers in `src/lib/bluecaster-client.ts`; types in `src/lib/bluecaster/intel-types.ts`. **Pool intel** needs BlueCaster's `pool/intelligence` reciprocity-gate bypass for the app key (no `angler_id` → anonymized aggregate read; see bluecaster-docs CHANGELOG) — otherwise the panel hides gracefully.
- **Opens on Victoria**: `buildExploreData` defaults `defaultCitySlug` to the pilot city (`victoria-bc`) when covered (else best-scoring), so the page lands on the bathymetry-rich Juan de Fuca coastline.
- **Mobile (`<lg`) is a document-flow page, desktop is the floating-panel map** (2026-07-01). The desktop full-screen map + `LeftRail`/`ForecastStrip`/`MapControls` are unchanged; below `lg` the shell renders a scrolling column instead: `ExploreTopBar` (slim) → mobile location header (reuses `LocationSelector`, its filter button opens `mobile-filter-sheet.tsx` = species + relief/labels/currents + near-me) → **the same single `<ExploreMap>` instance** in a contained `h-[45dvh]` block → `mobile-spot-list.tsx` (VIEWING ALL SPOTS + "N spots · M above 60" + a Score/Name Sort menu + `SpotCard`s) → `explore-footer.tsx`. The map wrapper flips on one div (`relative h-[45dvh] … lg:absolute lg:inset-x-0 lg:top-14 lg:bottom-0 lg:h-auto`); there is **never a second map**. Mobile-only nodes are `lg:hidden`, desktop panels stay `hidden lg:*`. `MapControls`/`ForecastStrip` are now desktop-only (`hidden lg:*`); the old `MobileSheet` + `MobileForecastStrip` are no longer rendered (files remain but dead). **`layout.tsx`** must stay `min-h-dvh overflow-y-auto lg:h-dvh lg:overflow-hidden` (the scroll gotcha) and exports `viewport = { viewportFit: "cover" }` for `pb-safe`. On mobile a pin/card tap **navigates to `/explore/spot/[slug]`** (viewport-aware `handleSelectSpot` via `matchMedia`), whereas desktop keeps the in-rail `SpotDrawer`. `react-map-gl@8` `trackResize` handles the container resize; a `matchMedia("(min-width:1024px)")` listener nudges `map.resize()` on live breakpoint crossings.
- **"Score explained" factor charts — local-day coverage** (2026-07-01). `factor-charts.tsx` renders per-factor 24h charts from the `/score` breakdown: **engine** factors (e.g. `tidal_current_speed_kt`, `pressure_trend_3h`, `season`, `minutes_to_next_slack`) as area **curves**, **comfort** factors (wind/precip/air_temp/visibility) as **bars**. Which factors appear is **species-driven** (Dungeness Crab has only `tidal_current_speed_kt`; salmon carry tide/pressure/season) — not a bug. **Gotcha:** BlueCaster's `GET /api/v1/fishing-spots/[id]/score` keys on a **UTC** day, but the chart plots a **local** day, so `days=1` drops the local evening (next UTC day). Fix: `spot-detail-shell.tsx` fetches `fetchSpotScore(..., 2)` and merges day0+day1 hours; `buildSeries()` windows them to the current local date via `localDate()`. Null hours render empty (no 4% stub / no baseline-drop trapezoid). The `NOW` pill is pinned to `nowHour` (independent of the scrub marker) and the `BEST WINDOW` label reuses `bestWindow().label` (from `hourly-bars.tsx`) so it matches the score card exactly. `HourlyBars` (the overall 24h score bars) uses the complete `hourlyScoreGrid` — no coverage gap there.
- **Spot page is a flush-white sheet** (2026-07-02). `spot-detail-shell.tsx` root is `bg-rc-panel` (white); every section (`ScoreCard`, `NowConditions`, `SpotProfile`, factor charts, species, 14-day, neighbours) is **flattened** — no `bg-rc-panel border rounded-xl shadow` card wrappers — and separated by `border-t border-rc-rule` / `divide-y` rules. The `BEST WINDOW` block (`bg-rc-good-bg`) and SPOT PROFILE cells (`bg-rc-surface`) stay tinted. The mobile header bar was removed (map at top, floating back button on the mini-map); the large title + `lat°N · lng°W` line render in-content on all sizes. Score-card buttons are title-case **Set alert** (blue) + **Log catch** (outline). `NowConditions` tiles now include SEA mini-bars, a PRESSURE trend line (direction-only from `pressure_trend_3h`), and WATER/AIR gradient **TempGauge**s (`5–20°` / `0–25°` with Cold/Optimal/Comfortable/Warm bands). **`SpotMiniMap` has 4 tabs** (Bathymetry / Satellite / Currents / Winds): Satellite (Mapbox raster) + Winds (OWM raster) are declared as react-map-gl `<Source>/<Layer>` (imperative `addLayer` gets reconciled away), keyed on `NEXT_PUBLIC_MAPBOX_TOKEN` / `NEXT_PUBLIC_OPENWEATHERMAP_API_KEY`. **KNOWN ISSUE:** Satellite tiles fetch fine (valid 200 JPEG, CORS-ok) but don't composite over the bespoke relief style in local QA — needs devtools debugging of the MapLibre raster z-order; Bathymetry + Currents work.

## Important Development Notes

### Component Creation

When creating new components:

1. Check existing components in `src/app/components/` for patterns
2. Use shadcn/ui components from the ui directory as base
3. Follow the existing file naming convention (camelCase for files)
4. Place feature-specific components in appropriate subdirectories

### Active Components

The 2026-07 cleanup deleted all dead components (verified by an import-graph
reachability scan — everything left in `src/app/components/` is reachable from
a live page). Highlights:

**Layout (AppShell pages: alerts, profile, billing):**

- `app-shell.tsx` - Main layout wrapper with icon sidebar, location panel, mobile nav
- `icon-sidebar.tsx` - Desktop icon-based sidebar navigation (Alerts · Catch Log · Profile)
- `location-panel.tsx` / `mobile-location-sheet.tsx` - Location selection
- `mobile-tab-bar.tsx` - Mobile bottom navigation
- `forecast/dashboard-header.tsx` - Page header (name is legacy; the dashboard itself is gone)

**Auth:**

- `auth/auth-form.tsx` - Shared login/signup form (light rc-* styling via className overrides; shadcn primitives untouched)
- `auth/auth-gate.tsx` - Client-side auth redirect for gated routes

**Catch Log:**

- `src/app/log-catch/` - Photo-first catch wizard (upload → analyzing → location → review); `catch-form.tsx` still used by the spot-page dialog only
- `src/app/catches/` - "My catches" list page

### API Integration

When working with APIs:

1. Add new API utilities in `src/app/utils/`
2. Follow existing patterns for error handling and data transformation
3. Use TypeScript interfaces for API responses
4. Handle loading and error states using the common components

### State Management

- The app uses React state and props for state management
- Authentication context provides user state management
- Location selection is passed through URL parameters
- User preferences are managed via UserPreferencesService

### Design System

ReelCaster uses a custom dark theme design system built on Tailwind CSS v4. **Always use the `rc-*` color tokens** for consistency across the application.

#### Light editorial design system (canonical, Figma-sourced — Explore page)

`src/styles/rc-tokens.css` holds the canonical `--rc-*` token system ported from the Figma "Explore + Spot" source of truth (same values as bluecaster's `/admin/design/design-system` page): brand `#1E40E0`, ink `#0B1220/#2A3344/#8A92A4`, white panels on `#F0EFED`, score tiers (good ≥75 / fair 55–74 / poor <55), 8pt spacing, Inter + IBM Plex Mono. It is mapped to Tailwind utilities in `globals.css` (`bg-rc-panel`, `text-rc-ink`, `border-rc-rule`, `bg-rc-good-bg text-rc-good-ink`, `font-rc-mono`, `shadow-rc-panel`, …) plus semantic classes (`.rc-label`, `.rc-title-lg`, `.rc-score--good`). The Explore page (`src/app/explore/`) is its first consumer; the dark tokens below remain the legacy app theme until the app-wide migration. New light-theme surfaces should build on these tokens, never ad-hoc hex values.

#### Color Tokens (Defined in `globals.css`)

```css
/* Background Colors (darkest to lightest) */
--color-rc-bg-darkest: #1E1E1E;  /* Page background, AppShell */
--color-rc-bg-dark: #2B2B2B;     /* Cards, containers, panels */
--color-rc-bg-light: #333333;    /* Input backgrounds, borders, hover states */

/* Text Colors */
--color-rc-text: #FFFFFF;        /* Primary text, headings */
--color-rc-text-light: #E3E3E3;  /* Secondary text */
--color-rc-text-muted: #AAAAAA;  /* Muted text, labels, placeholders, icons */
```

**Tailwind Usage:**
```tsx
// Backgrounds
className="bg-rc-bg-darkest"  // Page backgrounds
className="bg-rc-bg-dark"     // Cards, containers
className="bg-rc-bg-light"    // Input fields, borders, subtle backgrounds

// Text
className="text-rc-text"       // Primary text
className="text-rc-text-light" // Secondary text
className="text-rc-text-muted" // Labels, placeholders, disabled text

// Borders
className="border-rc-bg-light" // Standard borders
```

#### Accent Colors

Use Tailwind's built-in color palette for accents:

| Purpose | Color | Classes |
|---------|-------|---------|
| Primary actions, active states | Blue 600 | `bg-blue-600`, `text-blue-600`, `border-blue-600` |
| Success, positive | Emerald 400/500 | `text-emerald-400`, `bg-emerald-500/20` |
| Warning, attention | Amber 400/500 | `text-amber-400`, `bg-amber-500/20` |
| Error, destructive | Red 500 | `text-red-500`, `bg-red-500/20` |
| Info | Blue 400 | `text-blue-400`, `bg-blue-500/20` |
| CTA buttons | Green 600 | `bg-green-600 hover:bg-green-500` |

#### Page Layout Pattern

All pages should use the `AppShell` component with consistent padding:

```tsx
import { AppShell } from '@/app/components/layout'
import DashboardHeader from '@/app/components/forecast/dashboard-header'

export default function MyPage() {
  return (
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="Page Title"
          showTimeframe={false}
          showSetLocation={false}
          showCustomize={false}
        />

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Page content */}
        </div>
      </div>
    </AppShell>
  )
}
```

**Key Layout Classes:**
- Outer container: `p-4 sm:p-6 space-y-4 sm:space-y-6`
- Content width: `max-w-4xl mx-auto` (or `max-w-5xl`, `max-w-6xl`, `max-w-7xl`)
- Content spacing: `space-y-6`

#### Card/Container Pattern

```tsx
// Standard card
<div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
  {/* Content */}
</div>

// Card with darker background (for sections within cards)
<div className="bg-rc-bg-darkest border border-rc-bg-light rounded-xl p-6">
  <h2 className="text-xl font-semibold text-rc-text">Title</h2>
  <p className="text-sm text-rc-text-muted mt-1">Description</p>
</div>
```

#### Form Component Styling

**Input Fields:**
```tsx
// Use the Input component from @/components/ui/input
// Or inline styling:
<input className="w-full bg-rc-bg-light border border-rc-bg-light rounded-lg px-3 py-2 text-rc-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
```

**Select Dropdowns:**
```tsx
// Use Select from @/components/ui/select
// Key classes already applied:
// - Trigger: bg-rc-bg-light border-rc-bg-light text-rc-text
// - Content: bg-rc-bg-dark text-rc-text border-rc-bg-light
// - Item: focus:bg-rc-bg-light focus:text-rc-text
```

**Switch/Toggle:**
```tsx
// Use Switch from @/components/ui/switch
// Unchecked: bg-rc-bg-light, thumb bg-rc-text-muted
// Checked: bg-blue-600, thumb bg-white
```

**Checkbox:**
```tsx
// Use Checkbox from @/components/ui/checkbox
// Unchecked: border-rc-bg-light bg-rc-bg-light
// Checked: bg-blue-600 text-white border-blue-600
```

**Slider:**
```tsx
// Use Slider from @/components/ui/slider
// Track: bg-rc-bg-light
// Range (filled): bg-blue-600
// Thumb: border-blue-600 bg-rc-bg-dark
```

**Labels:**
```tsx
// Use Label from @/components/ui/label
<Label className="text-rc-text">Field Label</Label>
// Or inline:
<label className="block text-xs font-medium text-rc-text-muted mb-2">Label</label>
```

#### Button Patterns

```tsx
// Primary action button (gradient)
<Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
  Action
</Button>

// Secondary/ghost button
<button className="flex items-center gap-2 px-3 py-1.5 bg-rc-bg-light text-rc-text-muted hover:bg-rc-bg-dark rounded-lg text-sm transition-colors">
  Secondary
</button>

// Pill-shaped button (used in DashboardHeader)
<button className="flex items-center bg-rc-bg-dark hover:bg-rc-bg-light border border-rc-bg-light rounded-full text-sm transition-colors">
  <span className="px-4 py-2 text-rc-text">Button Text</span>
</button>

// CTA button (green)
<button className="flex items-center bg-green-600 hover:bg-green-500 rounded-full text-sm font-medium transition-colors">
  <span className="flex items-center gap-2 px-4 py-2 text-rc-text">Call to Action</span>
</button>
```

#### Status Badges

```tsx
// Success/positive
<span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-300">
  Released
</span>

// Info
<span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300">
  Kept
</span>

// Warning
<span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
  Pending
</span>

// Error
<span className="px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-300">
  Error
</span>

// Neutral/metadata
<span className="px-2 py-0.5 text-xs rounded-full bg-rc-bg-light text-rc-text-muted">
  Metadata
</span>
```

#### Stats Cards Pattern

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
  <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
    <div className="flex items-center gap-2 text-rc-text-muted text-xs mb-1">
      <Icon className="w-4 h-4" />
      <span>Label</span>
    </div>
    <p className="text-2xl font-bold text-rc-text">Value</p>
  </div>
  {/* Colored stat */}
  <div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4">
    <div className="flex items-center gap-2 text-emerald-400 text-xs mb-1">
      <Icon className="w-4 h-4" />
      <span>Success Metric</span>
    </div>
    <p className="text-2xl font-bold text-emerald-400">123</p>
  </div>
</div>
```

#### List Item/Card Pattern

```tsx
<div className="bg-rc-bg-dark border border-rc-bg-light rounded-xl p-4 hover:border-blue-500/30 transition-colors cursor-pointer">
  <div className="flex items-start justify-between">
    <div className="flex items-start gap-4">
      {/* Icon */}
      <div className="p-3 rounded-xl bg-emerald-500/20">
        <Icon className="w-6 h-6 text-emerald-400" />
      </div>

      <div>
        <h3 className="text-rc-text font-semibold">Title</h3>
        <div className="flex items-center gap-2 text-sm text-rc-text-muted mt-1">
          <Icon className="w-4 h-4" />
          <span>Metadata</span>
        </div>
      </div>
    </div>

    <ChevronRight className="w-5 h-5 text-rc-text-muted" />
  </div>
</div>
```

#### Empty State Pattern

```tsx
<div className="text-center py-12">
  <Icon className="w-12 h-12 text-rc-text-muted mx-auto mb-4" />
  <h3 className="text-lg font-medium text-rc-text mb-2">No Items Yet</h3>
  <p className="text-sm text-rc-text-muted">
    Description of what to do next.
  </p>
</div>
```

#### Focus States

All interactive elements should have visible focus states:
```tsx
// Standard focus ring (blue)
className="focus:outline-none focus:ring-2 focus:ring-blue-500"

// Or using the design system pattern
className="focus-visible:border-blue-500 focus-visible:ring-blue-500/30 focus-visible:ring-[3px]"
```

#### Hover States

```tsx
// Card hover
className="hover:border-blue-500/30 transition-colors"

// Button hover (background change)
className="hover:bg-rc-bg-light transition-colors"

// Button hover (darken)
className="bg-blue-600 hover:bg-blue-700 transition-colors"
```

#### Icon Styling

```tsx
// In text context (muted)
<Icon className="w-4 h-4 text-rc-text-muted" />

// Primary icon
<Icon className="w-5 h-5 text-rc-text" />

// Accent icon
<Icon className="w-6 h-6 text-blue-400" />

// Icon in container
<div className="p-2 bg-rc-bg-light rounded-lg">
  <Icon className="w-5 h-5 text-rc-text-light" />
</div>
```

#### Responsive Patterns

```tsx
// Padding
className="p-4 sm:p-6"           // 16px mobile, 24px desktop

// Spacing
className="space-y-4 sm:space-y-6"  // Vertical gaps

// Grid
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"

// Hide/show
className="hidden lg:block"      // Desktop only
className="lg:hidden"            // Mobile only

// Text
className="text-sm sm:text-base" // Responsive text size
```

#### DO's and DON'Ts

**DO:**
- Always use `rc-*` color tokens for backgrounds and text
- Use `rounded-xl` for cards, `rounded-lg` for inputs/buttons
- Add `transition-colors` to interactive elements
- Use `space-y-*` for vertical spacing within containers
- Use semantic color accents (emerald=success, amber=warning, red=error)

**DON'T:**
- Use `gray-*`, `slate-*`, or `zinc-*` colors (legacy)
- Use `text-white` (use `text-rc-text` instead)
- Use `bg-gray-900` (use `bg-rc-bg-dark` instead)
- Hardcode colors that aren't in the design system
- Forget hover/focus states on interactive elements

#### shadcn/ui Components (Themed)

The following shadcn/ui components have been customized for the ReelCaster design system. Always use these instead of creating custom form elements:

| Component | Path | Key Customizations |
|-----------|------|-------------------|
| `Input` | `@/components/ui/input` | `bg-rc-bg-light`, `text-rc-text`, blue focus ring |
| `Select` | `@/components/ui/select` | Dark dropdown, `bg-rc-bg-dark` content |
| `Switch` | `@/components/ui/switch` | `bg-blue-600` when checked |
| `Checkbox` | `@/components/ui/checkbox` | `bg-blue-600` when checked |
| `Slider` | `@/components/ui/slider` | `bg-blue-600` track fill |
| `Label` | `@/components/ui/label` | `text-rc-text` |
| `Button` | `@/components/ui/button` | Various variants available |
| `Card` | `@/components/ui/card` | Use with `bg-rc-bg-dark border-rc-bg-light` overrides |
| `Badge` | `@/components/ui/badge` | Use with custom color classes for status |

### TypeScript

- Strict mode is enabled
- `@typescript-eslint/no-explicit-any` is disabled (but avoid using `any` when possible)
- Define proper types for all props and API responses

## Testing

Currently, no testing framework is configured. When implementing tests:

- Consider adding Jest or Vitest for unit tests
- Add React Testing Library for component tests
- Place test files adjacent to source files with `.test.ts(x)` extension

## Application Features

The current application focuses on:

- **Fishing Forecasts**: Real-time weather and marine conditions analysis
- **Location-Based Data**: Multiple fishing locations in British Columbia
- **Species Information**: Fishing regulations and species data
- **User Authentication**: Profile management and personalized preferences
- **Email Broadcast System**: Admin tool for sending customized emails to all users
- **Responsive Design**: Mobile-first responsive interface

## Missing Configurations

The following are not currently set up but may be beneficial:

- Prettier for code formatting
- Husky for pre-commit hooks
- Environment variables for API endpoints
- Testing framework
- CI/CD pipeline configuration

## Scraping System (REMOVED 2026-07-10)

The automated scraping system (fishing-reports scraper, DFO regulations scraper,
DFO fishery-notices scraper) was deleted in the 2026-07 cleanup along with the
old dashboard, the `/fishing` SEO pages, and `/historical-reports`. What remains:

- **Regulations READ chain is kept**: `GET /api/regulations` and
  `src/app/data/regulations/` — used by the location
  components rendered on `/explore`. The `fishing_regulations` and `dfo_fishery_notices`
  tables still exist in Supabase but are no longer refreshed (data is frozen).
- `src/lib/dfo-notice-service.ts` (notification emails) still reads `dfo_fishery_notices`.
- The daily GitHub Action is now `.github/workflows/daily-jobs.yml` (scheduled
  notifications only — the accuracy pipeline was deleted with the admin pages);
  `scrape-data.yml` was deleted.
- The weekly Vercel cron for regulations scraping was removed from `vercel.json`.

## Automated Notification System

ReelCaster features a comprehensive automated notification system that sends personalized fishing alerts to users based on their preferences and weather conditions.

### Features

- **Scheduled Notifications**: Daily or weekly emails sent automatically via GitHub Actions
- **Personalized Forecasts**: Location-specific forecasts based on user-selected coordinates and radius
- **Species-Specific Scoring**: Customized fishing scores for user's favorite species
- **Weather Threshold Filtering**: Only send when conditions meet user's preferences
- **Interactive Map Selection**: Mapbox GL integration for location and radius selection
- **Comprehensive Preferences**:
  - Location with adjustable radius (5-100km)
  - Multiple species selection
  - Weather thresholds (wind, waves, precipitation, temperature, UV, fishing score)
  - Safety alerts (thunderstorms, gale warnings, pressure drops)
  - Regulatory change notifications (bundled with scheduled emails)
  - Frequency (daily/weekly) and timezone settings

### Setup Requirements

**Environment Variables** (add to `.env.local`):
```env
# Mapbox Access Token (for location selector map)
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token

# Cron Secret (for securing scheduled notification endpoint)
CRON_SECRET=your_cron_secret_key
```

**GitHub Secrets** (add to repository settings):
- `CRON_SECRET` - Same value as local CRON_SECRET for authenticating workflow requests

### Database Schema

- **`notification_preferences`** table stores all user preferences:
  - Notification toggles (enabled, email, push)
  - Schedule settings (frequency, time, timezone)
  - Location (lat/lng, radius, name)
  - Species preferences (array of IDs)
  - Weather thresholds (11 different metrics)
  - Alert toggles (3 safety alerts)
  - Tracking (last_notification_sent timestamp)

### Key Files

- **Settings Page**: `/profile/notification-settings` - User preferences interface
- **API Endpoints**:
  - `/api/notifications/send-scheduled` - Automated notification sending
  - `/api/notifications/preview` - Preview notification email
- **Core Logic**: `src/lib/notification-service.ts` - Notification generation logic
- **Email Template**: `src/lib/email-templates/scheduled-notification.ts` - Personalized HTML template
- **Components**:
  - `src/app/components/notifications/notification-preferences-form.tsx` - Main form
  - `src/app/components/notifications/notification-location-selector.tsx` - Mapbox map
  - `src/app/components/notifications/species-selector.tsx` - Multi-select species
  - `src/app/components/notifications/weather-threshold-sliders.tsx` - Threshold controls
  - `src/app/components/notifications/regulatory-preferences.tsx` - Regulation settings
- **Automation**: `.github/workflows/daily-jobs.yml` - Runs daily at 2 AM UTC
- **Migration Script**: `scripts/migrate-notification-preferences.ts` - One-time data migration

### How It Works

1. **User Configuration**: Users set preferences at `/profile/notification-settings`
2. **Scheduled Trigger**: GitHub Actions workflow runs daily at 2 AM UTC
3. **User Filtering**: System fetches users with notifications enabled
4. **Notification Logic**:
   - Checks if notification is due (based on frequency and last_sent)
   - Fetches 7-day forecast for user's location
   - Calculates fishing scores for user's species
   - Checks weather conditions against user's thresholds
   - Fetches regulation changes since last notification (if enabled)
5. **Threshold Evaluation**: Only sends if conditions meet user's criteria:
   - Fishing score >= threshold
   - Weather within acceptable ranges
   - Best day identified
6. **Email Generation**: Creates personalized email with:
   - Best fishing day highlighted
   - 7-day forecast table
   - Weather alerts (if any)
   - Regulation changes (if any)
   - Species-specific optimizations
7. **Batch Sending**: Sends emails in batches of 20 via Resend
8. **Timestamp Update**: Updates `last_notification_sent` for next cycle

### Technology

- **Map Library**: Mapbox GL JS (react-map-gl wrapper)
- **Email Service**: Resend
- **Automation**: GitHub Actions (daily cron job)
- **Weather Data**: Open Meteo API (7-day forecasts)
- **Scoring Algorithm**: Species-specific 13-factor calculation
- **Database**: Supabase PostgreSQL with RLS policies


## Custom Alert Engine

ReelCaster includes a custom alert engine that allows users to define multi-variable fishing condition triggers for specific GPS locations. When conditions match, users receive email notifications.

### Features

- **Multi-Variable Triggers**: Wind (speed, direction), Tide (phase, exchange), Pressure (trend, gradient), Water Temperature, Solunar Periods, Fishing Score
- **Logic Modes**: AND (all conditions must match) or OR (any condition can match)
- **Anti-Spam Protection**:
  - Configurable cooldown (1-168 hours between alerts)
  - Hysteresis/deadband logic to prevent flickering
  - Active hours filtering (only check during specified times)
- **Data Smoothing**: 3-point SMA for wind speed to filter gusts
- **Pressure Gradient**: 3-hour lookback for trend detection

### Database Schema

- **`user_alert_profiles`**: Custom alert definitions with JSONB triggers
- **`alert_history`**: Log of triggered alerts with condition snapshots

### Key Files

- **Core Engine**: `src/lib/custom-alert-engine.ts` - Evaluation logic, math functions, anti-spam
- **CRUD API**: `src/app/api/alerts/route.ts` - Create/read/update/delete profiles
- **Evaluation Endpoint**: `src/app/api/alerts/evaluate/route.ts` - Cron job endpoint
- **Email Template**: `src/lib/email-templates/custom-alert.ts` - Notification format
- **UI Page**: `src/app/profile/custom-alerts/page.tsx` - User interface
- **Components**:
  - `src/app/components/alerts/custom-alerts-list.tsx` - Profile list
  - `src/app/components/alerts/custom-alert-form.tsx` - Create/edit form
- **Automation**: `.github/workflows/custom-alerts.yml` - Runs every 30 minutes

### Trigger JSONB Structure

```json
{
  "wind": { "enabled": true, "speed_min": 0, "speed_max": 15, "direction_center": 270, "direction_tolerance": 45 },
  "tide": { "enabled": true, "phases": ["incoming", "high_slack"], "exchange_min": 1.5 },
  "pressure": { "enabled": true, "trend": "falling", "gradient_threshold": -2.0 },
  "water_temp": { "enabled": true, "min": 10.0, "max": 14.0 },
  "solunar": { "enabled": true, "phases": ["major", "minor"] },
  "fishing_score": { "enabled": true, "min_score": 70, "species": "chinook-salmon" }
}
```

### Math Functions

- **Wind Direction**: Angular difference with 360° wrap-around: `Δθ = 180 - | |θ_target - θ_current| - 180 |`
- **Pressure Gradient**: `ΔP = P₀ - P₋₃ₕ` (current vs 3 hours ago)
- **Tide Phase Detection**: Derivative-based: incoming (dH/dt > 0.05), outgoing (< -0.05), slack (|dH/dt| < 0.05)

### Technology

- **Polling Frequency**: Every 30 minutes via GitHub Actions
- **Weather Data**: Open Meteo API (reuses existing integration)
- **Tide Data**: CHS API (reuses existing integration)
- **Email Service**: Resend (shared infrastructure)
- **Database**: Supabase PostgreSQL with RLS policies

## Catch Logging System — photo-first wizard with auto analysis (2026-07-11)

ReelCaster's catch log is a photo-first wizard: drop a photo → BlueCaster reads
EXIF + runs vision (species/lure/size) + computes a conditions snapshot → a
map picker matches (or creates) the nearest saved spot within 400 m → a fully
editable review screen → save to the private catch log (+ fire-and-forget
commit into BlueCaster's intelligence pool). The old offline-first "Fish On"
FAB + IndexedDB stack (dark theme, GPS-only quick-capture) was retired in this
revamp — deleted: `src/app/components/catch-log/`, `src/app/profile/catch-log/`,
`src/lib/offline-catch-store.ts`, `src/lib/catch-sync-manager.ts`, the `idb`
dependency, and the commented `FishOnButtonWrapper` in `layout.tsx`.

### Wizard flow (`/log-catch`)

Client-side step machine in `src/app/log-catch/log-catch-shell.tsx` (a `File`
can't survive navigation): `upload → analyzing → location → review`.

1. **Upload** (`steps/upload-step.tsx`) — same dropzone as before (JPG/PNG/
   WebP/HEIC/HEIF, 25 MB cap).
2. **Analyzing** (`steps/analyzing-step.tsx`) — animated checklist while
   `src/lib/photo-prep.ts` runs client-side (EXIF read from the ORIGINAL via
   `exifr` before any conversion strips it; HEIC→JPEG via `heic2any`; a
   downscaled ≤3 MB analysis copy via `browser-image-compression`, since
   Anthropic's vision API rejects large images even though the bucket takes
   25 MB) and then makes the ONE `fetchCatchPreview` call. The full-quality
   `uploadFile` uploads to the `catch-photos` bucket in parallel
   (fire-and-forget) so the storage path is ready by the review step.
3. **Location** (`steps/location-step.tsx`) — `src/app/components/location/
   pin-picker-map.tsx` (MapLibre relief style, draggable pin, no Mapbox
   token). Pin starts at EXIF GPS, else the fallback chain in
   `src/lib/geo-fallback.ts` (browser geolocation **only if permission is
   already granted — never auto-prompts** → `/api/geo` [Vercel IP geo
   headers, free, null on localhost] → last-viewed Explore city
   [`localStorage["rc:lastCity"]`, written by `explore-shell.tsx`] → Victoria
   default). When the pin is only approximate (ip/city/default source) the
   step shows a "Use my precise location" button — the sole place the
   browser's location permission popup can appear (explicit user tap,
   `handleUseMyLocation` in the shell). Every pin move (debounced 400 ms) calls
   `fetchNearestSpots(lat, lng, 400)` → matched spot + score, or an amber
   "no mapped spot" card with **Create** → `wizard/create-spot-modal.tsx`
   (name input; coordinates + "DFO n-m" mgmt area auto-filled) →
   `createCustomSpot` (authed).
4. **Review** (`steps/review-step.tsx`) — photo + vision badge, species name +
   confidence chip + "Not right?" (`wizard/species-picker.tsx`, species-at-spot
   first, full BlueCaster list as fallback; changing species or the catch time
   refetches the score), editable weight/length/lure/depth
   (`wizard/stat-row.tsx`, imperial UI ↔ metric storage via `src/lib/units.ts`),
   an AUTO/EDITED **conditions grid** (`wizard/conditions-grid.tsx`: tide,
   current, wind, pressure, water temp, sky — each cell click-to-edit), the
   same map (drag re-matches), and Save-as-draft / Save-catch.

### Data model (`catch_logs`, extended 2026-07-11)

Beyond the original GPS/species/weight/length/lure/notes/photos columns
(`supabase/migrations/20251220_create_catch_logs.sql`), migration
`20260711_catch_log_revamp.sql` added: `status` (`draft`|`logged`),
`spot_id`/`spot_slug` (BlueCaster fishing_spots reference — no FK, cross-
database), `species_bc_id` (BlueCaster species uuid, needed to re-fetch
species-specific scores; `species_id` stays the frontend text slug),
`species_confidence`, `score` + `score_status` (`scored`|`pending`|`none`),
`mgmt_area`, `pool_observation_id`. Conditions stay in `weather_snapshot`
jsonb, now written as a typed **v2** shape (`{v:2, tide, current, wind,
pressure, water, sky}` — see `src/lib/catch-log-types.ts`, `readSnapshot()`
handles both v1 and v2 for list rendering).

### BlueCaster endpoints this depends on

- `POST /api/v1/ingest/catch/preview` (extended 2026-07-11: snapshot now
  carries current/pressure/sky/gusts/air-temp/visibility; accepts client
  EXIF/`file_lastmod`/`tz_offset_minutes` fields and no longer hard-rejects
  photos with no EXIF; 400 m match radius). Proxy:
  `src/app/api/bluecaster/ingest/catch/preview/route.ts`.
- `GET /api/v1/spots/by-coordinates` (new) — nearest-spot + candidates +
  today's score + DFO area for a raw lat/lng. Proxy: `.../spots/by-
  coordinates/route.ts`, fetcher `fetchNearestSpots`.
- `GET /api/v1/fishing-spots/[id]/snapshot` (new) — historical-capable
  conditions for a spot at any UTC instant (unlike forecast-only
  `/api/map/point-conditions`). Proxy + fetcher: `fetchSpotSnapshot`.
- `GET /api/v1/fishing-spots/[id]/score-hour` (new proxy, existing BlueCaster
  endpoint's single-hour mode) — score at the exact catch hour; empty
  `stocks` → render "—". Fetcher: `fetchSpotScoreHour`.
- `POST /api/v1/fishing-spots/custom` (fixed 2026-07-11 — was creating
  `is_active=false` spots invisible to matching/scoring, with no
  `city_fishing_spots` row or `spot_species_presence` seed, so new spots
  never scored). Proxy requires a signed-in session (mutates shared
  BlueCaster data): `src/app/api/bluecaster/fishing-spots/custom/route.ts`.
- `POST /api/v1/ingest/catch` (pool commit — newly wired into this flow;
  previously unused by reelcaster) — fired after a **logged** (non-draft)
  save, `contributes_to_pool:true, gps_stays_private:true`,
  `idempotency-key` = the catch row id. Never blocks the save; on success
  PUTs `pool_observation_id` back onto the row. Proxy:
  `src/app/api/bluecaster/ingest/catch/route.ts`.
- `GET /api/v1/species` — species-picker fallback list, proxy
  `src/app/api/bluecaster/species/route.ts`, 1h cache.

**Known limitation (by design, not a bug):** `score`/`score_status` reflect a
snapshot taken at log time only when the catch falls inside BlueCaster's
current forecast window (`session_scores` has no historical rows) — older
catches, and any catch logged before its spot's first scoring run, get
`score_status:"none"`/`"pending"` and render "—". True historical re-scoring
(the conditions layer IS historical-capable) is future work.

### `/catches` — "My catches" list

`src/app/catches/` (historically added to `middleware.ts` `ALLOW_PREFIXES` —
that list no longer exists, see "Route gating" below) replaces the
old `/profile/catch-log`: reads `GET /api/catches` (extended with `status`,
`q` full-text-ish search via `.or()`, `sort`/`order`) + `GET /api/catches/
stats` (season aggregates). Season stats row, species chips with counts,
search + sort + grid/list toggle, month-grouped rows, NEW (<48h) and DRAFT
badges. Thumbnails via batched `getCatchPhotoSignedUrls()` (one
`createSignedUrls` call, not N).

### Also still true from the original design

- **Log a catch (spot-page dialog)** — `src/app/explore/spot/components/
  log-catch-dialog.tsx` still wraps the original `src/app/log-catch/
  catch-form.tsx` (unchanged; the wizard rebuild only touched the standalone
  `/log-catch` page, which stopped importing `CatchForm`). Opened by the spot
  page's LOG CATCH button, pre-filled with the current spot + live conditions.
- **Alerts** — `create-alert-dialog.tsx` + `/notifications` still drive the
  Custom Alert Engine via `/api/alerts`, unrelated to this revamp.
- **Nav + wall:** ~~any new walled-off route must be added to `ALLOW_PREFIXES`~~
  — **no longer true.** See "Route gating" below: `middleware.ts` now walls
  nothing, and a new route needs no middleware change at all.

## Route gating — how a new route becomes reachable (corrected 2026-07-30)

The `ALLOW_PREFIXES` allow-list described above and in the catch-log section is
**gone**. `src/middleware.ts` inverted it into an opt-in deny-list,
`WALLED_PREFIXES`, which is currently **empty** — the old list had grown to
cover every real route, so its only surviving effect was answering nonexistent
URLs with a `/coming-soon` body at HTTP 200 (a soft 404). Unmatched paths now
fall through to `src/app/not-found.tsx` with a real 404.

What actually gates routes today:

- **`src/middleware.ts`** — add a prefix to `WALLED_PREFIXES` only if you
  deliberately want a surface behind the holding page. New routes need nothing.
- **`src/app/components/auth/auth-gate.tsx`** — this is the list that behaves
  the way `ALLOW_PREFIXES` used to. Anything **not** in `PUBLIC_EXACT` /
  `PUBLIC_PREFIXES` is private: AuthGate blocks render and redirects to
  `/login`. So a **private route needs no change**, and a **public route MUST**
  be added to `PUBLIC_PREFIXES` or signed-out visitors and crawlers get a
  spinner. Note AuthGate returns a spinner instead of children for signed-out
  users, so a page's own `router.replace('/login?next=…')` never actually runs
  — the `next` param is lost and you land on bare `/login`. Pages still carry
  that redirect as belt-and-braces (`/alerts`, `/support`).
- **`src/app/robots.ts`** — add private paths to `disallow`, and set
  `robots: { index: false, follow: false }` in the page metadata.
- **`src/app/sitemap.ts`** — `STATIC_ENTRIES`, public routes only.

## Plan matrix + upgrade modal (2026-07-31)

**`src/lib/plan-features.ts` is the single source of truth for what each tier
gets.** Before it, the answer lived in the pricing card's `FEATURES`, the
paywall card's `DEFAULT_BULLETS`, the FAQ, `support/content.ts`, and a dozen
server limit constants — and they had already drifted (the favourites cap still
reads 1 in the explore UI, 5 in `api/favorite-spots`). The module carries
`PLAN_TIERS` (anon / free / pro), `PLAN_FEATURES` (grouped rows, one cell per
tier) and `NAG_FEATURES` (the action that hit the wall → headline copy, the row
to highlight, and the `?feature=` key). **Change a limit here in the same PR you
change its enforcement**, and keep the enforcement pointers in the file header
current.

`src/app/components/paywall/pro-trial-modal.tsx` renders it: a headline naming
what the angler just tried to do ("Start your 7-day Pro trial to create an
alert"), then the full three-column matrix with the viewer's column marked and
the blocking row highlighted. A signed-out visitor blocked by something a *free*
account unlocks is sent to `/signup`, not `/pricing`.

Wired on /explore at: the favourites cap (rail card, drawer, spot page),
locked forecast days (via `explore/components/upgrade-dialog.tsx`, which is now
a thin wrapper), and alert creation — `create-alert-dialog.tsx` takes an
`onUpgradeRequired` callback and hands off *before* rendering a form the API
would refuse. `upgrade-required-modal.tsx` + `unlock-with-pro-card.tsx` still
serve `/alerts` and `/support`.

The custom-spots nag (`feature="custom-spots"`) is wired but unreachable: the
"Create custom spot" map button is `isPaid &&` gated, so a free user never sees
the wall.

### Alert delivery channels

`src/app/components/alerts/delivery-channel-picker.tsx` owns the email + SMS
toggles **and** the inline phone-verification flow (`POST /api/alerts/verify-
phone` sends a code, `PUT` confirms). Both alert forms use it — the spot-page
`create-alert-dialog.tsx` and the `/alerts` `score-alert-form.tsx`, which until
2026-07-31 hardcoded `delivery_channels: ['email']` and could not text anyone
regardless of tier. Add a channel here, not in either form.

SMS is live for Pro with a verified phone. A 503 from the verify route means
Twilio is unreachable *right now* (`isVerifyConfigured()`), not that the feature
is unbuilt — keep that copy phrased as a transient failure. `POST /api/alerts`
re-reads `phone_verified` and silently strips `sms` from a payload it can't
stand behind, so the picker is convenience, not the gate.

## The Port — Pro-only support portal (`/support`, 2026-07-30)

Before this, "customer support" was a `mailto:` on `/contact` plus 8 static
FAQs: no form, no endpoint, no table, no third-party widget, and nothing at all
inside the signed-in product. The Port is the real thing, gated to Pro.

- **Route:** `src/app/support/page.tsx` (server, `robots: noindex`) →
  `support-client.tsx`. **Hard Pro gate**, three states: signed-out redirects
  to `/login`; free tier gets a paywall (`UnlockWithProCard`, `feature="support"`)
  that **explicitly routes to `/faq` + `/contact`** so a hard gate is not a dead
  end; Pro gets the portal. `useSubscription().isPaid` is the client gate — the
  API re-checks server-side, so the client gate is cosmetic.
- **Six sections**, switched in-page (no sub-routes), under
  `src/app/support/components/`: `port-nav` (sticky rail desktop / scrolling
  chips mobile), `port-search`, `port-section` (shared heading frame),
  `start-section`, `guides-section`, `answers-section`, `billing-section`,
  `status-section`, `tickets-section` + `ticket-form`.
- **Content is a typed module, not a CMS** — `src/app/support/content.ts` holds
  `GUIDES`, `ARTICLES`, `CHANGELOG`, `KNOWN_ISSUES` and a module-scope search
  index. Deliberate: this content describes what ships, so it changes in the
  same PR as the code it describes. **If you make a fact here untrue, fix it in
  that PR.** `searchContent()` is AND-matching across all four sources with
  title hits weighted 2× — one search box, no request, no debounce.
- **Ticketing:** `supabase/migrations/20260730_create_support_tickets.sql` —
  `support_tickets` with a human `ticket_ref` (`RC-XXXXXX`, derived from
  `gen_random_uuid()` so it carries no pgcrypto dependency), category/status/
  priority CHECKs, a frozen `context` jsonb snapshot (tier at filing time —
  today's tier can't answer "what were they paying when this happened"), and
  `resolution_note` surfaced back to the member. RLS grants select-own and
  insert-own and **deliberately no update/delete** (a user who could set their
  own ticket to `urgent`, or delete a billing dispute, makes the queue
  meaningless).
- **API:** `src/app/api/support/tickets/route.ts` — GET own + POST, both
  Bearer-authed via `getUserIdFromRequest` **and** re-checking Pro server-side
  (tier `startsWith('pro')` && status active|trialing, mirroring
  `forecast-14d`). **Persist-then-notify is load-bearing:** `sendEmail()`
  silently returns `success: true` when `RESEND_API_KEY` is unset, so the row is
  written first and the response carries `emailed` — the UI says "saved but
  confirmation didn't send" rather than implying both legs worked. `context` is
  key-allowlisted (`page`/`spotSlug`/`appBuild`); `userAgent` is read from the
  request header, not the body.
- **Emails:** `src/lib/email-templates/support-ticket.ts` — triage email to the
  inbox + ack to the member. Ticket bodies are user-authored and land in HTML,
  so both templates escape before interpolation.
- **Shared types:** `src/lib/support-types.ts` (unions must track the table's
  CHECK constraints — drift shows up as a 500 on insert, not a type error).
- **Wiring:** `/support` added to `robots.ts` `disallow`; linked from
  `explore-top-bar.tsx` (beside the avatar, signed-in only — that bar renders
  for signed-out visitors and a top-level link to a paywall is worse than no
  link), the `mobile-bottom-nav.tsx` More sheet, and a card under
  `SubscriptionCard` on `/profile`, and a **Support** link in both
  `marketing-footer.tsx` rows. `/contact` and `/faq` gained static "Pro
  members" pointers (they're server components and can't read tier).
- **`SUPPORT_EMAIL` now lives in `src/lib/site.ts`** — it had been hardcoded in
  8 places. New code must import it; the legal pages still hold copies.

### Secrets via HashiCorp Vault (runtime OIDC loader, 2026-06-30)

Server secrets can be sourced at runtime from a self-hosted Vault instead of (or alongside) Vercel env vars. Integration is in place; the full rollout across consumers is still pending.

- **Loader:** `src/lib/secrets.ts` (`getServerSecret(name)` / `loadServerSecrets()` / `resolveSecret()`), built on the pure, unit-testable HTTP client `src/lib/vault-client.ts` (`vaultJwtLogin`, `vaultKvRead` — KV v2). Per-warm-instance in-memory cache (TTL `VAULT_CACHE_TTL_MS`, default 5 min) with inflight dedupe.
- **Auth:** on Vercel, each request's **OIDC token** (`@vercel/oidc` → `getVercelOidcToken()`) is exchanged for a short-lived Vault token via the JWT auth method. `VAULT_TOKEN` (static) overrides for local/non-Vercel runtimes. Vault JWT role binds on `project_id=prj_WoRjjGtjUopMvMCKJkQbiYHPhuZw` + `environment` (issuer `https://oidc.vercel.com`, aud `https://vercel.com/reelcaster-devs-projects`).
- **Fallback:** when `VAULT_ADDR` is unset, everything resolves from `process.env` — so local dev, tests, and current Vercel env keep working unchanged. Env vars documented in `.env.example` (VAULT_*).
- **CONSTRAINT:** `getVercelOidcToken()` cannot run at module level (token is per-request). The ~40 server files that read secrets as module-level constants / client singletons (`const x = process.env.SUPABASE_SERVICE_ROLE_KEY!`, `new Stripe(...)`, etc.) must become **lazy async getters** (`await getSupabaseAdmin()`) to migrate. Not yet done — only the loader + a probe ship so far.
- **Probe:** `GET /api/secrets/health?name=<KEY>` (auth `Bearer $CRON_SECRET`) reports `resolvedFrom: vault|env` + length, never the value. Remove after migration. Vault client flow verified locally against an API mock; the OIDC leg needs a preview deploy + a reachable Vault.

### Secrets via HashiCorp Vault (runtime OIDC loader, 2026-06-30)

Server secrets can be sourced at runtime from a self-hosted Vault instead of (or alongside) Vercel env vars. Integration is in place; the full rollout across consumers is still pending.

- **Loader:** `src/lib/secrets.ts` (`getServerSecret(name)` / `loadServerSecrets()` / `resolveSecret()`), built on the pure, unit-testable HTTP client `src/lib/vault-client.ts` (`vaultJwtLogin`, `vaultKvRead` — KV v2). Per-warm-instance in-memory cache (TTL `VAULT_CACHE_TTL_MS`, default 5 min) with inflight dedupe.
- **Auth:** on Vercel, each request's **OIDC token** (`@vercel/oidc` → `getVercelOidcToken()`) is exchanged for a short-lived Vault token via the JWT auth method. `VAULT_TOKEN` (static) overrides for local/non-Vercel runtimes. Vault JWT role binds on `project_id=prj_WoRjjGtjUopMvMCKJkQbiYHPhuZw` + `environment` (issuer `https://oidc.vercel.com`, aud `https://vercel.com/reelcaster-devs-projects`).
- **Fallback:** when `VAULT_ADDR` is unset, everything resolves from `process.env` — so local dev, tests, and current Vercel env keep working unchanged. Env vars documented in `.env.example` (VAULT_*).
- **CONSTRAINT:** `getVercelOidcToken()` cannot run at module level (token is per-request). The ~40 server files that read secrets as module-level constants / client singletons (`const x = process.env.SUPABASE_SERVICE_ROLE_KEY!`, `new Stripe(...)`, etc.) must become **lazy async getters** (`await getSupabaseAdmin()`) to migrate. Not yet done — only the loader + a probe ship so far.
- **Probe:** `GET /api/secrets/health?name=<KEY>` (auth `Bearer $CRON_SECRET`) reports `resolvedFrom: vault|env` + length, never the value. Remove after migration. Vault client flow verified locally against an API mock; the OIDC leg needs a preview deploy + a reachable Vault.

## Development Guidelines

When implementing a large new feature always create a detailed step by step plan as a task list. Ask me any clarifying question and then start implementation.
Always act like senior engineer and create smaller and reusable components. Make sure to use the existing components and utilities in the project.

**Important:** Many components in the codebase are legacy or unused. Refer to the "Active Components" section above to understand which components are currently in use before building upon existing functionality.

- for the docs always keep the names in file-name format.
- No need to create new document everytime we change something. We just need to update the CLAUDE.md with anything important regarding the system. and existing docs shouuld be updated if the changes were related.
- use supabase mcp when trying to access anything in supabase.
- don't build to check everything unless explicitly asked

## Journey testing (Phase E, 2026-05-08)

End-to-end Playwright suite covering 14 user journeys (Public → Free → Pro) lives at `e2e/journeys/`. The suite assumes two seed scripts have run:

- `bluecaster/scripts/seed-demo-content.ts` — populates 6 species profiles, flips `is_published=true` on 2 spots, links spot↔species, sets city hero images + featured species. See `bluecaster/CLAUDE.md`.
- `scripts/seed-demo-users.ts` — creates `free@reelcaster.test` + `pro@reelcaster.test` with seeded `user_settings` and 5 favorite_spots on the pro user.

Run locally:
```sh
# Both seeds (one-time, idempotent)
cd ../bluecaster && SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/seed-demo-content.ts
cd ../reelcaster-frontend && npx tsx scripts/seed-demo-users.ts   # prints test passwords on first run; copy into .env.test

# Servers (BC dev :3001 + FE dev :3004 auto-started by playwright.config.ts webServer)
cd ../bluecaster && npm run dev

# Suite
pnpm test:e2e e2e/journeys/
```

The journey suite is layered on top of:
- `e2e/sections/` — Phase 8 section-presence (49 tests).
- `e2e/api/contracts.spec.ts` — Phase 0/3/4 tier-gating contracts.
- `e2e/api/bluecaster.spec.ts` — BC public-endpoint contracts.
- `e2e/api/journeys.spec.ts` — post-seed assertions (Phase C.5).

See `e2e/journeys/README.md` for prereqs, env-var checklist, and the resolved 6h-vs-0d signed-out-clip note.
### Route note: `/support`, not `/theport`

The portal briefly shipped at `/theport` and moved to `/support` on the same
day. "The Port" remains its name in the UI — only the URL changed. Two
permanent redirects in `next.config.ts` (`/theport` and `/theport/:path*`)
keep the old path working, which matters because ticket acknowledgement
emails had already gone out carrying `/theport` links.
