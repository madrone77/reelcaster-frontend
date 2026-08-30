/**
 * Onboarding copy. Deliberately its own, not the Port's.
 *
 * The Port's GUIDES are reference material: a member who already uses the app
 * looking one thing up, six months in. This is the first ten minutes, and the
 * two want different writing. Reference copy assumes you know what a home spot
 * is and tells you what it does; onboarding copy has to say why you would want
 * one before it says where the button is.
 *
 * The cost of that choice is a second place where a product fact can go stale,
 * and the cost is real. Same rule as the Port's content module: if something
 * here is not true of `main`, fix it in the pull request that made it untrue.
 *
 * Shared with src/lib/email-templates/welcome.ts, which walks the same steps in
 * the same order, so the email and the page cannot tell a new member two
 * different stories. The email is the short version and this is the long one;
 * the STEPS below are the single list they both read from.
 */

/** True of an action a free account cannot take. Shown as a Pro tag. */
export type StepTier = 'all' | 'pro';

export interface WelcomeStep {
  /** Stable id, used as the anchor an email link can point at. */
  id: string;
  title: string;
  /** One line, the version the email uses. */
  short: string;
  /** The longer telling, page only. */
  detail: string[];
  tier: StepTier;
  href: string;
  hrefLabel: string;
}

/**
 * What to do first, in the order that compounds.
 *
 * Home spot before saved spots before alerts is not arbitrary. The home spot
 * is what the dashboard and Explore both key off, so it is the single setting
 * that changes the most screens for the least effort. An alert with no spot to
 * hang on is a form, not a feature. Catch logging is last because it pays off
 * over a season rather than on the first trip, and asking for work before the
 * product has given anything back is how onboarding loses people.
 */
export const STEPS: WelcomeStep[] = [
  {
    id: 'home-spot',
    title: 'Set your home spot',
    short:
      'Tap the house icon on the water you fish most, and the whole app points at it.',
    detail: [
      'Open any spot and you will see a house icon in the title row, next to the star. Tapping it pins that spot as your home water.',
      'It is the one setting that changes the most screens. Your dashboard leads with that spot: its score, its hourly bars, what the conditions are doing there right now. Explore opens on its city instead of guessing from your connection, so you land on your own water rather than being flown there a second after the map draws.',
      'There is only one home spot, so setting a new one replaces the old. It saves to your account rather than to the browser, which means it is still there when you pick up your phone on the dock.',
    ],
    tier: 'all',
    href: '/explore',
    hrefLabel: 'Find your water',
  },
  {
    id: 'save-spots',
    title: 'Save the spots you fish',
    short: 'The star builds your own short list, so the morning check is one screen.',
    detail: [
      'The star sits beside the house on every spot page and on the spot cards in Explore. Starring a spot puts it on your saved list.',
      'This is the difference between checking the forecast and hunting for it. Six starred spots is a single page you read with coffee, ranked, instead of six searches around a map at 5am.',
      'A free account keeps one saved spot, so make it the one you actually launch at. Pro keeps as many as you like.',
    ],
    tier: 'all',
    href: '/favorites',
    hrefLabel: 'Your saved spots',
  },
  {
    id: 'custom-spot',
    title: 'Drop a pin where we have no spot',
    short: 'Your own coordinates, scored by the same model as a published spot.',
    detail: [
      'We do not have a pin on every piece of water worth fishing, and the one you care about may be somewhere we have never named. Pro lets you put it on the map yourself.',
      'Hit Create custom spot in the left rail on a computer, or Add spot on a phone, then tap the map where you fish. Name it, choose private or public, and tick the species you want scored. Private is the default and means nobody else can see it.',
      'A brand new custom spot draws grey with a dot instead of a number until the next scoring run reaches it. That is normal and needs nothing from you. If the pin is refused it landed outside covered water; our fence runs 50 km from a covered city.',
    ],
    tier: 'pro',
    href: '/explore',
    hrefLabel: 'Open the map',
  },
  {
    id: 'alerts',
    title: 'Set an alert and stop checking',
    short: 'Name the score you would get out of bed for, and we watch the week for you.',
    detail: [
      'Pick a spot, pick a species, pick a number. We check conditions every 30 minutes and tell you when the score crosses it.',
      'Set the number higher than feels right. A threshold of 60 on a good spot fires most weeks and you will stop reading them inside a month. Start around 78. You can always lower it later; you cannot untrain yourself to ignore us.',
      'A free account runs one alert by email. Pro runs up to ten, by text or email, and can combine conditions: westerly under 15 knots on a falling tide, rather than a score standing in for it.',
    ],
    tier: 'all',
    href: '/alerts',
    hrefLabel: 'Set an alert',
  },
  {
    id: 'log-catch',
    title: 'Log a catch from the photo',
    short: 'Drop the picture and we read the rest out of it.',
    detail: [
      'Drop the original photo, straight off the camera roll. We read the time and place out of the file in your browser, suggest the species, match it to a spot, and save what the tide, wind and pressure were doing at that exact moment.',
      'Send the photo through a messaging app first and the location and timestamp are stripped out of it, so you will be placing the pin by hand. Use the original.',
      'This is the one that pays off slowly. A season of logged catches is what turns a forecast into your forecast, and it is free on every account.',
    ],
    tier: 'all',
    href: '/log-catch',
    hrefLabel: 'Log a catch',
  },
];
