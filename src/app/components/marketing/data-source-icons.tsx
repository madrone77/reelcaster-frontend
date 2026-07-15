// Monochrome data-source glyphs, matched to the Figma "trusted data sources"
// strip (compass-star / wave / wind / globe). Inline SVG in currentColor so
// they stay crisp and transparent at any size — the earlier raster PNGs had
// an opaque grey background baked in and rendered as boxes.

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** DFO / MPO — tides & regulations: compass star. */
export function DfoIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="9" strokeWidth={1.4} />
      <path d="M12 6.5l1.6 3.9 3.9 1.6-3.9 1.6L12 17.5l-1.6-3.9L6.5 12l3.9-1.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** NOAA — buoys & water temp: waves. */
export function NoaaIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="9" strokeWidth={1.4} />
      <path d="M6.5 10.2c1.4 0 1.4 1.3 2.75 1.3S12.65 10.2 14 10.2s1.4 1.3 2.75 1.3M6.5 14c1.4 0 1.4 1.3 2.75 1.3S12.65 14 14 14s1.4 1.3 2.75 1.3" />
    </svg>
  );
}

/** ECMWF — wind & pressure: wind lines. */
export function EcmwfIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="9" strokeWidth={1.4} />
      <path d="M6.5 10.3h6.7a1.7 1.7 0 1 0-1.7-1.7M6.5 13.7h8.9a1.9 1.9 0 1 1-1.9 1.9" />
    </svg>
  );
}

/** NCEP GFS — global forecast: globe. */
export function NcepIcon({ className }: { className?: string }) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="9" strokeWidth={1.4} />
      <path d="M3 12h18M12 3c2.4 2.4 3.7 5.6 3.7 9S14.4 18.6 12 21c-2.4-2.4-3.7-5.6-3.7-9S9.6 5.4 12 3z" />
    </svg>
  );
}
