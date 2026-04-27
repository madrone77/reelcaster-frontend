# Phase 6 — Alerts: simple Score flow + Twilio SMS + `/alerts`

1 day. Reuses existing custom-alert engine.

## Route

- `src/app/alerts/page.tsx` (NEW) — primary alerts surface. Default tab "Score Alerts", second tab "Advanced" (renders existing `<CustomAlertsList />`).
- `redirect()` from `/profile/custom-alerts` → `/alerts?tab=advanced`.

## Components

- `src/app/components/alerts/score-alert-form.tsx` (NEW):
  - Spot picker: search bluecaster spots OR pick from `favorite_spots`.
  - Species picker.
  - Threshold slider 0–100 (default 70).
  - Delivery channels: email (default on), SMS (only enabled if `phone_verified=true`; otherwise shows "Verify phone" button).
  - Active hours (default 6am–10pm in user TZ).
  - Submit → POST `/api/alerts` with payload that maps to existing JSONB schema:
    ```json
    { "alert_kind": "score", "target_spot_id": "<favorite_id_or_null>", "target_species": "chinook",
      "score_threshold": 70, "delivery_channels": ["email","sms"],
      "triggers": { "fishing_score": { "enabled": true, "min_score": 70, "species": "chinook" } } }
    ```

## Engine

- `src/lib/custom-alert-engine.ts` — small enhancement: when `alert_kind='score'`, query Phase 2 14-day forecast endpoint instead of recomputing. Dedupe per-day per-alert via `last_triggered_at`.

## Twilio

- `src/lib/twilio.ts` (NEW) — thin wrapper for `messages.create()` and Verify API.
- `src/app/api/alerts/verify-phone/route.ts` (NEW):
  - POST `/start` → Twilio Verify sends OTP to user's number.
  - POST `/check` → confirm OTP → set `phone_e164` + `phone_verified=true`.
- `src/app/api/twilio/webhook/route.ts` (NEW) — inbound SMS handler. STOP → `phone_verified=false`. HELP → reply with help text.
- `src/app/api/alerts/evaluate/route.ts` (existing 30-min cron) — extend to dispatch SMS where `delivery_channels` contains 'sms' AND `phone_verified=true`.

## Email + SMS templates

- `src/lib/email-templates/score-alert.ts` (NEW) — subject "Chinook peak today at Pedder Bay — 82 at 11am", body per spec.
- SMS body (Twilio 1600-char limit, target ≤300):
  > ReelCaster: Chinook peak 82 at Pedder Bay, 11am today. <link> Reply STOP to opt out.

## Tier gating

- Free: 1 active alert max (DB constraint or app-level check in POST `/api/alerts`).
- Paid: unlimited.

## Verification

- Verify phone flow: receive OTP, enter, sees "Verified" badge.
- Create simple score alert → cron picks up → email + SMS dispatched within 30 min when score crosses threshold.
- STOP keyword: `phone_verified=false`, subsequent alerts don't dispatch SMS.
- Free user: 2nd alert creation blocked with upgrade CTA.
