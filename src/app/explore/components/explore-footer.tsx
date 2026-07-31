import Link from "next/link";

/**
 * Small light-theme footer that closes the mobile (<lg) Explore document
 * flow. Desktop keeps its full-screen map + floating panels, so this only
 * renders on mobile. Not the legacy dark `marketing-footer` (wrong theme).
 */
export default function ExploreFooter() {
  return (
    <footer className="lg:hidden border-t border-rc-rule px-4 py-6 pb-safe">
      <div className="font-rc-mono text-[11px] text-rc-ink-mute space-y-1">
        <div>ReelCaster · BlueCaster v2.4</div>
        <div className="flex items-center gap-1.5">
          <span>© {new Date().getFullYear()}</span>
          <span aria-hidden>·</span>
          <Link href="/plans" className="hover:text-rc-ink-soft transition-colors">
            Plans
          </Link>
        </div>
      </div>
    </footer>
  );
}
