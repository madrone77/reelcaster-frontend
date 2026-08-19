/* eslint-disable @next/next/no-img-element */

// Map branding + the acknowledgements that aren't tied to a tile source.
// Source-level credits (bathymetry, OSM, DFO, WDFW, tide/buoy stations) live on
// the relief style spec and flow through MapLibre's attribution control; this
// list covers data that reaches the map through APIs instead of tiles (scores/
// conditions weather, SalishSeaCast ocean model, animated currents) plus the
// brand line and the non-navigational disclaimer.
export const MAP_CUSTOM_ATTRIBUTION = [
  "© ReelCaster",
  "⚠ Not for navigation",
  "Ocean currents & water temp: UBC SalishSeaCast (CC BY 4.0) · FES2014 (Aviso+)",
  "Weather data by Open-Meteo.com (CC BY 4.0)",
];

/**
 * The official ReelCaster lockup as a non-interactive map watermark: recolored
 * all-white via filter (brightness 0 → invert), 65% opacity, no glow.
 * reelcaster-logo-map.svg is the brand asset with the CASTER row translated
 * -3.64 units so it centers under REEL (bbox centers 56.95 vs 53.31 in the
 * original) — paths untouched, never re-typeset.
 */
export function MapBrandLogo({
  width = 88,
  opacity = 0.65,
  className = "",
}: {
  width?: number;
  opacity?: number;
  className?: string;
}) {
  return (
    <img
      src="/reelcaster-logo-map.svg"
      alt="ReelCaster"
      width={width}
      height={Math.round(width * (49 / 109))}
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
      style={{ filter: "brightness(0) invert(1)", opacity }}
    />
  );
}
