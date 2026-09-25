import type {
  MapCondCell,
  MapSpeciesStrip,
  MapSpotEntry,
  MapSpotsPayload,
} from "./bluecaster";

/**
 * BlueCaster's `shape=pins` body of /map/spots, and its expansion back into
 * the ordinary payload shape.
 *
 * The full body carries every spot's 24 hours of conditions and every
 * species' 24 hourly scores as 15-digit floats: 3 MB for a zoomed-out map of
 * 400 spots, which a phone downloads and parses before it colours one pin. The
 * pins body sends whole-number scores and only the conditions hours a pin or
 * rail card reads (each species' peak hour, plus now and next hour on today),
 * about a fifth of the size. See bluecaster lib/bluecaster/map/pins-shape.ts.
 *
 * It is expanded here, on the client, straight after the fetch, so everything
 * downstream keeps reading `MapSpotsPayload`. Expanded entries carry
 * `conditions_partial: true`: their strip holds only those few hours, and the
 * spot drawer, which scrubs every hour, reads the one spot it opens in full.
 */
export interface MapPinStrip {
  p: number; // peak 0..100
  ph: number; // local hour of the peak
  se: MapSpeciesStrip["season"];
  h: (number | null)[]; // 24 hourly scores 0..100
}

export type MapPinSpotEntry = Omit<MapSpotEntry, "scores" | "conditions"> & {
  pins: Record<string, MapPinStrip>;
  cond: Record<string, Partial<MapCondCell>> | null;
};

export type MapPinsPayload = Omit<MapSpotsPayload, "spots"> & {
  spots: MapPinSpotEntry[];
};

/** The one condition field an expanded cell must have to type as a full cell. */
const EMPTY_CELL: MapCondCell = {
  wkt: null,
  wdir: null,
  wav: null,
  tide: null,
  tph: null,
  cur: null,
  cld: null,
  pcp: null,
  air: null,
};

export function inflatePinSpot(entry: MapPinSpotEntry): MapSpotEntry {
  const { pins, cond, ...rest } = entry;
  const scores: Record<string, MapSpeciesStrip> = {};
  for (const [sid, p] of Object.entries(pins ?? {})) {
    scores[sid] = {
      peak: p.p / 100,
      peak_hour: p.ph,
      season: p.se,
      hours: p.h.map((v) => (v === null ? null : { s: v / 100, r: 0 as const })),
    };
  }
  let conditions: MapSpotEntry["conditions"] = null;
  if (cond) {
    conditions = new Array(24).fill(null);
    for (const [h, cell] of Object.entries(cond)) {
      const i = Number(h);
      if (Number.isInteger(i) && i >= 0 && i < 24) conditions[i] = { ...EMPTY_CELL, ...cell };
    }
  }
  return { ...rest, scores, conditions, conditions_partial: true };
}

/**
 * A /map/spots body as the ordinary payload, whichever shape it came in.
 * A full-shape body (an older deploy, or an edge copy cached before one)
 * passes through untouched.
 */
export function inflateMapSpotsBody(
  body: MapSpotsPayload | MapPinsPayload | null,
): MapSpotsPayload | null {
  if (!body || !Array.isArray(body.spots)) return body as MapSpotsPayload | null;
  return {
    ...body,
    spots: body.spots.map((s) =>
      "pins" in s ? inflatePinSpot(s as MapPinSpotEntry) : (s as MapSpotEntry),
    ),
  };
}
