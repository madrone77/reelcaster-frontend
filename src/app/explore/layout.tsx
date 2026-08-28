import { Archivo, IBM_Plex_Mono } from "next/font/google";

// The Explore page is the first consumer of the light rc-* design system
// (see src/styles/rc-tokens.css). Archivo (design system v1.0) + IBM Plex Mono
// load here; it fills the `--font-inter` slot so the token binding is unchanged.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
});

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
      className={`${archivo.variable} ${plexMono.variable} min-h-dvh bg-rc-page text-rc-ink font-rc-sans`}
    >
      {children}
    </div>
  );
}
