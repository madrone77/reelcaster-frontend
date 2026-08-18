// 12-hour clock formatting.
//
// Every clock time ReelCaster shows an angler reads the way they'd say it out
// loud — "2 PM", "6:42 AM" — never on a 24-hour clock. Machine-facing strings
// (ISO timestamps, `<input type="time">` values, API params, the internal
// `hour12: false` parses used to derive a zone's wall hour) stay 24-hour and
// must not route through here.

function split12(hour: number): { h: number; suffix: "AM" | "PM" } {
  const h24 = ((Math.trunc(hour) % 24) + 24) % 24;
  return { h: h24 % 12 === 0 ? 12 : h24 % 12, suffix: h24 < 12 ? "AM" : "PM" };
}

/** Split a fractional hour (20.62) into whole hour + minute, carrying :60. */
function splitFractional(t: number): { h: number; m: number } {
  let h = Math.floor(t);
  let m = Math.round((t - h) * 60);
  if (m === 60) {
    h++;
    m = 0;
  }
  return { h, m };
}

/** On-the-hour label: 14 → "2 PM". Hour 24 wraps to "12 AM". */
export function formatHour12(hour: number): string {
  const { h, suffix } = split12(hour);
  return `${h} ${suffix}`;
}

/** Hour + minute: (14, 5) → "2:05 PM". A zero minute collapses to "2 PM". */
export function formatTime12(hour: number, minute: number): string {
  const m = ((Math.round(minute) % 60) + 60) % 60;
  const { h, suffix } = split12(hour);
  return m === 0 ? `${h} ${suffix}` : `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Fractional hour → "8:37 PM". */
export function formatFractionalHour12(t: number): string {
  const { h, m } = splitFractional(t);
  return formatTime12(h, m);
}

/**
 * Tight form for chart axes and SVG annotations, where every character costs
 * pixels: 15 → "3p", 0 → "12a".
 */
export function formatHourCompact(hour: number): string {
  const { h, suffix } = split12(hour);
  return `${h}${suffix === "AM" ? "a" : "p"}`;
}

/** Tight form carrying minutes: 20.62 → "8:37p". */
export function formatFractionalHourCompact(t: number): string {
  const { h, m } = splitFractional(t);
  const { h: h12, suffix } = split12(h);
  const mer = suffix === "AM" ? "a" : "p";
  return m === 0 ? `${h12}${mer}` : `${h12}:${String(m).padStart(2, "0")}${mer}`;
}

/** `Intl.DateTimeFormat` options for a 12-hour clock time. */
export const TIME_12H_OPTIONS = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
} as const satisfies Intl.DateTimeFormatOptions;
