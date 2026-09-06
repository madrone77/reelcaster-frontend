import { supabase } from '@/lib/supabase';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class UpgradeRequiredError extends ApiError {
  feature?: string;
  constructor(message: string, body: unknown, feature?: string) {
    super(400, message, body);
    this.name = 'UpgradeRequiredError';
    this.feature = feature;
  }
}

export class WaitlistRequiredError extends ApiError {
  constructor(message: string, body: unknown) {
    super(403, message, body);
    this.name = 'WaitlistRequiredError';
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Optional feature id passed through to UpgradeRequiredError for analytics. */
  feature?: string;
  /** Skip auth header attachment (for endpoints that should be hit unauthenticated). */
  skipAuth?: boolean;
  /**
   * A session token the caller already holds, typically `useAuth().session`.
   * Sent as-is, and the Supabase client is not asked for a session. Prefer
   * this wherever the auth context is in reach: the client's own session read
   * waits on a cross-tab lock, which a frozen background tab on Android
   * Chrome can hold for as long as it lives (2026-09-06).
   */
  accessToken?: string | null;
}

/**
 * Fetch wrapper for ReelCaster's first-party API routes.
 *
 * Auto-attaches the Supabase access token and translates the established
 * `{ error, upgrade_required: true }` response shape into an
 * `UpgradeRequiredError` so callers can branch on `instanceof` instead of
 * inspecting status + body.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { body, feature, skipAuth, accessToken, headers: extraHeaders, ...rest } = opts;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...((extraHeaders as Record<string, string> | undefined) ?? {}),
  };

  if (!skipAuth) {
    let token = accessToken ?? undefined;
    if (!token) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    }
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }
  }

  const init: RequestInit = {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const res = await fetch(path, init);

  // Best-effort JSON parse so we can inspect `upgrade_required` even on errors.
  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (res.ok) return parsed as T;

  const bodyObj = (parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}) ?? {};
  const message =
    (typeof bodyObj.error === 'string' && bodyObj.error) ||
    (typeof bodyObj.message === 'string' && bodyObj.message) ||
    `Request failed: ${res.status}`;

  if (bodyObj.upgrade_required === true) {
    throw new UpgradeRequiredError(message, parsed, feature);
  }
  if (bodyObj.waitlist_required === true) {
    throw new WaitlistRequiredError(message, parsed);
  }

  throw new ApiError(res.status, message, parsed);
}
