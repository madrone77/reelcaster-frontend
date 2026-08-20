// Map acknowledgements that aren't tied to a tile source.
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
