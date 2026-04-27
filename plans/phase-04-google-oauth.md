# Phase 4 — Auth: Google OAuth

1 day. Adds Google as primary path on top of existing email/password.

## Setup

1. Google Cloud Console → OAuth 2.0 Client ID, configure JS origins + redirect URI to `<supabase-url>/auth/v1/callback`.
2. Supabase Dashboard → Authentication → Providers → Google → paste client ID + secret.

No env vars needed in code (Supabase holds them).

## Code changes

- `src/contexts/auth-context.tsx` — add `signInWithGoogle()` calling `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/callback } })`.
- `src/app/login/` + `src/app/signup/` — add Google button above email/password form.
- `src/app/auth/callback/route.ts` (existing) — verify it handles the OAuth code exchange; add unit-prefs handoff:
  - On first login (check `user_settings` row absence), copy localStorage prefs (`windUnit`, `tempUnit`, `precipUnit`, `heightUnit`) into the new `user_settings` row.

## Magic link

Stays disabled per spec — note in auth dialog: "Sign in with Google or email/password". Don't surface magic link button.

## Verification

- New Google sign-in creates a `user_settings` row.
- Existing email/password still works.
- localStorage prefs land in the new row on first sign-in.
