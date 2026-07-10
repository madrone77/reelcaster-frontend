import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { fetchSpecies } from '@/lib/bluecaster';

const SITE_URL = 'https://reelcaster.com';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchSpecies(slug);
  if (!data) return {};
  const name = data.species.name;
  const scientific = data.species.scientific_name ? ` (${data.species.scientific_name})` : '';
  const title = `${name} Fishing in BC${scientific ? ' ' + scientific : ''} | ReelCaster`;
  const description = `When and where to catch ${name} in British Columbia. Seasonal calendar, regulations, and top spots from ReelCaster.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/species/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/species/${slug}`,
      siteName: 'ReelCaster',
      type: 'article',
      locale: 'en_CA',
    },
    robots: { index: true, follow: true },
  };
}

export default async function SpeciesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await fetchSpecies(slug);
  if (!data) notFound();

  const { species, top_spots } = data;

  // seasonal_calendar may be free-form JSONB. We attempt a best-effort render
  // when it's an object keyed by month index; otherwise fall back gracefully.
  const seasonalRow = parseSeasonal(species.seasonal_calendar);

  // Heuristic: a "stub" species row has only slug+name. Show a graceful
  // "Profile coming soon" panel rather than a near-empty page. Top spots
  // still render if the array is non-empty — not gated on the stub flag.
  const isStub =
    species.scientific_name == null &&
    species.family == null &&
    species.seasonal_calendar == null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${species.name} Fishing in BC`,
    about: {
      '@type': 'Thing',
      name: species.name,
      alternateName: species.scientific_name ?? undefined,
    },
    url: `${SITE_URL}/species/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        <header
          data-testid="section-species-hero"
          className="max-w-4xl mx-auto px-6 pt-14 pb-8 md:pt-20"
        >
          <p className="text-rc-text-muted text-xs tracking-[0.25em] uppercase font-medium mb-3">
            <Link href="/species" className="hover:text-rc-text">Species</Link>
            {species.family && <span> · {species.family}</span>}
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-rc-text mb-3">
            {species.name}
          </h1>
          {species.scientific_name && (
            <p className="text-lg italic text-rc-text-light mb-2">
              {species.scientific_name}
            </p>
          )}
        </header>

        {isStub && (
          <section
            data-testid="section-species-coming-soon"
            className="max-w-4xl mx-auto px-6 py-6"
          >
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 flex items-start gap-4">
              <div className="p-2 bg-rc-bg-darkest rounded-lg border border-amber-500/40 shrink-0">
                <Lock className="w-5 h-5 text-amber-300" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-rc-text">
                  Profile coming soon
                </p>
                <p className="text-sm text-rc-text-light mt-1">
                  We&rsquo;re still building the {species.name} profile. Sign up
                  free and we&rsquo;ll notify you when it lands.
                </p>
              </div>
              <Link
                href={`/signup?from=species&slug=${encodeURIComponent(species.slug)}`}
                className="shrink-0 inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                Sign up free
              </Link>
            </div>
          </section>
        )}

        {seasonalRow && (
          <section
            data-testid="section-species-seasonal"
            className="max-w-4xl mx-auto px-6 py-6"
          >
            <h2 className="text-sm font-semibold text-rc-text uppercase tracking-widest mb-3">
              Seasonal calendar
            </h2>
            <div className="grid grid-cols-12 gap-1 text-center">
              {MONTH_LABELS.map((m, i) => {
                const rating = seasonalRow[i];
                return (
                  <div
                    key={m}
                    className={`text-[10px] py-2 rounded ${ratingClass(rating)}`}
                    title={rating ?? 'no data'}
                  >
                    {m}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-rc-text-muted mt-2">
              Color reflects historical abundance. Always verify current regulations
              before fishing.
            </p>
          </section>
        )}

        {top_spots.length > 0 && (
          <section
            data-testid="section-species-top-spots"
            className="max-w-4xl mx-auto px-6 py-6"
          >
            <h2 className="text-sm font-semibold text-rc-text uppercase tracking-widest mb-3">
              Top spots
            </h2>
            <ul className="divide-y divide-rc-bg-light border border-rc-bg-light rounded-lg bg-rc-bg-dark">
              {top_spots.map((s) => (
                <li key={s.id} className="px-4 py-3 flex items-center justify-between">
                  <span className="font-medium text-rc-text">{s.name}</span>
                  {typeof s.confidence === 'number' && (
                    <span className="text-xs text-rc-text-muted">
                      confidence {(s.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          data-testid="section-species-cta"
          className="max-w-4xl mx-auto px-6 py-12 border-t border-rc-bg-light mt-8"
        >
          <div className="bg-rc-bg-dark border border-rc-bg-light rounded-lg p-6 text-center">
            <h3 className="text-xl font-bold text-rc-text mb-2">
              Get a daily score for {species.name}
            </h3>
            <p className="text-sm text-rc-text-light mb-4">
              Sign up free for a 1-day forecast at any covered city. Pro unlocks
              the full 14-day window with multi-species scoring.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold text-white"
              >
                Sign up free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 bg-rc-bg-darkest border border-rc-bg-light hover:border-blue-500/40 rounded-md text-sm font-semibold text-rc-text"
              >
                See Pro pricing
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}

function parseSeasonal(raw: unknown): Array<string | null> | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  // Common shape: { months: { '1': 'good', '2': 'peak', ... } } OR { '1': 'good' }
  const months = (obj.months ?? obj) as Record<string, unknown>;
  if (!months || typeof months !== 'object') return null;
  const out: Array<string | null> = new Array(12).fill(null);
  for (let i = 0; i < 12; i++) {
    const v = months[String(i + 1)] ?? months[String(i)];
    if (typeof v === 'string') out[i] = v;
  }
  if (out.every((v) => v === null)) return null;
  return out;
}

function ratingClass(rating: string | null): string {
  switch (rating) {
    case 'peak':
      return 'bg-emerald-500 text-emerald-50';
    case 'excellent':
      return 'bg-emerald-500/30 text-emerald-200';
    case 'good':
      return 'bg-emerald-500/15 text-emerald-300';
    case 'fair':
      return 'bg-amber-500/15 text-amber-300';
    case 'poor':
      return 'bg-rc-bg-light text-rc-text-muted';
    case 'closed':
      return 'bg-red-500/15 text-red-300';
    default:
      return 'bg-rc-bg-darkest text-rc-text-muted';
  }
}
