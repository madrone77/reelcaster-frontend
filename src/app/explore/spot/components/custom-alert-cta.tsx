"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

/**
 * Custom-alert CTA banner (per the mockup) — a brand-soft panel inviting the
 * angler to set a score threshold alert for this spot, plus a separate
 * "Got questions?" panel. The threshold mirrors the "good" tier cutoff (75).
 */
export default function CustomAlertCta({
  spotName,
  threshold = 75,
}: {
  spotName: string;
  threshold?: number;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
      <div className="rounded-2xl bg-rc-brand-soft p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-rc-brand flex items-center justify-center text-white">
          <Bell className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rc-label text-[9px] text-rc-brand">CUSTOM ALERT</div>
          <div className="text-lg font-bold text-rc-ink mt-0.5">
            Notify me when {spotName} scores {threshold}+
          </div>
          <div className="font-rc-mono text-[11px] text-rc-ink-soft mt-1">
            Email free · SMS available with Reelcaster Pro
          </div>
        </div>
        <Link
          href="/profile/custom-alerts"
          className="shrink-0 inline-flex items-center justify-center px-5 py-3 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-rc-mono text-sm font-semibold tracking-[0.04em] transition-colors"
        >
          Create alert →
        </Link>
      </div>

      <div className="rounded-2xl bg-rc-brand-soft p-5 flex items-center justify-center">
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-rc-mono text-sm font-semibold tracking-[0.04em] transition-colors"
        >
          Got questions?
        </Link>
      </div>
    </div>
  );
}
