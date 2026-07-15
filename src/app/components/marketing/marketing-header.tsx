'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';

const NAV = [
  { href: '/about', label: 'About' },
  { href: '/explore', label: 'Explore' },
  { href: '/fishing', label: 'Forecast' },
  { href: '/log-catch', label: 'Catch Log' },
  { href: '/pricing', label: 'Pricing' },
];

export default function MarketingHeader() {
  const { user, loading, signOut } = useAuth();

  return (
    <header
      data-testid="marketing-header"
      className="border-b border-rc-rule bg-rc-panel/90 backdrop-blur-sm sticky top-0 z-30"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-8">
        <Link href="/" className="shrink-0 flex items-center" aria-label="ReelCaster home">
          <Image src="/reelcaster-mark.svg" alt="ReelCaster" width={104} height={48} priority />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-rc-ink-soft">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-rc-ink transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 min-h-[36px] ml-auto">
          {loading ? null : user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex text-sm font-medium text-rc-ink-soft hover:text-rc-ink px-3 py-1.5 transition-colors"
              >
                Dashboard
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
          <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-rc-ink">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
