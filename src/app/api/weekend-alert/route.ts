/**
 * Weekend Bite Alert capture.
 *
 * POST /api/weekend-alert  { city, province, contact, species?, source? }
 *   Email  -> row written, confirmation email sent, { status: 'check-email' }
 *   Phone  -> row written, Twilio Verify code sent,  { status: 'code-sent' }
 *
 * PUT /api/weekend-alert   { city, phone, code }
 *   Confirms an SMS subscription against the code Verify issued.
 *
 * ── Why the response never distinguishes new from existing ───────────────
 *
 * An endpoint that says "already subscribed" for one address and "check your
 * email" for another is an address oracle: anyone can test whether a given
 * person is on this list. Both paths return the same body, and a repeat
 * signup simply re-sends the confirmation.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  alertAdmin,
  classify,
  token,
  WEEKEND_ALERT_TABLE,
} from "@/lib/weekend-alert";
import { sendEmail } from "@/lib/email-service";
import { weekendAlertConfirmEmail } from "@/lib/email-templates/weekend-alert";
import {
  checkPhoneVerification,
  isVerifyConfigured,
  startPhoneVerification,
} from "@/lib/twilio";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Capture fields are short. Anything longer is a probe, not a subscriber. */
const MAX_FIELD = 200;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return bad("Invalid body");

  const contact = String(body.contact ?? "").slice(0, MAX_FIELD);
  const citySlug = String(body.city ?? "").slice(0, MAX_FIELD);
  const provinceCode = String(body.province ?? "").slice(0, 8).toUpperCase();
  const cityName = String(body.cityName ?? citySlug).slice(0, MAX_FIELD);
  const speciesSlug = body.species ? String(body.species).slice(0, MAX_FIELD) : null;
  const source = body.source ? String(body.source).slice(0, MAX_FIELD) : null;

  if (!citySlug || !provinceCode) return bad("Missing city");

  const parsed = classify(contact);
  if (!parsed) {
    return bad("Enter an email address or a mobile number");
  }

  if (parsed.channel === "sms" && !isVerifyConfigured()) {
    return NextResponse.json(
      {
        error: "Text alerts are not switched on yet. Leave an email instead.",
        reason: "sms-not-configured",
      },
      { status: 503 },
    );
  }

  const admin = alertAdmin();
  const confirmToken = token();
  const unsubscribeToken = token();

  // Upsert on the address, so a second signup re-sends rather than colliding
  // with the unique index. `confirm_token` is rotated every time: the link in
  // the newest email is the one that works.
  const { data: existing } = await admin
    .from(WEEKEND_ALERT_TABLE)
    .select("id, confirm_token, unsubscribe_token, confirmed_at")
    .eq("city_slug", citySlug)
    .eq(parsed.channel === "email" ? "email" : "phone", parsed.email ?? parsed.phone)
    .maybeSingle();

  let rowConfirmToken = confirmToken;

  if (existing) {
    rowConfirmToken = existing.confirmed_at ? existing.confirm_token : confirmToken;
    const { error } = await admin
      .from(WEEKEND_ALERT_TABLE)
      .update({
        confirm_token: rowConfirmToken,
        confirm_sent_at: new Date().toISOString(),
        species_slug: speciesSlug,
        source,
        // Someone re-subscribing has un-unsubscribed themselves.
        unsubscribed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[weekend-alert] update failed", error.message);
      return bad("Could not save that. Try again.", 500);
    }
  } else {
    const { error } = await admin.from(WEEKEND_ALERT_TABLE).insert({
      city_slug: citySlug,
      province_code: provinceCode,
      channel: parsed.channel,
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      species_slug: speciesSlug,
      confirm_token: confirmToken,
      confirm_sent_at: new Date().toISOString(),
      unsubscribe_token: unsubscribeToken,
      source,
      user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
    });
    if (error) {
      console.error("[weekend-alert] insert failed", error.message);
      return bad("Could not save that. Try again.", 500);
    }
  }

  if (parsed.channel === "email") {
    const { subject, html } = weekendAlertConfirmEmail({
      cityName,
      confirmUrl: siteUrl(
        `/api/weekend-alert/confirm?token=${encodeURIComponent(rowConfirmToken)}`,
      ),
    });
    const sent = await sendEmail({ to: parsed.email!, subject, html });
    if (!sent.success) {
      console.error("[weekend-alert] confirm email failed", sent.error);
    }
    // Still 200 on a send failure: the row exists, and telling a visitor
    // their address is broken when our mailer is the thing that broke would
    // be a lie they cannot act on.
    return NextResponse.json({ status: "check-email" });
  }

  const started = await startPhoneVerification(parsed.phone!);
  if (!started.ok) {
    return bad("Could not text that number. Try an email instead.", 502);
  }
  return NextResponse.json({ status: "code-sent" });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return bad("Invalid body");

  const citySlug = String(body.city ?? "").slice(0, MAX_FIELD);
  const code = String(body.code ?? "").slice(0, 12);
  const parsed = classify(String(body.contact ?? "").slice(0, MAX_FIELD));

  if (!citySlug || !code || parsed?.channel !== "sms") {
    return bad("Enter the code we texted you");
  }
  if (!isVerifyConfigured()) return bad("Text alerts are not switched on", 503);

  // `ok` only says Twilio answered. `approved` is whether the code matched,
  // and treating a delivered 200 as a pass would confirm every subscriber who
  // typed anything at all.
  const check = await checkPhoneVerification(parsed.phone!, code);
  if (!check.ok || !check.approved) return bad("That code did not match", 400);

  const admin = alertAdmin();
  const { error } = await admin
    .from(WEEKEND_ALERT_TABLE)
    .update({ confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("city_slug", citySlug)
    .eq("phone", parsed.phone);

  if (error) {
    console.error("[weekend-alert] sms confirm failed", error.message);
    return bad("Could not confirm that. Try again.", 500);
  }
  return NextResponse.json({ status: "confirmed" });
}
