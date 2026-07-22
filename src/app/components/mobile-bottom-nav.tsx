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

// App chrome only — hidden on the marketing site, auth, and the coming-soon
// wall, where a product tab bar would be out of place.
const HIDE_PREFIXES = ["/pricing", "/about", "/login", "/signup", "/coming-soon"];

/**
 * Mobile bottom tab bar (Zillow-style) — fixed to the bottom edge on phones and
 * tablets, hidden on desktop (the rail + top bar own that layout). Four tabs:
 * Explore, Catches, Favorites, Account. Active tab reads brand; the rest are
 * muted. Renders a matching-height spacer in flow so page content can scroll
 * clear of the fixed bar.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();

  // Home ("/") is the marketing landing — no tab bar there either.
  const hidden =
    pathname === "/" || HIDE_PREFIXES.some((p) => pathname.startsWith(p));
  if (hidden) return null;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Keeps scrollable content from ending under the fixed bar. */}
      <div className="lg:hidden h-[calc(3.5rem+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Primary"
        className="lg:hidden fixed inset-x-0 bottom-0 z-50 bg-rc-panel/95 backdrop-blur-md border-t border-rc-rule pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 h-14">
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
