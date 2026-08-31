import Link from 'next/link';
import TrialModalButton from '@/app/components/paywall/trial-modal-button';

const LEGAL_LINKS: Array<{ href: string; label: string }> = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/contact', label: 'Contact' },
  { href: '/support', label: 'Support' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/login', label: 'Sign In' },
];

export default function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer data-testid="marketing-footer" className="border-t border-rc-rule bg-rc-surface">
      {/* Only routes that still exist. Unlisted paths now return a real 404
          (the /coming-soon wall was retired), so a stale link here is a dead
          link. Locations lists the /fishing province directories; add a region
          here once it has lifecycle-published cities. Washington qualified when
          Seattle was promoted; Oregon still has none.
          "Support" points at /support, which paywalls non-Pro visitors. FAQ
          and Contact directly above it are the open routes.

          Tap targets: these links render at 15 to 17px, so the box comes from
          padding rather than the invisible ::after the dashboard rail links
          use. Those sit alone in a card; these are stacked flush, so an
          invisible box big enough to matter would overlap the neighbour, and a
          tap landing on the wrong link is worse than a small one. Padding
          separates them for real. Mobile only (md:py-0), since a mouse does not
          need it.

          `py-2` makes a 36px box, down from the 48px this shipped with. The
          footer read as too airy at 48: the links are 7 deep on a phone, so
          that padding alone was 336px of a 906px footer, and 28px of white
          between one link and the next is more than three times the 8px the
          same list uses on desktop. 36px keeps the whole box live (the links
          are adjacent with no gap, so there is no dead space between targets)
          and clears the WCAG 2.5.8 AA floor of 24px, while sitting under the
          44px AAA figure. That was a deliberate call, not an oversight. Do not
          go below `py-2` without revisiting it; the text line is 20px, so
          py-1.5 would leave a 32px box and a 12px optical gap.

          BLOCK ORDER IS A MOBILE LAYOUT CONSTRAINT, not an editorial one. Below
          md this is a 2-column grid, and a grid row track is as tall as its
          taller column, so pairing a 4-link block with a 2-link one leaves the
          short one padded out with dead space and drops the next header far
          below its neighbour's. Locations (4) and Company (4) are paired so
          that row is flush, which also keeps the last link row level and stops
          a void opening above the ReelCaster block. Product (3) and Account (2)
          take the ragged step, one link tall, at the bottom where nothing
          follows it in that column. Reordering these blocks or changing a
          link count reopens the gap, so re-pair by count if you do. */}
      <div className="max-w-6xl mx-auto px-6 py-8 md:py-12 grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-8 text-sm">
        <div>
          <h4 className="rc-label text-[10px] mb-3">Locations</h4>
          <ul className="md:space-y-2 text-rc-ink-soft">
            <li><Link href="/fishing/bc" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">British Columbia</Link></li>
            <li><Link href="/fishing/wa" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">Washington</Link></li>
            {/* Sitewide links so the guides aren't reachable only from search,
                an indexable page nothing links to reads as low value. They sit
                under Locations because each is region-specific. Note the
                spelling split: BC copy says "licence" (DFO), WA says "license"
                (WDFW), while both share the /fishing-licence/ route segment. */}
            <li><Link href="/fishing-licence/bc" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">BC fishing licence</Link></li>
            <li><Link href="/fishing-licence/wa" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">WA fishing license</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="rc-label text-[10px] mb-3">Company</h4>
          <ul className="md:space-y-2 text-rc-ink-soft">
            <li><Link href="/about" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">About</Link></li>
            <li><Link href="/faq" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">FAQ</Link></li>
            <li><Link href="/contact" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">Contact</Link></li>
            <li><Link href="/support" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">Support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="rc-label text-[10px] mb-3">Product</h4>
          <ul className="md:space-y-2 text-rc-ink-soft">
            <li><Link href="/explore" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">Explore the map</Link></li>
            <li><Link href="/catches" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">Catch log</Link></li>
            <li><Link href="/plans" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">Pro plans</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="rc-label text-[10px] mb-3">Account</h4>
          <ul className="md:space-y-2 text-rc-ink-soft">
            <li>
              <TrialModalButton from="marketing-footer" className="block py-2 md:py-0 hover:text-rc-ink">
                Start free
              </TrialModalButton>
            </li>
            <li><Link href="/login" prefetch={false} className="block py-2 md:py-0 hover:text-rc-ink">Sign in</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-rc-ink mb-3">ReelCaster</h4>
          <p className="text-rc-ink-mute text-xs leading-relaxed">
            Fishing intelligence for British Columbia and the Pacific
            Northwest. Forecasts are reference only. Always verify
            regulations with your regulator: DFO in BC, WDFW in Washington.
          </p>
        </div>
      </div>
      <div className="border-t border-rc-rule">
        <div className="max-w-6xl mx-auto px-6 py-4 md:py-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ul data-testid="marketing-footer-legal" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-rc-ink-mute">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                {/* prefetch={false}: Next prefetches every in-viewport Link, so
                    a footer of 14 links pulled 14 route payloads on a page the
                    reader has not finished loading yet — competing with the
                    content for bandwidth to speculate on a navigation that
                    mostly does not happen. Footers are not a hot path. */}
                <Link
                  href={l.href}
                  prefetch={false}
                  className="inline-block py-2 md:py-0 hover:text-rc-ink transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            {/* Plain <a>: /sitemap.xml is a route handler, not an app page, so
                <Link> would prefetch an RSC payload that doesn't exist. */}
            <li>
              <a href="/sitemap.xml" className="inline-block py-2 md:py-0 hover:text-rc-ink transition-colors">
                Sitemap
              </a>
            </li>
          </ul>
          <p className="text-xs text-rc-ink-mute">© {year} ReelCaster · BC fishing forecasts</p>
        </div>
      </div>
    </footer>
  );
}
