/**
 * Share cards, server half — minting a snapshot and reading one back.
 *
 * Split from `share-cards.ts` so the client modals can import the copy helpers
 * without pulling Supabase and the BlueCaster fetchers into the browser bundle.
 *
 * Everything a card shows is resolved ONCE, here, and written as finished
 * display strings. See the migration for why: /s/<token> is immutable, so a
 * later change to units or formatting must not reach back and rewrite cards
 * that have already been sent to other people.
 */

import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  fetchCurrentsSeries,
  fetchSpotForecast14d,
  fetchSpotLivePage,
} from "@/lib/bluecaster";
import type { HourlyConditions } from "@/lib/bluecaster/live-spot-types";
import { timezoneFor } from "@/lib/regions";
import { tierFor } from "@/app/explore/lib/explore-data";
import { bestWindow } from "@/app/explore/lib/best-window";
import { storedFirstName } from "@/lib/display-name";
import { mToFt, round1 } from "@/lib/units";
import { cardSpeciesName, type ShareCard, type ShareTier } from "@/lib/share-cards";

export function shareAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * 16 hex characters. The token IS the credential — anyone holding the link can
 * read the card — so it has to be unguessable, and the table is service-role
 * only precisely so it can never be enumerated instead.
 */
export function newShareToken(): string {
  return randomBytes(8).toString("hex");
}

// ── Timezone ───────────────────────────────────────────────────────────

/** Milliseconds `tz` is ahead of UTC at the given instant. */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - at.getTime();
}

/**
 * A local wall time at the spot ("2026-09-06", hour 6) as a real instant.
 *
 * The hourly grids are indexed by LOCAL hour (see `fmtPeak` in explore-data,
 * which formats the index straight through with no conversion), but the
 * currents endpoint takes UTC. Guess-then-correct is exact everywhere except
 * inside the hour a DST transition moves, which no dawn window falls in.
 */
function zonedHourToUtc(targetDate: string, hour: number, tz: string): Date {
  const [y, m, d] = targetDate.split("-").map(Number);
  const guess = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hour);
  return new Date(guess - tzOffsetMs(new Date(guess), tz));
}

// ── Formatting the rail ────────────────────────────────────────────────

/**
 * "Flood 9.1 ft".
 *
 * Feet, because that is what anglers on this coast use for water — the metres
 * toggle is a preference on live surfaces, and a frozen card cannot offer one,
 * so it takes the default rather than shipping a number half the readers have
 * to convert in their head.
 */
function fmtTide(c: HourlyConditions | undefined): string | null {
  if (!c || c.tideM == null) return null;
  const ft = round1(mToFt(c.tideM));
  const trend =
    c.tideTrend === "rising" ? "Flood" : c.tideTrend === "falling" ? "Ebb" : null;
  return trend ? `${trend} ${ft} ft` : `${ft} ft`;
}

/** "8 kn SW" — "kn" matches the strip and drawer, not the email's "kt". */
function fmtWind(c: HourlyConditions | undefined): string | null {
  if (!c || c.windKt == null) return null;
  return `${Math.round(c.windKt)} kn${c.windDir ? ` ${c.windDir}` : ""}`;
}

// ── Building a snapshot ────────────────────────────────────────────────

/** Peak score and the local hour it lands on, over one day's 24 cells. */
function peakOf(series: (number | null)[] | undefined): {
  score: number | null;
  hour: number | null;
} {
  if (!series) return { score: null, hour: null };
  let score = -1;
  let hour = -1;
  for (let h = 0; h < series.length; h++) {
    const v = series[h];
    if (typeof v === "number" && v > score) {
      score = v;
      hour = h;
    }
  }
  return score >= 0 ? { score, hour } : { score: null, hour: null };
}

export interface BuildSnapshotOpts {
  slug: string;
  /** BlueCaster species id. Omitted means "whichever scores best that day". */
  speciesId?: string | null;
  /**
   * Species slug, resolved to an id against the spot's own roster. The alert
   * engine names the species it scored by slug, and the hourly grids are keyed
   * by id, so without this a card minted from an alert would silently fall back
   * to the spot's best species and could name the wrong fish.
   */
  speciesSlug?: string | null;
  /** YYYY-MM-DD in the spot's timezone. Omitted means the best of the next 14. */
  targetDate?: string | null;
}

export type ShareSnapshot = Omit<
  ShareCard,
  "token" | "createdAt" | "sharerName" | "source"
>;

/**
 * Resolve everything a card shows for one spot on one day.
 *
 * Returns null when the spot cannot be read or has no scored day to talk
 * about, which is a normal outcome (an unscored spot, a species with no grid)
 * and never an error the caller should surface.
 */
export async function buildShareSnapshot(
  opts: BuildSnapshotOpts,
): Promise<ShareSnapshot | null> {
  const [page, forecast] = await Promise.all([
    fetchSpotLivePage(opts.slug).catch(() => null),
    fetchSpotForecast14d(opts.slug).catch(() => null),
  ]);
  if (!page) return null;

  // forecast-14d is the full grid; the spot-page payload carries all 14 days
  // only for the rank-1 species, so it is the fallback, not the source.
  const daily14 = forecast?.daily14 ?? page.daily14 ?? [];
  const scoreGrid = forecast?.hourlyScoreGrid ?? page.hourlyScoreGrid ?? {};
  const condGrid = forecast?.hourlyConditionsGrid ?? page.hourlyConditionsGrid ?? [];
  if (!daily14.length) return null;

  const tz = timezoneFor(page.spot.region);

  // Which species grid to read. An explicit id wins; otherwise take whichever
  // species actually scores best over the horizon, which is how the rest of
  // the app picks a default.
  let speciesId = opts.speciesId ?? null;
  if (!speciesId && opts.speciesSlug) {
    speciesId =
      page.species.find((sp) => sp.slug === opts.speciesSlug)?.id ?? null;
  }
  if (!speciesId || !scoreGrid[speciesId]) {
    let bestId: string | null = null;
    let bestScore = -1;
    for (const [id, grid] of Object.entries(scoreGrid)) {
      for (const day of grid ?? []) {
        const p = peakOf(day);
        if (p.score !== null && p.score > bestScore) {
          bestScore = p.score;
          bestId = id;
        }
      }
    }
    speciesId = bestId;
  }
  const grid = speciesId ? scoreGrid[speciesId] : undefined;

  // The species-specific daily peak is the honest series for a card that names
  // a species; daily14[].score is the peak across ALL species at the spot.
  const series: (number | null)[] = daily14.map(
    (d, i) => peakOf(grid?.[i]).score ?? d.score ?? null,
  );

  let dayIndex = opts.targetDate
    ? daily14.findIndex((d) => d.iso === opts.targetDate)
    : -1;
  if (dayIndex < 0) {
    // No date asked for, or the day has rolled out of the horizon: fall back to
    // the best day we can actually see.
    let best = -1;
    dayIndex = 0;
    series.forEach((s, i) => {
      if (s !== null && s > best) {
        best = s;
        dayIndex = i;
      }
    });
  }

  const score = series[dayIndex];
  if (score === null || score === undefined) return null;

  const dayHours = grid?.[dayIndex];
  const peak = peakOf(dayHours);

  // The SAME rule the spot page's "Best window" callout uses. A second
  // implementation here had the card claiming "7 to 9 AM" while the page it
  // links to said "7 AM-11 AM", which is the kind of disagreement a reader
  // notices and cannot explain. The run is end-exclusive there, so the stored
  // end hour is `+ 1` to match the label.
  const win = bestWindow(dayHours ?? []);
  const start = win.window ? win.window[0] : peak.hour;
  const end = win.window ? win.window[1] + 1 : peak.hour;

  const conditions = condGrid?.[dayIndex]?.[peak.hour ?? 12];

  // Current is Salish Sea only. Outside that grid the series comes back empty
  // and the rail simply renders without that row.
  let current: string | null = null;
  if (peak.hour !== null) {
    const at = zonedHourToUtc(daily14[dayIndex].iso, peak.hour, tz);
    const currents = await fetchCurrentsSeries(
      page.spot.lat,
      page.spot.lng,
      new Date(at.getTime() - 90 * 60_000).toISOString(),
      new Date(at.getTime() + 90 * 60_000).toISOString(),
    ).catch(() => null);
    const nearest = (currents?.series ?? []).reduce<
      { speed_kn: number; gap: number } | null
    >((acc, s) => {
      const gap = Math.abs(new Date(s.t).getTime() - at.getTime());
      return !acc || gap < acc.gap ? { speed_kn: s.speed_kn, gap } : acc;
    }, null);
    if (nearest) current = `${round1(nearest.speed_kn)} kn`;
  }

  const speciesName = speciesId
    ? (page.species.find((s) => s.id === speciesId)?.name ?? null)
    : null;

  return {
    spotSlug: opts.slug,
    spotName: page.spot.name,
    speciesName: speciesName ? cardSpeciesName(speciesName) : null,
    targetDate: daily14[dayIndex].iso,
    tz,
    windowStartHour: start,
    windowEndHour: end,
    score: Math.round(score),
    tier: tierFor(Math.round(score)) as ShareTier,
    tide: fmtTide(conditions),
    wind: fmtWind(conditions),
    current,
    series,
    seriesDayIndex: dayIndex,
  };
}

// ── Minting and reading ────────────────────────────────────────────────

/** The stored first name, or null when the account has never set one. */
export async function sharerFirstName(
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await shareAdmin().auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return storedFirstName(data.user);
}

function rowToCard(row: Record<string, unknown>): ShareCard {
  return {
    token: row.token as string,
    createdAt: row.created_at as string,
    sharerName: (row.sharer_name as string | null) ?? null,
    source: row.source as "alert" | "spot",
    spotSlug: row.spot_slug as string,
    spotName: row.spot_name as string,
    speciesName: (row.species_name as string | null) ?? null,
    targetDate: row.target_date as string,
    tz: row.tz as string,
    windowStartHour: (row.window_start_hour as number | null) ?? null,
    windowEndHour: (row.window_end_hour as number | null) ?? null,
    score: row.score as number,
    tier: row.tier as ShareTier,
    tide: (row.tide as string | null) ?? null,
    wind: (row.wind as string | null) ?? null,
    current: (row.current as string | null) ?? null,
    series: (row.series as (number | null)[]) ?? [],
    seriesDayIndex: (row.series_day_index as number) ?? 0,
  };
}

/** How long a signed-out caller's unsent card is reused for. */
const ANON_REUSE_MS = 10 * 60_000;

export interface MintOpts extends BuildSnapshotOpts {
  source: "alert" | "spot";
  userId?: string | null;
  /** Set for alert-borne cards. Dedupes to one card per alert per day. */
  alertProfileId?: string | null;
}

/**
 * Mint a card, or hand back the one that already exists.
 *
 * An alert-borne card is unique on (alert_profile_id, target_date), which is
 * what makes the sharer's modal open once per alert rather than every time
 * they revisit the link: the second call finds the existing token. Spot-page
 * shares carry a null profile id, and Postgres treats nulls as distinct in a
 * unique index, so those stay unconstrained.
 */
export async function mintShareCard(
  opts: MintOpts,
): Promise<ShareCard | null> {
  const db = shareAdmin();

  if (opts.alertProfileId && opts.targetDate) {
    const { data: existing } = await db
      .from("share_cards")
      .select("*")
      .eq("alert_profile_id", opts.alertProfileId)
      .eq("target_date", opts.targetDate)
      .maybeSingle();
    if (existing) return rowToCard(existing);
  }

  const snapshot = await buildShareSnapshot(opts);
  if (!snapshot) return null;

  // Anonymous minting is open, because gating your own growth loop behind a
  // login is an own goal. The cost is a public write, and the house answer to
  // that (see the weekend-alert capture route) is idempotence rather than a
  // rate limiter: a signed-out caller asking twice for the same spot, species
  // and day inside a few minutes gets the card they already made.
  //
  // Matched AFTER the snapshot resolves, on the fields the card actually shows.
  // An earlier version matched before building and skipped whenever a species
  // was named — which was every share from the spot page, since its button
  // always passes the selected species, so the guard never once fired.
  //
  // Only while the first card is still unsent, so a real share always gets its
  // own token and its own open counts.
  if (!opts.userId && !opts.alertProfileId) {
    const since = new Date(Date.now() - ANON_REUSE_MS).toISOString();
    let q = db
      .from("share_cards")
      .select("*")
      .is("created_by", null)
      .is("shared_at", null)
      .is("alert_profile_id", null)
      .eq("spot_slug", snapshot.spotSlug)
      .eq("target_date", snapshot.targetDate)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    q = snapshot.speciesName
      ? q.eq("species_name", snapshot.speciesName)
      : q.is("species_name", null);
    const { data: recent } = await q;
    if (recent?.[0]) return rowToCard(recent[0]);
  }

  const token = newShareToken();
  const sharerName = await sharerFirstName(opts.userId);

  const { data, error } = await db
    .from("share_cards")
    .insert({
      token,
      created_by: opts.userId ?? null,
      sharer_name: sharerName,
      source: opts.source,
      alert_profile_id: opts.alertProfileId ?? null,
      spot_slug: snapshot.spotSlug,
      spot_name: snapshot.spotName,
      species_name: snapshot.speciesName,
      target_date: snapshot.targetDate,
      tz: snapshot.tz,
      window_start_hour: snapshot.windowStartHour,
      window_end_hour: snapshot.windowEndHour,
      score: snapshot.score,
      tier: snapshot.tier,
      tide: snapshot.tide,
      wind: snapshot.wind,
      current: snapshot.current,
      series: snapshot.series,
      series_day_index: snapshot.seriesDayIndex,
    })
    .select("*")
    .single();

  if (error) {
    // A racing mint for the same alert-day loses the unique index. That is the
    // constraint doing its job, so read the winner rather than failing.
    if (opts.alertProfileId && opts.targetDate) {
      const { data: winner } = await db
        .from("share_cards")
        .select("*")
        .eq("alert_profile_id", opts.alertProfileId)
        .eq("target_date", opts.targetDate)
        .maybeSingle();
      if (winner) return rowToCard(winner);
    }
    console.error("share_cards insert failed", error);
    return null;
  }
  return data ? rowToCard(data) : null;
}

export async function readShareCard(token: string): Promise<ShareCard | null> {
  if (!/^[0-9a-f]{16}$/.test(token)) return null;
  const { data } = await shareAdmin()
    .from("share_cards")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  return data ? rowToCard(data) : null;
}

/**
 * Count an open. Fire-and-forget: a failed counter must never take the page
 * down, and the recipient's render does not wait on it.
 */
export async function recordShareOpen(token: string): Promise<void> {
  try {
    await shareAdmin().rpc("share_card_opened", { p_token: token });
  } catch (err) {
    console.error("share open counter failed", err);
  }
}

/** Stamp the moment the sharer actually sent it, as opposed to merely minting. */
export async function markShareSent(token: string): Promise<void> {
  try {
    await shareAdmin()
      .from("share_cards")
      .update({ shared_at: new Date().toISOString() })
      .eq("token", token)
      .is("shared_at", null);
  } catch (err) {
    console.error("share sent stamp failed", err);
  }
}
