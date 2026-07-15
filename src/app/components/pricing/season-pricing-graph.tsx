import { MONTHLY_PRICE_TABLE } from '@/lib/pricing';

interface Props {
  currentMonth: number; // 1-12
}

const W = 720;
const H = 240;
const PAD_X = 40;
const PAD_Y = 36;

// Hex values mirror the rc-* tokens used in CSS — SVG can't read CSS vars
// directly, so we keep them in sync with `globals.css` by hand.
const COLOR_GRID = '#DEE2EA'; // rc-rule
const COLOR_AXIS_TEXT = '#8A92A4'; // rc-ink-mute
const COLOR_LINE = '#1E40E0'; // rc-brand
const COLOR_AREA = '#1E40E0';
const COLOR_DOT = '#1E40E0';
const COLOR_DOT_STROKE = '#FFFFFF'; // rc-panel — the card background behind the graph
const COLOR_DOT_CURRENT = '#16A34A'; // rc-good
const COLOR_LABEL_CURRENT = '#0B1220'; // rc-ink

export function SeasonPricingGraph({ currentMonth }: Props) {
  const minPrice = 5;
  const maxPrice = 15;
  const priceRange = maxPrice - minPrice;

  const xFor = (idx: number) =>
    PAD_X + (idx * (W - PAD_X * 2)) / (MONTHLY_PRICE_TABLE.length - 1);
  const yFor = (cents: number) => {
    const dollars = cents / 100;
    const t = (dollars - minPrice) / priceRange;
    return H - PAD_Y - t * (H - PAD_Y * 2);
  };

  const linePath = MONTHLY_PRICE_TABLE.map((m, i) => {
    const x = xFor(i);
    const y = yFor(m.amountCents);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const areaPath =
    `${linePath} L ${xFor(MONTHLY_PRICE_TABLE.length - 1)} ${H - PAD_Y} L ${xFor(0)} ${H - PAD_Y} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Seasonal monthly pricing curve, January through December"
      className="w-full h-auto"
    >
      {/* Y-axis grid */}
      {[5, 10, 15].map((dollars) => (
        <g key={dollars}>
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={yFor(dollars * 100)}
            y2={yFor(dollars * 100)}
            stroke={COLOR_GRID}
            strokeDasharray="3 3"
          />
          <text
            x={PAD_X - 8}
            y={yFor(dollars * 100) + 4}
            fontSize="11"
            fill={COLOR_AXIS_TEXT}
            textAnchor="end"
            fontFamily="system-ui, sans-serif"
          >
            ${dollars}
          </text>
        </g>
      ))}

      {/* Filled area under curve */}
      <path d={areaPath} fill={COLOR_AREA} fillOpacity="0.09" />

      {/* Line */}
      <path d={linePath} stroke={COLOR_LINE} strokeWidth="2.5" fill="none" />

      {/* Month dots + labels */}
      {MONTHLY_PRICE_TABLE.map((m, i) => {
        const isCurrent = m.month === currentMonth;
        const x = xFor(i);
        const y = yFor(m.amountCents);
        return (
          <g key={m.month}>
            <circle
              cx={x}
              cy={y}
              r={isCurrent ? 7 : 4}
              fill={isCurrent ? COLOR_DOT_CURRENT : COLOR_DOT}
              stroke={COLOR_DOT_STROKE}
              strokeWidth="2"
            />
            {isCurrent && (
              <text
                x={x}
                y={y - 14}
                fontSize="11"
                fill={COLOR_LABEL_CURRENT}
                textAnchor="middle"
                fontFamily="system-ui, sans-serif"
                fontWeight="600"
              >
                ${(m.amountCents / 100).toFixed(0)} now
              </text>
            )}
            <text
              x={x}
              y={H - PAD_Y + 18}
              fontSize="11"
              fill={isCurrent ? COLOR_LABEL_CURRENT : COLOR_AXIS_TEXT}
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontWeight={isCurrent ? '700' : '400'}
            >
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
