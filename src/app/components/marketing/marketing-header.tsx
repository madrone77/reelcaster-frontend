'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

// Keep in step with the routes that actually exist — /fishing, /species and
// /regulations were removed, and anything not on the middleware allowlist
// silently rewrites to /coming-soon rather than 404ing, so dead links here
// look like real pages until you click them.
const NAV = [
  { href: '/about', label: 'About' },
  { href: '/explore', label: 'Explore' },
  { href: '/catches', label: 'Catch Log' },
  { href: '/pricing', label: 'Pricing' },
];

export default function MarketingHeader() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  // "/" would match every path under startsWith, so the home link compares
  // exactly and only the sub-path links use the prefix test.
  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);

  // On the landing page the bar shares the hero's tint and drops its rule —
  // the two are one surface, so a divider would just draw a line through the
  // middle of it. Every other surface gets a white bar with a rule, since
  // there's no matching band underneath for it to merge into.
  const onLanding = pathname === '/';

  return (
    // No backdrop-blur either way: an opaque bar has no backdrop to blur.
    <header
      data-testid="marketing-header"
      className={`sticky top-0 z-30 ${
        onLanding ? 'bg-rc-band' : 'bg-rc-panel border-b border-rc-rule'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
        <Link href="/" className="shrink-0 flex items-center" aria-label="ReelCaster home">
          <Image src="/reelcaster-mark.svg" alt="ReelCaster" width={104} height={48} priority />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-rc-ink-soft">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={`transition-colors ${
                isActive(item.href) ? 'text-rc-brand font-semibold' : 'hover:text-rc-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 min-h-[36px] ml-auto">
          {loading ? null : user ? (
            <>
              {/* Same signed-in affordance as ExploreTopBar (initials → /profile);
                  the old "Dashboard" link pointed at a route the middleware
                  rewrites to /coming-soon. */}
              <Link
                href="/profile"
                aria-label="Profile"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-rc-ink text-white font-rc-mono font-bold text-[11px]"
              >
                {user.email ? user.email.slice(0, 2).toUpperCase() : '··'}
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center px-4 py-2 rounded border border-rc-rule hover:bg-rc-surface text-sm font-semibold text-rc-ink transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex text-sm font-medium text-rc-ink-soft hover:text-rc-ink px-3 py-1.5 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center px-4 py-2 rounded bg-rc-brand hover:bg-rc-brand-hover text-sm font-semibold text-white transition-colors"
              >
                Start free trial
              </Link>
            </>
          )}
        </div>
      </div>

      <nav className="md:hidden flex items-center gap-4 px-6 pb-3 -mt-1 text-xs font-medium text-rc-ink-mute overflow-x-auto">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={`whitespace-nowrap ${
              isActive(item.href) ? 'text-rc-brand font-semibold' : 'hover:text-rc-ink'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
