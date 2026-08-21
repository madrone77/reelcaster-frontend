import { ImageResponse } from "next/og";
import { fetchCityGuides, fetchHierarchy } from "@/lib/bluecaster";
import { getFishingCity, getFishingProvince } from "../../lib/fishing-data";

// Per-city social card.
//
// These pages had no usable card at all: eight of the nine had no hero image,
// and the two that did were the wrong photographs. Generating one fixes every
// city at once and removes photo sourcing from the cost of launching a new
// one.
//
// Deliberately evergreen, for the same reason the spot card is: Facebook
// caches one scrape per URL and never re-polls, so a score, a spot count or a
// "best today" baked in here freezes at whatever it was the first time
// somebody shared the page. Species and place do not move.

export const alt = "ReelCaster fishing forecast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#1F40E0";
const INK = "#F5F7FF";
const MUTED = "#A8B4D8";
const FOOT = "#7C8AB5";

/** Long city names have to shrink or they wrap into the species row. */
function nameSize(name: string): number {
  if (name.length > 22) return 72;
  if (name.length > 14) return 82;
  return 92;
}

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

export default async function CityOpengraphImage({
  params,
}: {
  params: Promise<{ province: string; city: string }>;
}) {
  const { province: provinceParam, city: citySlug } = await params;

  // A card is decoration. This route prerenders alongside the page, so a
  // throw here would fail the build on a transient upstream 500 rather than
  // lose a nicety.
  const [hierarchy, guides] = await Promise.all([
    fetchHierarchy().catch(() => null),
    fetchCityGuides(citySlug).catch(() => null),
  ]);

  const province = hierarchy ? getFishingProvince(hierarchy, provinceParam) : null;
  const city = getFishingCity(province, citySlug);

  if (!city) {
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
            <div
              style={{ fontSize: 32, color: MUTED, maxWidth: 880, lineHeight: 1.35 }}
            >
              Tides, weather, water conditions, and regulations in one fishing
              score for the BC and Washington coasts.
            </div>
          </div>
        </Shell>
      ),
      { ...size },
    );
  }

  const roster = (guides?.guides ?? []).slice(0, 4).map((g) => g.species_name);

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
              {city.provinceName}
            </div>
            <div
              style={{
                fontSize: nameSize(city.name),
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: "-0.03em",
                maxWidth: 1000,
              }}
            >
              {/* One text node, not two. Satori requires an explicit
                  `display` on any div with more than one child, and
                  `Fishing {city.name}` is a string plus an expression. */}
              {`Fishing ${city.name}`}
            </div>
            {roster.length > 0 ? (
              <div
                style={{ display: "flex", gap: 14, flexWrap: "wrap", maxWidth: 1000 }}
              >
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
