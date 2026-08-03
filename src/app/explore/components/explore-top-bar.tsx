"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

const NAV: { href: string; label: string; signedInOnly?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", signedInOnly: true },
  { href: "/explore", label: "Explore" },
  { href: "/log-catch", label: "Log a catch" },
  { href: "/catches", label: "My catches" },
  { href: "/notifications", label: "Notifications" },
];

/**
 * Fixed 64px top bar. Deliberately mirrors MarketingHeader's styling (same
 * mark, height, nav type, and 4px control corners) so the chrome doesn't
 * change character when you cross from /about into the product — only the
 * links and the signed-in affordances differ. Stays `fixed` (not `sticky`)
 * because Explore owns its own scroll containers.
 */
export default function ExploreTopBar() {
  const { user, session, loading } = useAuth();
  const pathname = usePathname();

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : null;

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
    <header className="fixed top-0 inset-x-0 h-16 z-40 bg-rc-panel border-b border-rc-rule">
      <div className="h-full px-4 sm:px-6 flex items-center gap-8">
        <Link href="/" className="shrink-0 flex items-center" aria-label="ReelCaster home">
          <Image src="/reelcaster-mark.svg" alt="ReelCaster" width={104} height={48} priority />
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-rc-ink-soft">
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
                    ? "text-rc-brand font-semibold"
                    : "hover:text-rc-ink"
                }`}
              >
                {item.label}
                {showBadge && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rc-badge text-rc-ink text-[10px] font-bold">
                    {alertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          {loading ? null : user && initials ? (
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-rc-ink text-white font-rc-mono font-bold text-[11px]"
            >
              {initials}
            </Link>
          ) : (
            // Same signed-out pairing as MarketingHeader (About, the
            // homepage, etc.) — "Sign in" text link + a filled sign-up CTA —
            // so the auth affordance doesn't change shape crossing from the
            // marketing site into the product.
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex text-sm font-medium text-rc-ink-soft hover:text-rc-ink px-3 py-1.5 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded bg-rc-brand hover:bg-rc-brand-hover text-sm font-semibold text-white transition-colors"
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
