"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Map, NotebookPen, MoreHorizontal, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Home is the dashboard (the angler's saved/favorite spots) and sits far left.
// Catch log owns the wizard at /log-catch too. It's one destination with a
// "Log a catch" button on it, so the tab stays lit while you're logging instead
// of leaving no tab active at all.
const TABS: {
  href: string;
  label: string;
  Icon: LucideIcon;
  alsoActiveFor?: string[];
}[] = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/explore", label: "Explore", Icon: Map },
  {
    href: "/catches",
    label: "Catch log",
    Icon: NotebookPen,
    alsoActiveFor: ["/log-catch"],
  },
];

// The "More" tab opens a sheet with the secondary destinations instead of
// linking somewhere directly.
// This sheet renders for signed-out visitors too, so The Port sits below the
// account links rather than at the top — it is the Pro support surface, and
// the page itself explains the paywall to anyone who arrives without Pro.
const MORE_LINKS = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/preferences", label: "Preferences" },
  { href: "/settings/units", label: "Units" },
  { href: "/alerts", label: "Alerts" },
  { href: "/support", label: "Support" },
  { href: "/plans", label: "Plans" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
] as const;

/**
 * Mobile bottom tab bar (Zillow-style, floating) — a rounded pill detached from
 * the screen edges, hovering above the content with a soft shadow, on phones
 * and tablets; hidden on desktop (the rail + top bar own that layout). Four
 * tabs: Home, Explore, Catch log, and More (which opens a sheet of secondary links).
 * Active tab reads brand; the rest are muted. Renders a matching-height spacer
 * in flow so page content can scroll clear of the floating bar. Shows on every
 * page — marketing, auth, and the coming-soon wall included.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Close the More sheet whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const moreActive =
    moreOpen || MORE_LINKS.some((l) => isActive(l.href));

  // The dashboard has its own top nav + footer — the floating pill is
  // redundant there and overlaps the footer, so drop it on that route.
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return null;
  }

  // Cold-traffic ad landing pages (/lp/*) are deliberately distraction-free —
  // one CTA, no app navigation competing with the free-trial conversion.
  if (pathname.startsWith("/lp/") || pathname === "/lp") {
    return null;
  }

  return (
    <>
      {/* Reserve scroll space so content clears the floating bar. */}
      <div className="lg:hidden h-[calc(5.5rem+env(safe-area-inset-bottom))]" />

      {/* More sheet + backdrop. */}
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-rc-ink/25"
          />
          <div className="lg:hidden fixed inset-x-0 z-50 px-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-rc-rule bg-rc-panel/95 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur-md">
              {MORE_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center justify-between border-b border-rc-rule px-4 py-3 text-sm transition-colors last:border-0 hover:bg-rc-surface ${
                    isActive(href)
                      ? "font-semibold text-rc-brand"
                      : "text-rc-ink"
                  }`}
                >
                  {label}
                  <ChevronRight className="h-4 w-4 text-rc-ink-mute" />
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Outer strip is click-through (pointer-events-none) so the transparent
          margins beside the pill don't swallow taps on the content behind. */}
      <nav
        aria-label="Primary"
        className="lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-auto mx-auto grid h-16 max-w-md grid-cols-4 rounded-2xl border border-rc-rule bg-rc-panel/95 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur-md">
          {TABS.map(({ href, label, Icon, alsoActiveFor }) => {
            const active =
              isActive(href) || !!alsoActiveFor?.some((h) => isActive(h));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? "text-rc-brand" : "text-rc-ink-mute hover:text-rc-ink"
                }`}
              >
                <Icon
                  className="w-5 h-5"
                  fill="none"
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="whitespace-nowrap text-[10px] font-medium tracking-[0.01em]">
                  {label}
                </span>
              </Link>
            );
          })}

          {/* More — opens the sheet rather than navigating. */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              moreActive ? "text-rc-brand" : "text-rc-ink-mute hover:text-rc-ink"
            }`}
          >
            <MoreHorizontal
              className="w-5 h-5"
              strokeWidth={moreActive ? 2.4 : 2}
            />
            <span className="text-[10px] font-medium tracking-[0.01em]">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
