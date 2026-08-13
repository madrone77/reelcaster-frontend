import type { AlertProfile } from '@/lib/custom-alert-engine';

/**
 * Shared read of the viewer's alert profiles.
 *
 * Two independent components want this on the same paint — the top bar, for its
 * "Notifications" badge count, and the dashboard, for the alerts rail — so
 * every signed-in page load fired `/api/alerts` twice. Neither is wrong on its
 * own, and neither should have to know about the other, so the dedup lives
 * here: one request per token per window, shared by whoever asks.
 *
 * A short TTL rather than a plain in-flight promise, because the two callers
 * mount a few hundred milliseconds apart and would otherwise miss each other.
 * Mutations call `invalidateAlertProfiles()` so a freshly created or deleted
 * alert never waits the window out.
 */
const TTL_MS = 30_000;

let cache: { token: string; at: number; promise: Promise<AlertProfile[]> } | null = null;

export function fetchAlertProfiles(token: string): Promise<AlertProfile[]> {
  const now = Date.now();
  if (cache && cache.token === token && now - cache.at < TTL_MS) return cache.promise;

  const promise = fetch('/api/alerts', { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.profiles ?? []) as AlertProfile[])
    .catch(() => [] as AlertProfile[]);

  cache = { token, at: now, promise };
  return promise;
}

/** Drop the shared copy — call after creating, editing, or deleting an alert. */
export function invalidateAlertProfiles(): void {
  cache = null;
}
