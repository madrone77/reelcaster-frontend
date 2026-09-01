/**
 * GET /api/cron/weekend-digest
 *
 * The Thursday 4pm send. One digest per city, to every confirmed subscriber
 * of that city who has not unsubscribed.
 *
 * ── Why it runs hourly rather than at one time ───────────────────────────
 *
 * Vercel schedules crons in UTC and the cities served here observe daylight
 * saving, so any fixed UTC time is 4pm for half the year and 3pm or 5pm for
 * the other half. Instead this wakes every hour on Thursday and Friday UTC
 * (Thursday afternoon on the Pacific coast straddles both UTC days) and sends
 * only for cities whose OWN local clock reads Thursday 16:00. Adding a city
 * in another timezone needs no schedule change.
 *
 * ── Why a cooldown rather than a sent-this-week flag ─────────────────────
 *
 * A retry, a redeploy mid-run, or a second invocation inside the same hour
 * must not send twice. `last_sent_at` plus a three-day floor makes a repeat
 * physically impossible without needing a separate "week" concept that would
 * itself need a timezone.
 *
 * GET, not POST. Vercel Cron issues GET, and a POST-only route answers with
 * 405 forever without anything appearing to be wrong.
 */

import { NextResponse } from "next/server";
import {
  alertAdmin,
  RESEND_COOLDOWN_DAYS,
  WEEKEND_ALERT_TABLE,
} from "@/lib/weekend-alert";
import { sendEmail } from "@/lib/email-service";
import { weekendDigestEmail } from "@/lib/email-templates/weekend-alert";
import { sendSms, isTwilioConfigured } from "@/lib/twilio";
import { fetchCityToday, fetchMapSpots } from "@/lib/bluecaster";
import { FREE_FORECAST_DAYS } from "@/lib/forecast-horizon";
import { siteUrl } from "@/lib/site";
import { formatHour12 } from "@/lib/time-format";
import { buildHubData, rankSpots } from
  "@/app/fishing/[country]/[state]/[city]/hub/hub-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Fan-out over cities plus a send per subscriber. Well inside the ceiling,
 *  but the default 10s is not enough for a real list. */
export const maxDuration = 300;

const SEND_WEEKDAY = "Thu";
const SEND_HOUR = 16;
/** Spots named in the digest. Three is a teaser; the link is the product. */
const DIGEST_SPOTS = 3;

interface Row {
  id: string;
  city_slug: string;
  province_code: string;
  channel: "email" | "sms";
  email: string | null;
  phone: string | null;
  unsubscribe_token: string;
  last_sent_at: string | null;
}

/** Is it Thursday 4pm where this city is? */
function isSendTime(tz: string, now: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return weekday === SEND_WEEKDAY && hour === SEND_HOUR;
}

export async function GET(request: Request) {
  // Closed rather than open when the secret is unset: this route emails and
  // texts customers.
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const admin = alertAdmin();
  const cutoff = new Date(
    now.getTime() - RESEND_COOLDOWN_DAYS * 24 * 3600 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from(WEEKEND_ALERT_TABLE)
    .select(
      "id, city_slug, province_code, channel, email, phone, unsubscribe_token, last_sent_at",
    )
    .not("confirmed_at", "is", null)
    .is("unsubscribed_at", null)
    .or(`last_sent_at.is.null,last_sent_at.lt.${cutoff}`);

  if (error) {
    console.error("[weekend-digest] subscriber read failed", error.message);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const byCity = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byCity.get(row.city_slug);
    if (list) list.push(row);
    else byCity.set(row.city_slug, [row]);
  }

  let sent = 0;
  let skipped = 0;
  const cities: string[] = [];

  for (const [citySlug, subscribers] of byCity) {
    const today = await fetchCityToday(citySlug, FREE_FORECAST_DAYS);
    if (!today) {
      skipped += subscribers.length;
      continue;
    }
    if (!isSendTime(today.city.tz, now)) {
      skipped += subscribers.length;
      continue;
    }

    const payload = await fetchMapSpots({ city: citySlug });
    const inCity = new Set((payload?.spots ?? []).map((s) => s.id));
    const hub = buildHubData(payload, inCity);
    const headlineId = today.headline?.species_id ?? null;
    const top = rankSpots(hub.spots, headlineId, DIGEST_SPOTS);

    // The headline number and the window come off the SAME row the digest
    // leads with, for the reason the page had to be fixed for: BlueCaster
    // computes `headline.window` at whichever spot leads the city on daily
    // mean, this ranks on peak and then track record, and quoting one above
    // a list ordered by the other put "best 6 AM to 8 AM" directly above a
    // first entry reading 7 PM to 9 PM.
    const lead = top[0];
    const speciesName = today.headline?.species_name ?? null;
    const win = lead?.entry.window ?? today.headline?.window ?? null;
    const hours = lead?.entry.good_hours ?? today.headline?.good_hours ?? 0;
    const verdictLine = speciesName
      ? `${hours} fishable hour${hours === 1 ? "" : "s"} for ${speciesName}${
          win
            ? `, best ${formatHour12(win.start_hour)} to ${formatHour12((win.end_hour + 1) % 24)}`
            : ""
        }`
      : `Today's outlook for ${today.city.name}`;

    const aheadLine = today.ahead.best
      ? `Best day ahead: ${
          today.ahead.best.days_out === 1
            ? "tomorrow"
            : `in ${today.ahead.best.days_out} days`
        }, ${today.ahead.best.good_hours} hours for ${today.ahead.best.species_name}.`
      : null;

    const provinceCode = (subscribers[0]?.province_code ?? "").toLowerCase();
    const cityUrl = siteUrl(`/fishing/${provinceCode}/${citySlug}?source=weekend`);

    cities.push(citySlug);

    for (const sub of subscribers) {
      const unsubscribeUrl = siteUrl(
        `/api/weekend-alert/unsubscribe?token=${encodeURIComponent(sub.unsubscribe_token)}`,
      );

      let ok = false;

      if (sub.channel === "email" && sub.email) {
        const { subject, html } = weekendDigestEmail({
          cityName: today.city.name,
          verdictLine,
          speciesName,
          spots: top.map(({ spot, entry }) => ({
            name: spot.name,
            score: entry.peak,
            window: entry.window
              ? `${formatHour12(entry.window.start_hour)} to ${formatHour12((entry.window.end_hour + 1) % 24)}`
              : null,
            url: siteUrl(`/explore/spot/${spot.slug}`),
          })),
          aheadLine,
          cityUrl,
          unsubscribeUrl,
        });
        const res = await sendEmail({ to: sub.email, subject, html });
        ok = res.success;
      } else if (sub.channel === "sms" && sub.phone && isTwilioConfigured()) {
        const body =
          `${today.city.name}: ${verdictLine}.` +
          (lead ? ` Leading at ${lead.spot.name} (${lead.entry.peak}).` : "") +
          ` ${cityUrl}` +
          // Carriers expect the opt-out keyword in the message itself, not
          // only at signup.
          ` Reply STOP to end.`;
        const res = await sendSms(sub.phone, body);
        ok = res.ok;
      }

      if (!ok) continue;

      await admin
        .from(WEEKEND_ALERT_TABLE)
        .update({ last_sent_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("id", sub.id);
      sent += 1;
    }
  }

  return NextResponse.json({ sent, skipped, cities });
}
