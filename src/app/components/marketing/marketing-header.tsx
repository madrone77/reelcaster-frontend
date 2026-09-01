'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { btn } from '@/app/components/ui/button';
import SearchTrigger from '@/app/components/search/search-trigger';
import TrialModalButton from '@/app/components/paywall/trial-modal-button';

interface MarketingHeaderProps {
  /**
   * "brand" is the blue bar with the white mark. Mirrors ExploreTopBar's
   * variant of the same name — same fill, same rule, same inverted controls —
   * so the bar doesn't change character crossing between the two.
   */
  variant?: 'default' | 'brand';
  /**
   * What the bar offers a signed-out visitor.
   *
   * - `full` (default): Sign in + the trial CTA, the marketing-site pairing.
   * - `cta`: the CTA alone, for surfaces already dedicated to one action.
   * - `none`: nothing. For /billing/success, where the visitor has just paid
   *   and every control the bar could offer is either a sale they already
   *   made or a door the claim flow is about to open for them.
   */
  signedOutActions?: 'full' | 'cta' | 'none';
  /**
   * Label for the trial CTA, when a surface can name the outcome better than
   * the default can.
   *
   * "Start free trial" is honest and generic; a city page arriving from a
   * fishing ad can say what the trial actually opens. Per-surface rather than
   * a global rename because this bar is also the homepage's, the licence
   * guides' and the province index's, and changing their button is a
   * marketing decision, not a side effect of restyling one page.
   *
   * The `from` attribution key is unchanged either way, so a relabelled
   * button still reports as the same entry point.
   */
  ctaLabel?: string;
}

export default function MarketingHeader({
  variant = 'default',
  signedOutActions = 'full',
  ctaLabel = 'Start free trial',
}: MarketingHeaderProps = {}) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();

  const brand = variant === 'brand';

  // On the landing page the bar shares the hero's tint and drops its rule —
  // the two are one surface, so a divider would just draw a line through the
  // middle of it. Every other surface gets a white bar with a rule. The brand
  // variant is its own surface and answers to neither.
  const onLanding = pathname === '/';

  return (
    // Stripped to a pure conversion funnel: logo + a single Start-free CTA, no
    // nav links — the marketing chrome shouldn't offer exits from the pitch.
    // No backdrop-blur either way: an opaque bar has no backdrop to blur.
    <header
      data-testid="marketing-header"
      className={`sticky top-0 z-30 ${
        brand
          ? 'bg-rc-brand border-b border-white/15'
          : onLanding
            ? 'bg-rc-band'
            : 'bg-rc-panel border-b border-rc-rule'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
        <Link href="/" className="shrink-0 flex items-center" aria-label="ReelCaster home">
          <Image
            src={brand ? '/reelcaster-mark-white.svg' : '/reelcaster-mark.svg'}
            alt="ReelCaster"
            width={104}
            height={48}
            priority
          />
        </Link>

        <div className="flex items-center gap-2 min-h-[36px] ml-auto">
          {/* The one nav-like control on this bar, and it earns the exception:
              the pitch is about water we cover, and a reader who wants to know
              whether we cover THEIRS has otherwise no way to ask. Signed in or
              out, because a member reading /about should not have to go back
              into the app to search.

              Not on `signedOutActions: 'none'` — that is /billing/success,
              where the visitor has just paid and the bar deliberately offers
              no control at all until the claim flow opens their account. */}
          {signedOutActions !== 'none' && <SearchTrigger brand={brand} />}

          {loading ? null : user ? (
            <>
              {/* Signed-in affordance (initials → /profile). */}
              <Link
                href="/profile"
                aria-label="Profile"
                className={`flex items-center justify-center w-8 h-8 rounded-full font-rc-mono font-bold text-[11px] ${
                  brand ? 'bg-white text-rc-brand' : 'bg-rc-ink text-white'
                }`}
              >
                {user.email ? user.email.slice(0, 2).toUpperCase() : '··'}
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className={`inline-flex items-center px-4 py-2 rounded border text-sm font-semibold transition-colors ${
                  brand
                    ? 'border-white/30 text-white hover:bg-white/10'
                    : 'border-rc-rule text-rc-ink hover:bg-rc-surface'
                }`}
              >
                Sign out
              </button>
            </>
          ) : signedOutActions === 'none' ? null : (
            <>
              {signedOutActions === 'full' && (
                <Link
                  href="/login"
                  className={`hidden sm:inline-flex text-sm font-semibold uppercase tracking-wide px-3 py-1.5 transition-colors ${
                    brand
                      ? 'text-white/80 hover:text-white'
                      : 'text-rc-ink-soft hover:text-rc-ink'
                  }`}
                >
                  Sign in
                </Link>
              )}
              {/* Opens the same trial modal as every other entry point —
                  plan matrix, cadence, pay-first checkout, and the free-tier
                  link at its foot. /plans is still there for anyone who wants
                  to read the sales page first; it just isn't where a CTA
                  labelled "start" dumps you. Inverted to a white button on the
                  blue bar, same as ExploreTopBar. */}
              <TrialModalButton
                from="marketing-header"
                className={brand ? btn.navOnBrand : btn.nav}
              >
                {ctaLabel}
              </TrialModalButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
