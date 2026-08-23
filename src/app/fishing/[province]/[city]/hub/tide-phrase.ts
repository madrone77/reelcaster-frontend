// "on the morning flood" — the one clause of conditions prose on the hero.
//
// Derived, never written. The phase comes off the same conditions strip the
// map draws from, read at the hour the window peaks, at the spot the window
// belongs to. If any of those three are missing the hero simply says less;
// there is no generic fallback, because "on the tide" is filler and a wrong
// phase is worse than a short sentence.

import type { MapSpotsPayload } from "@/lib/bluecaster";

const PHASE_PHRASE: Record<string, string> = {
  flood_early: "on the early flood",
  flood_mid: "through the flood",
  flood_late: "on the late flood",
  slack_high: "over high slack",
  ebb_early: "on the early ebb",
  ebb_mid: "through the ebb",
  ebb_late: "on the late ebb",
  slack_low: "over low slack",
};

/** "on the late flood", or null when the strip has no phase at that hour. */
export function tidePhraseFor(
  payload: MapSpotsPayload | null,
  spotId: string | null | undefined,
  hour: number | null | undefined,
): string | null {
  if (!payload || !spotId || hour == null) return null;
  const spot = payload.spots.find((s) => s.id === spotId);
  const phase = spot?.conditions?.[hour]?.tph ?? null;
  return phase ? (PHASE_PHRASE[phase] ?? null) : null;
}
