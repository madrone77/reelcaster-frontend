import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";

// /lp/* — cold-traffic ad landing pages. noindex (paid traffic only, never a
// search result), on the light rc-* system. No marketing header/footer: these
// pages carry their own distraction-free chrome (a single logo + one CTA) so
// nothing competes with the free-trial conversion.
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
