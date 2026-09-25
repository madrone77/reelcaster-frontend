/**
 * A reader who leaves for Stripe and comes back gets their place back.
 *
 * Until 2026-09-24 coming back cost them the sheet and the address they had
 * typed. Stripe's own back arrow went to /billing/cancel, a "Checkout
 * canceled" page whose way on was "Back to Explore", not the city they were
 * reading (10 of 116 signed-out redirects in two weeks, 1 came back). A
 * swipe back to a `no-store` page (every ad page) reloaded it with the sheet
 * shut and the field empty.
 *
 * Two things are kept for the tab, in sessionStorage:
 *
 *   the address    typed into the sheet, so any sheet opened later in the
 *                  visit starts filled in (and its session prefetch starts
 *                  building straight away);
 *   the sheet      that sent the reader to Stripe (its `from`, feature, place
 *                  and region, and the page it was on), so <TrialReturn>
 *                  can open that same sheet again when they come back.
 *
 * sessionStorage, not a cookie: it is per tab, which is what "come back to
 * where I was" means, and it never goes to the server. Every access is
 * wrapped; iOS in private mode throws on it (see incident_blocked_storage).
 */

const EMAIL_KEY = 'rc_trial_email';
const SHEET_KEY = 'rc_trial_sheet';
/** Past this, a returning reader is on a new visit and gets a fresh page. */
const SHEET_MAX_AGE_MS = 30 * 60 * 1000;

export interface TrialSheetRecord {
  /** The page the sheet was open on: pathname + search. */
  path: string;
  from: string;
  feature: string;
  spotName?: string;
  placeName?: string;
  region?: string;
  at: number;
  /** Set by /billing/cancel: the reader pressed Stripe's back arrow. */
  back?: boolean;
}

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberTrialEmail(value: string): void {
  try {
    const s = store();
    if (!s) return;
    const v = value.trim();
    if (v) s.setItem(EMAIL_KEY, v);
    else s.removeItem(EMAIL_KEY);
  } catch {
    /* storage refused */
  }
}

export function recallTrialEmail(): string {
  try {
    return store()?.getItem(EMAIL_KEY) ?? '';
  } catch {
    return '';
  }
}

/** The page the reader is on, as a same-origin path for Stripe's cancel_url. */
export function currentPath(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname + window.location.search;
}

/**
 * A path a checkout may send the reader back to: same origin, ours, short.
 * Used on both sides, so a crafted request cannot turn the cancel page into
 * an open redirect.
 */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length > 512) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (value.startsWith('/billing') || value.startsWith('/api')) return null;
  return value;
}

export function rememberTrialSheet(rec: Omit<TrialSheetRecord, 'path' | 'at'>): void {
  try {
    store()?.setItem(SHEET_KEY, JSON.stringify({ ...rec, path: currentPath(), at: Date.now() }));
  } catch {
    /* storage refused */
  }
}

/** For /billing/cancel: the reader came back through Stripe's arrow. */
export function markTrialSheetBack(): void {
  try {
    const s = store();
    const raw = s?.getItem(SHEET_KEY);
    if (!s || !raw) return;
    s.setItem(SHEET_KEY, JSON.stringify({ ...JSON.parse(raw), back: true }));
  } catch {
    /* storage refused or not JSON */
  }
}

/**
 * The sheet to reopen on this page, taken (so it opens once), or null.
 *
 * Only on the page it was left from, only within the half hour, and only
 * when the reader is arriving BACK: through Stripe's arrow (`back`), or by
 * the browser's back button (navigation type back_forward). A reader who
 * types the city's address again later is not ambushed by a sheet.
 */
export function takeTrialSheet(): TrialSheetRecord | null {
  try {
    const s = store();
    const raw = s?.getItem(SHEET_KEY);
    if (!s || !raw) return null;
    const rec = JSON.parse(raw) as TrialSheetRecord;
    if (rec.path !== currentPath()) return null;
    if (Date.now() - rec.at > SHEET_MAX_AGE_MS) {
      s.removeItem(SHEET_KEY);
      return null;
    }
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!rec.back && nav?.type !== 'back_forward') return null;
    s.removeItem(SHEET_KEY);
    return rec;
  } catch {
    return null;
  }
}

/** Drop the sheet record: a bfcache restore brought the open sheet back itself. */
export function forgetTrialSheet(): void {
  try {
    store()?.removeItem(SHEET_KEY);
  } catch {
    /* storage refused */
  }
}
