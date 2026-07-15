import type { Metadata } from "next";
import CatchesShell from "./catches-shell";

export const metadata: Metadata = {
  title: "My catches · ReelCaster",
  description: "Your private catch log — every catch with conditions at catch time.",
  robots: { index: false },
};

export default function CatchesPage() {
  return <CatchesShell />;
}
