"use client";

// Today's daily report, with the upgrade modal its locked state opens.
//
// This used to carry the verdict band above the report. The band is now the
// bite radar at the top of the page, which answers the same question with the
// window and the conditions attached, so keeping both would have put two
// verdicts on one screen. The wrapper stays because the report's locked state
// opens the upgrade modal and the modal needs one owner.

import { useState } from "react";
import UpgradeDialog from "@/app/explore/components/upgrade-dialog";
import CityReport from "./city-report";

export default function CityLive({
  cityName,
  citySlug,
}: {
  cityName: string;
  citySlug: string;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <div className="space-y-4">
      <CityReport
        citySlug={citySlug}
        cityName={cityName}
        onUpgrade={() => setUpgradeOpen(true)}
      />
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
