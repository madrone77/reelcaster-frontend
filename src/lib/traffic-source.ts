/**
 * What page was this, and who sent them to it?
 *
 * The vocabulary behind the organic-traffic counter. Every value this file
 * returns becomes a column in `traffic_events_daily`, so the lists here ARE
 * the report: a distinction not drawn in this file cannot be drawn in the
 * admin, and a bucket added here starts filling on the next deploy.
 *
 * WHY THIS EXISTS SEPARATELY FROM src/lib/attribution.ts. That file answers
 * "where did this ACCOUNT come from", once, at signup. This one answers "where
 * did this VISIT come from", every time, for the far larger population that
 * never signs up. The paid campaigns report has had a denominator since
 * 20260820_campaign_telemetry; organic has never had one, so a city page that
 * nobody reads and a city page that everybody bounces off have been the same
 * empty row.
 *
 * Everything here is pure and has no Node built-ins, because it runs inside
 * edge middleware. Keep it that way: an import that pulls in a Node API breaks
 * the middleware bundle for the whole site, not just this counter.
 */

/** Cap on any stored dimension. Paths and hosts, never prose. */
const MAX_VALUE = 120;

function clamp(value: string): string {
  return value.trim().slice(0, MAX_VALUE);
}

/**
 * The kinds of page worth counting, as an acquisition question.
 *
 * Signed-in surfaces are deliberately absent rather than lumped into "other".
 * A dashboard reload is not an arrival, and counting them would let a handful
 * of daily-active users out-vote every SEO reader in the table while telling
 * us nothing about where anyone came from. `classifyPage` returns null for
 * those and the caller writes no row at all.
 */
export type PageKind =
  | 'home'
  | 'explore'
  | 'spot'
  | 'province'
  | 'city'
  | 'city-species'
  | 'licence'
  | 'lp'
  | 'marketing'
  | 'other';

export interface PageClass {
  kind: PageKind;
  /**
   * What distinguishes this page from others of its kind, and nothing more.
   *
   * Empty for the pages there is only one of (home, explore). For the rest it
   * is the identifying tail: "wa/seattle-wa", "point-robinson-e2e269",
   * "6/seattle-wa". Not the full path, because the prefix is already carried
   * by `kind` and storing it twice widens the primary key for nothing.
   */
  slug: string;
}

/**
 * Path prefixes that are somewhere a person already is, not somewhere they
 * arrive. Checked before anything else, and the reason this function is
 * nullable at all.
 *
 * `/first` is the post-signup welcome, `/plans` and `/billing` are mid-funnel
 * and already measured by the paywall and conversion tables, and `/api`,
 * `/auth` and `/_vercel` are not pages.
 */
const NEVER_COUNTED = [
  '/api',
  '/auth',
  '/_vercel',
  '/billing',
  '/dashboard',
  '/alerts',
  '/catches',
  '/favorites',
  '/profile',
  '/settings',
  '/notifications',
  '/log-catch',
  '/plans',
  '/first',
  '/login',
  '/signup',
  '/coming-soon',
  '/weekend-alert',
];

/** Marketing pages that are one flat page each, keyed by their own name. */
const MARKETING = ['about', 'contact', 'faq', 'privacy', 'terms', 'support'];

/**
 * Which page is this, or null if it is not an arrival worth counting.
 *
 * Order follows specificity, longest route first, because these paths nest:
 * /fishing/wa/seattle-wa/chinook is also a /fishing/wa/seattle-wa prefix and
 * testing the short one first would collapse every species page into its city.
 */
export function classifyPage(pathname: string): PageClass | null {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (NEVER_COUNTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    return null;
  }

  if (path === '/') return { kind: 'home', slug: '' };

  // Spot pages, including the ad-framed rewrite target. Both are the same page
  // to a reader, and the ad frame is already a dimension of its own in
  // campaign_events_daily.
  const spot = path.match(/^\/explore\/spot\/([^/]+)(?:\/ad)?$/);
  if (spot) return { kind: 'spot', slug: clamp(spot[1]) };

  if (path === '/explore') return { kind: 'explore', slug: '' };

  // Landing pages, both shapes: the numbered /lp/<n>/<city> family and the
  // city-first /lp/seattle/1. Stored as the tail so a new variant needs no
  // edit here, matching how LANDING_SHAPE treats the counter it feeds.
  const lp = path.match(/^\/lp\/(.+)$/);
  if (lp) return { kind: 'lp', slug: clamp(lp[1]) };

  const licence = path.match(/^\/fishing-licence\/([^/]+)$/);
  if (licence) return { kind: 'licence', slug: clamp(licence[1]) };

  const citySpecies = path.match(/^\/fishing\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (citySpecies) {
    return {
      kind: 'city-species',
      slug: clamp(`${citySpecies[1]}/${citySpecies[2]}/${citySpecies[3]}`),
    };
  }

  const city = path.match(/^\/fishing\/([^/]+)\/([^/]+)$/);
  if (city) return { kind: 'city', slug: clamp(`${city[1]}/${city[2]}`) };

  const province = path.match(/^\/fishing\/([^/]+)$/);
  if (province) return { kind: 'province', slug: clamp(province[1]) };

  const marketing = path.match(/^\/([^/]+)$/);
  if (marketing && MARKETING.includes(marketing[1])) {
    return { kind: 'marketing', slug: clamp(marketing[1]) };
  }

  return { kind: 'other', slug: clamp(path) };
}

/**
 * How the visitor got here, in one word.
 *
 * `internal` is the one that has to exist and is easy to forget. Client-side
 * navigation never reaches middleware, but a hard reload or a middle-click on
 * our own link does, carrying our own host as the referrer. Folding those into
 * `direct` would make the single largest bucket in the report a number that
 * means "somebody pressed reload".
 */
export type SourceKind =
  | 'paid'
  | 'search'
  | 'ai'
  | 'social'
  | 'referral'
  | 'internal'
  | 'direct';

/**
 * Search engines. The value of separating these from `referral` is that
 * search is the only channel we can act on with content.
 */
const SEARCH_HOSTS = [
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',
  'ecosia.org',
  'search.brave.com',
  'startpage.com',
  'qwant.com',
  'baidu.com',
  'yandex.com',
];

/**
 * Assistants that cite sources. Their own bucket rather than folded into
 * search, because the thing that earns a citation is not the thing that earns
 * a blue link, and telling them apart is the whole reason to look.
 */
const AI_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'claude.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'you.com',
  'phind.com',
];

const SOCIAL_HOSTS = [
  'facebook.com',
  'instagram.com',
  'reddit.com',
  'x.com',
  't.co',
  'youtube.com',
  'linkedin.com',
  'tiktok.com',
  'pinterest.com',
  'threads.net',
  'snapchat.com',
];

/**
 * Networks that reach us under more than one host, collapsed to one name.
 *
 * Same list and same reasoning as bluecaster's lib/attribution-labels.ts: real
 * traffic arrived as both `l.facebook.com` and `lm.facebook.com`, which
 * without this are two rows of one beside a `facebook.com` row of one, for
 * what is one channel.
 */
const HOST_ALIASES = [
  ...SEARCH_HOSTS,
  ...AI_HOSTS,
  ...SOCIAL_HOSTS,
  'news.google.com',
];

/**
 * The host that sent them, collapsed through the alias list. Empty string when
 * there is no referrer or it cannot be parsed, which the caller reads as
 * direct.
 */
export function referrerHost(referrer: string): string {
  if (!referrer) return '';
  let host: string;
  try {
    host = new URL(referrer).host.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
  // Longest alias first, so `news.google.com` is not eaten by `google.com`.
  const alias = [...HOST_ALIASES]
    .sort((a, b) => b.length - a.length)
    .find((a) => host === a || host.endsWith(`.${a}`));
  return alias ?? host;
}

function inList(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Classify one visit's source.
 *
 * `isPaid` is decided by the caller from the same `buildPaid` logic the
 * attribution cookies use, so a click counted as paid here and a signup
 * credited as paid there can never disagree. Paid is checked FIRST and beats
 * every referrer: an Instagram ad and an Instagram share arrive from the same
 * host, and the parameters are the only thing that tells them apart.
 */
export function classifySource(input: {
  referrer: string;
  selfHost: string;
  isPaid: boolean;
}): { kind: SourceKind; host: string } {
  const host = referrerHost(input.referrer);

  if (input.isPaid) return { kind: 'paid', host };
  if (!host) return { kind: 'direct', host: '' };

  const self = input.selfHost.replace(/^www\./, '').toLowerCase();
  if (host === self || host.endsWith(`.${self}`)) {
    return { kind: 'internal', host: '' };
  }

  if (inList(host, AI_HOSTS)) return { kind: 'ai', host };
  if (inList(host, SEARCH_HOSTS)) return { kind: 'search', host };
  if (inList(host, SOCIAL_HOSTS)) return { kind: 'social', host };
  return { kind: 'referral', host };
}
