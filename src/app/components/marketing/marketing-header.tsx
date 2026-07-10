'use client';

import Link from 'next/link';
import { Fish, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

const NAV = [
  { href: '/species', label: 'Species' },
  { href: '/regulations', label: 'Regulations' },
  { href: '/pricing', label: 'Pricing' },
];

export default function MarketingHeader() {
  const { user, loading, signOut } = useAuth();

  return (
    <header
      data-testid="marketing-header"
      className="border-b border-rc-bg-light bg-rc-bg-darkest/95 backdrop-blur-sm sticky top-0 z-30"
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-rc-text">
          <span className="p-1.5 rounded-md bg-blue-600">
            <Fish className="w-4 h-4 text-white" />
          </span>
          <span className="font-bold tracking-tight">ReelCaster</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-rc-text-light">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-rc-text transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 min-h-[34px]">
          {loading ? null : user ? (
            <>
              <Link
                href="/explore"
                className="hidden sm:inline-flex text-sm font-medium text-rc-text-light hover:text-rc-text px-3 py-1.5 transition-colors"
              >
                Explore
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rc-bg-light hover:bg-rc-bg-dark border border-rc-bg-light rounded-md text-sm font-semibold text-rc-text transition-colors"
                title={user.email ?? 'Sign out'}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex text-sm font-medium text-rc-text-light hover:text-rc-text px-3 py-1.5 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-semibold text-white transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav strip */}
      <nav className="md:hidden flex items-center gap-4 px-6 pb-2 -mt-1 text-xs font-medium text-rc-text-muted overflow-x-auto">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap hover:text-rc-text"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
