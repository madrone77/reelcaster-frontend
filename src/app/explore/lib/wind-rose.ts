/**
 * Compass name for a wind direction in degrees, on the 16-point rose.
 *
 * One rose for every wind readout on the spot page. The 24h chart's arrows,
 * the conditions strip and the map's time bar all name the same hour, and they
 * used to name it from two different sources: the chart from `windDirDeg` at 16
 * points, the strip from the API's `windDir` string, which bluecaster rounds to
 * 8. So one 250° hour read "WSW" under the chart's arrow and "W" in the strip
 * directly above it. Degrees are the fact; the string is a rendering of it, and
 * this is where that rendering happens.
 *
 * `windDirDeg` is the meteorological convention — the direction the wind is
 * coming FROM — so "SW" is a southwesterly, blowing toward the northeast.
 */
const POINTS = [
  "N", "NNE", "NE", "ENE",
  "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW",
  "W", "WNW", "NW", "NNW",
];

export function windCardinal(deg: number | null | undefined): string | null {
  if (typeof deg !== "number" || !Number.isFinite(deg)) return null;
  return POINTS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
}
