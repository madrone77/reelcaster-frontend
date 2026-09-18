/**
 * The pieces every testimonial card shares: the angler byline (a circle of
 * initials beside the name, the place under it) and the rating as
 * Trustpilot-style green tiles with the score beside them. Casey set the
 * shape from two review-widget crops (2026-09-18) for the row under the
 * chart, then asked for the same in the paywall modals. One module so the
 * two surfaces cannot drift: a person wears the same circle and the same
 * stars everywhere their words appear. No hooks, no client directive; both
 * a server-rendered page and a client modal can render these.
 */
/** "Nick S., Tacoma WA" → name and place; initials from the name's words. */
export function splitAttr(attr: string) {
  const comma = attr.indexOf(",");
  const name = comma === -1 ? attr : attr.slice(0, comma).trim();
  const place = comma === -1 ? "" : attr.slice(comma + 1).trim();
  const initials = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, "")[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { name, place, initials };
}

/**
 * Circle colours by name, not by position, so the same angler wears the
 * same circle wherever the cards appear. One light and two solid, like the
 * widget Casey clipped.
 */
const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-teal-600 text-white",
  "bg-amber-100 text-amber-800",
  "bg-sky-600 text-white",
] as const;

export function Byline({ attr }: { attr: string }) {
  const { name, place, initials } = splitAttr(attr);
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${tone}`}
      >
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold text-rc-ink">{name}</span>
        {place && <span className="block truncate text-[12px] text-rc-ink-mute">{place}</span>}
      </span>
    </div>
  );
}

/**
 * Trustpilot-style rating: five green tiles, a white star on each, the
 * score beside them. A fractional rating part-fills its tile from the
 * left, the way that widget shows a 4.4.
 */
export function TileStars({ rating, className = "" }: { rating: number; className?: string }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <div
      className={`flex items-center gap-1.5 ${className}`}
      aria-label={`${clamped.toFixed(1)} out of 5 stars`}
    >
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => {
          const fill = Math.max(0, Math.min(1, clamped - i));
          return (
            <span key={i} className="relative block h-5 w-5 overflow-hidden bg-rc-rule">
              <span
                className="absolute inset-y-0 left-0 bg-[#00b67a]"
                style={{ width: `${fill * 100}%` }}
              />
              <svg viewBox="0 0 24 24" className="relative h-5 w-5 fill-white p-[3px]" aria-hidden>
                <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
              </svg>
            </span>
          );
        })}
      </div>
      <span className="text-[13px] font-semibold text-rc-ink">{clamped.toFixed(1)}</span>
    </div>
  );
}
