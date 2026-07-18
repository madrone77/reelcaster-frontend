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
 * The official ReelCaster lockup (public/reelcaster-logo.svg — the brand asset,
 * never re-typeset) as a non-interactive map watermark. A soft white halo keeps
 * the brand-blue mark legible over both land and water.
 */
export function MapBrandLogo({ width = 88, className = "" }: { width?: number; className?: string }) {
  return (
    <img
      src="/reelcaster-logo.svg"
      alt="ReelCaster"
      width={width}
      height={Math.round(width * (49 / 109))}
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
      style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,0.9)) drop-shadow(0 0 6px rgba(255,255,255,0.7))" }}
    />
  );
}
