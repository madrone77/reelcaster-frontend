import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";

// /lp/* — the addresses paid ads point at. noindex (paid traffic only, never
// a search result), on the light rc-* system. Two pages live here: the
// landing page ([...path], the framed city page with the trial sheet) and the
// quiz (q/). No marketing header or footer: each carries its own chrome.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="rc-light"
      className="min-h-dvh bg-rc-page text-rc-ink font-rc-sans antialiased"
    >
      {children}
    </div>
  );
}
