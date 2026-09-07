/**
 * PREVIEW (claude/neon-score-object-preview): the four-band score palette,
 * cut at 85 / 75 / 55, held at one weight across the four. Read by the
 * Explore cards' 24-hour squares, the map pucks, the drawer's strip and the
 * spot page's score row. Everything else still reads the shipped three tiers
 * (explore-data.ts).
 */
export const BAND4 = {
  prime: "#0FA958", // deep vivid green
  good: "#3CCB74", // the reference check's green, one step lighter than prime
  fair: "#F2A93B", // warm amber, held at the same weight as the greens
  poor: "#E4574F", // vivid red, a touch softer so a run of poor hours is not a wall
  none: "#E2E5E9",
} as const;

export type Band4 = keyof typeof BAND4;

export function band4(score: number | null): Band4 {
  if (score === null) return "none";
  if (score >= 85) return "prime";
  if (score >= 75) return "good";
  if (score >= 55) return "fair";
  return "poor";
}

export const band4Fill = (score: number | null) => BAND4[band4(score)];
