"use client";

import { Bell } from "lucide-react";
import { tierFor, TIER_PILL, TIER_TEXT } from "../../lib/explore-data";
import { regHighlights } from "../../lib/reg-limits";
import type { LiveRegulation } from "@/lib/bluecaster/live-spot-types";
import type { Regulator } from "@/lib/regions";

/**
 * Consolidated headline score card: today's PEAK score for the driver species,
 * the live score as a secondary reading, the best contiguous window, and the
 * regulatory strip — all in one white panel so it reads as a single unit on
 * mobile and as the rail header on desktop.
 *
 * The peak leads, and the live hour sits under it. It used to be the other way
 * round, which meant the loudest thing on the page was whatever the score
 * happened to be at the moment someone opened it. Read at 9pm, a spot that
 * peaks at 89 at 7am opened on a red 33 and the word POOR: true, useless, and
 * the opposite of what the reader came to find out. Nobody is deciding whether
 * to fish in the next sixty seconds; they are deciding whether to go, which is
 * a question about the day. The live number still matters once you are on the
 * water, so it keeps its place, just not the headline.
 */
/**
 * The regulatory notice's box, which is a link everywhere except the ad frame.
 *
 * A wrapper rather than two copies of the box's contents, so the notice cannot
 * drift between the two frames — it is the same figures either way, and only
 * the click differs. `hover:brightness` lives on the anchor only: a div that
 * lights up under the cursor promises a click it does not have.
 */
function RegulatoryNotice({
  href,
  className,
  children,
}: {
  href: string | null;
  className: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} hover:brightness-[0.98]`}
    >
      {children}
    </a>
  );
}

export default function ScoreCard({
  nowTime,
  nowIsPeak = false,
  score,
  peak,
  peakTime,
  windowLabel,
  windowPeak,
  tidePhase,
  dfoArea,
  regulator,
  speciesName,
  regulation,
  onSetAlert,
  children,
  adFrame = false,
}: {
  /** On the ad frame the regulatory notice is a box, not a link out. */
  adFrame?: boolean;
  /** The current hour with its zone, e.g. "9 PM PDT". */
  nowTime: string;
  /** Is the live hour the day's peak hour? Then the secondary line would be
   *  the same number at the same time as the headline, printed twice. */
  nowIsPeak?: boolean;
  /** Score at the current hour (0–100), null if unavailable. */
  score: number | null;
  /** Today's peak score. The headline number. */
  peak: number | null;
  /** Today's peak time, e.g. "11 AM". */
  peakTime: string | null;
  /** Best contiguous window, e.g. "10 AM–1 PM". */
  windowLabel: string | null;
  /** Score the window peaks at. */
  windowPeak: number | null;
  /** Tide phase at the peak, e.g. "Tide flooding". */
  tidePhase: string | null;
  /** Regulatory area code, e.g. "19-4" in BC, "10" in WA. */
  dfoArea: string | null;
  /** The authority this strip cites and links. Resolved by the caller from
   *  the payload's agency — see `regulatorFrom`; a spot's jurisdiction is not
   *  reliably its city's. */
  regulator: Regulator;
  /** Driver species common name, e.g. "Dungeness Crab". */
  speciesName: string | null;
  /** In-effect regulation for the driver species — drives the status word and
   *  the limits line. Null when no row resolves for this species. */
  regulation: LiveRegulation | null;
  /** Tapped "Set alert" — the shell gates signed-out anglers into sign-up.
   *  Optional: the spot page moved this CTA up to the identity row, so the card
   *  renders no button when it is absent. Other callers still pass it. */
  onSetAlert?: () => void;
  /** Optional content nested inside the card, above the Set alert button
   *  (e.g. the fresh-catch evidence). */
  children?: React.ReactNode;
}) {
  // The pill describes the numeral beside it, so it follows the peak.
  const tier = tierFor(peak ?? score);
  // Falling back to the live hour when there is no peak keeps the card honest
  // rather than empty: a spot with a partial grid still has a number worth
  // printing, it just isn't a day's best.
  const headline = peak ?? score;
  const leadingWithPeak = peak != null;
  // Release-only used to render as "closed" here, because this strip took a
  // boolean. It's a third state: the fishery is on, you just can't keep one.
  const statusWord =
    regulation == null
      ? null
      : regulation.status === "Open"
        ? "open"
        : regulation.status === "Release"
          ? "release only"
          : "closed";
  const highlights = regulation ? regHighlights(regulation) : [];
  // "Peaks at 89" while the headline above reads 89 is the same number twice,
  // eight lines apart. The window box is drawn from the same day grid, so its
  // peak IS the headline peak by construction; what it adds is WHEN and what
  // the tide is doing. Kept only when it somehow differs.
  const windowSub = [
    windowPeak != null && windowPeak !== peak ? `Peaks at ${windowPeak}` : null,
    tidePhase,
  ]
    .filter(Boolean)
    .join(" · ");

  // On desktop the score, the window callout, and the reg strip fill a band the
  // exact height of the mini-map beside them (h-72), so the strip's bottom edge
  // lands on the map's. `justify-between` spreads the leftovers evenly instead
  // of stacking a hand-tuned margin under each block — which held only for one
  // combination of content and drifted the moment a chip wrapped or a window
  // callout went missing. min-h (not h) so an over-tall band grows rather than
  // clipping. Below lg the two columns stack and the band is meaningless, so
  // the per-block margins take over again.
  const alignToMap = dfoArea != null;

  return (
    <div>
      <div
        className={
          alignToMap
            ? "lg:min-h-72 lg:flex lg:flex-col lg:justify-between"
            : undefined
        }
      >
        <div>
          <div className="rc-label text-[9px] text-rc-ink-mute">
            {leadingWithPeak
              ? `Best score for the day${peakTime ? ` · ${peakTime}` : ""}`
              : `Now · ${nowTime}`}
          </div>

          <div className="flex items-end gap-4 mt-2">
            {/* "/100" rather than a bare numeral: an 89 means nothing to a
                first-time reader who does not know the scale, and an ad can
                land one on this page cold. Set small and muted so it reads as
                the unit on the number rather than as a second number. */}
            <span
              className={`flex items-end ${
                tier === "fair" ? "text-rc-fair-ink" : TIER_TEXT[tier]
              }`}
            >
              <span className="text-[64px] leading-[0.8] font-bold tracking-[-0.04em]">
                {headline ?? "—"}
              </span>
              {headline != null && (
                <span className="text-[22px] leading-none font-semibold tracking-[-0.02em] opacity-45 pb-[3px]">
                  /100
                </span>
              )}
            </span>
            <div className="pb-1.5 space-y-1.5">
              <span
                className={`inline-block px-2 py-0.5 rounded font-rc-mono text-[11px] font-bold ${TIER_PILL[tier]}`}
              >
                {headline != null ? tier.toUpperCase() : "NO SCORE"}
              </span>
              {leadingWithPeak && score != null && !nowIsPeak && (
                <p className="font-rc-mono text-xs text-rc-ink-soft">
                  Now {score} · {nowTime}
                </p>
              )}
            </div>
          </div>
        </div>

        {windowLabel && (
          <div className="mt-4 lg:mt-0 rounded bg-rc-good-bg text-center py-3 px-3">
            <div className="rc-label text-[9px] text-rc-good-ink">BEST WINDOW</div>
            <div className="text-lg font-bold text-rc-good-ink mt-0.5">
              {windowLabel}
            </div>
            {windowSub && (
              <div className="font-rc-mono text-[11px] text-rc-good-ink/80 mt-0.5">
                {windowSub}
              </div>
            )}
          </div>
        )}

        {/* Regulatory notice — muted chrome, hairline border, no fill. Points at
          the governing authority's own recreational-fishing page: the in-app
          /regulations route was removed, and on regs we link the source rather
          than restate it. Which authority depends on the spot — this was
          hardcoded to DFO, so Seattle spots cited Canadian regulations.

          Two rows deep: the area and status on top, and under it the figures
          you'd otherwise have to scroll to the Current Regulations panel for —
          daily quantity, length, and the gear rule. The second row keeps its
          height even when nothing is published, so the card doesn't reflow as
            the species selector moves between well- and thinly-documented rows. */}
        {/* On the ad frame this notice stays and its href goes: same box, same
            figures, no trip to a government site that will not send the reader
            back. `Regulations ↗` goes with the link — it is a label for a
            click that no longer exists. */}
        {dfoArea && (
          <RegulatoryNotice
            href={adFrame ? null : regulator.url}
            className="mt-3 lg:mt-0 flex min-h-[88px] flex-col justify-center gap-1.5 rounded border border-rc-fair-border bg-rc-fair-bg px-3 py-2.5 font-rc-mono text-[11px] text-rc-fair-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-all"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">
                {regulator.name} · {regulator.areaLabel} {dfoArea}
                {speciesName && statusWord ? ` · ${speciesName} ${statusWord}` : ""}
              </span>
              {!adFrame && <span className="shrink-0 text-rc-brand">Regulations ↗</span>}
            </span>
            {/* Wraps rather than truncates: a phone-width line can't hold "2 per
                day · min 45 cm · barbless hook and line", and the gear rule is
                the part that would get cut. Two rows is the floor, not a cap. */}
            {highlights.length > 0 ? (
              <span className="line-clamp-2 text-rc-fair-ink/80">
                {highlights.join(" · ")}
              </span>
            ) : (
              /* An absence, not a rule — never dress it up as one. */
              <span className="line-clamp-2 text-rc-fair-ink/55">
                Limits not published · check {regulator.name}
              </span>
            )}
          </RegulatoryNotice>
        )}
      </div>

      {/* Nested content (e.g. fresh-catch evidence) sits between the reg
          notice and the alert CTA. */}
      {children && (
        <div className="mt-4 pt-4 border-t border-rc-rule">{children}</div>
      )}

      {/* Single alert action — saving lives on the star beside the spot name.
          Outlined (not filled) so the score numeral stays the loudest thing. */}
      {onSetAlert && (
      <button
        type="button"
        onClick={onSetAlert}
        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded border border-rc-brand text-rc-brand hover:bg-rc-brand-soft text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand transition-colors"
      >
        <Bell className="w-4 h-4" />
        Set alert
      </button>
      )}
    </div>
  );
}
