import type { Metadata } from 'next';
import { DEFAULT_OG, SITE_URL } from '@/lib/site';
import Link from 'next/link';
import AboutTabs from './about-tabs';


export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand,
  // so naming it here too rendered "About ReelCaster | … | ReelCaster".
  title: 'About: BC Fishing Forecasts',
  description:
    'ReelCaster turns tides, weather, water conditions, and DFO and WDFW rules into one score for the BC and Washington coasts. Built by anglers in Victoria, BC.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'About ReelCaster',
    description:
      'Tides, weather, water conditions, and regulations in one simple fishing score, built by anglers in Victoria, BC.',
    url: `${SITE_URL}/about`,
    siteName: 'ReelCaster',
    type: 'website',
    ...DEFAULT_OG,
    locale: 'en_CA',
  },
  robots: { index: true, follow: true },
};

const JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About ReelCaster',
  url: `${SITE_URL}/about`,
  inLanguage: 'en-CA',
  publisher: {
    '@type': 'Organization',
    name: 'ReelCaster',
    url: SITE_URL,
    email: 'support@reelcaster.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Victoria',
      addressRegion: 'BC',
      addressCountry: 'CA',
    },
  },
};

// Coverage rollout — honest about what's live vs. expanding.
const COVERAGE = [
  { status: 'Live now', place: 'Victoria & South Vancouver Island', tone: 'live' },
  { status: 'Expanding', place: 'Across the Salish Sea', tone: 'soon' },
  { status: 'Coming', place: 'The wider Pacific Northwest', tone: 'later' },
];

// How the score works — numbered, like the reference's feature cards.
const HOW = [
  {
    n: '01',
    title: 'One score',
    body: 'Tides, weather, water, and regulations distilled into a single 0–100 number for each spot and species.',
  },
  {
    n: '02',
    title: 'Every spot',
    body: 'Computed for the actual bank, point, or channel you fish, on nautical-chart bathymetry rather than a weather grid.',
  },
  {
    n: '03',
    title: 'Regulation-aware',
    body: 'DFO openings and closures are baked into the score, so it never sends you somewhere you can’t fish.',
  },
];

// A stylized dotted map of the coast — the ReelCaster answer to the reference's
// "members around the world" dot map. Faint dot matrix + a few coverage pins.
function CoverageMap() {
  const cols = 22;
  const rows = 13;
  const gap = 18;
  const dots: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Carve a soft diagonal coastline so the grid reads as land ↘ water.
      if (c + r * 0.7 < 6 || c + r * 0.7 > 26) continue;
      dots.push({ x: 20 + c * gap, y: 16 + r * gap });
    }
  }
  // Coverage pins (grid-space → px), brightest = live.
  const pins = [
    { x: 20 + 6 * gap, y: 16 + 9 * gap, label: 'Victoria', bright: true },
    { x: 20 + 10 * gap, y: 16 + 6 * gap, label: 'Salish Sea', bright: false },
    { x: 20 + 15 * gap, y: 16 + 3 * gap, label: 'PNW', bright: false },
  ];

  return (
    <svg
      viewBox="0 0 420 270"
      className="h-auto w-full"
      role="img"
      aria-label="Stylized coverage map of the BC coast and Salish Sea with covered areas marked"
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1.6} fill="rgba(255,255,255,0.16)" />
      ))}
      {/* faint connective path between pins */}
      <path
        d={`M ${pins[0].x} ${pins[0].y} L ${pins[1].x} ${pins[1].y} L ${pins[2].x} ${pins[2].y}`}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
      {pins.map((p) => (
        <g key={p.label}>
          {p.bright && (
            <circle cx={p.x} cy={p.y} r={10} fill="#1E40E0" opacity={0.25} />
          )}
          <circle
            cx={p.x}
            cy={p.y}
            r={p.bright ? 5 : 4}
            fill={p.bright ? '#3B5BF0' : '#1E40E0'}
            stroke="#fff"
            strokeWidth={p.bright ? 1.5 : 1}
          />
          <text
            x={p.x + 10}
            y={p.y + 3.5}
            className="font-rc-mono"
            fontSize="10"
            fill="rgba(255,255,255,0.72)"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }}
      />

      <article data-testid="section-about" className="overflow-hidden bg-rc-panel">
        {/* ── HERO: tabbed about (left) + founding-story card (right) ───── */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 md:pb-24 md:pt-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <AboutTabs />

            <div className="relative overflow-hidden rounded-2xl bg-rc-navy p-8 text-white md:p-10">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/[0.05]"
              />
              <p className="font-rc-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
                Our story
              </p>
              <h1 className="mt-3 text-balance text-4xl font-black leading-[1.05] tracking-[-0.02em] md:text-5xl">
                Built by anglers, for anglers.
              </h1>
              <p className="mt-5 max-w-md text-pretty leading-relaxed text-white/75">
                We got tired of cross-referencing tide tables, wind apps, and
                regulation PDFs before every trip, and still guessing. So we
                built one honest score for the water we fish.
              </p>
            </div>
          </div>
        </section>

        {/* ── WHERE WE'RE COVERING: dark section + dotted map ──────────── */}
        <section className="bg-rc-navy text-white">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
            <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-3 font-rc-mono text-[11px] uppercase tracking-[0.16em] text-white/50">
                  On the water now
                </p>
                <h2 className="text-balance text-3xl font-black tracking-[-0.02em] md:text-4xl">
                  Where we’re covering.
                </h2>
                <p className="mt-4 max-w-md text-pretty leading-relaxed text-white/70">
                  ReelCaster starts where we fish and grows city by city. Every
                  new area is seeded with local spots and reviewed before it goes
                  live. Coverage grows carefully, not all at once.
                </p>

                <ul className="mt-8 space-y-4">
                  {COVERAGE.map(({ status, place, tone }) => (
                    <li key={place} className="flex items-center gap-4">
                      <span
                        className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                          tone === 'live'
                            ? 'bg-rc-good'
                            : tone === 'soon'
                              ? 'bg-white/60'
                              : 'bg-white/25'
                        }`}
                      />
                      <span className="font-rc-mono text-[11px] uppercase tracking-wider text-white/50">
                        {status}
                      </span>
                      <span className="text-sm font-semibold text-white">{place}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/fishing/bc"
                  className="mt-8 inline-flex items-center text-sm font-bold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
                >
                  See what’s published in British Columbia →
                </Link>
              </div>

              <div className="relative">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-4 rounded-3xl bg-white/[0.03]"
                />
                <div className="relative">
                  <CoverageMap />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW THE SCORE WORKS: numbered cards ──────────────────────── */}
        <section className="bg-rc-panel">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
            <p className="mb-3 font-rc-mono text-[11px] uppercase tracking-[0.16em] text-rc-ink-mute">
              The method
            </p>
            <h2 className="max-w-2xl text-balance text-3xl font-black tracking-[-0.02em] text-rc-ink md:text-4xl">
              How the score works.
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {HOW.map(({ n, title, body }) => (
                <div
                  key={n}
                  className="rounded-2xl border border-rc-rule bg-rc-panel p-7"
                >
                  <p className="font-rc-mono text-sm font-bold text-rc-brand">—{n}</p>
                  <h3 className="mt-4 text-xl font-black tracking-[-0.01em] text-rc-ink">
                    {title}
                  </h3>
                  <p className="mt-2 text-pretty text-sm leading-relaxed text-rc-ink-soft">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
