import type { Metadata } from "next";

// profile/page.tsx is a client component and cannot export metadata itself.
// See dashboard/layout.tsx for why robots.txt alone was not keeping this out
// of the index. Applies to the nested /profile/* settings pages too.
export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: true },
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
