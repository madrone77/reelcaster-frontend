"use client";

import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import {
  PLAN_FEATURES,
  planTiers,
  SHARED_ROW_HEADING,
  SHARED_ROW_START,
  type PlanCell,
  type PlanTierId,
} from "@/lib/plan-features";
import { usePricing } from "@/app/components/split-test/use-pricing";
import { cn } from "@/lib/utils";
import Testimonial from "./testimonial";
import { PROOF } from "@/app/lp/_shared/lp-content";

/**
 * The plan matrix: what each tier gets, one row per capability.
 *
 * Extracted from ProTrialModal so the trial nag and /billing/cancel show the
 * same table rather than two drifting copies of it. Copy and limits come from
 * `@/lib/plan-features` — never hardcode them here.
 *
 * Two columns, Free and Pro, because that is the question being asked. A signed
 * out visitor gets the same two: what they can see without an account was a
 * third column that turned a yes/no into a three-way read.
 *
 * Pro-only rows run first and the shared rows follow under a heading. That
 * order is a property of the list, not of this file: see the ordering note in
 * plan-features.ts for why, and change it there.
 */

// One track per PLAN_TIERS entry — kept literal because Tailwind can't scan a
// computed class. Narrow value columns on a phone so the feature label keeps
// most of the row; they widen once there's room for a longer string.
const COL =
  "grid grid-cols-[minmax(0,1fr)_repeat(2,64px)] sm:grid-cols-[minmax(0,1fr)_repeat(2,minmax(72px,96px))]";

export default function PlanMatrix({
  viewerTier,
  highlightRowId,
  stickyHeader = true,
  withProof = false,
  className,
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
  /**
   * Hang the customer quote off the foot of the table. Opt-in, and today only
   * the upgrade modal asks for it: that is the surface selling a trial to
   * somebody who has not bought yet, where another customer's word is the last
   * argument left. /billing/cancel goes without on purpose — the reader there
   * already tried to buy, so proof answers a question they had stopped asking,
   * and that page's job is to get them back to checkout.
   */
  withProof?: boolean;
  /**
   * Merged onto the root. The table carries its own top rule because every
   * surface has so far stacked it under something; the trial dialog puts it in
   * a column of its own at desktop widths, where that rule would be a stray
   * hairline across the top of the panel, and turns it off from here.
   */
  className?: string;
}) {
  // The Pro column's price line. Read per reader rather than from a constant,
  // so a price test does not leave this table quoting one number while the
  // button above it quotes another.
  const tiers = planTiers(usePricing());

  return (
    <div className={cn("border-t border-rc-rule", className)}>
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
        {tiers.map((t) => {
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
        // The seam. Above it, what paying adds; below it, the rows the free
        // tier gets as well. The Pro block leads so that the rows sharing the
        // screen with the buy button are all reasons to press it, and the
        // heading below stops the matched ticks reading as an argument for
        // staying on free.
        const seam = i === SHARED_ROW_START;
        return (
          <Fragment key={row.id}>
            {seam && (
              <div
                className={`${COL} px-4 sm:px-6 pt-3 pb-1.5 border-t border-rc-rule`}
              >
                <div className="rc-label text-rc-ink-mute">
                  {SHARED_ROW_HEADING}
                </div>
              </div>
            )}
            <div
              data-row={row.id}
              data-highlighted={hit || undefined}
              className={`${COL} items-center px-4 sm:px-6 py-2 ${
                seam ? "" : "border-t border-rc-rule/60"
              } ${hit ? "bg-rc-brand-soft" : ""}`}
            >
              <div
                className={`pr-3 text-[13px] leading-snug ${
                  hit ? "font-semibold text-rc-ink" : "text-rc-ink-soft"
                }`}
              >
                {row.label}
              </div>
              {tiers.map((t) => (
                <Cell key={t.id} value={row[t.id]} emphasis={t.id === "pro"} />
              ))}
            </div>
          </Fragment>
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

      {/* One customer, in his own words, under the table rather than over it.
          The table is the claim we make about the product; this is somebody
          else making it, which is worth more once the reader has seen what is
          being claimed than as a banner before they know what it refers to.

          Off unless a caller asks for it, so the page that shows this table to
          somebody whose checkout just failed does not argue at them. Rendered
          from the shared component, which reads PROOF, so the quote is not
          reproduced here: see testimonial.tsx. Nothing renders when
          PROOF.showProof is off, and the border goes with it so the matrix
          cannot end on a rule with nothing under it. */}
      {withProof && PROOF.showProof && (
        <div className="border-t border-rc-rule px-4 sm:px-6 py-4">
          <Testimonial className="" />
        </div>
      )}
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
