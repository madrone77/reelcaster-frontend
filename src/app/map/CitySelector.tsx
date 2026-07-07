"use client";

interface CitySelectorProps {
  label: string;
  onOpenFilters?: () => void;
}

/** Standalone city pill (▼) + a faders button, floating above the rail. */
export function CitySelector({ label, onOpenFilters }: CitySelectorProps) {
  return (
    <div className="pointer-events-auto absolute left-3 top-[68px] z-10 flex w-[387px] items-center gap-2">
      <button className="flex min-w-0 flex-1 items-center gap-2 rounded-[4px] bg-white/80 px-3.5 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-rcc-line backdrop-blur-[2px] hover:ring-slate-300">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rcc-brand/10 text-rcc-brand">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </span>
        <span className="truncate text-[14px] font-bold text-rcc-ink">{label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-auto shrink-0 text-rcc-muted">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <button
        onClick={onOpenFilters}
        aria-label="Filters"
        className="grid h-12 w-12 place-items-center rounded-[4px] bg-white/80 text-rcc-muted shadow-[0_1px_4px_rgba(15,23,42,0.08)] ring-1 ring-rcc-line backdrop-blur-[2px] hover:text-rcc-ink"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="21" x2="14" y1="4" y2="4" />
          <line x1="10" x2="3" y1="4" y2="4" />
          <line x1="21" x2="12" y1="12" y2="12" />
          <line x1="8" x2="3" y1="12" y2="12" />
          <line x1="21" x2="16" y1="20" y2="20" />
          <line x1="12" x2="3" y1="20" y2="20" />
          <line x1="14" x2="14" y1="2" y2="6" />
          <line x1="8" x2="8" y1="10" y2="14" />
          <line x1="16" x2="16" y1="18" y2="22" />
        </svg>
      </button>
    </div>
  );
}
