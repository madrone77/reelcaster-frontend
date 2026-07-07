"use client";

// Freemium entitlement for the fresh product.
//
// Stub for now: defaults to FREE. When auth + billing are re-authored for the
// new product (Supabase session → Stripe subscription / "Boat Pro" entitlement),
// wire that here — every gated surface (Boat-Pro forecast days, the Upgrade pill)
// reads this single hook, so flipping it on is a one-place change.
export function usePro(): { isPro: boolean; tier: "free" | "pro" } {
  const isPro = false;
  return { isPro, tier: isPro ? "pro" : "free" };
}

// Forecast days 0–6 are free; days 7–13 (the back half) are the "Boat Pro" gate
// shown in the Figma. Keep the boundary here so the strip + any copy agree.
export const FREE_FORECAST_DAYS = 7;
