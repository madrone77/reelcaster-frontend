/**
 * The Port's static content: getting-started guides, knowledge base, changelog,
 * and known issues.
 *
 * Deliberately a typed module rather than a CMS. This content changes when the
 * product changes, which means it changes in a pull request alongside the code
 * it describes — a CMS would let the two drift silently. Everything here is
 * indexed into one flat search list by `searchIndex()` so the portal has a
 * single search box rather than one per section.
 *
 * Rule of thumb when editing: if a fact here isn't true of `main`, fix it in
 * the same PR that made it untrue.
 */

import { TRIAL_DAYS } from '@/lib/pricing';

export type SectionId =
  | 'start'
  | 'guides'
  | 'answers'
  | 'billing'
  | 'status'
  | 'tickets';

/* ------------------------------------------------------------------ guides */

export interface GuideStep {
  title: string;
  detail: string;
  /** Optional deep link into the product for this step. */
  href?: string;
  hrefLabel?: string;
}

export interface Guide {
  id: string;
  title: string;
  summary: string;
  /** Rough read/do time, shown as a mono chip. */
  minutes: number;
  steps: GuideStep[];
}

export const GUIDES: Guide[] = [
  {
    id: 'read-a-score',
    title: 'Read a fishing score',
    summary:
      'What the 0–100 number actually means, which factors moved it, and how to find the best window in a day.',
    minutes: 4,
    steps: [
      {
        title: 'Start with the tier, not the digits',
        detail:
          'Scores band into three tiers: 75 and above is good, 55–74 is fair, below 55 is poor. The difference between a 78 and an 81 is noise; the difference between a 78 and a 51 is your Saturday. Read the colour first.',
      },
      {
        title: 'Find the best window',
        detail:
          'Every spot page shows 24 hourly bars with a BEST WINDOW callout. A spot averaging 60 with a 2-hour spike to 85 is usually a better trip than a flat 70, because the score is per-hour, so fish the peak.',
        href: '/explore',
        hrefLabel: 'Open the map',
      },
      {
        title: 'Open "Score explained"',
        detail:
          'The breakdown splits into engine factors (tidal current, pressure trend, season, minutes to next slack) and comfort factors (wind, precipitation, air temperature, visibility). Comfort factors describe whether you will enjoy being out there; engine factors describe whether the fish care.',
      },
      {
        title: 'Expect different factors per species',
        detail:
          'Which factors appear is species-driven, not a bug. Dungeness crab scores are driven almost entirely by tidal current speed, so that is the only chart you will see. Salmon carry tide, pressure and season together. If a chart you expected is missing, check which species is selected.',
      },
      {
        title: 'Check the confidence bar',
        detail:
          'The evidence panel shows how much real data sits behind a score: source tallies and the top algorithm variables. A high score with thin evidence is a hypothesis. A high score with a deep catch history behind it is a plan.',
      },
    ],
  },
  {
    id: 'explore-map',
    title: 'Get more out of the Explore map',
    summary:
      'The bathymetric chart, the currents layer, species filtering, and what the pin colours and numbers mean.',
    minutes: 5,
    steps: [
      {
        title: 'The chart is bathymetry, not a road map',
        detail:
          'Explore renders a colour-relief nautical chart with depth contours, DFO subarea boundaries, rockfish conservation areas, marine structures and tide stations. The Relief and Labels toggles turn the shading and place names on and off if the pins get busy.',
        href: '/explore',
        hrefLabel: 'Open Explore',
      },
      {
        title: 'Pin colour is the score, the numeral is the value',
        detail:
          'Pins run a continuous five-stop scale from green through amber to red, with the score printed inside. A grey pin with a dot means the spot has not been scored yet, usually a new or custom spot awaiting its first scoring run.',
      },
      {
        title: 'Turn on Currents before planning a slack-tide trip',
        detail:
          'The Currents toggle overlays a live flow field: a colour heatmap for speed plus white particle ribbons showing direction. It clips at the coastline. For anything current-driven (crab, halibut on a slack, or a tide-line troll) this is faster than reading numbers.',
      },
      {
        title: 'Filter by species',
        detail:
          'The species filter re-scores every pin and the whole list for one species. A spot that reads 45 overall can be an 80 for the fish you are actually after, so a general scan will hide it from you.',
      },
      {
        title: 'Use Near me to jump regions',
        detail:
          'The Near me button matches your position to the nearest covered city and refits the map. It runs entirely in the browser against the already-loaded city list, so no request is sent anywhere.',
      },
    ],
  },
  {
    id: 'alerts',
    title: 'Set up alerts that are worth reading',
    summary:
      'Score alerts versus custom multi-variable alerts, thresholds that avoid noise, and how cooldowns work.',
    minutes: 4,
    steps: [
      {
        title: 'Start with a Score Alert',
        detail:
          'Pick a spot, a species and a threshold. We check conditions every 30 minutes and email you when the score crosses it. This covers most of what people want.',
        href: '/alerts',
        hrefLabel: 'Go to Alerts',
      },
      {
        title: 'Set the threshold higher than feels right',
        detail:
          'A threshold of 60 on a good spot fires most weeks and you will stop reading them. Start at 78–80. You can always lower it; you cannot un-train yourself to ignore the emails.',
      },
      {
        title: 'Use the cooldown',
        detail:
          'Cooldown is the minimum gap between alerts from one profile, from 1 to 168 hours. A 24-hour cooldown on a weekend spot means one email per opportunity rather than one per re-check as the score wobbles across your line.',
      },
      {
        title: 'Go custom for multi-variable triggers',
        detail:
          'Custom alerts combine wind speed and direction, tide phase and exchange, pressure trend, water temperature, solunar period and score, joined with AND or OR. This is how you encode "westerly under 15 knots on a falling tide" instead of approximating it with a score number.',
        href: '/profile/custom-alerts',
        hrefLabel: 'Custom alerts',
      },
      {
        title: 'Pro gives you ten profiles',
        detail:
          'Free accounts run one alert. Pro runs up to ten, which is enough to cover a home spot per species plus a couple of road-trip candidates. Wind speed is smoothed with a 3-point moving average so a single gust does not trip a wind trigger.',
      },
    ],
  },
  {
    id: 'log-catch',
    title: 'Log a catch from a photo',
    summary:
      'Drop a photo and the wizard reads the EXIF, identifies the species, matches the spot and snapshots conditions.',
    minutes: 3,
    steps: [
      {
        title: 'Drop the photo first',
        detail:
          'JPG, PNG, WebP, HEIC or HEIF up to 25 MB. Read the EXIF from the original file. If you screenshot the photo or send it through a messaging app first, the GPS and timestamp are stripped and you will be placing the pin by hand.',
        href: '/log-catch',
        hrefLabel: 'Log a catch',
      },
      {
        title: 'Let it analyse',
        detail:
          'We read EXIF locally in your browser, then run vision on a downscaled copy to suggest species, lure and size, and compute a conditions snapshot for that exact moment.',
      },
      {
        title: 'Confirm the spot',
        detail:
          'The pin starts at the photo GPS. Any spot within 400 m is matched automatically. If nothing is there you get a Create button that makes a custom spot at that point with the DFO management area filled in.',
      },
      {
        title: 'Correct anything on the review screen',
        detail:
          'Species confidence is shown as a chip with a "Not right?" picker listing species known at that spot first. Weight, length, lure, depth and every conditions cell are click-to-edit. Changing the species or the catch time refetches the score.',
      },
      {
        title: 'Save as draft if you are on the water',
        detail:
          'Drafts keep the photo and everything read so far without committing. Finish them later from My catches; drafts are badged in the list.',
        href: '/catches',
        hrefLabel: 'My catches',
      },
    ],
  },
  {
    id: 'pro-features',
    title: 'What your Pro membership unlocks',
    summary:
      'The concrete differences between Free and Pro, and where each one lives in the app.',
    minutes: 2,
    steps: [
      {
        title: 'The full 14-day forecast',
        detail:
          'Pro sees 14 days on every spot page. A free account sees 7, and browsing signed-out shows the next 2. The extra week is what lets you pick a weekend two weeks out instead of reacting to this one.',
      },
      {
        title: 'Ten alerts with composite triggers',
        detail:
          'Up to ten alert profiles instead of one, plus multi-variable triggers and per-alert pause, duplicate and history.',
        href: '/alerts',
        hrefLabel: 'Alerts',
      },
      {
        title: 'Custom spots anywhere in covered waters',
        detail:
          'Drop your own spot at any coordinates in our coverage and it gets scored like a mapped one.',
      },
      {
        title: 'The full per-spot breakdown',
        detail:
          'Wind, swell, tide, pressure and solunar detail, the per-factor charts, and the "why this score" evidence panel.',
      },
      {
        title: 'The Port',
        detail:
          'This page. Priority support with a one business day reply target, and a ticket history you can point back at.',
      },
    ],
  },
];

/* ------------------------------------------------------- knowledge base */

export type ArticleTopic =
  | 'Account & billing'
  | 'Forecasts & scores'
  | 'Map & spots'
  | 'Alerts'
  | 'Catch log'
  | 'Data & privacy';

export interface Article {
  id: string;
  question: string;
  answer: string;
  topic: ArticleTopic;
  /** Extra search terms that are not in the question or answer text. */
  tags?: string[];
}

export const ARTICLE_TOPICS: ArticleTopic[] = [
  'Account & billing',
  'Forecasts & scores',
  'Map & spots',
  'Alerts',
  'Catch log',
  'Data & privacy',
];

export const ARTICLES: Article[] = [
  // ---- Account & billing
  {
    id: 'pro-vs-free',
    question: 'What does Pro give me that Free does not?',
    topic: 'Account & billing',
    tags: ['tier', 'upgrade', 'plan', 'difference'],
    answer:
      'Pro unlocks the full 14-day forecast (free accounts see 7 days, signed-out visitors see 2), up to 10 custom alerts with composite triggers, custom spots anywhere in covered waters, the full per-spot breakdown panel (wind, swell, tide, pressure, solunar), and The Port with priority support. Free still covers the live map, city and spot pages, the 7-day forecast, 1 email alert, favourites and catch logging.',
  },
  {
    id: 'manage-subscription',
    question: 'How do I change my plan, update my card, or cancel?',
    topic: 'Account & billing',
    tags: ['stripe', 'portal', 'cancel', 'refund', 'invoice', 'receipt'],
    answer:
      'Everything billing-related lives in the Stripe customer portal. Open it from the Billing section of The Port or from your profile. You can update your card, download invoices, and cancel. Cancelling keeps your Pro access until the end of the period you already paid for; nothing is clawed back.',
  },
  {
    id: 'trial',
    question: 'How does the free trial work?',
    topic: 'Account & billing',
    tags: ['trial', 'card', 'charge'],
    answer: `Both Pro plans start with a ${TRIAL_DAYS}-day free trial. Your card is collected up front but not charged until the trial ends, and cancelling any time before then means you are never billed. During the trial your account is fully Pro, including The Port.`,
  },
  {
    id: 'complimentary-pro',
    question: 'My account says Pro is complimentary. What does that mean?',
    topic: 'Account & billing',
    tags: ['comp', 'free', 'granted', 'founding'],
    answer:
      'It means Pro was granted rather than purchased, so there is no card on file and no Stripe portal to open. You keep full Pro access, including The Port, until the date shown on your subscription card, and nothing renews or charges. If you want to continue past that date, you can subscribe normally at any point.',
  },
  {
    id: 'change-email',
    question: 'Can I change the email on my account?',
    topic: 'Account & billing',
    tags: ['email', 'address', 'login'],
    answer:
      'Not from the app yet. File a ticket under "Account & login" from the Contact section below with the address you want to move to, and we will migrate the account; your catch log, spots and alerts all come with it.',
  },
  {
    id: 'delete-account',
    question: 'How do I delete my account and data?',
    topic: 'Account & billing',
    tags: ['delete', 'remove', 'gdpr', 'erase', 'close'],
    answer:
      'Self-serve deletion is not built yet. The button in your profile is deliberately disabled rather than pretending to work. File a ticket under "Account & login" and we will delete the account and everything attached to it (catch logs, photos, spots, alerts, preferences) and confirm in writing when it is done.',
  },

  // ---- Forecasts & scores
  {
    id: 'accuracy',
    question: 'How accurate are the forecasts?',
    topic: 'Forecasts & scores',
    tags: ['accurate', 'trust', 'reliable', 'wrong'],
    answer:
      'Weather and marine inputs come from Open-Meteo and the Canadian Hydrographic Service, the same sources marine professionals use. Our scores combine those signals with species behaviour models. Treat them as advisory: a high-score window is a strong starting point, not a guarantee. Always cross-check Environment and Climate Change Canada before you launch.',
  },
  {
    id: 'score-meaning',
    question: 'What does the score number actually mean?',
    topic: 'Forecasts & scores',
    tags: ['score', '0-100', 'tier', 'rating'],
    answer:
      'It is a 0–100 estimate of how favourable conditions are for the selected species at that spot in that hour. 75 and above is good, 55–74 is fair, below 55 is poor. It is per-hour, not per-day, so read the hourly bars: a spot that averages 60 but spikes to 85 for two hours is often the better trip.',
  },
  {
    id: 'missing-factor-charts',
    question: 'Why does one species show fewer factor charts than another?',
    topic: 'Forecasts & scores',
    tags: ['charts', 'factors', 'crab', 'missing', 'breakdown'],
    answer:
      'Because the factors are species-specific and that is the correct behaviour. Dungeness crab is driven almost entirely by tidal current speed, so its breakdown shows that chart alone. Salmon species carry tide, pressure and season together and show more. A missing chart means that factor does not move that species’ score.',
  },
  {
    id: 'no-score',
    question: 'Why does a spot show a dash or a grey pin instead of a score?',
    topic: 'Forecasts & scores',
    tags: ['dash', 'grey', 'unscored', 'empty', 'no score'],
    answer:
      'The spot has not been through a scoring run yet. That is normal for a custom spot you just created, and for any spot outside the current forecast window. It resolves on the next run rather than needing anything from you.',
  },

  // ---- Map & spots
  {
    id: 'coverage',
    question: 'Which regions are covered?',
    topic: 'Map & spots',
    tags: ['region', 'area', 'bc', 'washington', 'coverage', 'where'],
    answer:
      'British Columbia is the launch region: the Salish Sea, the west coast of Vancouver Island, and parts of the north coast and inlets. Other provinces and Pacific Northwest US waters are on the roadmap. If you want a specific area prioritised, file a feature request; we rank by demand.',
  },
  {
    id: 'wrong-spot',
    question: 'A spot is wrong, missing, or in the wrong place.',
    topic: 'Map & spots',
    tags: ['incorrect', 'report', 'fix', 'move', 'add spot'],
    answer:
      'Please report it. File a ticket under "Spot data correction" with the spot URL or coordinates and what should change. We review corrections by hand before publishing so the public map stays trustworthy, which usually means a day or two rather than instantly.',
  },
  {
    id: 'custom-spot',
    question: 'How do I add my own spot?',
    topic: 'Map & spots',
    tags: ['custom', 'private', 'add', 'create', 'my spot'],
    answer:
      'Pro accounts can create custom spots anywhere in covered waters. The quickest route is the catch log: drop a photo, and if no mapped spot sits within 400 m of the pin you get a Create button that fills in the coordinates and DFO management area for you. New spots score from the next scoring run.',
  },
  {
    id: 'satellite-tab',
    question: 'The Satellite tab on a spot map is blank.',
    topic: 'Map & spots',
    tags: ['satellite', 'imagery', 'blank', 'broken', 'tab'],
    answer:
      'Known issue; see Status below. The satellite tiles download correctly but do not composite over our bespoke relief chart, so the tab renders empty. The Bathymetry and Currents tabs are unaffected. A fix is in progress; no need to report it.',
  },

  // ---- Alerts
  {
    id: 'alert-frequency',
    question: 'How often are alerts checked?',
    topic: 'Alerts',
    tags: ['frequency', 'how often', 'polling', 'delay'],
    answer:
      'Every 30 minutes. When a profile matches, we email you and then hold off for the length of that profile’s cooldown (1 to 168 hours) so a score hovering around your threshold cannot spam you.',
  },
  {
    id: 'no-alerts-arriving',
    question: 'My alert has never fired.',
    topic: 'Alerts',
    tags: ['not working', 'never', 'missing email', 'spam'],
    answer:
      'Three usual causes, in order of likelihood. One: the threshold is higher than the spot has actually reached. Check the 14-day view for that spot and see whether it has crossed your number at all. Two: active-hours filtering is excluding the window when the score peaks. Three: the email is in spam, so add noreply@reelcaster.com to your contacts. If none of those fit, file a ticket and include the alert name.',
  },
  {
    id: 'sms-alerts',
    question: 'Can I get alerts by SMS?',
    topic: 'Alerts',
    tags: ['sms', 'text', 'phone', 'push'],
    answer:
      'Yes, on Pro. Verify your phone in your profile, then turn on SMS delivery per alert. You can run email and SMS on the same alert, or either on its own. Free accounts get email only. Standard message rates from your carrier apply, and replying STOP unsubscribes you from all of them.',
  },

  // ---- Catch log
  {
    id: 'export-catches',
    question: 'Can I export my catch log?',
    topic: 'Catch log',
    tags: ['export', 'csv', 'download', 'backup'],
    answer:
      'Yes. Request an export from your profile and we email you a CSV of every catch you have logged. If you need a specific third-party log format, file a feature request naming it; we are working through the common ones.',
  },
  {
    id: 'catch-score-dash',
    question: 'Why does an older catch show a dash instead of a score?',
    topic: 'Catch log',
    tags: ['score', 'historical', 'dash', 'pending', 'old catch'],
    answer:
      'A catch only gets a score when it falls inside the forecast window at the time you logged it. Catches from before that window, or logged before their spot’s first scoring run, are marked pending or none and render a dash. The underlying conditions data is historical-capable, so proper back-scoring is planned; the score field simply is not filled in retroactively yet.',
  },
  {
    id: 'photo-no-gps',
    question: 'My photo did not place the pin correctly.',
    topic: 'Catch log',
    tags: ['exif', 'gps', 'location', 'wrong place', 'pin'],
    answer:
      'EXIF GPS is read from the original file. Screenshots, and photos sent through most messaging apps, have that data stripped before you ever get them, so use the original from your camera roll. Without GPS we fall back to your last-viewed area and you can drag the pin. There is a "Use my precise location" button on the location step; that is the only place we ever ask for the location permission, and only on an explicit tap.',
  },
  {
    id: 'species-wrong',
    question: 'The species detection got it wrong.',
    topic: 'Catch log',
    tags: ['vision', 'ai', 'species', 'incorrect', 'identify'],
    answer:
      'Tap the confidence chip next to the species name and pick the right one. Species known at that spot are listed first, with the full list underneath. Correcting it refetches the score for that species. The correction is used; low-confidence guesses are shown as suggestions precisely so they can be overridden.',
  },

  // ---- Data & privacy
  {
    id: 'gps-privacy',
    question: 'Do you store my exact GPS location?',
    topic: 'Data & privacy',
    tags: ['privacy', 'tracking', 'location', 'gps'],
    answer:
      'Only points you explicitly save: favourite spots, alert locations and catch logs. We do not track your device in the background, and the app never requests the browser location permission except when you tap "Use my precise location" during the catch wizard.',
  },
  {
    id: 'catch-sharing',
    question: 'Are my catches shared with other users?',
    topic: 'Data & privacy',
    tags: ['private', 'pool', 'share', 'community', 'anonymous'],
    answer:
      'Your catch log is private. Logged catches contribute to an anonymised community intelligence pool, the aggregate that powers "anglers here catch most on…", with exact GPS kept private and never attributed to you. Drafts contribute nothing.',
  },
  {
    id: 'regulations-authority',
    question: 'Are the DFO regulations shown here authoritative?',
    topic: 'Data & privacy',
    tags: ['dfo', 'regulations', 'legal', 'closure', 'rules'],
    answer:
      'No, they are a reference and nothing more. We aggregate DFO Pacific Region notices to surface them faster, and we link the official source on every notice. You are always responsible for following live DFO regulations. Note the regulations dataset is currently frozen (see Status), so check the official DFO source before every trip.',
  },
];

/* -------------------------------------------------------------- changelog */

export type ChangeTag = 'New' | 'Improved' | 'Fixed';

export interface ChangelogEntry {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  tag: ChangeTag;
  title: string;
  detail: string;
}

/** Newest first. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-08-09',
    tag: 'Improved',
    title: 'One price, and Apple Pay at the paywall',
    detail:
      'Pro is now a single plan — $33 a year, which is $2.75 a month — instead of a monthly/yearly choice. You can also start a trial with Apple Pay or Google Pay without leaving the page. Anyone already billing monthly stays on their existing plan and price.',
  },
  {
    date: '2026-07-30',
    tag: 'New',
    title: 'The Port opens',
    detail:
      'A dedicated support portal for Pro members: guides, a searchable knowledge base, billing self-serve, live status, and ticketing with a one business day reply target.',
  },
  {
    date: '2026-07-29',
    tag: 'New',
    title: `${TRIAL_DAYS}-day free trial on both Pro plans`,
    detail:
      'Monthly and annual now both start with a free trial. The card is collected up front but nothing is charged until the trial ends.',
  },
  {
    date: '2026-07-15',
    tag: 'Improved',
    title: 'Public site moved to the light design system',
    detail:
      'The landing page, pricing, auth and all info pages were unwalled and restyled. Signed-in surfaces follow.',
  },
  {
    date: '2026-07-11',
    tag: 'New',
    title: 'Photo-first catch logging',
    detail:
      'Drop a photo and the wizard reads EXIF, identifies species and lure by vision, matches the nearest spot within 400 m, and snapshots the conditions at the moment of the catch. Drafts and a rebuilt My catches list came with it.',
  },
  {
    date: '2026-07-02',
    tag: 'Improved',
    title: 'Spot pages rebuilt',
    detail:
      'Flush-white layout, temperature gauges for water and air, a pressure trend line, sea-state mini-bars, and a four-tab mini-map (bathymetry, satellite, currents, winds).',
  },
  {
    date: '2026-07-01',
    tag: 'Improved',
    title: 'Explore is a proper mobile page',
    detail:
      'Below the desktop breakpoint Explore is now a scrolling document (location header, contained map, sortable spot list) instead of a floating-panel map squeezed onto a phone. Tapping a pin opens the full spot page.',
  },
  {
    date: '2026-07-01',
    tag: 'Fixed',
    title: 'Factor charts no longer lose the evening',
    detail:
      'Score data is keyed on UTC days while the charts plot a local day, which silently dropped the local evening. The charts now fetch two days and window them to your local date.',
  },
];

/* ------------------------------------------------------------ known issues */

export type IssueState = 'investigating' | 'in_progress' | 'workaround';

export interface KnownIssue {
  id: string;
  title: string;
  state: IssueState;
  detail: string;
  workaround?: string;
}

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    id: 'satellite-tiles',
    title: 'Satellite tab on spot mini-maps renders blank',
    state: 'in_progress',
    detail:
      'Satellite tiles download correctly but do not composite over our custom relief chart, so the tab appears empty. A map layer ordering problem on our side, not a data outage.',
    workaround:
      'Bathymetry and Currents tabs are unaffected and cover most of what the satellite view was for.',
  },
  {
    id: 'regulations-frozen',
    title: 'DFO regulations data is frozen',
    state: 'workaround',
    detail:
      'The automated regulations scraper was retired in July. Regulation and fishery-notice content still displays, but it is no longer refreshed, so it can lag the official record. A replacement ingestion path is being scoped.',
    workaround:
      'Treat everything in-app as a pointer only and check the official DFO Pacific Region source before every trip. We link it on each notice.',
  },
  {
    id: 'historical-catch-scores',
    title: 'Older catches do not get a score',
    state: 'investigating',
    detail:
      'Scores are captured at log time from the live forecast window. Catches outside that window, or logged before their spot was first scored, show a dash permanently rather than being back-filled.',
    workaround:
      'The conditions snapshot on those catches is complete and historical; only the single score number is missing.',
  },
];

/* ----------------------------------------------------------- search index */

export interface SearchHit {
  id: string;
  section: SectionId;
  title: string;
  snippet: string;
  /** Where the hit lives, for the result badge. */
  kind: 'Guide' | 'Answer' | 'Status' | 'Update';
}

/**
 * Flatten every content source into one searchable list.
 *
 * Built once at module scope: the corpus is static, small (tens of entries),
 * and identical for every visitor, so rebuilding it per keystroke or per mount
 * would be pure waste.
 */
const INDEX: Array<SearchHit & { haystack: string }> = [
  ...GUIDES.map((g) => ({
    id: g.id,
    section: 'guides' as SectionId,
    title: g.title,
    snippet: g.summary,
    kind: 'Guide' as const,
    haystack: [
      g.title,
      g.summary,
      ...g.steps.map((s) => `${s.title} ${s.detail}`),
    ]
      .join(' ')
      .toLowerCase(),
  })),
  ...ARTICLES.map((a) => ({
    id: a.id,
    section: 'answers' as SectionId,
    title: a.question,
    snippet: a.answer,
    kind: 'Answer' as const,
    haystack: [a.question, a.answer, a.topic, ...(a.tags ?? [])]
      .join(' ')
      .toLowerCase(),
  })),
  ...KNOWN_ISSUES.map((i) => ({
    id: i.id,
    section: 'status' as SectionId,
    title: i.title,
    snippet: i.detail,
    kind: 'Status' as const,
    haystack: [i.title, i.detail, i.workaround ?? ''].join(' ').toLowerCase(),
  })),
  ...CHANGELOG.map((c) => ({
    id: `${c.date}-${c.title}`,
    section: 'status' as SectionId,
    title: c.title,
    snippet: c.detail,
    kind: 'Update' as const,
    haystack: [c.title, c.detail, c.tag].join(' ').toLowerCase(),
  })),
];

/**
 * Rank hits for a query.
 *
 * All query terms must appear somewhere in the entry (AND, not OR) — with a
 * corpus this small, OR matching returns most of the portal for any two-word
 * question, which reads as "search is broken". A title match outranks a body
 * match so "cancel" surfaces the billing article rather than a guide step that
 * happens to say the word.
 */
export function searchContent(query: string, limit = 8): SearchHit[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  return INDEX.map((entry) => {
    if (!terms.every((t) => entry.haystack.includes(t))) return null;
    const title = entry.title.toLowerCase();
    const score = terms.reduce(
      (acc, t) => acc + (title.includes(t) ? 2 : 1),
      0,
    );
    return { entry, score };
  })
    .filter((x): x is { entry: (typeof INDEX)[number]; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => ({
      id: entry.id,
      section: entry.section,
      title: entry.title,
      snippet: entry.snippet,
      kind: entry.kind,
    }));
}
