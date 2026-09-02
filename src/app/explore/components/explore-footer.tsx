"use client";

import Link from "next/link";
import { useAdFrame } from "../lib/ad-frame";

/**
 * Small light-theme footer that closes the mobile (<lg) Explore document
 * flow. Desktop keeps its full-screen map + floating panels, so this only
 * renders on mobile. Not the legacy dark `marketing-footer` (wrong theme).
 *
 * On the ad frame it keeps the line and loses the link. "Plans" was the last
 * way off an ad-framed map — a page whose entire design is to have one button
 * on it — and it led to the pricing page, which sells the same thing the
 * trial modal in the bar is already selling, one click further from the buy.
 */
export default function ExploreFooter() {
  const adFrame = useAdFrame();
  return (
    <footer className="lg:hidden border-t border-rc-rule px-4 py-6 pb-safe">
      <div className="font-rc-mono text-[11px] text-rc-ink-mute space-y-1">
        <div>ReelCaster · BlueCaster v2.4</div>
        <div className="flex items-center gap-1.5">
          <span>© {new Date().getFullYear()}</span>
          {/* The separator goes with the link it separated. */}
          {!adFrame && (
            <>
              <span aria-hidden>·</span>
              <Link href="/plans" className="hover:text-rc-ink-soft transition-colors">
                Plans
              </Link>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
