import type { Metadata } from "next";
import LogCatchShell from "./log-catch-shell";

export const metadata: Metadata = {
  title: "Log a catch",
  description:
    "Drop a fishing photo. We read EXIF and run vision to pull species, size, location and time, then attach the conditions snapshot.",
};

export default function LogCatchPage() {
  return <LogCatchShell />;
}
