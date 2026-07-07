"use client";

import { usePro } from "./usePro";

type Tab = "explore" | "species" | "report" | "notifications";

interface TopBarProps {
  active: Tab;
  onSelect: (t: Tab) => void;
  notificationCount?: number;
}

const TABS: { id: Tab; label: string; soon?: boolean }[] = [
  { id: "explore", label: "Explore" },
  { id: "species", label: "Species ID", soon: true },
  { id: "report", label: "14-day report", soon: true },
  { id: "notifications", label: "Notifications", soon: true },
];

export function TopBar({ active, onSelect, notificationCount = 0 }: TopBarProps) {
  const { isPro } = usePro();

  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b border-rcc-line bg-rcc-surface px-4">
      {/* Left: wordmark + nav */}
      <div className="flex items-center gap-6">
        <span className="font-mono text-base font-extrabold tracking-tight text-rcc-brand">
          REEL<span className="text-rcc-ink">CASTER</span>
        </span>
        <nav className="flex items-center gap-1">
          {TABS.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                title={t.soon ? "Coming soon" : undefined}
                className={`relative rounded-md px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-rcc-brand/10 font-semibold text-rcc-brand"
                    : "text-rcc-muted hover:text-rcc-ink"
                }`}
              >
                {t.label}
                {t.id === "notifications" && notificationCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rcc-brand px-1 text-[10px] font-bold text-white">
                    {notificationCount}
                  </span>
                )}
                {t.soon && !isActive && (
                  <span className="ml-1 align-top text-[8px] uppercase tracking-wide text-rcc-faint">soon</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: search, plan, avatar */}
      <div className="flex items-center gap-3">
        <button
          aria-label="Search"
          className="grid h-8 w-8 place-items-center rounded-full text-rcc-muted hover:bg-slate-100 hover:text-rcc-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>

        {isPro ? (
          <span className="rounded-full bg-rcc-brand/10 px-3 py-1 text-xs font-semibold text-rcc-brand">
            Boat Pro
          </span>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-rcc-line py-1 pl-3 pr-1">
            <span className="flex items-center gap-1.5 text-xs text-rcc-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Free
            </span>
            <button className="rounded-full bg-rcc-brand px-2.5 py-1 text-xs font-semibold text-white hover:brightness-110">
              Upgrade →
            </button>
          </div>
        )}

        <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
          RB
        </div>
      </div>
    </header>
  );
}
