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
    <div
      data-theme="rc-light"
      className={`${inter.variable} ${plexMono.variable} min-h-dvh overflow-y-auto lg:h-dvh lg:overflow-hidden bg-rc-page text-rc-ink font-rc-sans`}
    >
      {children}
    </div>
  );
}
