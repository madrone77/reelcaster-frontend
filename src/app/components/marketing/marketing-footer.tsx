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
    <footer data-testid="marketing-footer" className="bg-rc-ink">
      <div className="max-w-6xl mx-auto flex flex-col gap-4 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <ul
          data-testid="marketing-footer-legal"
          className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/50"
        >
          {LEGAL_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition-colors hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm text-white/50 md:text-right">
          © {year} Reelcaster · Made for the BC coast
        </p>
      </div>
    </footer>
  );
}
