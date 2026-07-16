// Shared chart-curve math for the spot page's hourly series.

/**
 * Monotone cubic (Fritsch–Carlson) interpolation between adjacent hourly
 * samples. Unlike per-segment cosine easing — whose slope is forced to zero at
 * every sample, scalloping a steadily rising/falling series — the tangents
 * come from neighbouring secants, so the curve is smooth through each hour and
 * only flattens at true highs/lows. The limiter keeps it from overshooting the
 * sampled values, so the curve never exceeds an annotated high/low.
 */
export function monoInterp(arr: (number | null)[], t: number): number | null {
  const num = (v: number | null | undefined) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const n = arr.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(t)));
  const j = Math.min(n - 1, i + 1);
  const a = num(arr[i]), b = num(arr[j]);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  const d = b - a;
  // One-sided secants stand in at array ends and null gaps.
  const prev = i > 0 ? num(arr[i - 1]) : null;
  const next = j < n - 1 ? num(arr[j + 1]) : null;
  const d0 = prev == null ? d : a - prev;
  const d2 = next == null ? d : next - b;
  let m0 = d0 * d <= 0 ? 0 : (d0 + d) / 2;
  let m1 = d * d2 <= 0 ? 0 : (d + d2) / 2;
  if (d === 0) {
    m0 = 0; m1 = 0;
  } else {
    m0 = Math.sign(d) * Math.min(Math.abs(m0), 3 * Math.abs(d));
    m1 = Math.sign(d) * Math.min(Math.abs(m1), 3 * Math.abs(d));
  }
  const f = t - i, f2 = f * f, f3 = f2 * f;
  return (
    (2 * f3 - 3 * f2 + 1) * a + (f3 - 2 * f2 + f) * m0 +
    (-2 * f3 + 3 * f2) * b + (f3 - f2) * m1
  );
}
