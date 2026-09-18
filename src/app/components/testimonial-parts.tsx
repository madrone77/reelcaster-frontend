import { Star } from "lucide-react";

/**
 * The pieces every testimonial card shares: the angler byline (name, the
 * place under it) and the rating as five yellow stars with the score beside
 * them. Casey set the shape from two review-widget crops (2026-09-18) for
 * the row under the chart, then asked for the same in the paywall modals.
 * One module so the two surfaces cannot drift: a person wears the same
 * byline and the same stars everywhere their words appear. No hooks, no
 * client directive; both a server-rendered page and a client modal can
 * render these.
 *
 * Later on 2026-09-18 the Trustpilot green tiles went back to the yellow
 * stars the cards had before, the circle of initials came out, and the
 * byline moved under the quote ("lose the initials dot, and put the name
 * under the testimonial, leave the number 5.0 next to the stars").
 */
/** "Nick S., Tacoma WA" → name and place. */
export function splitAttr(attr: string) {
  const comma = attr.indexOf(",");
  const name = comma === -1 ? attr : attr.slice(0, comma).trim();
  const place = comma === -1 ? "" : attr.slice(comma + 1).trim();
  return { name, place };
}

export function Byline({ attr, className = "" }: { attr: string; className?: string }) {
  const { name, place } = splitAttr(attr);
  return (
    <div className={`min-w-0 ${className}`}>
      <span className="block truncate text-[14px] font-semibold text-rc-ink">{name}</span>
      {place && <span className="block truncate text-[12px] text-rc-ink-mute">{place}</span>}
    </div>
  );
}

/**
 * Five yellow stars, the score beside them. Filled to the rounded rating;
 * the rest outlined.
 */
export function TileStars({ rating, className = "" }: { rating: number; className?: string }) {
  const clamped = Math.max(0, Math.min(5, rating));
  const filled = Math.round(clamped);
  return (
    <div
      className={`flex items-center gap-1.5 ${className}`}
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < filled ? "fill-rc-badge text-rc-badge" : "fill-none text-rc-rule"}`}
            aria-hidden
          />
        ))}
      </div>
      <span className="text-[13px] font-semibold text-rc-ink">{clamped.toFixed(1)}</span>
    </div>
  );
}
