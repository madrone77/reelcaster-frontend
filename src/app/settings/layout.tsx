import type { Metadata } from "next";

// Settings are per-user preference surfaces — keep them out of the index, the
// same way /profile is (a robots.txt entry alone wasn't enough there).
export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: true },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
