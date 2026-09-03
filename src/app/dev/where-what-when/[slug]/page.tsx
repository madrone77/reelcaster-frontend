import { notFound } from 'next/navigation';
import { loadSpotHeroFeed } from '@/app/(marketing)/components/spot-hero-feed';
import WhereWhatWhenPhone from '@/app/lp/_city1/where-what-when-phone';

/**
 * `/dev/where-what-when/<spot-slug>?province=BC` -- the capture surface for
 * the WHERE / WHAT / WHEN picture. DEVELOPMENT ONLY: it 404s in production.
 *
 * scripts/capture-where-what-when.mjs opens this, waits for the mini map to
 * finish its tiles, and screenshots the `[data-wwv]` element with a
 * transparent background. The picture is the product's own components in the
 * product's own device frame, so the only thing this route adds is a page to
 * point a browser at.
 *
 * `province` picks the mark's clock (see timezoneFor); every covered region
 * is Pacific today, and the default is the Canadian one.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DevWhereWhatWhen({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === 'production') notFound();

  const { slug } = await params;
  const sp = await searchParams;
  const province = typeof sp.province === 'string' ? sp.province : 'BC';

  const feed = await loadSpotHeroFeed(slug, province);
  if (!feed) notFound();

  return (
    <main style={{ background: 'transparent', padding: 24 }}>
      <WhereWhatWhenPhone feed={feed} serverNowMs={Date.now()} />
    </main>
  );
}
