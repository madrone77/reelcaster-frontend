'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

export default function MarketingHeader() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();

  // On the landing page the bar shares the hero's tint and drops its rule —
  // the two are one surface, so a divider would just draw a line through the
  // middle of it. Every other surface gets a white bar with a rule.
  const onLanding = pathname === '/';

  return (
    // Stripped to a pure conversion funnel: logo + a single Start-free CTA, no
    // nav links — the marketing chrome shouldn't offer exits from the pitch.
    // No backdrop-blur either way: an opaque bar has no backdrop to blur.
    <header
      data-testid="marketing-header"
      className={`sticky top-0 z-30 ${
        onLanding ? 'bg-rc-band' : 'bg-rc-panel border-b border-rc-rule'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
        <Link href="/" className="shrink-0 flex items-center" aria-label="ReelCaster home">
          <Image src="/reelcaster-mark.svg" alt="ReelCaster" width={104} height={48} priority />
        </Link>

        <div className="flex items-center gap-2 min-h-[36px] ml-auto">
          {loading ? null : user ? (
            <>
              {/* Signed-in affordance (initials → /profile). */}
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
                className="inline-flex min-h-11 items-center rounded bg-rc-brand px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-rc-brand-hover"
              >
                Start free trial
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
