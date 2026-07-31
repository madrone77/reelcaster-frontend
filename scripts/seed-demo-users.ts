/**
 * One-shot demo user seed for the Public → Free → Pro user-journey audit.
 *
 * Creates two test accounts in the frontend Supabase project:
 *   - free@reelcaster.test  → tier=free, status=canceled, onboarding completed
 *   - pro@reelcaster.test   → tier=pro_annual, status=active, 5 favorite_spots seeded
 *
 * The pro user is pre-seeded with 5 favorites — more than a free account may
 * hold (FREE_FAVORITE_SPOTS is 1), so the Pro specs start from a state that
 * only Pro can reach. The free user is seeded with none; its cap journey adds
 * one and expects the second to be refused. Both users have
 * onboarding_completed_at set so the modal doesn't pop on dashboard load.
 *
 * Run:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/seed-demo-users.ts
 *
 * Idempotent: re-running upserts settings + favorites without re-creating users.
 *
 * On first run, the script creates the auth.users rows with random passwords
 * and PRINTS them to stdout — capture and write into .env.test.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FREE_EMAIL = "free@reelcaster.test";
const PRO_EMAIL = "pro@reelcaster.test";

const PRO_FAVORITES = [
  { name: "Brotchie Ledge", location: "Victoria BC", lat: 48.4127, lon: -123.3805, slug: "brotchie-ledge" },
  { name: "Oak Bay Flats", location: "Victoria BC", lat: 48.4232, lon: -123.3010, slug: "oak-bay-flats" },
  { name: "Constance Bank", location: "Victoria BC", lat: 48.3920, lon: -123.4250, slug: "constance-bank" },
  { name: "Race Rocks", location: "Victoria BC", lat: 48.2980, lon: -123.5310, slug: "race-rocks" },
  { name: "Pedder Bay", location: "Victoria BC", lat: 48.3450, lon: -123.5530, slug: "pedder-bay" },
];

function genPassword(): string {
  // Strong-enough random password for test accounts.
  return crypto.randomBytes(18).toString("base64").replace(/[+/=]/g, "");
}

async function ensureUser(email: string): Promise<{ id: string; password: string | null }> {
  // Look up existing user via admin listUsers — there's no get-by-email primitive.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    console.log(`  ✓ user already exists: ${email} (${existing.id})`);
    return { id: existing.id, password: null };
  }
  const password = genPassword();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  console.log(`  ✓ created ${email} (${data.user.id})`);
  return { id: data.user.id, password };
}

async function setSettings(
  userId: string,
  tier: "free" | "pro_annual",
  status: "canceled" | "active",
) {
  const periodEnd =
    tier === "pro_annual"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      subscription_tier: tier,
      subscription_status: status,
      subscription_period_end: periodEnd,
      onboarding_completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
  console.log(`  ✓ user_settings ${tier}/${status}`);
}

async function seedProFavorites(userId: string) {
  // Wipe existing then insert exactly 5. Idempotent: same input → same output.
  const { error: delErr } = await supabase
    .from("favorite_spots")
    .delete()
    .eq("user_id", userId);
  if (delErr) throw delErr;
  const rows = PRO_FAVORITES.map((f) => ({
    user_id: userId,
    name: f.name,
    location: f.location,
    lat: f.lat,
    lon: f.lon,
    slug: f.slug,
  }));
  const { error: insErr } = await supabase.from("favorite_spots").insert(rows);
  if (insErr) throw insErr;
  console.log(`  ✓ 5 favorite_spots seeded`);
}

async function main() {
  console.log("=== seed-demo-users.ts ===");
  console.log(`Supabase URL: ${SUPABASE_URL}`);

  console.log(`\n--- ${FREE_EMAIL} ---`);
  const free = await ensureUser(FREE_EMAIL);
  await setSettings(free.id, "free", "canceled");
  if (free.password) {
    console.log(`\n  TEST_FREE_USER_PASSWORD="${free.password}"`);
  }

  console.log(`\n--- ${PRO_EMAIL} ---`);
  const pro = await ensureUser(PRO_EMAIL);
  await setSettings(pro.id, "pro_annual", "active");
  await seedProFavorites(pro.id);
  if (pro.password) {
    console.log(`\n  TEST_PRO_USER_PASSWORD="${pro.password}"`);
  }

  console.log(
    "\n✅ Seed complete. Capture any TEST_*_PASSWORD lines above into .env.test.",
  );
  console.log(
    "   (Passwords print only on first creation — subsequent runs leave existing accounts untouched.)",
  );
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
