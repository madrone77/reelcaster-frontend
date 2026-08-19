"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { btn } from "@/app/components/ui/button";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import { useAuth } from "@/contexts/auth-context";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";
import { fetchAlertProfiles } from "@/lib/alerts-client";

// "Catch log" is the single destination for catch logging. The wizard at
// /log-catch used to sit beside it as its own nav item, which made one feature
// look like two places; it is now reached from the "Log a catch" button on the
// log itself, and lights this item up while you're in it (`alsoActiveFor`).
const NAV: {
  href: string;
  label: string;
  signedInOnly?: boolean;
  alsoActiveFor?: string[];
}[] = [
  { href: "/dashboard", label: "Dashboard", signedInOnly: true },
  { href: "/explore", label: "Explore" },
  { href: "/catches", label: "Catch log", alsoActiveFor: ["/log-catch"] },
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
  hideOnScroll = false,
  upgradeCta = false,
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
  /** Phones and tablets only: roll the bar out of the way while the reader is
   *  heading down a long document, and bring it back the moment they scroll
   *  up. Desktop keeps it pinned. Off by default, and it must stay off on any
   *  surface that scrolls inside its own container rather than the document
   *  (Explore) — the window never scrolls there, so the bar would simply
   *  never move. */
  hideOnScroll?: boolean;
  /** Offer Pro to a signed-in viewer who does not have it. Off by default, so
   *  the bar stays what it is on every other surface; Explore turns it on
   *  because on a phone this bar now exists mainly to make that offer. It has
   *  no effect signed out, where the trial CTA already fills the same slot. */
  upgradeCta?: boolean;
} = {}) {
  const { user, session, loading } = useAuth();
  const pathname = usePathname();
  const brand = variant === "brand";
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : null;

  // Signed-in vs out — a preview forces the signed-in look for the mock.
  const signedIn = preview || !!user;
  const avatarLabel = preview ? "R" : initials;

  // Active-alert count → "Notifications" badge.
  const [alertCount, setAlertCount] = useState<number | null>(null);
  useEffect(() => {
    if (!session?.access_token) {
      setAlertCount(null);
      return;
    }
    let cancelled = false;
    // Shared read — the dashboard wants the same list on the same paint.
    fetchAlertProfiles(session.access_token)
      .then((profiles) => {
        if (cancelled) return;
        setAlertCount(profiles.filter((p) => p.is_active).length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  // Roll-away. Hides once the reader is past the bar's own height and still
  // heading down; any upward move brings it straight back, so the nav is one
  // flick away instead of a scroll to the top. The 4px deadband ignores the
  // jitter a rubber-band overscroll produces at either end of the document,
  // and the rAF gate keeps a fast flick to one state change per frame.
  const [rolledAway, setRolledAway] = useState(false);
  useEffect(() => {
    if (!hideOnScroll) return;
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const dy = y - lastY;
        if (Math.abs(dy) < 4) return;
        lastY = y;
        setRolledAway(dy > 0 && y > 64);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [hideOnScroll]);

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
      className={`fixed top-0 inset-x-0 h-16 z-40 border-b transition-transform duration-200 ${
        rolledAway ? "-translate-y-full lg:translate-y-0" : "translate-y-0"
      } ${brand ? "bg-rc-brand border-white/15" : "bg-rc-panel border-rc-rule"}`}
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
            const active =
              isActive(item.href) ||
              !!item.alsoActiveFor?.some((href) => isActive(href));
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
              {upgradeCta && (
                <TrialModalButton
                  from="explore-topbar-upgrade"
                  className={brand ? btn.navOnBrand : btn.nav}
                >
                  {/* 375px of bar, less a 104px mark and a 32px avatar, does
                      not hold the full label. It fits from 640 up. */}
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
