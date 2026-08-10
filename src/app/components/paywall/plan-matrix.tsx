"use client";

import { Check, Minus } from "lucide-react";
import {
  PLAN_FEATURES,
  PLAN_TIERS,
  PRO_ROW_START,
  type PlanCell,
  type PlanTierId,
} from "@/lib/plan-features";

/**
 * The plan matrix: what each tier gets, one row per capability.
 *
 * Extracted from ProTrialModal so the trial nag and /billing/cancel show the
 * same table rather than two drifting copies of it. Copy and limits come from
 * `@/lib/plan-features` — never hardcode them here.
 */

// Narrow value columns on a phone so the feature label keeps most of the row;
// they widen once there's room for the longer strings ("Unlimited").
const COL =
  "grid grid-cols-[minmax(0,1fr)_repeat(3,58px)] sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(64px,84px))]";

export default function PlanMatrix({
  viewerTier,
  highlightRowId,
  stickyHeader = true,
}: {
  viewerTier: PlanTierId;
  /** Row to call out — the one that blocked them. Omit where nothing did. */
  highlightRowId?: string;
  /**
   * Column heads track the reader down the rows. True inside the modal, whose
   * dialog is the scroller. False on an ordinary page, where `sticky` would
   * measure against the viewport and park the heads under the site's own
   * sticky top bar instead.
   */
  stickyHeader?: boolean;
}) {
  return (
    <div className="border-t border-rc-rule">
      {/* Column heads — sticky so the tier you're reading stays labelled while
          the rows scroll past. Now that the whole modal is one scroller these
          stick to the top of the dialog rather than to a table-sized window,
          which is the only thing that stays fixed while you read the rows. The
          z sits below the close button's (see DialogContent) so it slides
          under the X instead of over it. */}
      <div
        className={`${COL} ${
          stickyHeader ? "sticky top-0 z-10" : ""
        } bg-rc-panel border-b border-rc-rule px-4 sm:px-6 py-2.5`}
      >
        <div className="rc-label text-rc-ink-mute self-end">
          What you get
        </div>
        {PLAN_TIERS.map((t) => {
          const current = t.id === viewerTier;
          return (
            <div key={t.id} className="text-center">
              <div
                className={`font-rc-mono text-[10px] font-bold tracking-[0.08em] uppercase ${
                  t.id === "pro"
                    ? "text-rc-brand"
                    : current
                      ? "text-rc-ink"
                      : "text-rc-ink-mute"
                }`}
              >
                {t.label}
              </div>
              <div className="mt-0.5 text-[10px] leading-none text-rc-ink-mute">
                {current ? "You" : t.price}
              </div>
            </div>
          );
        })}
      </div>

      {PLAN_FEATURES.map((row, i) => {
        const hit = row.id === highlightRowId;
        return (
          <div
            key={row.id}
            data-row={row.id}
            data-highlighted={hit || undefined}
            className={`${COL} items-center px-4 sm:px-6 py-2 border-t ${
              // The seam between "free and serious" and "what paying adds" —
              // the one place the table makes an argument rather than a list.
              i === PRO_ROW_START ? "border-rc-rule" : "border-rc-rule/60"
            } ${hit ? "bg-rc-brand-soft" : ""}`}
          >
            <div
              className={`pr-3 text-[13px] leading-snug ${
                hit ? "font-semibold text-rc-ink" : "text-rc-ink-soft"
              }`}
            >
              {row.label}
            </div>
            {PLAN_TIERS.map((t) => (
              <Cell key={t.id} value={row[t.id]} emphasis={t.id === "pro"} />
            ))}
          </div>
        );
      })}

      {/* Names only what a customer can actually use today. Oregon used to be
          listed here and in COVERED_PROVINCES despite having no cities in
          BlueCaster at all, so this sold water we don't forecast; it has been
          swept out of the covered set and every other surface that named it.
          "More coming soon" covers the next region without naming a date.

          The currency sentence stays: the price above says "$33" and nothing
          else on this modal says which dollar that is. */}
      <p className="px-4 sm:px-6 py-4 text-[11px] leading-relaxed text-rc-ink-mute border-t border-rc-rule">
        Pro available in British Columbia and Washington. More coming soon.
        Billed in CAD in Canada, USD in the US.
      </p>
    </div>
  );
}

function Cell({ value, emphasis }: { value: PlanCell; emphasis: boolean }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <Check
          className={`w-4 h-4 ${emphasis ? "text-rc-brand" : "text-rc-good"}`}
          aria-label="Included"
        />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <Minus className="w-3.5 h-3.5 text-rc-ink-mute/50" aria-label="Not included" />
      </div>
    );
  }
  return (
    <div
      className={`text-center font-rc-mono text-[11px] leading-tight px-0.5 ${
        emphasis ? "font-bold text-rc-brand" : "text-rc-ink-soft"
      }`}
    >
      {value}
    </div>
  );
}
