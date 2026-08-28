import type { Metadata } from "next";
import BlendPage, { blendMetadata } from "../_blend/blend-page";

/**
 * `/lp/seattle/3`, the same blend as /lp/seattle/2, asking for a card.
 *
 * Identical page, identical data, identical reel. The only difference is the
 * ask: an email field that posts straight to Stripe, with the amount and the
 * charge date under the button, in place of the link into Explore. That is the
 * whole experiment, whether a page carrying this much real data has earned
 * the ask, or whether the ask is a wall in front of the demo.
 *
 * Holding everything else constant is the point. Anything changed here that is
 * not the ask makes the pair unreadable in the campaigns report.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

export const revalidate = 900;

export function generateMetadata(): Promise<Metadata> {
  return blendMetadata();
}

export default function LpSeattle3() {
  return <BlendPage ask="trial" landing="lpseattle3" />;
}
