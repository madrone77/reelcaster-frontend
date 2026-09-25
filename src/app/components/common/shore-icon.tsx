import { SHORE_BADGE } from "@/app/explore/lib/score-puck";

/**
 * The shore mark: the same sand disc and wave a shore pin wears on the map
 * (score-puck.ts), so the badge on a spot's panel reads as the pin you tapped.
 */
export default function ShoreIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="-7 -7 14 14" aria-hidden="true" className={`shrink-0 ${className}`}>
      <circle r={6.2} fill={SHORE_BADGE.fill} />
      <path
        d="M -3.6 0.2 Q -1.8 -2.2 0 0.2 Q 1.8 2.6 3.6 0.2"
        fill="none"
        stroke={SHORE_BADGE.wave}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}
