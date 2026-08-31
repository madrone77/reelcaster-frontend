import type { Metadata } from "next";
import BlendPage, { blendMetadata } from "@/app/lp/_blend/blend-page";
import { VICTORIA } from "@/app/lp/_blend/blend-city";

/**
 * `/lp/victoria/2`: /lp/victoria/1's animated hero over /lp/7's live city
 * instrument, asking for nothing but a click.
 *
 * The ask is a link into Explore. No email and no card. See
 * ../../_blend/blend-page.tsx for what the blend takes from each parent, and
 * ../3 for the same page with a card-required trial in place of the link --
 * that pair is the experiment, and it is the only thing that differs.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Nothing in this route reads searchParams, so it prerenders and this is a
// real ISR window rather than a per-request render. See blendMetadata for the
// trap that costs you both.
export const revalidate = 900;

export function generateMetadata(): Promise<Metadata> {
  return blendMetadata(VICTORIA);
}

export default function LpVictoria2() {
  return <BlendPage city={VICTORIA} ask="explore" landing="lpvictoria2" />;
}
