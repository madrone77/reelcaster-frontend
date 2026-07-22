"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Fish, Heart, User } from "lucide-react";

const TABS = [
  { href: "/explore", label: "Explore", Icon: Map },
  { href: "/catches", label: "Catches", Icon: Fish },
  { href: "/favorites", label: "Favorites", Icon: Heart },
  { href: "/profile", label: "Account", Icon: User },
] as const;

/**
 * Mobile bottom tab bar (Zillow-style, floating) — a rounded pill detached from
 * the screen edges, hovering above the content with a soft shadow, on phones
 * and tablets; hidden on desktop (the rail + top bar own that layout). Four
 * tabs: Explore, Catches, Favorites, Account. Active tab reads brand; the rest
 * are muted. Renders a matching-height spacer in flow so page content can
 * scroll clear of the floating bar. Shows on every page — marketing, auth, and
 * the coming-soon wall included.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Reserve scroll space so content clears the floating bar. */}
      <div className="lg:hidden h-[calc(5.5rem+env(safe-area-inset-bottom))]" />
      {/* Outer strip is click-through (pointer-events-none) so the transparent
          margins beside the pill don't swallow taps on the content behind. */}
      <nav
        aria-label="Primary"
        className="lg:hidden pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="pointer-events-auto mx-auto grid h-16 max-w-md grid-cols-4 rounded-2xl border border-rc-rule bg-rc-panel/95 shadow-[0_6px_24px_rgba(15,23,42,0.18)] backdrop-blur-md">
          {TABS.map(({ href, label, Icon }) => {
            const active = isActive(href);
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
                  fill={active && label === "Favorites" ? "currentColor" : "none"}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="text-[10px] font-medium tracking-[0.01em]">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
