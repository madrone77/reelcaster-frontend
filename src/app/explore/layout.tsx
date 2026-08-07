import { Inter, IBM_Plex_Mono } from "next/font/google";

// The Explore page is the first consumer of the light rc-* design system
// (see src/styles/rc-tokens.css). Inter + IBM Plex Mono load only on this
// route; hoist to the root layout when the rest of the app migrates.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
});

// Opt the viewport into the safe-area insets so the mobile document-flow
// footer (`pb-safe`) clears the iOS home indicator / notch.
export const viewport = { viewportFit: "cover" as const };

export default function ExploreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Theme, fonts and page background only — deliberately NOT a viewport lock.
    // This layout is shared by two surfaces that scroll in opposite ways:
    // Explore is a full-bleed map pinned to the viewport, while the spot page
    // is a long document. It used to carry `lg:h-dvh lg:overflow-hidden` for
    // Explore's benefit, which was harmless only while the spot page ran its
    // own nested `h-dvh overflow-y-auto` scroller. Once that root became
    // `min-h-dvh` and handed scrolling back to the document, this box clipped
    // everything past the first viewport with no scrollbar to recover it.
    // The lock now lives on ExploreShell, the surface that actually wants it.
    <div
      data-theme="rc-light"
      className={`${inter.variable} ${plexMono.variable} min-h-dvh bg-rc-page text-rc-ink font-rc-sans`}
    >
      {children}
    </div>
  );
}
