import type { Metadata } from "next";
import BlendPage, { blendMetadata } from "@/app/lp/_blend/blend-page";
import { NANAIMO } from "@/app/lp/_blend/blend-city";

/**
 * `/lp/nanaimo/3` is /lp/nanaimo/2 asking for an email and a card instead of
 * a click. The ask is the only difference, and it is the experiment.
 *
 * The checkout is priced from NANAIMO.billingRegion rather than from geo, so
 * this page cannot quote the wrong currency under DFO regulations.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Nothing in this route reads searchParams, so it prerenders and this is a
// real ISR window rather than a per-request render. See blendMetadata for the
// trap that costs you both.
export const revalidate = 900;

export function generateMetadata(): Promise<Metadata> {
  return blendMetadata(NANAIMO);
}

export default function LpNanaimo3() {
  return <BlendPage city={NANAIMO} ask="trial" landing="lpnanaimo3" />;
}
