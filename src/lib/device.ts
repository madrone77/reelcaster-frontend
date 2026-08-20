/**
 * What kind of machine is this request coming from?
 *
 * Parsed from the User-Agent header on the SERVER, never reported by the
 * client. A campaign report that a visitor can edit is not a report, and the
 * header is already on every request we would count, so asking the browser to
 * describe itself in a JSON body would add a lie surface for nothing.
 *
 * Two separate answers, because they answer different questions:
 *
 *   device   how big is the screen this ad landed on. Decides whether a
 *            landing page's mobile layout is the thing to fix first.
 *   os       which platform. Decides where the app effort goes, and is the
 *            axis Google's own bidding treats as distinct.
 *
 * Deliberately coarse. A version-level parser (ua-parser-js and friends) is a
 * dependency plus a signature database that goes stale, in exchange for
 * precision no advertising decision has ever needed. Six platforms and three
 * form factors is the whole vocabulary, and everything unrecognised says so
 * rather than guessing.
 *
 * ORDER IS THE WHOLE ALGORITHM here, because these strings nest:
 *   - every Android UA also contains "Linux"
 *   - ChromeOS ("CrOS") also contains "Linux"
 *   - iPadOS 13 and later report "Macintosh", so an iPad is a Mac until
 *     something else tells you otherwise
 * Each test below therefore runs before the broader string it lives inside.
 */

/** Form factor. "unknown" when the header is missing or unrecognised. */
export type DeviceClass = 'mobile' | 'tablet' | 'desktop' | 'unknown';

/** Platform family. Matches the vocabulary the admin campaign page renders. */
export type OsClass =
  | 'ios'
  | 'android'
  | 'windows'
  | 'macos'
  | 'linux'
  | 'chromeos'
  | 'unknown';

export interface DeviceInfo {
  device: DeviceClass;
  os: OsClass;
}

/**
 * Bots identify themselves, and the honest ones are the majority of the
 * traffic that would otherwise inflate a landing page's hit count while never
 * being able to click a CTA. Counting them would deflate every CTR on the
 * page, and worse, it would deflate them unevenly: a variant that happens to
 * be crawled more looks like a variant nobody clicks.
 *
 * This only catches the self-declaring ones. The rest is why the page says
 * "hits", not "people".
 */
const BOT_SIGNATURES = [
  'bot',
  'crawler',
  'spider',
  'slurp',
  'headlesschrome',
  'lighthouse',
  'pagespeed',
  'preview',
  'monitor',
  'curl/',
  'wget/',
  'python-requests',
  'axios/',
  'node-fetch',
  'facebookexternalhit',
  'whatsapp',
  'vercel-screenshot',
];

/** Does this User-Agent admit to being a machine? */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return true; // No header at all is not a browser we should count.
  return BOT_SIGNATURES.some((sig) => ua.includes(sig));
}

/**
 * Classify a User-Agent into a platform and a form factor.
 *
 * Never throws and never returns null: an unreadable header produces
 * "unknown" on both axes, which the admin renders as its own row rather than
 * silently folding into desktop. A large unknown bucket is a signal worth
 * seeing; a large desktop bucket that is secretly unknowns is not.
 */
export function classifyUserAgent(userAgent: string | null | undefined): DeviceInfo {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return { device: 'unknown', os: 'unknown' };

  // ── iOS ────────────────────────────────────────────────────────────────
  // iPhone and iPod are unambiguous. iPad is not: since iPadOS 13 Safari
  // requests desktop sites by default and sends a Macintosh UA, so the tablet
  // tell is a touch-capable "Macintosh", which is what the Mac branch checks.
  if (ua.includes('iphone') || ua.includes('ipod')) {
    return { device: 'mobile', os: 'ios' };
  }
  if (ua.includes('ipad')) {
    return { device: 'tablet', os: 'ios' };
  }

  // ── Android ────────────────────────────────────────────────────────────
  // Before Linux, which every Android UA also contains. Google's own rule for
  // telling a phone from a tablet is the presence of "Mobile": Android tablets
  // omit it, phones include it, and no other field distinguishes them.
  if (ua.includes('android')) {
    return { device: ua.includes('mobile') ? 'mobile' : 'tablet', os: 'android' };
  }

  // ── ChromeOS ───────────────────────────────────────────────────────────
  // Also before Linux, and worth its own row: a Chromebook is a real segment
  // for a web-only product and reads as generic Linux otherwise.
  if (ua.includes('cros')) {
    return { device: 'desktop', os: 'chromeos' };
  }

  if (ua.includes('windows phone')) {
    return { device: 'mobile', os: 'windows' };
  }
  if (ua.includes('windows')) {
    return { device: 'desktop', os: 'windows' };
  }

  // ── Mac, and the iPads hiding inside it ────────────────────────────────
  // A Macintosh UA advertising multi-touch is an iPad asking for the desktop
  // site. Real Macs do not claim touch points, so this is the one signal that
  // separates them without a client-side check.
  if (ua.includes('macintosh') || ua.includes('mac os x')) {
    const touch = ua.includes('mobile') || ua.includes('touch');
    return touch ? { device: 'tablet', os: 'ios' } : { device: 'desktop', os: 'macos' };
  }

  if (ua.includes('linux') || ua.includes('x11')) {
    return { device: 'desktop', os: 'linux' };
  }

  // A UA carrying "mobile" and nothing else recognisable is still known to be
  // a phone, which is more than "unknown" says.
  if (ua.includes('mobile')) {
    return { device: 'mobile', os: 'unknown' };
  }

  return { device: 'unknown', os: 'unknown' };
}
