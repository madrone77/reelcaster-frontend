import type { Metadata } from "next";
import LogCatchShell from "./log-catch-shell";

export const metadata: Metadata = {
  title: "Log a catch | ReelCaster",
  description:
    "Drop a fishing photo — we read EXIF and run vision to pull species, size, location and time, then attach the conditions snapshot.",
};

export default function LogCatchPage() {
  return <LogCatchShell />;
}
