"use client";

import type { ComponentProps } from "react";
import CityInstrument from "@/app/fishing/[province]/[city]/instrument/city-instrument";
import { useBlendTarget } from "./blend-track";

/**
 * `CityInstrument`, told what to credit its presses to.
 *
 * A four-line client wrapper exists because the target has to be built by a
 * hook, the angle comes off `window.location.search`, for the ISR reason in
 * blend-track.tsx, and the page rendering it is a server component. Every
 * other prop passes straight through.
 *
 * Without this the instrument's two walls (a locked day, and the custom-spot
 * button) count nothing on a city-first path, because the path parser they
 * fall back to only speaks `/lp/<n>/<city>`. Those walls are where this half
 * of the page does its selling, so an uncounted one makes the whole variant
 * unreadable in the campaigns report.
 */
type Props = Omit<ComponentProps<typeof CityInstrument>, "campaign"> & {
  landing: string;
};

export default function BlendInstrument({ landing, ...rest }: Props) {
  // The slug the counter files under is the same one the instrument loads
  // from, so there is nothing to keep in step here.
  const campaign = useBlendTarget(landing, rest.citySlug);
  return <CityInstrument {...rest} campaign={campaign} />;
}
