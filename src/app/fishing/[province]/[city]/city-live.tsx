"use client";

// The live band at the top of a city page: today's verdict, then today's
// report.
//
// They share a wrapper only because the report's locked state opens the
// upgrade modal, and the modal needs one owner. Keeping that state here rather
// than in either section means neither has to know the modal exists beyond
// calling `onUpgrade`.

import { useState } from "react";
import type { BlueCasterCityToday } from "@/lib/bluecaster";
import UpgradeDialog from "../../../explore/components/upgrade-dialog";
import CityToday from "./city-today";
import CityReport from "./city-report";

export default function CityLive({
  today,
  cityName,
  citySlug,
}: {
  /** Server-rendered at the anon horizon; the band upgrades it in place. */
  today: BlueCasterCityToday | null;
  cityName: string;
  citySlug: string;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <div className="space-y-4">
      {today && (
        <CityToday initial={today} cityName={cityName} citySlug={citySlug} />
      )}
      <CityReport
        citySlug={citySlug}
        cityName={cityName}
        onUpgrade={() => setUpgradeOpen(true)}
      />
      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
