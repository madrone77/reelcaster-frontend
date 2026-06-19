# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReelCaster Frontend is a Next.js 15 application that provides fishing forecasts and historical data analysis for British Columbia, Canada. It integrates multiple APIs to deliver weather, marine conditions, tide data, and fishing statistics to help anglers make informed decisions.

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
│   ├── auth/          # Authentication components (auth-button, auth-dialog, user-menu)
│   ├── charts/        # Data visualization (mobile-friendly-chart)
│   ├── common/        # Shared components (sidebar, loading, error states)
│   ├── forecast/      # Active forecast UI (day-outlook, hourly-chart, weather-conditions, etc.)
│   ├── location/      # Location selection (compact-location-selector)
│   └── ui/           # Enhanced UI components
├── utils/            # API integrations and utilities
├── profile/          # User profile page
├── page.tsx          # Main application page (fishing forecast)
└── layout.tsx        # Root layout
```

### Key Routes

- `/` - Main fishing forecast page with location-based forecasts
- `/profile` - User profile and preferences page
- `/profile/catch-log` - Catch logging history and statistics
- `/profile/custom-alerts` - Custom alert configuration
- `/admin/send-email` - Admin email broadcast system (manual email sending)

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

## Interactive Weather Map

The forecast page includes an interactive weather map with **dual visualization options**: a custom Mapbox-based map and an official Windy-powered map. Users can toggle between both map types, with their preference saved locally.

### Map Options

#### 1. Mapbox Map (Custom Implementation)

**Features:**
- **Mapbox GL Base Map**: Dark theme matching app design
- **Hotspot Markers**: Clickable markers for all fishing locations in the selected area
- **Weather Tile Layers**: Real-time weather overlays from OpenWeatherMap
  - Temperature layer (heat map visualization)
  - Precipitation layer (rainfall intensity)
  - Wind layer (direction and speed)
  - Cloud cover layer
- **Layer Controls**: Toggle individual layers on/off with opacity adjustment
- **Timeline Scrubber**: Playback forecast data through 14-day period
- **Current Weather Display**: Real-time temp, wind, and precipitation metrics
- **Interactive Markers**: Click hotspot markers to change location and reload forecast
- **Wind Flow Visualization**: Custom animated directional arrows showing wind patterns over water (arrow length indicates wind intensity)

**Environment Variables:**
```env
# Required - Mapbox GL base map
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token

# Optional - Weather tile layers (map works without this, but layers won't display)
NEXT_PUBLIC_OPENWEATHERMAP_API_KEY=your_openweathermap_api_key
```

**API Keys:**
- **Mapbox** (Free tier: 50,000 loads/month): https://account.mapbox.com/access-tokens/
- **OpenWeatherMap** (Free tier: 60 calls/min, 1M tiles/month): https://home.openweathermap.org/api_keys

**Technical Implementation:**
- Map Library: react-map-gl v8.x with Mapbox GL JS
- Tile Rendering: OpenWeatherMap raster tiles via Source/Layer
- Timeline Playback: Auto-advance through forecast data points (500ms intervals)
- Marker Interaction: Click handler updates URL params and triggers forecast reload
- Responsive Design: 500px height on mobile, maintains aspect ratio on desktop

#### 2. Windy Map (Official Integration)

**Features:**
- **Official Windy Visualization**: Industry-leading wind flow animations
- **Multiple Weather Layers**: Wind, temperature, precipitation, clouds, and 20+ other parameters
- **Hotspot Markers**: Same clickable markers as Mapbox version
- **Interactive Forecast**: Click anywhere on map for detailed point forecast
- **Timeline Controls**: Playback forecast data with Windy's built-in timeline
- **Layer Menu**: Access to Windy's full layer selection (bottom-right)

**Environment Variables:**
```env
# Required - Windy API key
NEXT_PUBLIC_WINDY_API_KEY=your_windy_api_key
```

**API Keys:**
- **Windy API** (Testing tier: Free for development only): https://api.windy.com/keys
  - **Note**: Professional tier required for production use (contact Windy for pricing)

**Technical Implementation:**
- Map Library: Leaflet 1.4.x (loaded via Windy CDN)
- API Integration: Windy Map Forecast API
- Custom Markers: Leaflet divIcon with custom styling
- Documentation: https://api.windy.com/map-forecast/docs

### Map Switcher

Users can toggle between map types using the **Map Type** switcher above the map. The selection is saved to `localStorage` and persists across sessions.

### Key Files

- **Switcher**: `src/app/components/forecast/forecast-map-switcher.tsx` - Main component with toggle
- **Mapbox Map**: `src/app/components/forecast/forecast-map.tsx` - Custom Mapbox implementation
- **Windy Map**: `src/app/components/forecast/forecast-map-windy.tsx` - Official Windy integration
- **Wind Particles**: `src/app/components/forecast/wind-particle-layer.tsx` - Custom wind animation (Mapbox only)
- **Integration**: `src/app/page.tsx` - Integrated between location selector and forecast header
- **Data Flow**: Uses existing `openMeteoData` state for timeline playback

## Explore relief map (`/explore`)

The Explore page renders a **bathymetric color-relief nautical chart** (ported from BlueCaster's `test/map/1` / "bathy-relief" system) instead of a generic base map — **no `NEXT_PUBLIC_MAPBOX_TOKEN` required**. It uses **MapLibre GL** (`react-map-gl/maplibre`, already-installed `maplibre-gl`), not Mapbox.

- **Self-hosted tiles**: relief raster (WebP) + depth contours + land are versioned PMTiles archives on BlueCaster's public Supabase CDN, served per-z/x/y by our own proxy `src/app/api/map/tiles/[set]/[z]/[x]/[y]/route.ts` (uses `pmtiles`; immutable 1-yr cache). Registry: `src/lib/map/tile-sets.ts` — **a BlueCaster re-bake (new version key) must be mirrored here** (bump the version const + the keys referenced in `relief-style.ts`).
- **Style**: `src/lib/map/relief-style.ts` — `buildReliefStyle(origin)` is a **verbatim port of BlueCaster's** `lib/bluecaster/map/relief-style.ts`, kept at full `/test/map/1` parity (relief + contours + contour-labels + land + DFO subarea grid + RCAs + WDFW (hidden) + marine structures + tide stations + US/CA border + multi-tier place labels). Keep it in sync with the BlueCaster source on any chart change. Called with `origin=""` so all URLs are root-relative same-origin. Glyphs (`public/fonts/Open Sans Semibold/`) + the overlay GeoJSON (`public/*_salish.geojson`, `public/region_places.geojson`) are copied from BlueCaster; **every symbol layer must set `text-font: ["Open Sans Semibold"]`** (only shipped fontstack). `next.config.ts` long-caches `/fonts/*` + `/:file.geojson`.
- **Markers**: native GL **clustered** circle/symbol layers (not DOM markers) — `src/app/explore/components/explore-map.tsx` + `src/app/explore/lib/spot-geojson.ts`. Pins match BlueCaster's MapExplorer 1:1: `scoreColor()` continuous 5-stop scale (`#059669`/`#65a30d`/`#ca8a04`/`#ea580c`/`#e11d48`, unscored `#9ca3af`), color/opacity/label/txtColor baked into feature props, zoom-interpolated radius (11→14→16), white numerals (unscored = grey `·`), cobalt `#1F40E0` selection stroke + hover stroke bump, cobalt count-stepped clusters. `getClusterExpansionZoom` + `easeTo` on cluster click. (The rail/drawer keep the light-editorial 4-tier `TIER_PILL` system — that's the reelcaster design language, intentionally separate from the map pins.)
- **Map controls** (`src/app/explore/components/map-controls.tsx`, floating bottom-center/left) — mirror BlueCaster's MapExplorer toggles, state owned by `explore-shell.tsx`:
  - **Relief** + **Labels** — flip `visibility` on the relief/contour layers and the `places-t*` layers (`setLayoutProperty` in `explore-map.tsx`).
  - **Currents** — bathy-relief **WebGL flow** (`src/app/explore/lib/use-currents-flow.ts`, a faithful port of BlueCaster's `app/bathy-relief/relief.html` `startFlow`, matching https://www.bluecaster.co/bathy-relief — **not** the simpler `useCurrentsArrows` DOM-canvas hook). Rendered as a MapLibre **custom (WebGL) layer** composed of two offscreen 2D canvases blitted as fullscreen quads each frame: (1) a smooth speed→colour **heatmap field** (absolute-knots ramp `[0,0.4,0.9,1.6,2.4,3.5]`, 50% opacity, bilinear-upscaled low-res grid) and (2) **white particle ribbons** (3800 particles, faint dark shadow, trail-fade 0.96) advected through the U/V field. The layer is inserted **before `subarea-lines-casing`** and the `land` fill is forced into the translucent pass (`fill-opacity` 0.999 while on, 1 when off) so currents **clip at the coastline** and render under place labels. Field over-fetched with 0.2 viewport padding so the heatmap overfills the screen. Data via the same-origin proxy `src/app/api/bluecaster/currents/field/route.ts` → BlueCaster's auth-free `/api/map/currents/field` (note: that path is **not** under `/api/v1`, so the proxy hits `BLUECASTER_API_URL/api/map/...` directly).
  - **Species filter** — re-scores pins + rail by a single species using `RailSpot.scoresBySpecies` (per-species peak, 0–100, added in `explore-data.ts`); options come from `ExploreData.species`. `displaySpots` in the shell applies it (overrides `score`/`bestSpeciesId`/`driverSpecies`, re-sorts).
- **Opens on Victoria**: `buildExploreData` defaults `defaultCitySlug` to the pilot city (`victoria-bc`) when covered (else best-scoring), so the page lands on the bathymetry-rich Juan de Fuca coastline.

## Important Development Notes

### Component Creation

When creating new components:

1. Check existing components in `src/app/components/` for patterns
2. Use shadcn/ui components from the ui directory as base
3. Follow the existing file naming convention (camelCase for files)
4. Place feature-specific components in appropriate subdirectories

### Active Components

Based on current usage analysis, these components are actively used:

**Auth Components:**

- `auth-button.tsx` - Authentication button with user menu
- `auth-dialog.tsx` - Login/signup dialog
- `forecast-section-overlay.tsx` - Auth overlay for forecast sections
- `user-menu.tsx` - User profile menu

**Charts:**

- `mobile-friendly-chart.tsx` - Data visualization component for charts

**Layout (New Design System):**

- `app-shell.tsx` - Main layout wrapper with icon sidebar, location panel, mobile nav
- `icon-sidebar.tsx` - Desktop icon-based sidebar navigation
- `location-panel.tsx` - Desktop location/hotspot selector panel
- `mobile-tab-bar.tsx` - Mobile bottom navigation
- `mobile-location-sheet.tsx` - Mobile location selector sheet
- `dashboard-header.tsx` - Page header with title and optional controls

**Common:**

- `modern-loading-state.tsx` - Loading state component
- `error-state.tsx` - Error display component

**Forecast (Main UI):**

- `new-forecast-header.tsx` - Forecast page header
- `forecast-map-switcher.tsx` - Map type switcher with localStorage persistence
- `forecast-map.tsx` - Custom Mapbox GL map with OpenWeatherMap layers
- `forecast-map-windy.tsx` - Official Windy map integration with Leaflet
- `wind-particle-layer.tsx` - Custom canvas-based wind animation overlay
- `day-outlook.tsx` - Daily forecast overview
- `overall-score.tsx` - Fishing score summary
- `hourly-chart.tsx` - Hourly fishing score chart
- `hourly-table.tsx` - Detailed hourly data table
- `weather-conditions.tsx` - Current conditions display
- `species-regulations.tsx` - Fishing regulations info
- `fishing-reports.tsx` - Recent fishing reports

**Location:**

- `compact-location-selector.tsx` - Location picker component

**Catch Log:**

- `fish-on-button.tsx` - Floating action button for quick catch logging
- `fish-on-button-wrapper.tsx` - Auth-aware wrapper component
- `quick-catch-modal.tsx` - Outcome selection modal (Bite/Landed)

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

## Automated Scraping System

ReelCaster uses two automated scraping systems to keep data fresh:

### 1. Fishing Reports Scraper

- **Source**: FishingVictoria.com weekly reports (published Sundays)
- **Parser**: Hybrid Cheerio+OpenAI approach (Cheerio extracts sections, AI parses natural language)
- **Cost Optimization**: ~25-40% token reduction via pre-extraction with Cheerio
- **Alternatives**: Claude Haiku (80% cheaper), Groq Llama (95% cheaper), pure Cheerio (impossible - unstructured text)
- **Frequency**: Daily check at 2 AM UTC (reports published Sundays)
- **Smart Logic**: Checks Sunday dates specifically, stops after finding latest report per location
- **Storage**: `fishing_reports` table (JSONB)
- **API**: `/api/fishing-reports/scrape?weeks=4` (PUBLIC - no auth required)

### 2. Regulations Scraper

- **Source**: DFO Pacific Region fishing regulations
- **Parser**: Cheerio (HTML parsing) - NO OpenAI needed
- **Areas**: 19 (Victoria, Sidney), 20 (Sooke, Port Renfrew)
- **Storage**: `fishing_regulations` + related tables (normalized)
- **API**: `/api/regulations/scrape?area_id=19`

### Key Files

- **API Endpoints**: `src/app/api/fishing-reports/scrape/` and `src/app/api/regulations/scrape/`
- **Scrapers**: `src/app/utils/scrape-fishing-report.ts` and `src/app/utils/dfoScraperV2.ts`
- **Manual Scripts**: `scripts/scrape-historical-reports.ts` and `scripts/scrape-and-update-regulations.ts`
- **GitHub Actions**: `.github/workflows/scrape-data.yml` (runs daily at 2 AM UTC)
- **Documentation**: `docs/scraping-system.md` (comprehensive guide)

### Adding New Areas/Locations

The system is fully dynamic - just add data to the database and the frontend automatically displays it.

**For Fishing Reports**: Update locations array in `/api/fishing-reports/scrape/route.ts`
**For Regulations**: Add to `AREA_NAMES` in `src/app/utils/dfoScraperV2.ts`, run scraper

See `docs/scraping-system.md` for detailed instructions.

## Email Broadcast System

ReelCaster includes an admin email broadcast system for sending customized emails to all registered users.

### Features

- **Manual Email Composition**: Admin can compose custom messages with rich text
- **Optional Data Sections**: Toggle inclusion of forecast, weather, tides, and fishing reports
- **Location-Specific Data**: Select location for forecast/tide data
- **Email Preview**: Preview emails before sending
- **Batch Sending**: Emails sent in batches of 20 to avoid rate limits
- **Progress Tracking**: Real-time progress and result reporting
- **Responsive Templates**: Beautiful, mobile-friendly HTML email templates

### Setup Requirements

**Environment Variables** (add to `.env.local`):
```env
# Supabase Service Role Key (for accessing auth.users)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Resend API Key (for email sending)
# Free tier: 100 emails/day, 3,000 emails/month
RESEND_API_KEY=your_resend_api_key
```

### Key Files

- **Admin Page**: `/admin/send-email` - Email composition interface
- **API Endpoints**:
  - `/api/admin/preview-email` - Generate email preview
  - `/api/admin/send-broadcast` - Send emails to all users
- **Email Service**: `src/lib/email-service.ts` - Email sending logic
- **Email Template**: `src/lib/email-templates/admin-broadcast.ts` - HTML template
- **Components**:
  - `src/app/components/admin/email-composer.tsx` - Composer UI
  - `src/app/components/admin/email-preview.tsx` - Preview modal
- **Documentation**: `docs/email-broadcast-system.md` - Comprehensive guide

### Usage

1. Navigate to `/admin/send-email`
2. Compose custom message
3. Select location and toggle data sections
4. Preview email
5. Send to all users

### Technology

- **Email Service**: Resend (https://resend.com)
- **Template Engine**: Custom TypeScript/HTML generator
- **Batch Processing**: 20 emails per batch with rate limiting
- **Authentication**: Supabase Admin API for user access

See `docs/email-broadcast-system.md` for detailed setup and usage instructions.

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
- **Automation**: `.github/workflows/scrape-data.yml` - Runs daily at 2 AM UTC after scraping
- **Migration Script**: `scripts/migrate-notification-preferences.ts` - One-time data migration
- **Documentation**: `docs/notification-system.md` - Comprehensive architecture guide

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
- **Email Service**: Resend (shared with broadcast system)
- **Automation**: GitHub Actions (daily cron job)
- **Weather Data**: Open Meteo API (7-day forecasts)
- **Scoring Algorithm**: Species-specific 13-factor calculation
- **Database**: Supabase PostgreSQL with RLS policies

See `docs/notification-system.md` for detailed architecture and implementation guide.

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

## Catch Logging System (Fish On)

ReelCaster includes a mobile-first catch logging system that allows anglers to quickly log catches with minimal friction. The system features offline-first architecture with background sync.

### Features

- **Quick Capture**: Large "Fish On" floating action button for instant logging
- **Auto-Captured Data**: GPS coordinates, accuracy, heading, speed, timestamp
- **Two Outcome Types**: Bite (lost) or Landed (in the boat)
- **Offline-First**: IndexedDB storage with Supabase sync when online
- **Deferred Details**: Species, depth, lure, size, weight can be added later
- **Retention Tracking**: Released or Kept status
- **Predefined Lures**: BC fishing lures with custom entry option

### Database Schema

- **`catch_logs`**: Individual catch records with GPS, weather context, and optional details
- **`lures`**: Predefined BC lures + user-created custom lures

### Key Files

- **Floating Button**: `src/app/components/catch-log/fish-on-button.tsx` - Global FAB
- **Quick Capture Modal**: `src/app/components/catch-log/quick-catch-modal.tsx` - Outcome selection
- **Button Wrapper**: `src/app/components/catch-log/fish-on-button-wrapper.tsx` - Auth integration
- **History Page**: `src/app/profile/catch-log/page.tsx` - Catch history and stats
- **API Endpoints**:
  - `/api/catches` - CRUD operations
  - `/api/catches/sync` - Batch offline sync
  - `/api/lures` - Lure CRUD
- **Services**:
  - `src/lib/geolocation-service.ts` - GPS capture helper
  - `src/lib/offline-catch-store.ts` - IndexedDB wrapper
  - `src/lib/catch-sync-manager.ts` - Background sync
- **Migrations**:
  - `supabase/migrations/20251220_create_catch_logs.sql`
  - `supabase/migrations/20251220_create_lures.sql`

### UX Flow

1. **Quick Capture (2 taps)**:
   - Tap "Fish On" button → GPS capture starts
   - Select outcome → "Bite" or "In the Boat"
   - Done → Catch saved locally, syncs when online

2. **Add Details (optional)**:
   - Species, Retention status (Released/Kept)
   - Depth, Size, Weight
   - Lure selection, Notes, Photos

### Offline Sync Strategy

- All catches stored locally first (instant response)
- Background sync every 30 seconds when online
- `client_id` prevents duplicates during sync
- Exponential backoff with max 5 retries
- Conflict detection with manual resolution

### Technology

- **Local Storage**: IndexedDB via `idb` library
- **GPS**: Browser Geolocation API with high accuracy
- **Sync**: Custom sync manager with queue
- **UI**: Floating action button with haptic feedback
- **Database**: Supabase PostgreSQL with RLS

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