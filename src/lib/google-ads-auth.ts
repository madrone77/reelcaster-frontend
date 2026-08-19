/**
 * Google Ads API credentials and access tokens.
 *
 * Shared by the two things that talk to Google: uploading conversions back
 * (src/lib/conversion-upload.ts) and pulling spend down (src/lib/ad-spend.ts).
 * They authenticate identically, and a second copy of the refresh dance is a
 * second place for the token handling to drift.
 */

export interface GoogleAdsConfig {
  developerToken: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  customerId: string;
  loginCustomerId: string;
}

/** Null when anything is missing, so every caller degrades to a clean no-op. */
export function googleAdsConfig(): GoogleAdsConfig | null {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  // Digits only: the API rejects the dashed form people copy out of the UI.
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID ?? '').replace(/-/g, '');
  const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? '').replace(/-/g, '');
  if (!developerToken || !clientId || !clientSecret || !refreshToken || !customerId) {
    return null;
  }
  return { developerToken, clientId, clientSecret, refreshToken, customerId, loginCustomerId };
}

export async function googleAccessToken(cfg: GoogleAdsConfig): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`oauth ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('oauth returned no access_token');
  return json.access_token;
}

export function googleAdsHeaders(cfg: GoogleAdsConfig, token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'developer-token': cfg.developerToken,
    'Content-Type': 'application/json',
  };
  // Only present for manager accounts; sending an empty one is an error.
  if (cfg.loginCustomerId) headers['login-customer-id'] = cfg.loginCustomerId;
  return headers;
}
