"use client";

// Today's daily report, with the upgrade modal its locked state opens.
//
// Sits ABOVE the 14-day strip on both the public city page and its ad frame:
// the headline is a sentence about what anglers are catching on this water
// right now, and it is the strongest thing on the page, so it goes first. It
// used to sit under "What you can keep today", where a reader who came for the
// forecast never scrolled to it.
//
// The wrapper stays because the report's locked state opens the upgrade modal
// and the modal needs one owner. Inside the ad frame there is no dialog: the
// locked state opens the frame's own trial modal (see ad/city-ad-view.tsx),
// which keeps the reader in the frame and counts the press as a campaign CTA.

import { useState } from "react";
import UpgradeDialog from "@/app/explore/components/upgrade-dialog";
import { useAdTrial } from "./ad/city-ad-view";
import CityReport, { type ReportTeaser } from "./city-report";

export default function CityLive({
  cityName,
  citySlug,
  teaser = null,
}: {
  cityName: string;
  citySlug: string;
  /** The headline the server already knows, so the band renders in the
   *  prerendered HTML instead of arriving after the strip has painted. */
  teaser?: ReportTeaser | null;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const adTrial = useAdTrial();

  return (
    <div className="space-y-4">
      <CityReport
        citySlug={citySlug}
        cityName={cityName}
        teaser={teaser}
        onUpgrade={adTrial ? () => adTrial("report") : () => setUpgradeOpen(true)}
      />
      {!adTrial && <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />}
    </div>
  );
}
