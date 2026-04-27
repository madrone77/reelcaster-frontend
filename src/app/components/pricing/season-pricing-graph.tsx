import { MONTHLY_PRICE_TABLE } from '@/lib/pricing';

interface Props {
  currentMonth: number; // 1-12
}

const W = 720;
const H = 240;
const PAD_X = 40;
const PAD_Y = 36;

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
            stroke="#e7e5e4"
            strokeDasharray="3 3"
          />
          <text
            x={PAD_X - 8}
            y={yFor(dollars * 100) + 4}
            fontSize="11"
            fill="#78716c"
            textAnchor="end"
            fontFamily="system-ui, sans-serif"
          >
            ${dollars}
          </text>
        </g>
      ))}

      {/* Filled area under curve */}
      <path d={areaPath} fill="#0f172a" fillOpacity="0.06" />

      {/* Line */}
      <path d={linePath} stroke="#0f172a" strokeWidth="2.5" fill="none" />

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
              fill={isCurrent ? '#10b981' : '#0f172a'}
              stroke="#fff"
              strokeWidth="2"
            />
            {isCurrent && (
              <text
                x={x}
                y={y - 14}
                fontSize="11"
                fill="#0f172a"
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
              fill={isCurrent ? '#0f172a' : '#78716c'}
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
