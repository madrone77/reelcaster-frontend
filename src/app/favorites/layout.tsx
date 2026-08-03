import type { Metadata } from "next";

// favorites/page.tsx is a client component and cannot export metadata itself.
// See dashboard/layout.tsx for why robots.txt alone was not keeping this out
// of the index.
export const metadata: Metadata = {
  title: "Favourites",
  robots: { index: false, follow: true },
};

export default function FavoritesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
