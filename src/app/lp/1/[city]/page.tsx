import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  fetchFreshCatches,
  fetchHierarchy,
  fetchMapSpots,
  fetchSpotPage,
  fetchSpotsOutlook14d,
} from "@/lib/bluecaster";
import { regulatorFor } from "@/lib/regions";
import { buildExploreData, fmtPeak, tierFor } from "@/app/explore/lib/explore-data";
import { formatHour12 } from "@/lib/time-format";
import type { MapSpot } from "@/app/(marketing)/components/marketing-map";
import LpShell from "./lp-shell";
import type { LpDay, LpFreshSpecies, LpShellProps, LpTier } from "./lp-types";

// Cold-traffic LP: scores move through the day, keep it fresh-ish. Cities added
// later render on demand and then cache.
export const revalidate = 900;

const DOW_FULL: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "victoria" → "Victoria", "friday-harbor" → "Friday Harbor". */
function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** ISO → "3 min ago" / "2 days ago" / "just now". Whole-unit, coarse. */
function relTime(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 90) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  // "victoria-bc" → "Victoria, BC" — split a trailing 2-letter province code.
  const parts = city.split("-");
  const prov =
    parts.length > 1 && parts[parts.length - 1].length === 2
      ? parts[parts.length - 1].toUpperCase()
      : null;
  const bare = titleCaseSlug((prov ? parts.slice(0, -1) : parts).join("-"));
  const cityLabel = prov ? `${bare}, ${prov}` : bare;
  const title = `${bare} fishing — know the bite before you go`;
  return {
    title: { absolute: title },
    description: `See this week's best fishing windows for every spot around ${cityLabel}. One score from tides, weather, water and regulations. Free 7-day trial.`,
    robots: { index: false, follow: true },
  };
}

export default async function LpCityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;

  const [hierarchy, payload, outlook, fresh] = await Promise.all([
    fetchHierarchy(),
    fetchMapSpots({ city: citySlug }),
    fetchSpotsOutlook14d({ citySlug }),
    fetchFreshCatches({ city: citySlug }),
  ]);

  const data = buildExploreData(hierarchy, payload);
  const spots = data.spots.filter((s) => s.citySlug === citySlug);
  // The representative spot = the city's top-scoring published spot right now.
  // No scored spot → nothing to sell; 404 rather than ship an empty hero.
  const rep = spots
    .filter((s) => s.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  if (!rep) notFound();

  // Reg + seasonality live on the per-spot page payload.
  const spotPage = await fetchSpotPage(rep.slug);

  const speciesNameById = new Map(data.species.map((s) => [s.id, s.name]));
  const cityName = rep.cityName || titleCaseSlug(citySlug);
  const provinceCode = rep.provinceCode;
  const species = rep.driverSpecies ?? "fish";
  const tier = tierFor(rep.score) as LpTier;
  const tierWord = tier === "none" ? "" : tier.charAt(0).toUpperCase() + tier.slice(1);

  // ── 14-day strip + best day/window ──────────────────────────────────
  const outlookDays = outlook?.by_spot[rep.id] ?? [];
  const days: LpDay[] = outlookDays.map((d, i) => {
    const meta = outlook?.days[i];
    return {
      dow: meta?.dow ?? "",
      date: meta?.date ?? "",
      score: d?.score ?? null,
      tier: tierFor(d?.score ?? null) as LpTier,
      peak: d ? fmtPeak(d.peak_hour) : "—",
      isBest: false,
    };
  });
  let bestIdx = -1;
  let bestScore = -1;
  days.forEach((d, i) => {
    if (d.score != null && d.score > bestScore) {
      bestScore = d.score;
      bestIdx = i;
    }
  });
  if (bestIdx >= 0) days[bestIdx].isBest = true;
  const bestDay =
    bestIdx <= 0 ? "today" : DOW_FULL[days[bestIdx].dow] ?? days[bestIdx].dow;
  const bestPeakHour = bestIdx >= 0 ? outlookDays[bestIdx]?.peak_hour ?? null : null;
  const bestWindowLabel =
    bestIdx >= 0 ? `${days[bestIdx].dow} ${days[bestIdx].date}` : null;
  const bestWindowTime =
    bestPeakHour != null
      ? `${formatHour12(bestPeakHour)} – ${formatHour12(Math.min(bestPeakHour + 4, 23))}`
      : null;
  const bestWindowSub = bestScore >= 0 ? `Peaks at ${bestScore}` : null;

  // ── Reg strip ───────────────────────────────────────────────────────
  const regulator = regulatorFor(provinceCode);
  const regArea = spotPage?.spot.dfo_area_label ?? null;
  const driverRow = spotPage?.species_table.find(
    (r) => r.species_id === rep.bestSpeciesId || r.species_name === species,
  );
  const regStatus =
    driverRow?.status === "open"
      ? "open"
      : driverRow?.status === "non_retention"
        ? "release only"
        : driverRow?.status === "closed"
          ? "closed"
          : null;

  // ── Seasonality (monthly abundance of the driver species) ───────────
  const seasonRow =
    spotPage?.seasonal_abundance.find(
      (r) => r.species_id === rep.bestSpeciesId || r.species_name === species,
    ) ?? spotPage?.seasonal_abundance[0];
  const rawMonths = seasonRow?.monthly_weights ?? [];
  const monthMax = rawMonths.length ? Math.max(...rawMonths, 0.0001) : 1;
  const seasonMonths = rawMonths.map((w) => w / monthMax);
  let seasonPeakIdx = -1;
  let seasonPeakVal = -1;
  rawMonths.forEach((w, i) => {
    if (w > seasonPeakVal) {
      seasonPeakVal = w;
      seasonPeakIdx = i;
    }
  });
  const seasonPeakMonth = seasonPeakIdx >= 0 ? MONTHS[seasonPeakIdx] : null;
  const seasonNote = seasonPeakMonth
    ? `${species} peak in ${seasonPeakMonth} — a window that recurs every season, not a one-off.`
    : `${species} runs recur every season — this window is not a one-off.`;

  // ── Fresh catch ─────────────────────────────────────────────────────
  const freshEntry = fresh?.spots[rep.id] ?? null;
  const freshCount = freshEntry?.count ?? 0;
  const freshActivity: LpShellProps["freshActivity"] =
    freshCount >= 8 ? "Busy" : freshCount > 0 ? "Active" : null;
  const freshSpecies: LpFreshSpecies[] = freshEntry
    ? Object.entries(freshEntry.species)
        .map(([id, s]) => ({
          name: speciesNameById.get(id) ?? id,
          positive: s.positive,
          count: s.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
    : [];
  const freshLatest = relTime(freshEntry?.latest_date ?? null);

  // ── Living map ──────────────────────────────────────────────────────
  const mapSpots: MapSpot[] = spots
    .filter((s) => s.score !== null)
    .map(({ slug, name, lat, lng, score, scoresBySpecies }) => ({
      slug,
      name,
      lat,
      lng,
      score,
      scoresBySpecies,
    }));
  const cityCenter = spotPage?.hierarchy?.city ?? null;
  const mapCenter = cityCenter
    ? { lat: cityCenter.lat, lng: cityCenter.lng }
    : { lat: rep.lat, lng: rep.lng };

  const shellProps: LpShellProps = {
    city: cityName,
    provinceCode,
    species,
    bestDay,
    score: rep.score,
    tier,
    tierWord,
    spotName: rep.name,
    regulator: regulator.name,
    regAreaLabel: regulator.areaLabel,
    regArea,
    regStatus,
    peakScore: rep.score,
    peakTime: rep.peakHour == null ? null : formatHour12(rep.peakHour),
    bestWindowLabel,
    bestWindowTime,
    bestWindowSub,
    hours24: rep.hours24,
    updatedLabel: `Updated ${relTime(spotPage?.meta.generated_at ?? null) ?? "today"}`,
    days,
    seasonMonths,
    seasonPeakMonth,
    seasonNote,
    freshCount,
    freshActivity,
    freshSpecies,
    freshLatest,
    mapSpots,
    mapSpecies: data.species,
    mapCenter,
    mapZoom: 10,
  };

  return <LpShell {...shellProps} />;
}
