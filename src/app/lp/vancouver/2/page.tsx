import type { Metadata } from "next";
import BlendPage, { blendMetadata } from "@/app/lp/_blend/blend-page";
import { VANCOUVER } from "@/app/lp/_blend/blend-city";

/**
 * `/lp/vancouver/2` is the Vancouver twin of /lp/seattle/2: the reel hero
 * over the live city instrument, asking for nothing but a click into Explore.
 *
 * See @/app/lp/_blend/blend-page.tsx for what the blend takes from
 * /lp/seattle/1 and from /lp/7, and /lp/vancouver/3 for the other half of the
 * pair.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Nothing in this route reads searchParams, so it prerenders and this is a
// real ISR window rather than a per-request render. See blendMetadata for the
// trap that costs you both.
export const revalidate = 900;

export function generateMetadata(): Promise<Metadata> {
  return blendMetadata(VANCOUVER);
}

export default function LpVancouver2() {
  return <BlendPage city={VANCOUVER} ask="explore" landing="lpvancouver2" />;
}
