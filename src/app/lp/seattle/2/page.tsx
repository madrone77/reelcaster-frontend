import type { Metadata } from "next";
import BlendPage, { blendMetadata } from "@/app/lp/_blend/blend-page";
import { SEATTLE } from "@/app/lp/_blend/blend-city";

/**
 * `/lp/seattle/2`, /lp/seattle/1's animated hero over /lp/7's live city
 * instrument, asking for nothing but a click.
 *
 * The ask is a link into Explore. No email and no card: the free tier already
 * answers the question the ad asked, and this page has just spent nine screens
 * proving the data behind that answer is real. See ../_blend/blend-page.tsx
 * for what the blend takes from each parent, and /lp/seattle/3 for the same
 * page with a card-required trial in place of the link.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Nothing in this route reads searchParams, so it prerenders and this is a
// real ISR window rather than a per-request render. See blendMetadata for the
// trap that costs you both.
export const revalidate = 900;

export function generateMetadata(): Promise<Metadata> {
  return blendMetadata(SEATTLE);
}

export default function LpSeattle2() {
  return <BlendPage city={SEATTLE} ask="explore" landing="lpseattle2" />;
}
