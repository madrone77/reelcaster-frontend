// The ONLY button styles. Three sizes, defined once — change here, every
// button updates. No per-button padding anywhere else.
//
// Sizes (height): large 48px · medium 40/44px · small 36px.
// Prominent CTAs are LARGE + filling on compact/medium (big, thumb-friendly)
// and step down to MEDIUM + hugging at wide (≥1024) — a full-size button at
// desktop scale is a shout. All buttons are uppercase.

const BASE =
  'inline-flex items-center justify-center rounded font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';

// Large on compact + medium (48px / text-base / 24px pad), medium at wide.
const PROMINENT = 'min-h-12 px-6 text-base lg:min-h-11 lg:px-5 lg:text-sm';
// Small nav button — steady across ranges.
const SMALL = 'min-h-10 px-4 text-xs';

const PRIMARY = 'bg-rc-brand text-white hover:bg-rc-brand-hover';
const SECONDARY =
  'border border-rc-brand bg-rc-panel text-rc-brand hover:bg-rc-brand-soft';
const ON_BRAND = 'bg-white text-rc-brand hover:bg-white/90';

export const btn = {
  // Standalone prominent CTA: fills on compact, hugs from medium (640) up.
  primary: `${BASE} ${PROMINENT} w-full min-w-20 ${PRIMARY} sm:w-auto`,
  secondary: `${BASE} ${PROMINENT} w-full min-w-20 ${SECONDARY} sm:w-auto`,
  // Prominent CTA on a brand-colored band (white button).
  onBrand: `${BASE} ${PROMINENT} min-w-20 ${ON_BRAND} sm:w-auto w-full`,
  // Fills its own cell at every range (pricing card columns).
  cardPrimary: `${BASE} ${PROMINENT} w-full ${PRIMARY}`,
  // Compact header CTA: small, always hugs.
  nav: `${BASE} ${SMALL} ${PRIMARY}`,
} as const;
