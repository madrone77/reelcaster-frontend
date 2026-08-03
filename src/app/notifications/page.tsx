import type { Metadata } from "next";
import NotificationsShell from "./notifications-shell";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Manage your fishing-condition alerts and see recent triggers.",
  // Signed-in surface. See dashboard/layout.tsx — the Disallow in robots.txt
  // blocks crawling, not indexing, so the directive has to be on the page.
  robots: { index: false, follow: true },
};

// Replaces the old mock notifications list with the real alert-management
// surface (light rc-* theme) backed by the existing /api/alerts engine.
export default function NotificationsPage() {
  return <NotificationsShell />;
}
