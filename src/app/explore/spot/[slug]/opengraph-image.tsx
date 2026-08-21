import { ImageResponse } from "next/og";
import { fetchSpotLivePage } from "@/lib/bluecaster";
import { provinceCodeFromName } from "@/lib/regions";
import { BRAND, FOOT, INK, MUTED, cardSpeciesName, nameSize } from "@/lib/creative";

// Per-spot social card.
//
// Every spot used to share the one site-wide card, so a Salmon Bank link and a
// Victoria Waterfront link were visually identical in a feed. This names the
// water instead.
//
// Deliberately evergreen: no score, no best hour, no report counts, even
// though all three are in the payload below. Facebook caches a scrape per URL
// and never re-polls, so a number baked in here freezes at whatever it was the
// first time anyone shared the page.
export const alt = "ReelCaster fishing forecast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Palette and text-fitting live in @/lib/creative, shared with the paid-ad
// creative route so the two cannot drift apart.

function Shell({ children }: { children: React.ReactNode }) {
  return (
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
        color: INK,
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

      {children}

      <div
        style={{
          display: "flex",
          fontSize: 24,
          color: FOOT,
          letterSpacing: "0.08em",
        }}
      >
        www.reelcaster.com
      </div>
    </div>
  );
}

export default async function SpotOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // A card is decoration. If the read fails we still owe the scraper an image,
  // and this route is prerendered alongside the page, so throwing here would
  // fail the build on a transient upstream 500 rather than lose a nicety.
  const page = await fetchSpotLivePage(slug).catch(() => null);

  if (!page) {
    return new ImageResponse(
      (
        <Shell>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
            <div style={{ fontSize: 32, color: MUTED, maxWidth: 880, lineHeight: 1.35 }}>
              Tides, weather, water conditions, and regulations in one fishing
              score for the BC and Washington coasts.
            </div>
          </div>
        </Shell>
      ),
      { ...size },
    );
  }

  const name = page.spot.name;
  // "Victoria, BC", not "Victoria, British Columbia" — same short form the
  // page <title> uses, and the long name crowds the spot name underneath it.
  const region = page.spot.region ? provinceCodeFromName(page.spot.region) : null;
  const where = [page.spot.city, region].filter(Boolean).join(", ");
  const roster = page.species.slice(0, 4).map((s) => cardSpeciesName(s.name));

  return new ImageResponse(
    (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: MUTED,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {where || "Fishing forecast"}
          </div>
          <div
            style={{
              fontSize: nameSize(name, 86),
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.03em",
              maxWidth: 1000,
            }}
          >
            {name}
          </div>
          {roster.length > 0 ? (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", maxWidth: 1000 }}>
              {roster.map((s) => (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    fontSize: 26,
                    color: INK,
                    border: `2px solid ${BRAND}`,
                    borderRadius: 999,
                    padding: "8px 22px",
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 30, color: MUTED }}>
              Tides, weather, water conditions, and regulations in one score.
            </div>
          )}
        </div>
      </Shell>
    ),
    { ...size },
  );
}
