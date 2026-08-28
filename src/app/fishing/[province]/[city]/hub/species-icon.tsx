// Species glyphs for the filter chips.
//
// Inline SVG, four shapes, no asset pipeline: a chip bar is the first thing a
// thumb reaches on this page and it must not wait on a sprite or a font.
// `currentColor` throughout so a chip's active state carries the icon with it.
//
// The shape is chosen from the species NAME rather than from a stored field,
// because no such field exists and adding one would mean a migration and a
// backfill to say "salmon are fish-shaped". A new salmon reads right with no
// data edit; anything unrecognised falls back to the generic fish rather than
// to a blank, which would make one chip look broken.

type Shape = "salmon" | "flat" | "crab" | "bottom";

function shapeFor(name: string): Shape {
  const n = name.toLowerCase();
  if (/crab|prawn|shrimp/.test(n)) return "crab";
  if (/halibut|flounder|sole|turbot/.test(n)) return "flat";
  if (/salmon|steelhead|trout/.test(n)) return "salmon";
  if (/cod|rockfish|lingcod|greenling|cabezon|perch|herring|sculpin/.test(n)) {
    return "bottom";
  }
  return "salmon";
}

const PATHS: Record<Shape, string> = {
  // Streamlined body, forked tail — a swimming fish.
  salmon:
    "M2 8c3-3.6 7.2-4.4 10-2.6 1-.9 2.2-1.4 3.2-1.6-.4 1-.6 2-.5 2.9.9.8 1.5 1.9 1.5 3.3-.9-.5-1.9-.7-2.8-.6-2.4 2.6-7.4 2.4-11.4-1.4Zm9.6-1.3a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4Z",
  // Deep oval body lying on its side, both eyes up — a flatfish.
  flat: "M2.2 8.5C4 5.4 7.4 4 10.4 4.6c3 .6 5.4 2.9 5.4 4 0 1-2.4 3.3-5.4 3.9-3 .6-6.4-.8-8.2-4Zm6-1.6a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Zm2 0a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Z",
  // Carapace with claws and legs.
  crab:
    "M4.6 5.3 6.9 7m6.5-1.7L11.1 7M9 6.6c2.1 0 3.6 1.3 3.6 2.8S11.1 12 9 12s-3.6-1.1-3.6-2.6S6.9 6.6 9 6.6ZM3 10.4l2.5-.6M15 10.4l-2.5-.6M4 12.6l2-1M14 12.6l-2-1",
  // Blunt head, big spiny dorsal — a bottomfish.
  bottom:
    "M2.4 9.2c2-3 5.6-4.2 8.6-3.3l2-1.6.4 2.4 2.2 1.2-2 1.4-.2 2.4-2-1.4c-3 1-6.6-.2-9-1.1Zm4-.6a.6.6 0 1 0 0 1.2.6.6 0 0 0 0-1.2Z",
};

export default function SpeciesIcon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const shape = shapeFor(name);
  const stroked = shape === "crab";
  return (
    <svg
      viewBox="0 0 18 16"
      className={className}
      aria-hidden
      focusable="false"
      fill={stroked ? "none" : "currentColor"}
      stroke={stroked ? "currentColor" : "none"}
      strokeWidth={stroked ? 1.3 : 0}
      strokeLinecap="round"
    >
      <path d={PATHS[shape]} />
    </svg>
  );
}
