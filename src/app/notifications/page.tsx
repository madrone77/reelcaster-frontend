import type { Metadata } from "next";
import NotificationsShell from "./notifications-shell";

export const metadata: Metadata = {
  title: "Your alerts | ReelCaster",
  description: "Manage your fishing-condition alerts and see recent triggers.",
};

// Replaces the old mock notifications list with the real alert-management
// surface (light rc-* theme) backed by the existing /api/alerts engine.
export default function NotificationsPage() {
  return <NotificationsShell />;
}
