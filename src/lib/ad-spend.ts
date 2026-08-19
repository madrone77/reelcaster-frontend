/**
 * Pulling ad spend down from Google and Meta.
 *
 * The denominator. Conversions on their own say which campaigns produce
 * customers; only spend says which ones produce them for less than they are
 * worth, and those are frequently not the same campaigns.
 *
 * Two things about this that are easy to get wrong and expensive to discover
 * late:
 *
 *   1. Spend is NOT final when first reported. Both platforms restate the last
 *      few days as they strip invalid clicks, so a one-shot "yesterday" pull
 *      permanently banks a number the platform has since corrected. Every run
 *      re-pulls a trailing window and upserts over the top.
 *   2. Currency is per ad account, not global. Storing spend without it and
 *      dividing by conversions in another currency yields a figure that looks
 *      like money and is not, which is worse than having no figure at all.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { googleAdsConfig, googleAccessToken, googleAdsHeaders } from './google-ads-auth';

/**
 * How far back to re-pull on every run.
 *
 * Comfortably past the point where either platform is still adjusting figures.
 * The cost of a wider window is re-writing rows that did not change; the cost
 * of a narrower one is silently keeping a number that is wrong.
 */
export const RESTATEMENT_WINDOW_DAYS = 7;

const GOOGLE_API_VERSION = 'v18';
const META_API_VERSION = 'v21.0';

export interface SpendRow {
  day: string;
  platform: 'google' | 'meta';
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string;
  adset_name: string | null;
  ad_id: string;
  ad_name: string | null;
  impressions: number;
  clicks: number;
  spend_cents: number;
  currency: string;
}

export interface IngestResult {
  google: number;
  meta: number;
  skipped: string[];
  errors: string[];
}

/** YYYY-MM-DD, UTC. Both APIs want plain dates, not timestamps. */
function isoDay(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400_000).toISOString().slice(0, 10);
}

// ── Google Ads ───────────────────────────────────────────────────────

interface GoogleSearchRow {
  segments?: { date?: string };
  campaign?: { id?: string; name?: string };
  adGroup?: { id?: string; name?: string };
  adGroupAd?: { ad?: { id?: string; name?: string } };
  metrics?: { impressions?: string; clicks?: string; costMicros?: string };
  customer?: { currencyCode?: string };
}

async function fetchGoogleSpend(since: string, until: string): Promise<SpendRow[]> {
  const cfg = googleAdsConfig();
  if (!cfg) throw new Error('google_not_configured');

  const token = await googleAccessToken(cfg);
  const headers = googleAdsHeaders(cfg, token);

  // ad_group_ad is the finest grain that still carries cost, which is what
  // makes per-ad CAC possible rather than per-campaign only.
  const query = `
    SELECT segments.date, campaign.id, campaign.name, ad_group.id, ad_group.name,
           ad_group_ad.ad.id, ad_group_ad.ad.name, metrics.impressions,
           metrics.clicks, metrics.cost_micros, customer.currency_code
    FROM ad_group_ad
    WHERE segments.date BETWEEN '${since}' AND '${until}'
  `;

  const rows: SpendRow[] = [];
  let pageToken: string | undefined;

  do {
    const res = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_API_VERSION}/customers/${cfg.customerId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, ...(pageToken ? { pageToken } : {}) }),
      },
    );
    if (!res.ok) {
      throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      results?: GoogleSearchRow[];
      nextPageToken?: string;
    };

    for (const r of json.results ?? []) {
      const day = r.segments?.date;
      if (!day) continue;
      rows.push({
        day,
        platform: 'google',
        campaign_id: r.campaign?.id ?? '',
        campaign_name: r.campaign?.name ?? null,
        adset_id: r.adGroup?.id ?? '',
        adset_name: r.adGroup?.name ?? null,
        ad_id: r.adGroupAd?.ad?.id ?? '',
        // Responsive ads frequently have no name. Null, not "".
        ad_name: r.adGroupAd?.ad?.name || null,
        // int64 arrives as a STRING over REST. Number() it or every sum below
        // silently becomes string concatenation.
        impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0),
        // Micros are millionths of a unit; cents are hundredths. 10,000 to 1.
        spend_cents: Math.round(Number(r.metrics?.costMicros ?? 0) / 10_000),
        currency: (r.customer?.currencyCode ?? 'CAD').toLowerCase(),
      });
    }

    pageToken = json.nextPageToken;
  } while (pageToken);

  return rows;
}

// ── Meta ─────────────────────────────────────────────────────────────

interface MetaInsightRow {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  account_currency?: string;
}

function metaSpendConfig() {
  const accountId = (process.env.META_AD_ACCOUNT_ID ?? '').replace(/^act_/, '');
  // Reporting needs ads_read, which the Conversions API token may not carry.
  // A dedicated token wins; the CAPI one is the fallback so a single-token
  // setup still works.
  const token = process.env.META_ADS_ACCESS_TOKEN || process.env.META_CAPI_ACCESS_TOKEN;
  if (!accountId || !token) return null;
  return { accountId, token };
}

async function fetchMetaSpend(since: string, until: string): Promise<SpendRow[]> {
  const cfg = metaSpendConfig();
  if (!cfg) throw new Error('meta_not_configured');

  const params = new URLSearchParams({
    level: 'ad',
    // Without this, the whole range collapses into one row and the daily
    // grain (and therefore any day-by-day chart) is lost.
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    fields:
      'date_start,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend,account_currency',
    limit: '500',
    access_token: cfg.token,
  });

  let url = `https://graph.facebook.com/${META_API_VERSION}/act_${cfg.accountId}/insights?${params}`;
  const rows: SpendRow[] = [];

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`meta ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      data?: MetaInsightRow[];
      paging?: { next?: string };
    };

    for (const r of json.data ?? []) {
      if (!r.date_start) continue;
      rows.push({
        day: r.date_start,
        platform: 'meta',
        campaign_id: r.campaign_id ?? '',
        campaign_name: r.campaign_name ?? null,
        adset_id: r.adset_id ?? '',
        adset_name: r.adset_name ?? null,
        ad_id: r.ad_id ?? '',
        ad_name: r.ad_name ?? null,
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        // Meta reports MAJOR units as a decimal string ("12.34"), the opposite
        // of Google's integer micros. Rounding after the multiply avoids the
        // float dust that would otherwise make sums drift by a cent.
        spend_cents: Math.round(Number(r.spend ?? 0) * 100),
        currency: (r.account_currency ?? 'CAD').toLowerCase(),
      });
    }

    url = json.paging?.next ?? '';
  }

  return rows;
}

// ── Write ────────────────────────────────────────────────────────────

async function upsertSpend(admin: SupabaseClient, rows: SpendRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  // Chunked: a wide date range across many ads is thousands of rows, and one
  // enormous statement is the shape that has taken this database down before.
  const CHUNK = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await admin
      .from('marketing_ad_spend')
      .upsert(slice, { onConflict: 'day,platform,campaign_id,adset_id,ad_id' });
    if (error) throw new Error(`upsert failed: ${error.message}`);
    written += slice.length;
  }
  return written;
}

/**
 * Pull both platforms and write them.
 *
 * One platform failing must not stop the other: a bad Meta token should not
 * mean Google spend goes missing too, because a half-populated table with a
 * visible error beats an empty one with the same error.
 */
export async function ingestAdSpend(
  admin: SupabaseClient,
  days = RESTATEMENT_WINDOW_DAYS,
): Promise<IngestResult> {
  const since = isoDay(days);
  const until = isoDay(0);
  const result: IngestResult = { google: 0, meta: 0, skipped: [], errors: [] };

  for (const [platform, fetcher] of [
    ['google', fetchGoogleSpend],
    ['meta', fetchMetaSpend],
  ] as const) {
    try {
      const rows = await fetcher(since, until);
      const written = await upsertSpend(admin, rows);
      result[platform] = written;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      // "Not configured" is a resting state, not a fault. Separating the two
      // is what lets the dashboard say "no credentials yet" instead of
      // showing an error for a platform nobody has set up.
      if (message.endsWith('_not_configured')) result.skipped.push(message);
      else result.errors.push(`${platform}: ${message}`);
    }
  }

  return result;
}
