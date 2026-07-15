'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

const NAV = [
  { href: '/explore', label: 'Explore' },
  { href: '/catches', label: 'Catch Log' },
  { href: '/pricing', label: 'Pricing' },
];

function Logo() {
  return (
    <Link
      href="/"
      className="flex flex-col items-center border-2 border-rc-brand bg-rc-panel px-2.5 py-1 leading-none"
      aria-label="Reelcaster home"
    >
      <span className="border-b-2 border-rc-brand pb-0.5 text-lg font-black tracking-tight text-rc-brand">
        REEL
      </span>
      <span className="mt-0.5 font-rc-mono text-[7px] font-semibold tracking-[0.35em] text-rc-brand">
        CASTER
      </span>
    </Link>
  );
}

export default function MarketingHeader() {
  const { user, loading, signOut } = useAuth();

  return (
    <header
      data-testid="marketing-header"
      className="sticky top-0 z-30 border-b border-rc-rule bg-rc-panel/95 backdrop-blur-sm"
    >
      <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-6">
        <Logo />

        <div className="flex items-center gap-8">
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-rc-brand">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="transition-colors hover:text-rc-brand-hover"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex min-h-[34px] items-center gap-5">
            {loading ? null : user ? (
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 rounded-md border border-rc-rule px-3.5 py-1.5 text-sm font-semibold text-rc-ink-soft transition-colors hover:bg-rc-surface"
                title={user.email ?? 'Sign out'}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-bold text-rc-brand transition-colors hover:text-rc-brand-hover"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-bold text-rc-brand transition-colors hover:text-rc-brand-hover"
                >
                  Start free trial
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav strip */}
      <nav className="md:hidden -mt-1 flex items-center gap-5 overflow-x-auto px-6 pb-2.5 text-xs font-medium text-rc-brand">
        {NAV.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="whitespace-nowrap transition-colors hover:text-rc-brand-hover"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
