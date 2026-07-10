import { Page, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export interface TestUser {
  email: string;
  password: string;
}

export const freeUser: TestUser = env.freeUser;
export const proUser: TestUser = env.proUser;

function adminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      'Supabase admin credentials missing — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.test',
    );
  }
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Sign in via the public /login page and assert we land somewhere authenticated.
 * Pages that redirect on auth (login/signup → /explore) settle to whatever URL.
 * Specs that need a specific landing page should navigate after this returns.
 */
export async function loginAs(page: Page, user: TestUser) {
  if (!user.email || !user.password) {
    throw new Error('Test user credentials missing in .env.test');
  }
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  // The login page also has a "Sign in with Google" OAuth button — match the
  // submit button exactly so we don't trigger strict-mode ambiguity.
  await page.getByRole('button', { name: /^(sign in|log in)$/i }).click();
  // Wait for navigation away from /login to confirm auth landed.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

export async function logout(page: Page) {
  await page.evaluate(async () => {
    // Clear Supabase session in localStorage
    Object.keys(localStorage)
      .filter((k) => k.includes('supabase') || k.startsWith('sb-'))
      .forEach((k) => localStorage.removeItem(k));
  });
  await page.context().clearCookies();
}

/**
 * Resolve a user's auth.users id by email.
 */
export async function getUserId(email: string): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const found = data.users.find((u) => u.email === email);
  if (!found) throw new Error(`Test user not found: ${email}`);
  return found.id;
}

/**
 * Flip a user's tier directly in user_settings (bypassing Stripe).
 * Use ONLY in tests that don't exercise the Stripe flow.
 */
export async function setUserTier(
  email: string,
  tier: 'free' | 'pro_monthly' | 'pro_annual',
  status: 'none' | 'active' | 'trialing' | 'canceled' = tier === 'free' ? 'none' : 'active',
) {
  const admin = adminClient();
  const userId = await getUserId(email);
  await admin.from('user_settings').upsert(
    {
      user_id: userId,
      subscription_tier: tier,
      subscription_status: status,
    },
    { onConflict: 'user_id' },
  );
}

/**
 * Wipe alerts/favorites/onboarding for a test user so each spec starts clean.
 * Does NOT delete the user (Stripe customer ID persists across runs).
 */
export async function resetUserState(email: string) {
  const admin = adminClient();
  const userId = await getUserId(email);
  await Promise.all([
    admin.from('user_alert_profiles').delete().eq('user_id', userId),
    admin.from('favorite_spots').delete().eq('user_id', userId),
    admin
      .from('user_settings')
      .update({ onboarding_completed_at: null })
      .eq('user_id', userId),
  ]);
}

export { expect };
