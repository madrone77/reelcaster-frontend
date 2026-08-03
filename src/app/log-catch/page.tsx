import type { Metadata } from "next";
import LogCatchShell from "./log-catch-shell";

export const metadata: Metadata = {
  title: "Log a catch",
  description:
    "Drop a fishing photo. We read EXIF and run vision to pull species, size, location and time, then attach the conditions snapshot.",
  // Signed-in surface. See dashboard/layout.tsx — the Disallow in robots.txt
  // blocks crawling, not indexing, so the directive has to be on the page.
  robots: { index: false, follow: true },
};

export default function LogCatchPage() {
  return <LogCatchShell />;
}
