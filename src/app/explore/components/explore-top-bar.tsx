"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { btn } from "@/app/components/ui/button";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";

const NAV: { href: string; label: string; signedInOnly?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", signedInOnly: true },
  { href: "/explore", label: "Explore" },
  { href: "/log-catch", label: "Log a catch" },
  { href: "/catches", label: "My catches" },
  { href: "/notifications", label: "Notifications" },
];

// The Port is Pro-only and lives beside the avatar rather than in NAV: this bar
// renders for signed-out visitors too, and a top-level link that greets most of
// them with a paywall is worse than no link. Signed-in members see it; the page
// itself handles the free-tier case.
const SUPPORT_HREF = "/support";

/**
 * Fixed 64px top bar. Deliberately mirrors MarketingHeader's styling (same
 * mark, height, nav type, and 4px control corners) so the chrome doesn't
 * change character when you cross from /about into the product — only the
 * links and the signed-in affordances differ. Stays `fixed` (not `sticky`)
 * because Explore owns its own scroll containers.
 */
export default function ExploreTopBar({
  variant = "brand",
  preview,
  containerClassName = PAGE_MEASURE,
}: {
  /** "brand" (the default) is a blue bar with a white mark/links; "default"
   *  is the light bar, kept available for any surface that needs it. */
  variant?: "default" | "brand";
  /** Force the signed-in affordance for a static preview (dashboard mock). */
  preview?: boolean;
  /** Measure for the bar's inner row. The rule and background stay full-bleed
   *  either way; this only moves the mark and the right-hand controls. Defaults
   *  to the app gridline, so a new surface lands on it without having to know
   *  it exists. Explore passes BLEED_MEASURE — it's the one surface where a
   *  centred row would leave the mark floating over the middle of a map. */
  containerClassName?: string;
} = {}) {
  const { user, session, loading } = useAuth();
  const { isPaid, loading: tierLoading } = useSubscription();
  const pathname = usePathname();
  const brand = variant === "brand";
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : null;

  // Signed-in vs out — a preview forces the signed-in look for the mock.
  const signedIn = preview || !!user;
  const avatarLabel = preview ? "R" : initials;

  // Nothing until the tier is known: a button that appears and then vanishes
  // reads as "we thought you weren't paying", and a member who is paying
  // should never be sold to. The preview mock has no user, so it stays out
  // of this entirely.
  const showUpgrade = !!user && !tierLoading && !isPaid;

  // Active-alert count → "Notifications" badge.
  const [alertCount, setAlertCount] = useState<number | null>(null);
  useEffect(() => {
    if (!session?.access_token) {
      setAlertCount(null);
      return;
    }
    let cancelled = false;
    fetch("/api/alerts", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const n = (d.profiles ?? []).filter(
          (p: { is_active?: boolean }) => p.is_active,
        ).length;
        setAlertCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  // "/" would match every path under startsWith, so the home link compares
  // exactly and only the sub-path links use the prefix test.
  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    // White, like MarketingHeader everywhere off the landing page — the tint
    // only exists there to merge the bar into the hero band, and there's no
    // such band here. Opaque, so there's no backdrop to blur. Keeps its rule:
    // this bar floats over the map and needs the edge.
    <header
      className={`fixed top-0 inset-x-0 h-16 z-40 border-b ${
        brand ? "bg-rc-brand border-white/15" : "bg-rc-panel border-rc-rule"
      }`}
    >
      <div className={`h-full flex items-center gap-8 ${containerClassName}`}>
        <Link href="/" className="shrink-0 flex items-center" aria-label="ReelCaster home">
          <Image
            src={brand ? "/reelcaster-mark-white.svg" : "/reelcaster-mark.svg"}
            alt="ReelCaster"
            width={104}
            height={48}
            priority
          />
        </Link>

        <nav
          className={`hidden md:flex items-center gap-7 text-sm font-medium ${
            brand ? "text-white/70" : "text-rc-ink-soft"
          }`}
        >
          {NAV.filter((item) => !item.signedInOnly || user).map((item) => {
            const active = isActive(item.href);
            const showBadge =
              item.href === "/notifications" && !!alertCount && alertCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-1.5 transition-colors ${
                  active
                    ? brand
                      ? "text-white font-semibold"
                      : "text-rc-brand font-semibold"
                    : brand
                      ? "hover:text-white"
                      : "hover:text-rc-ink"
                }`}
              >
                {item.label}
                {showBadge && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                      brand ? "bg-white text-rc-brand" : "bg-rc-badge text-rc-ink"
                    }`}
                  >
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {loading && !preview ? null : signedIn && avatarLabel ? (
            <>
              {/* Signing in used to remove the only standing way to buy: the
                  bar swapped the trial CTA for the avatar, leaving a free
                  account with nothing but the walls it happened to hit. Same
                  modal as every other entry point, so the pitch a member sees
                  is the pitch a visitor sees. */}
              {showUpgrade && (
                <TrialModalButton
                  from="explore-topbar-free"
                  data-testid="topbar-upgrade"
                  className={`px-3 py-1.5 rounded text-sm font-semibold transition-colors ${
                    brand
                      ? "bg-white text-rc-brand hover:bg-white/90"
                      : "bg-rc-brand hover:bg-rc-brand-hover text-white"
                  }`}
                >
                  {/* Room for the full label once there's a bar to put it in. */}
                  <span className="sm:hidden">Upgrade</span>
                  <span className="hidden sm:inline">Upgrade to Pro</span>
                </TrialModalButton>
              )}
              <Link
                href={SUPPORT_HREF}
                aria-label="Support"
                aria-current={isActive(SUPPORT_HREF) ? "page" : undefined}
                title="Support: The Port"
                className={`hidden sm:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 transition-colors ${
                  brand
                    ? "text-white/80 hover:text-white"
                    : isActive(SUPPORT_HREF)
                      ? "text-rc-brand font-semibold"
                      : "text-rc-ink-soft hover:text-rc-ink"
                }`}
              >
                <LifeBuoy className="w-4 h-4" aria-hidden />
                Support
              </Link>
              <Link
                href="/profile"
                aria-label="Profile"
                className={`flex items-center justify-center w-8 h-8 rounded-full font-rc-mono font-bold text-[11px] ${
                  brand ? "bg-white text-rc-brand" : "bg-rc-ink text-white"
                }`}
              >
                {avatarLabel}
              </Link>
            </>
          ) : (
            // Same signed-out pairing as MarketingHeader (About, the
            // homepage, etc.) — "Sign in" text link + a filled sign-up CTA —
            // so the auth affordance doesn't change shape crossing from the
            // marketing site into the product.
            <>
              <Link
                href="/login"
                className={`hidden sm:inline-flex text-sm font-semibold uppercase tracking-wide px-3 py-1.5 transition-colors ${
                  brand ? "text-white/80 hover:text-white" : "text-rc-ink-soft hover:text-rc-ink"
                }`}
              >
                Sign in
              </Link>
              {/* Same trial modal as every other CTA in the product, styled
                  with the canonical btn — btn.nav on light, inverted to
                  btn.navOnBrand on the blue bar. */}
              <TrialModalButton
                from="explore-topbar"
                className={brand ? btn.navOnBrand : btn.nav}
              >
                Start free trial
              </TrialModalButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
