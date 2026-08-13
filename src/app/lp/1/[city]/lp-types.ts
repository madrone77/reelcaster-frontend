import type { MapSpot } from "@/app/(marketing)/components/marketing-map";
import type { SpeciesOption } from "@/app/explore/lib/explore-data";

export type LpTier = "good" | "fair" | "poor" | "none";

/** One cell of the 14-day strip. Weather glyphs are intentionally absent in v1
 *  — the outlook payload carries scores, not per-day weather. */
export interface LpDay {
  dow: string; // "Thu"
  date: string; // "Aug 14"
  score: number | null;
  tier: LpTier;
  peak: string | null; // "06:00" · "—" when the day is unscored
  isBest: boolean;
}

/** A species row inside the fresh-catch card (landed / reported). */
export interface LpFreshSpecies {
  name: string;
  positive: number;
  count: number;
}

/** Everything the client shell renders. Assembled server-side in page.tsx from
 *  live BlueCaster data for the city's top-scoring published spot. */
export interface LpShellProps {
  // identity
  city: string; // "Victoria"
  provinceCode: string; // "BC"
  species: string; // "Chinook"
  bestDay: string; // "Thursday" · "today"

  // score card
  score: number | null;
  tier: LpTier;
  tierWord: string; // "Good"
  spotName: string; // "Constance Bank" — the representative spot
  regulator: string; // "DFO"
  regAreaLabel: string; // "PFMA"
  regArea: string | null; // "19-3"
  regStatus: string | null; // "open" · "closed" · "release only"
  peakScore: number | null; // best today
  peakTime: string | null; // "10:00 AM"
  bestWindowLabel: string | null; // "Thu Aug 14"
  bestWindowTime: string | null; // "06:00 – 10:00 AM"
  bestWindowSub: string | null; // "Peaks at 91"
  hours24: (number | null)[]; // 24 hourly scores for the cascade bars
  updatedLabel: string; // "Updated 9:41 AM"

  // 14-day + seasonality
  days: LpDay[];
  /** Monthly abundance weights (12), normalized 0–1, for the seasonality spark. */
  seasonMonths: number[];
  seasonPeakMonth: string | null; // "August"
  seasonNote: string; // "Chinook peak in August — a window that recurs every season."

  // fresh catch
  freshCount: number;
  freshActivity: "Busy" | "Active" | null; // Busy at >= 8 reports, else Active, null when 0
  freshSpecies: LpFreshSpecies[];
  freshLatest: string | null; // "2 days ago"

  // living map
  mapSpots: MapSpot[];
  mapSpecies: SpeciesOption[];
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
}
