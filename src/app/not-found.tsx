import type { Metadata } from "next";
import Link from "next/link";

// Root 404. Without this file a `notFound()` from any page (a stale city slug,
// a renamed spot) fell through to the root layout with no body of its own —
// which, behind the auth spinner, rendered as a permanent "Loading..." at HTTP
// 200. That is a soft 404: the crawler is told the page is fine and shown
// nothing. This gives Next a body to pair with the real 404 status.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-rc-panel text-rc-ink flex items-center justify-center px-6 py-20">
      <div className="max-w-xl text-center">
        <p className="font-rc-mono text-[11px] tracking-[0.14em] uppercase text-rc-ink-mute">
          404
        </p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-[-0.02em]">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-4 text-rc-ink-soft leading-relaxed">
          The link may be out of date, or the spot may have been renamed. The
          map and the regional directory below both stay current.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/explore"
            className="px-5 py-2.5 rounded bg-rc-brand text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Open the map
          </Link>
          <Link
            href="/fishing/bc"
            className="px-5 py-2.5 rounded border border-rc-rule font-semibold text-sm hover:bg-rc-surface transition-colors"
          >
            Browse BC fishing spots
          </Link>
        </div>

        <p className="mt-8 text-sm text-rc-ink-soft">
          Or head back to the{" "}
          <Link href="/" className="text-rc-brand font-medium hover:underline">
            homepage
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
