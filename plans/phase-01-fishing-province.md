# Phase 1 — `/fishing` index + `/fishing/bc` province page

**Public-first.** No auth, no payment. SSR for SEO. ½ day.

## Routes

- `src/app/fishing/page.tsx` (NEW) — country/province/city index
- `src/app/fishing/[province]/page.tsx` (NEW) — single province (map + cities)

Existing `src/app/fishing/[...slug]/page.tsx` continues to handle city + spot pages downstream.

## Data

- `GET /api/v1/hierarchy` (BlueCaster, existing) — countries → provinces → cities tree.
- Province editorial paragraph: markdown frontmatter at `content/provinces/<slug>.md` (new folder). Example: `content/provinces/bc.md`. Read with the existing markdown loader if one exists; otherwise `gray-matter` is fine.

## `/fishing/page.tsx`

- SSR fetch hierarchy.
- Group by country → list provinces with a covered/coming-soon badge based on `COVERED_PROVINCES` constant.
- Schema.org `WebPage` + `BreadcrumbList`.
- Light editorial theme matching existing city pages (stone/slate, not `rc-*` dark).

## `/fishing/[province]/page.tsx`

- SSR fetch hierarchy filtered to the province.
- Top: short editorial paragraph from `content/provinces/<slug>.md`.
- Body: Mapbox static-snapshot map (or react-map-gl in non-interactive mode) with city markers.
- List of cities → `/fishing/<province>/<city>` (existing).
- Schema.org `WebPage` + `BreadcrumbList` + `Place` per city.

## Constants

`src/lib/regions.ts` (NEW):

```ts
export const COVERED_PROVINCES = ['bc', 'wa', 'or'] as const;
export type CoveredProvince = typeof COVERED_PROVINCES[number];
export const isCovered = (slug: string) => COVERED_PROVINCES.includes(slug.toLowerCase() as CoveredProvince);
```

## Verification

- `curl /fishing` returns 200, lists BC/WA/OR with covered badge.
- `curl /fishing/bc` returns 200, paragraph + map + city list.
- Lighthouse mobile LCP < 2s on both.
- Google Rich Results test passes for BreadcrumbList + WebPage.
