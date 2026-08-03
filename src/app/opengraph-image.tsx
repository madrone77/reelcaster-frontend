import { ImageResponse } from "next/og";

// Site-wide fallback social card. Any route that does not define its own
// `opengraph-image` inherits this one, so every share renders as a card
// instead of a bare text link.
export const alt = "ReelCaster: tides, weather, and regulations in one fishing score";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#1F40E0";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B1020",
          backgroundImage: `radial-gradient(circle at 78% 18%, ${BRAND}55 0%, transparent 55%)`,
          padding: "72px 80px",
          color: "#F5F7FF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: BRAND,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            R
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            ReelCaster
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 82,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              maxWidth: 900,
            }}
          >
            Know the bite. Before you go.
          </div>
          <div style={{ fontSize: 32, color: "#A8B4D8", maxWidth: 880, lineHeight: 1.35 }}>
            Tides, weather, water conditions, and regulations in one fishing
            score for the BC, Washington, and Oregon coasts.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#7C8AB5",
            letterSpacing: "0.08em",
          }}
        >
          www.reelcaster.com
        </div>
      </div>
    ),
    { ...size },
  );
}
