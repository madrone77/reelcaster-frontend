"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/species", label: "Species" },
  { href: "/fishing", label: "Fishing guide" },
  { href: "/regulations", label: "Regulations" },
  { href: "/log-catch", label: "Log a catch" },
  { href: "/notifications", label: "Notifications" },
];

/**
 * Fixed 56px white top bar per the Figma spec — replaces the marketing
 * header on this route. Re-homes the key internal links the header carried.
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

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="fixed top-0 inset-x-0 h-14 z-40 bg-rc-panel border-b border-rc-rule shadow-rc-bar">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <Link href="/" className="shrink-0 flex items-center" aria-label="ReelCaster home">
            <Image
              src="/reelcaster-logo.svg"
              alt="ReelCaster"
              width={82}
              height={37}
              priority
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {NAV.map((item) => {
              const active = isActive(item.href);
              const showBadge =
                item.href === "/notifications" && !!alertCount && alertCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-rc-brand-soft text-rc-brand font-semibold"
                      : "text-rc-ink-soft hover:bg-rc-surface hover:text-rc-ink"
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
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/pricing"
            className="hidden sm:flex items-center gap-2 pl-3 pr-3.5 py-1.5 rounded-full border border-rc-rule bg-rc-panel text-sm hover:border-rc-brand transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-rc-badge" />
            <span className="text-rc-ink-soft">Free</span>
            <span className="font-semibold text-rc-brand">Upgrade →</span>
          </Link>

          <Link
            href="/fishing"
            aria-label="Search spots"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-rc-rule text-rc-ink-soft hover:bg-rc-surface transition-colors"
          >
            <Search className="w-4 h-4" />
          </Link>

          {loading ? null : user && initials ? (
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex items-center justify-center w-8 h-8 rounded-full bg-rc-ink text-white font-rc-mono font-bold text-[11px]"
            >
              {initials}
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-md bg-rc-brand hover:bg-rc-brand-hover text-sm font-semibold text-white transition-colors"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
