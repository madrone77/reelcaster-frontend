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
    <footer
      data-testid="marketing-footer"
      className="border-t border-rc-bg-light bg-rc-bg-darkest mt-16"
    >
      <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <h4 className="font-semibold text-rc-text mb-3">Forecasts</h4>
          <ul className="space-y-2 text-rc-text-muted">
            <li><Link href="/explore" className="hover:text-rc-text">Explore map</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-rc-text mb-3">Species &amp; Regs</h4>
          <ul className="space-y-2 text-rc-text-muted">
            <li><Link href="/species" className="hover:text-rc-text">Species library</Link></li>
            <li><Link href="/regulations" className="hover:text-rc-text">DFO notices</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-rc-text mb-3">Account</h4>
          <ul className="space-y-2 text-rc-text-muted">
            <li><Link href="/signup" className="hover:text-rc-text">Sign up free</Link></li>
            <li><Link href="/login" className="hover:text-rc-text">Log in</Link></li>
            <li><Link href="/pricing" className="hover:text-rc-text">Pro pricing</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold text-rc-text mb-3">ReelCaster</h4>
          <p className="text-rc-text-muted text-xs leading-relaxed">
            Live fishing intelligence for British Columbia and the Pacific
            Northwest. Forecasts are reference only — always verify regulations
            with DFO.
          </p>
        </div>
      </div>
      <div className="border-t border-rc-bg-light">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ul
            data-testid="marketing-footer-legal"
            className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-rc-text-muted"
          >
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="hover:text-rc-text transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-rc-text-muted">
            © {year} ReelCaster · BC fishing forecasts
          </p>
        </div>
      </div>
    </footer>
  );
}
