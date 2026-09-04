"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { btn } from "@/app/components/ui/button";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import { useAuth } from "@/contexts/auth-context";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";
import type { NagFeatureId } from "@/lib/plan-features";
import { fetchAlertProfiles } from "@/lib/alerts-client";
// Search lives here because this bar is the only chrome every signed-in
// surface mounts. It used to hang off AppShell, which no page has rendered
// since the app moved off that dark shell, so the palette — and the cmd-K that
// opens it — were unreachable in the running product.
import SearchTrigger from "@/app/components/search/search-trigger";

// "Catch log" is the single destination for catch logging. The wizard at
// /log-catch used to sit beside it as its own nav item, which made one feature
// look like two places; it is now reached from the "Log a catch" button on the
// log itself, and lights this item up while you're in it (`alsoActiveFor`).
//
// `trial` marks an item that only means something once you have an account.
// Signed out, it opens the trial modal instead of navigating — see the render
// below for why.
const NAV: {
  href: string;
  label: string;
  signedInOnly?: boolean;
  alsoActiveFor?: string[];
  trial?: { feature: NagFeatureId; from: string };
}[] = [
  { href: "/dashboard", label: "Dashboard", signedInOnly: true },
  { href: "/explore", label: "Explore" },
  {
    href: "/catches",
    label: "Catch log",
    alsoActiveFor: ["/log-catch"],
    trial: { feature: "catch-log", from: "explore-topbar-catches" },
  },
  {
    href: "/notifications",
    label: "Notifications",
    trial: { feature: "alerts", from: "explore-topbar-notifications" },
  },
];

// The Port is not in this bar at all. It is Pro-only, so a top-level link
// greets most visitors with a paywall, and it already has a home one tap away:
// the "Open The Port" card on /settings/account, which the avatar leads to.
// The mobile "More" sheet lists it for the same reason.

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
  placeName,
  adFrame = false,
  adBarEdge = "bottom",
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
  /**
   * The city the reader is looking at, when the surface knows one.
   *
   * Only Explore passes it, because only Explore has a camera pointed at a
   * city. It travels to the trial modal, where the phone sheet sets it in
   * brand blue behind the headline ("See the next 14 days in Seattle") and
   * names the catch-reports row after the same city. Every other surface that
   * mounts this bar leaves it unset and gets the plain headline, which is the
   * right answer for a page that cannot say what the reader was looking at.
   */
  placeName?: string;
  /**
   * Wear this bar on a page somebody paid to land on.
   *
   * The ad frame used to have no bar at all — every link in it is a way off a
   * page that cost money, and the offer rode in a pinned strip under the map
   * instead. That strip is gone (the offer is the modal now), so the bar comes
   * back carrying the two things the frame actually wants: the mark, and one
   * button.
   *
   * What `adFrame` removes is everything that is an exit. The nav, the search
   * trigger, "Sign in", and the avatar all go, and the mark stops being a link
   * — a logo that leads to the homepage is the most-pressed way out of a
   * landing page, and the homepage sells the same thing less specifically than
   * the page it would be leaving. What is left is a header with a logo and a
   * Start free trial button, which is the whole brief.
   *
   * Not a fourth `variant`: this is orthogonal to the bar's colour, and both
   * ad surfaces want the same blue bar the product already wears.
   */
  adFrame?: boolean;
  /**
   * Which edge of the screen the ad frame's bar sits on.
   *
   * "bottom" (the default) is the thumb-reach position the frame shipped
   * with, still worn by the ad spot page. "top" is Explore's (Casey's call,
   * 2026-09-04: never at the bottom there): the brand blue, the mark and the
   * Start free trial button sit where every other page keeps them.
   *
   * Only read under `adFrame`; the product bar is always at the top.
   */
  adBarEdge?: "top" | "bottom";
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

  // White, like MarketingHeader everywhere off the landing page — the tint
  // only exists there to merge the bar into the hero band, and there's no
  // such band here. Opaque, so there's no backdrop to blur. Keeps its rule:
  // this bar floats over the map and needs the edge.
  //
  // The ad frame's copy sits at the BOTTOM of the screen instead.
  //
  // It is the same bar with the same one button, moved to where a thumb
  // already is. On a phone the top-right corner is the furthest point on the
  // screen from a hand holding it, and this bar exists to be pressed; the top
  // edge is where you put chrome you want out of the way, which is the
  // opposite of what this is for. The rule flips with it (`border-t`, so the
  // edge still faces the content), it takes the device safe area as padding so
  // the button clears a home indicator, and it publishes `data-ad-bar` so
  // everything else pinned to the bottom of a phone moves up by its height —
  // see globals.css.
  //
  // It never rolls away. `hideOnScroll` is a trade for a long read whose nav
  // lives elsewhere; here the bar is the only ask on the page.
  //
  // Explore asks for the top edge (`adBarEdge="top"`): same bar, same one
  // button, pinned where the product's bar is. It publishes no `data-ad-bar`
  // there, so nothing below moves up to clear it.
  const atBottom = adFrame && adBarEdge === "bottom";
  return (
    <header
      data-ad-bar={atBottom ? "" : undefined}
      className={
        atBottom
          ? `fixed bottom-0 inset-x-0 z-50 border-t pb-[env(safe-area-inset-bottom,0px)] ${
              brand ? "bg-rc-brand border-white/15" : "bg-rc-panel border-rc-rule"
            }`
          : `fixed top-0 inset-x-0 h-16 z-40 border-b transition-transform duration-200 ${
              rolledAway ? "-translate-y-full lg:translate-y-0" : "translate-y-0"
            } ${brand ? "bg-rc-brand border-white/15" : "bg-rc-panel border-rc-rule"}`
      }
    >
      <div className={`h-16 flex items-center gap-8 ${containerClassName}`}>
        {/* The same mark either way; on the ad frame it is a picture rather
            than a door. See the `adFrame` prop for why. */}
        {adFrame ? (
          <span className="shrink-0 flex items-center">
            <Image
              src={brand ? "/reelcaster-mark-white.svg" : "/reelcaster-mark.svg"}
              alt="ReelCaster"
              width={104}
              height={48}
              priority
            />
          </span>
        ) : (
          <Link href="/" className="shrink-0 flex items-center" aria-label="ReelCaster home">
            <Image
              src={brand ? "/reelcaster-mark-white.svg" : "/reelcaster-mark.svg"}
              alt="ReelCaster"
              width={104}
              height={48}
              priority
            />
          </Link>
        )}

        {!adFrame && (
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
            const itemClass = `flex items-center gap-1.5 transition-colors ${
              active
                ? brand
                  ? "text-white font-semibold"
                  : "text-rc-brand font-semibold"
                : brand
                  ? "hover:text-white"
                  : "hover:text-rc-ink"
            }`;

            // Signed out, these two items used to hand a visitor a surface they
            // can't use: /notifications bounces straight to /login, and the
            // catch log is an empty page with a sign-in link on it. Make the
            // offer at the click instead — the same modal every other CTA in
            // the product opens, on the row that covers what they reached for.
            // Held until auth resolves (`loading`) so a returning member is
            // never shown the paywall on first paint; until then the item stays
            // an ordinary link.
            if (item.trial && !loading && !signedIn) {
              return (
                <TrialModalButton
                  key={item.href}
                  from={item.trial.from}
                  feature={item.trial.feature}
                  className={itemClass}
                >
                  {item.label}
                </TrialModalButton>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={itemClass}
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
        )}

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {/* Search is a way to somewhere else, which on a paid landing is the
              one thing this bar must not offer. */}
          {!adFrame && <SearchTrigger brand={brand} />}

          {/* The ad frame's right-hand side is one button and nothing else.
              Signed out — which cold ad traffic is by definition — that is the
              trial CTA below. Signed in it is the upgrade CTA, or nothing at
              all for someone who already pays; the avatar is a link to
              /profile, so it goes with the rest of the exits.

              Not held behind `loading`, unlike the product bar. The ask IS the
              page here, `useAuth` has been seen taking seconds, and a paid
              click that lands on a page with no visible offer is the whole ad
              wasted — the same trade the pinned bar used to make. */}
          {adFrame ? (
            signedIn ? (
              upgradeCta && (
                <TrialModalButton
                  from="explore-ad-topbar-upgrade"
                  placeName={placeName}
                  className={brand ? btn.navOnBrand : btn.nav}
                >
                  <span className="sm:hidden">Upgrade</span>
                  <span className="hidden sm:inline">Upgrade to Pro</span>
                </TrialModalButton>
              )
            ) : (
              <TrialModalButton
                from="explore-ad-topbar"
                placeName={placeName}
                className={brand ? btn.navOnBrand : btn.nav}
              >
                Start free trial
              </TrialModalButton>
            )
          ) : loading && !preview ? null : signedIn && avatarLabel ? (
            <>
              {upgradeCta && (
                <TrialModalButton
                  from="explore-topbar-upgrade"
                  placeName={placeName}
                  className={brand ? btn.navOnBrand : btn.nav}
                >
                  {/* 375px of bar, less a 104px mark and a 32px avatar, does
                      not hold the full label. It fits from 640 up. */}
                  <span className="sm:hidden">Upgrade</span>
                  <span className="hidden sm:inline">Upgrade to Pro</span>
                </TrialModalButton>
              )}
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
                placeName={placeName}
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
