import Link from 'next/link';

const LEGAL_LINKS: Array<{ href: string; label: string }> = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/login', label: 'Sign In' },
];

export default function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer data-testid="marketing-footer" className="border-t border-rc-rule bg-rc-surface mt-16">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <h4 className="rc-label text-[10px] mb-3">Forecasts</h4>
          <ul className="space-y-2 text-rc-ink-soft">
            <li><Link href="/fishing" className="hover:text-rc-ink">All regions</Link></li>
            <li><Link href="/fishing/bc" className="hover:text-rc-ink">British Columbia</Link></li>
            <li><Link href="/explore" className="hover:text-rc-ink">Explore the map</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="rc-label text-[10px] mb-3">Species &amp; Regs</h4>
          <ul className="space-y-2 text-rc-ink-soft">
            <li><Link href="/species" className="hover:text-rc-ink">Species library</Link></li>
            <li><Link href="/regulations" className="hover:text-rc-ink">DFO notices</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="rc-label text-[10px] mb-3">Account</h4>
          <ul className="space-y-2 text-rc-ink-soft">
            <li><Link href="/signup" className="hover:text-rc-ink">Start free</Link></li>
            <li><Link href="/login" className="hover:text-rc-ink">Sign in</Link></li>
            <li><Link href="/pricing" className="hover:text-rc-ink">Pro pricing</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-rc-ink mb-3">ReelCaster</h4>
          <p className="text-rc-ink-mute text-xs leading-relaxed">
            Fishing intelligence for British Columbia and the Pacific
            Northwest. Forecasts are reference only — always verify
            regulations with DFO.
          </p>
        </div>
      </div>
      <div className="border-t border-rc-rule">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ul data-testid="marketing-footer-legal" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-rc-ink-mute">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-rc-ink transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-rc-ink-mute">© {year} ReelCaster · BC fishing forecasts</p>
        </div>
      </div>
    </footer>
  );
}
