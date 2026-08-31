/**
 * Share cards — the frozen fishing-day snapshot behind /s/<token>.
 *
 * This half is pure: types, palette, and every string that appears on a card,
 * in its unfurl, or in the message someone actually sends. No Supabase, no
 * fetches, so a client modal and the Satori image route can both import it.
 * The database and BlueCaster half lives in `share-cards-server.ts`.
 *
 * Everything here is written once, at mint time, and never re-derived. A card
 * is immutable by design (see the migration for why), so a later change to how
 * we format feet or phrase a headline must not reach back and rewrite a card
 * somebody already sent.
 */

export type ShareTier = "good" | "fair" | "poor";

export interface ShareCard {
  token: string;
  createdAt: string;
  /** First name for "Dave shared this with you". Null for ~1 account in 4. */
  sharerName: string | null;
  source: "alert" | "spot";
  spotSlug: string;
  spotName: string;
  speciesName: string | null;
  /** The fishing day, YYYY-MM-DD, in the spot's own timezone. */
  targetDate: string;
  tz: string;
  /** Local hours bounding the best window, 0–23. */
  windowStartHour: number | null;
  windowEndHour: number | null;
  score: number;
  tier: ShareTier;
  tide: string | null;
  wind: string | null;
  current: string | null;
  /** 14 daily peak scores. Nulls are unscored days. */
  series: (number | null)[];
  seriesDayIndex: number;
}

// ── Palette ────────────────────────────────────────────────────────────
//
// Literal hex, mirroring src/styles/rc-tokens.css. Satori cannot resolve a CSS
// custom property, which is the same reason TIER_PIN in explore-data.ts exists
// for map pucks. Keep the three tier fills in step with that export and with
// --rc-good / --rc-fair / --rc-poor.

export const CARD_INK = "#12151A";
export const CARD_INK_SOFT = "#5A616B";
export const CARD_INK_MUTE = "#8A919C";
export const CARD_PAPER = "#F5F6F7";
export const CARD_RULE = "#E2E5E9";
/** Unhighlighted forecast bars. */
export const CARD_BAR = "#C8CDD4";
export const CARD_BRAND = "#2536D9";

export const CARD_TIER: Record<
  ShareTier,
  { fill: string; pillBg: string; pillInk: string; word: string }
> = {
  good: { fill: "#3D8B4F", pillBg: "#DCFCE7", pillInk: "#1B6B41", word: "good" },
  fair: { fill: "#C97A1C", pillBg: "#FEF3C7", pillInk: "#92400E", word: "fair" },
  poor: { fill: "#B23A2F", pillBg: "#FEE2E2", pillInk: "#991B1B", word: "poor" },
};

/**
 * Headline copy, split so the tier word can be painted its tier colour while
 * the rest stays ink.
 *
 * ⚠️ The fair and poor lines are placeholders pending Casey's wording. They are
 * honest, which is the requirement (colour follows the real tier and sharing is
 * open on any day), but "a fair day" is a weak thing to send someone and this
 * is the sentence that decides whether a share happens at all.
 *
 * Budget: about 28 characters at the card's 78px head size. Longer copy still
 * renders — `headSizeFor` steps the size down — but it stops being the loudest
 * thing in a chat bubble, which is the whole job.
 */
export const TIER_HEADLINE: Record<
  ShareTier,
  { lead: string; word: string; tail: string }
> = {
  good: { lead: "A ", word: "good", tail: " fishing day is coming" },
  fair: { lead: "A ", word: "fair", tail: " day, worth a look" },
  poor: { lead: "A ", word: "poor", tail: " day. Try another." },
};

export function headlineText(tier: ShareTier): string {
  const h = TIER_HEADLINE[tier];
  return `${h.lead}${h.word}${h.tail}`;
}

/**
 * Head size for the card's one-line headline.
 *
 * The line is `white-space: nowrap` because a wrapped headline pushes the graph
 * off the bottom of a fixed 630px canvas. Satori does not shrink to fit, it
 * overflows silently, so the ramp is the only thing standing between longer
 * copy and a card with half a word hanging off the edge.
 */
export function headSizeFor(text: string): number {
  if (text.length > 40) return 56;
  if (text.length > 34) return 66;
  if (text.length > 29) return 72;
  return 78;
}

/**
 * Size ramp for the spot line under the graph, which is also nowrap and lives
 * in a column narrowed to ~596px by the instrument rail.
 */
export function spotLineSizeFor(text: string): number {
  if (text.length > 34) return 34;
  if (text.length > 26) return 40;
  if (text.length > 20) return 44;
  return 50;
}

/**
 * Card-length species label: "Chinook Salmon" -> "Chinook".
 *
 * Only the trailing "Salmon" comes off, matching the rule the spot page's own
 * card uses. "Dungeness Crab" keeps its noun, because a card is read cold by
 * someone who would not recognise "Dungeness" on its own.
 */
export function cardSpeciesName(name: string): string {
  return name.replace(/\s+Salmon$/i, "");
}

/**
 * Drop a parenthetical qualifier, e.g. "Colburne Passage (Moresby Island)".
 * Used only when the full name blows a budget, so precise names keep their
 * qualifier and only the overlong ones get trimmed.
 */
export function stripQualifier(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

// ── Dates and times ────────────────────────────────────────────────────

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

/**
 * Parse YYYY-MM-DD as a calendar date, not an instant.
 *
 * `new Date("2026-09-06")` is UTC midnight, so formatting it anywhere west of
 * Greenwich prints the 5th. A share card names one fishing day and gets read in
 * unknown timezones, so the date is built from its parts and formatted in UTC.
 */
function utcDate(targetDate: string): Date {
  const [y, m, d] = targetDate.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/** "Saturday, Sep 6" — never a relative word. A frozen card outlives "tomorrow". */
export function dayLabel(targetDate: string): string {
  const dt = utcDate(targetDate);
  return `${DAYS[dt.getUTCDay()]}, ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
}

/** "Saturday morning" for prose. Falls back to the bare day with no window. */
export function dayPhrase(
  targetDate: string,
  startHour: number | null,
): string {
  const day = DAYS[utcDate(targetDate).getUTCDay()];
  if (startHour === null) return day;
  if (startHour < 12) return `${day} morning`;
  if (startHour < 17) return `${day} afternoon`;
  return `${day} evening`;
}

function hour12(hour: number): { n: number; suffix: "AM" | "PM" } {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  return { n: h % 12 === 0 ? 12 : h % 12, suffix: h < 12 ? "AM" : "PM" };
}

/**
 * "6 to 10 AM", or "10 AM to 2 PM" when the window straddles noon.
 *
 * 12-hour throughout, per src/lib/time-format.ts — every clock time an angler
 * reads is written the way they would say it. The suffix collapses when both
 * ends share it, which is the common case for a dawn window.
 */
export function windowLabel(
  start: number | null,
  end: number | null,
): string | null {
  if (start === null) return null;
  const a = hour12(start);
  if (end === null || end === start) return `${a.n} ${a.suffix}`;
  const b = hour12(end);
  return a.suffix === b.suffix
    ? `${a.n} to ${b.n} ${b.suffix}`
    : `${a.n} ${a.suffix} to ${b.n} ${b.suffix}`;
}

// ── Unfurl copy ────────────────────────────────────────────────────────

/**
 * iMessage renders `og:title` and the domain, and no description at all, so
 * this line has to work as a complete sentence on its own. Facebook clips past
 * roughly 60 characters.
 */
const OG_TITLE_BUDGET = 60;

export function shareTitle(card: ShareCard): string {
  const phrase = dayPhrase(card.targetDate, card.windowStartHour);
  const verdict = CARD_TIER[card.tier].word;
  const full = `${card.spotName}, ${phrase} looks ${verdict}`;
  if (full.length <= OG_TITLE_BUDGET) return full;

  const short = `${stripQualifier(card.spotName)}, ${phrase} looks ${verdict}`;
  if (short.length <= OG_TITLE_BUDGET) return short;

  // Last resort: the day and the verdict matter more than the full name.
  return `${phrase} looks ${verdict} at ${stripQualifier(card.spotName)}`.slice(
    0,
    OG_TITLE_BUDGET,
  );
}

/** WhatsApp, Signal and Slack render this. iMessage does not. */
export function shareDescription(card: ShareCard): string {
  const bits: string[] = [];
  const win = windowLabel(card.windowStartHour, card.windowEndHour);
  if (win) bits.push(`Best window ${win}`);
  if (card.tide) bits.push(card.tide.toLowerCase());
  if (card.wind) bits.push(`wind ${card.wind}`);
  const lead = card.speciesName
    ? `${card.speciesName} at ${card.spotName}`
    : card.spotName;
  return `${lead} on ${dayLabel(card.targetDate)}. ${
    bits.length ? `${bits.join(", ")}. ` : ""
  }Scored hour by hour on tides, weather, water and regulations.`;
}

/**
 * The message that lands in the sharer's compose box.
 *
 * This matters more than the card. Most people will not write anything, and a
 * share sheet that opens onto an empty box is where a send quietly dies. They
 * can edit it or delete it; what they cannot do is be bothered to compose one.
 */
export function shareMessage(card: ShareCard): string {
  const phrase = dayPhrase(card.targetDate, card.windowStartHour);
  const species = card.speciesName
    ? `, ${card.speciesName.toLowerCase()}`
    : "";
  const win = windowLabel(card.windowStartHour, card.windowEndHour);
  const window = win ? `, ${win}` : "";

  if (card.tier === "good") {
    return `${card.spotName} looks good ${phrase}${species}${window}. Want to go?`;
  }
  if (card.tier === "fair") {
    return `${card.spotName} is only fair ${phrase}${species}. Here's the read.`;
  }
  return `${card.spotName} looks poor ${phrase}. Here's the read.`;
}

/** Absolute share URL for a token. */
export function shareUrl(siteOrigin: string, token: string): string {
  return `${siteOrigin.replace(/\/$/, "")}/s/${token}`;
}

// ── Staleness ──────────────────────────────────────────────────────────

/**
 * Has the card's fishing day already passed?
 *
 * Compared as calendar dates in the spot's timezone, not as instants: a card
 * for today is not stale at 11pm, and one for yesterday is stale at 1am.
 */
export function isPastDay(card: ShareCard, now: Date = new Date()): boolean {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: card.tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return card.targetDate < today;
}
