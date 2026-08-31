import { ImageResponse } from "next/og";
import { readShareCard } from "@/lib/share-cards-server";
import { SHARE_CARD_MARK } from "@/lib/share-card-mark";
import {
  CARD_BAR,
  CARD_INK,
  CARD_INK_MUTE,
  CARD_INK_SOFT,
  CARD_PAPER,
  CARD_RULE,
  CARD_TIER,
  TIER_HEADLINE,
  dayLabel,
  headSizeFor,
  headlineText,
  spotLineSizeFor,
  windowLabel,
} from "@/lib/share-cards";

// The share card: one fishing day, frozen, at its own URL.
//
// Unlike the spot page's evergreen card, this one carries a date and a verdict,
// which is only safe because /s/<token> is immutable — see the share_cards
// migration for why a per-share URL is the whole mechanism.
//
// DESIGNED FOR TWO READING DISTANCES. An iMessage bubble is about 280pt wide,
// so this 1200x630 canvas renders at roughly 0.235 scale and every size here
// divides by four. At that size only three things survive: the headline, the
// tier pill, and the one tall coloured bar. The instrument rail is deliberately
// a reward for tapping, not a promise to the thread — trying to make it legible
// in the bubble would need 60px type and there is no room for it.
export const alt = "ReelCaster fishing forecast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BAR_MAX = 118;
const BAR_MIN = 18;

/**
 * Bar heights, scaled to the range actually present rather than to 0-100.
 *
 * Scores sit in a 70-90 band, so a zeroed axis draws fourteen near-identical
 * bars and says nothing. Scaling to the visible range is what makes "this day
 * stands out" a picture instead of a claim. It also flatters — that is the
 * known cost of the choice, and the reason the axis is never labelled.
 */
function barHeights(series: (number | null)[]): (number | null)[] {
  const values = series.filter((v): v is number => typeof v === "number");
  if (!values.length) return series.map(() => null);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const floor = Math.max(0, min - 3);
  const span = Math.max(1, max - floor);
  return series.map((v) =>
    typeof v === "number"
      ? BAR_MIN + ((v - floor) / span) * (BAR_MAX - BAR_MIN)
      : null,
  );
}

function Rail({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 0,
        borderTop: `1px solid ${CARD_RULE}`,
        paddingTop: 14,
      }}
    >
      {/* Fixed label column so the three readings line up. "CURRENT" is five
          characters longer than "TIDE", and self-sizing labels staggered every
          value to a different x.
      
          The widths are a budget, not a guess. The rail gives 376px of content;
          the label takes 132 and the longest realistic reading ("Flood -10.2
          ft", a big minus tide) needs about 238 at 32px. `nowrap` on both is
          what guarantees it: a value that ever outgrew the column would WRAP
          rather than shrink, and a two-line reading is exactly what this rail
          exists to avoid. */}
      <div
        style={{
          display: "flex",
          width: 132,
          flexShrink: 0,
          whiteSpace: "nowrap",
          fontSize: 22,
          letterSpacing: "0.08em",
          color: CARD_INK_MUTE,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 32, whiteSpace: "nowrap", color: CARD_INK }}>
        {value}
      </div>
    </div>
  );
}

export default async function ShareCardImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const card = await readShareCard(token).catch(() => null);

  // A card is decoration. An unreadable token still owes the scraper an image,
  // and throwing here would leave the unfurl blank rather than lose a nicety.
  if (!card) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: CARD_PAPER,
            padding: "56px 64px",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 600, color: CARD_INK }}>
            Know the bite before you go.
          </div>
          <img src={SHARE_CARD_MARK} width={122} height={56} alt="" style={{ marginTop: 40 }} />
        </div>
      ),
      size,
    );
  }

  const tier = CARD_TIER[card.tier];
  const head = TIER_HEADLINE[card.tier];
  const headSize = headSizeFor(headlineText(card.tier));
  const heights = barHeights(card.series);

  const spotLine = card.speciesName
    ? `${card.spotName} · ${card.speciesName}`
    : card.spotName;
  const win = windowLabel(card.windowStartHour, card.windowEndHour);
  const whenLine = win
    ? `${dayLabel(card.targetDate)} · ${win}`
    : dayLabel(card.targetDate);

  const rails: Array<{ label: string; value: string }> = [];
  if (card.tide) rails.push({ label: "TIDE", value: card.tide });
  if (card.wind) rails.push({ label: "WIND", value: card.wind });
  if (card.current) rails.push({ label: "CURRENT", value: card.current });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: CARD_PAPER,
          padding: "56px 64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* The headline leads. It is also the safest place on the canvas: the
            clients that render a preview closer to square crop from the edges. */}
        <div
          style={{
            display: "flex",
            whiteSpace: "pre",
            fontSize: headSize,
            fontWeight: 600,
            color: CARD_INK,
            lineHeight: 1.05,
          }}
        >
          <span>{head.lead}</span>
          <span style={{ color: tier.fill }}>{head.word}</span>
          <span>{head.tail}</span>
        </div>

        <div style={{ display: "flex", flex: 1, gap: 52, marginTop: 34 }}>
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "flex-end",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 9,
                height: BAR_MAX,
              }}
            >
              {heights.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flex: 1,
                    height: h ?? 8,
                    borderRadius: 3,
                    background:
                      h === null
                        ? CARD_RULE
                        : i === card.seriesDayIndex
                          ? tier.fill
                          : CARD_BAR,
                  }}
                />
              ))}
            </div>

            <div
              style={{
                fontSize: spotLineSizeFor(spotLine),
                fontWeight: 600,
                color: CARD_INK,
                marginTop: 20,
              }}
            >
              {spotLine}
            </div>
            <div style={{ fontSize: 34, color: CARD_INK_SOFT, marginTop: 6 }}>
              {whenLine}
            </div>
          </div>

          {/* Instrument rail. Rows render only when the reading exists — the
              current series is Salish Sea only, so a spot outside that grid
              shows two rows rather than a hole. */}
          <div
            style={{
              display: "flex",
              width: 420,
              flexShrink: 0,
              flexDirection: "column",
              justifyContent: "space-between",
              borderLeft: `1px solid ${CARD_RULE}`,
              paddingLeft: 44,
            }}
          >
            <div style={{ display: "flex" }}>
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  color: tier.pillInk,
                  background: tier.pillBg,
                  padding: "14px 32px",
                  borderRadius: 12,
                }}
              >
                {card.tier.toUpperCase()}
              </div>
            </div>
            {rails.map((r) => (
              <Rail key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </div>

        {/* Logo only. iMessage prints the domain under the card already, so a
            URL here said it twice. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderTop: `1px solid ${CARD_RULE}`,
            marginTop: 22,
            paddingTop: 20,
          }}
        >
          <img src={SHARE_CARD_MARK} width={218} height={100} alt="" />
        </div>
      </div>
    ),
    {
      ...size,
      headers: {
        // The row behind this image never changes, so the render is safe to
        // keep forever. Unfurlers scrape once and never re-poll anyway.
        "cache-control": "public, immutable, no-transform, max-age=31536000",
      },
    },
  );
}
