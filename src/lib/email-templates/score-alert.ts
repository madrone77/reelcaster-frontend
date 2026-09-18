/**
 * Score Alert Messages
 *
 * One message per angler per day, covering every alert of theirs that has
 * something to say. It used to be one message per alert per beat, which is why
 * a Pro user with eight alerts on six nearby spots got mail on eighteen days
 * out of eighteen: eight alerts describing one weather system, each one
 * individually well behaved.
 *
 * Two beats survive:
 *
 *   heads_up    days out, said early enough to book the day off, and openly
 *               caveated because the forecast can still move
 *   confirm     the day is here or imminent and it held
 *
 * There used to be a third, `stand_down`, for a flagged day that fell apart. It
 * was written but never wired to anything, so the heads-up's closing promise
 * ("we will confirm the morning before") was kept only when the news was good.
 * The promise is gone rather than half-kept: nothing here now commits us to a
 * follow-up we do not send.
 *
 * Every line carries how far out the day is. That is what makes the early ones
 * trustworthy instead of annoying: an angler who knows a number is six days out
 * reads it as a plan, not a promise.
 *
 * WHAT THE MESSAGE IS ABOUT
 *
 * A window of water, not a number. The thing an angler wants to hear is "glass
 * at dawn on Saturday", and the score is the evidence for it, so the copy leads
 * with the conditions when it has them and falls back to the number when it
 * does not. The sea-state words are earned, never decorative, and rare by
 * design: "glass" is a claim about wind and is only said when the wind at
 * the peak hour is known and at or under GLASS_KT, which most mornings are
 * not. The ordinary alert names the window and the wind and leaves it there.
 * A message that said glass on a 12-knot morning would be the last one that
 * angler read, and one that said it every week would be filed unread.
 */

import type { AlertBeat } from '@/lib/custom-alert-engine';
// The identical private copy this file used to carry moved to ./shell when the
// welcome email needed the same guarantee for member names.
import { escapeHtml } from './shell';
// The same formatters the share card uses, so the window an angler reads in
// the email is spelled exactly as the card they forward from it.
import { stripQualifier, windowLabel } from '@/lib/share-cards';

/**
 * The conditions at the day's peak hour, as the share-card snapshot froze
 * them. Every field is optional: a lead alert (no account) never mints a
 * card, and a mint can fail, and the message must still send.
 */
export interface ScoreAlertConditions {
  /** Local hour the best window opens, 0-23. */
  windowStartHour: number | null;
  /** Local hour the best window closes, exclusive. */
  windowEndHour: number | null;
  /** "8 kn SW", as fmtWind() in share-cards-server writes it. */
  wind: string | null;
  /** "Flood 9.1 ft". */
  tide: string | null;
  /** "0.4 kn". */
  current: string | null;
}

/** One line of the digest: a fishing day at a spot. */
export interface ScoreAlertItem {
  beat: AlertBeat;
  spotName: string;
  spotSlug: string | null;
  speciesName: string | null;
  /** False when we scored the spot's best species instead of the one chosen. */
  speciesMatched: boolean;
  /**
   * Deep link back to the spot with the share card open, when one was minted
   * for this day. Absent whenever the mint could not resolve a card, which is a
   * normal outcome — the digest must still send without it.
   */
  shareUrl?: string | null;
  /** What the water is doing at the peak hour, when the mint resolved them. */
  conditions?: ScoreAlertConditions | null;
  /** The fishing day, YYYY-MM-DD. */
  targetDate: string;
  /** 0 = today. */
  leadDays: number;
  score: number;
}

export interface ScoreAlertDigestParams {
  /** Everything the angler is owed today. Drives the email. */
  items: ScoreAlertItem[];
  /**
   * The subset whose own alert asked for SMS. Drives the text, which is why it
   * is separate: the email covers every alert, the text covers only the ones
   * that asked to be texted. Defaults to `items`.
   */
  smsItems?: ScoreAlertItem[];
  /** Whether an email is also going out, which changes where the text points. */
  alsoEmailing: boolean;
  appBase: string;
  manageAlertsUrl: string;
  /**
   * Replaces the "Manage your alerts" footer line. A lead (an alert with no
   * account) has nothing to manage, so it gets sign-up and unsubscribe links
   * instead. Trusted HTML: callers build it from their own strings.
   */
  footerHtml?: string;
}

export interface ScoreAlertMessage {
  subject: string;
  html: string;
  /** Plain-text body for SMS, kept inside one segment. */
  sms: string;
}

// The app's own tokens, copied from src/styles/rc-tokens.css. Every other
// email in this folder still carries the older slate palette; this one is
// the product's score card in an inbox, so it takes the product's colours.
// Archivo and Plex Mono are the site's faces; clients that refuse web fonts
// fall through to the same system stacks the site itself falls through to.
const SANS = "'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "'IBM Plex Mono', 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const BRAND = '#2536D9';
const BRAND_SOFT = '#EDEFFE';
const INK = '#12151A';
const INK_SOFT = '#5A616B';
const INK_MUTE = '#8A919C';
const PANEL = '#FFFFFF';
const PAPER = '#F5F6F7';
const RULE = '#E2E5E9';
const RULE_SOFT = '#EDEFF1';

/** One SMS segment. */
const SMS_BUDGET = 160;

/**
 * Glass is rare and has to stay rare. It means no wind and no waves, the
 * morning an angler talks about for a month, and if the word shows up in
 * most alerts it stops meaning anything. So the bar is Beaufort 0, dead
 * calm, and wind is the only thing we can see: 2 kn or less at the peak
 * hour, and nothing over that. Most alerts will say neither word, and that
 * is the point.
 */
const GLASS_KT = 2;
/** Beaufort 1, "light air": ripples, no wavelets. Calm, not glass. */
const CALM_KT = 5;
/** The score at which a calm day gets called pristine. */
const PRISTINE_SCORE = 85;

/** rc-good / rc-fair / rc-poor and their pill pairs, same thresholds as the app. */
function tierFor(score: number) {
  if (score >= 75) return { label: 'Good', num: '#3D8B4F', bg: '#DCFCE7', ink: '#1B6B41' };
  if (score >= 55) return { label: 'Fair', num: '#C97A1C', bg: '#FEF3C7', ink: '#92400E' };
  return { label: 'Poor', num: '#B23A2F', bg: '#FEE2E2', ink: '#991B1B' };
}

// ── Reading the conditions ─────────────────────────────────────────────

type SeaState = 'glass' | 'calm' | null;

/**
 * The leading knots of "8 kn SW". Our own format, written by fmtWind() in
 * share-cards-server.ts, so the parse is exact rather than defensive; a
 * shape it does not recognise means "unknown", which is the safe answer.
 */
function windKnots(c: ScoreAlertConditions | null | undefined): number | null {
  const m = c?.wind?.match(/^(\d+)\s*kn\b/);
  return m ? Number(m[1]) : null;
}

/** "glass" / "calm" / nothing, and nothing whenever the wind is unknown. */
function seaState(item: ScoreAlertItem): SeaState {
  const kt = windKnots(item.conditions);
  if (kt === null) return null;
  if (kt <= GLASS_KT) return 'glass';
  if (kt <= CALM_KT) return 'calm';
  return null;
}

/** "Glass" for the top of a sentence, "glass" inside one. */
function seaWord(sea: SeaState, capital: boolean): string {
  if (sea === 'glass') return capital ? 'Glass' : 'glass';
  return capital ? 'Calm' : 'calm';
}

/**
 * The quality word for a window: pristine only when the score is high AND
 * the water is glass, otherwise the tier word. A high score on a 15-knot
 * day is still good fishing, but "pristine" is a word about the whole
 * morning, and like glass it has to stay rare to mean anything.
 */
function windowQuality(item: ScoreAlertItem): string {
  const rounded = Math.round(item.score);
  if (rounded >= PRISTINE_SCORE && seaState(item) === 'glass') return 'pristine';
  return tierFor(rounded).label.toLowerCase();
}

/** "6 to 10 AM", or null when the mint gave us no window. */
function windowText(item: ScoreAlertItem): string | null {
  const c = item.conditions;
  if (!c) return null;
  return windowLabel(c.windowStartHour, c.windowEndHour);
}

/**
 * The window as a headline says it: "6 to 10 this morning", "2 to 6 this
 * afternoon", or "10 AM to 2 PM today" when it straddles noon and the
 * suffixes have to stay. Null without a window.
 */
function windowPhraseToday(item: ScoreAlertItem): string | null {
  const c = item.conditions;
  if (!c || c.windowStartHour === null) return null;
  const label = windowLabel(c.windowStartHour, c.windowEndHour);
  if (!label) return null;
  // One suffix means both ends share it, and the part of day already says it.
  const suffixes = label.match(/\b[AP]M\b/g) ?? [];
  if (suffixes.length <= 1) return `${label.replace(/\s*[AP]M$/, '')} ${partOfToday(item)}`;
  return `${label} today`;
}

/** "this morning" / "this afternoon" / "this evening" / "today". */
function partOfToday(item: ScoreAlertItem): string {
  const start = item.conditions?.windowStartHour ?? null;
  if (start === null) return 'today';
  if (start < 12) return 'this morning';
  if (start < 17) return 'this afternoon';
  return 'this evening';
}

/** "in the morning" / "in the afternoon" / "in the evening" / "". */
function partOfDay(item: ScoreAlertItem): string {
  const start = item.conditions?.windowStartHour ?? null;
  if (start === null) return '';
  if (start < 12) return 'in the morning';
  if (start < 17) return 'in the afternoon';
  return 'in the evening';
}

/**
 * The name an angler says out loud. "Hat Island (Gedney Island) South End"
 * is the chart's name and belongs on the spot page; in a subject line and a
 * text message the parenthetical is a mouthful that pushes the number off
 * the end of the preview.
 */
function spokenSpot(item: ScoreAlertItem): string {
  return stripQualifier(item.spotName) || item.spotName;
}

/**
 * "Coho" rather than "Coho Salmon" in running copy. Every salmon on this
 * coast is a salmon; the pill in the email keeps the full name.
 */
function spokenSpecies(item: ScoreAlertItem, fallback: string): string {
  return item.speciesName ? item.speciesName.replace(/\s+Salmon$/i, '') : fallback;
}

// ── Dates ──────────────────────────────────────────────────────────────

/**
 * "Sat Aug 22" from "2026-08-22".
 *
 * Formatted in UTC deliberately. The date string is already the spot's local
 * calendar day, so re-interpreting it in the server's zone is how a Saturday
 * alert ends up saying Friday.
 */
function formatDay(targetDate: string): string {
  const d = new Date(`${targetDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "Saturday" from "2026-08-22". */
function weekdayOf(targetDate: string): string {
  const d = new Date(`${targetDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });
}

/** "today" / "tomorrow" / "3 days out". */
function leadPhrase(leadDays: number): string {
  if (leadDays === 0) return 'today';
  if (leadDays === 1) return 'tomorrow';
  return `${leadDays} days out`;
}

/**
 * The day as a word: "Today", "Tomorrow", "Saturday" inside the week, and
 * the dated form past it, where a bare weekday could mean either of two.
 */
function dayWord(item: ScoreAlertItem): string {
  if (item.leadDays === 0) return 'Today';
  if (item.leadDays === 1) return 'Tomorrow';
  if (item.leadDays < 7) return weekdayOf(item.targetDate);
  return formatDay(item.targetDate);
}

/** "Today" / "Tomorrow, Sat Aug 30" / "Sat Aug 30". */
function dayLabel(item: ScoreAlertItem): string {
  if (item.leadDays === 0) return 'Today';
  if (item.leadDays === 1) return `Tomorrow, ${formatDay(item.targetDate)}`;
  return formatDay(item.targetDate);
}

/** "A, B and C" without the serial comma, which reads oddly in a subject. */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// ── Copy ───────────────────────────────────────────────────────────────

/**
 * The headline of a single-item email. Conditions first, when we have them:
 * "Glass this morning" is the whole message, and the number underneath is
 * why we believe it.
 */
function headlineFor(item: ScoreAlertItem): string {
  const sea = seaState(item);
  const spot = spokenSpot(item);
  const win = windowText(item);

  if (item.beat === 'confirm') {
    if (item.leadDays === 0) {
      const when = windowPhraseToday(item) ?? partOfToday(item);
      if (sea) return `${seaWord(sea, true)} at ${spot}, ${when}`;
      return win ? `${spot} is on, ${when}` : `Today is the day at ${spot}`;
    }
    const day = dayWord(item);
    const at = win ? `, ${win}` : '';
    return sea ? `${day} held: ${seaWord(sea, false)} at ${spot}${at}` : `${day} held at ${spot}${at}`;
  }

  const at = win ? `, ${win}` : '';
  if (item.leadDays === 0) return `Today is your best shot at ${spot}${at}`;
  const day = dayWord(item);
  if (sea) return `${day} could be ${seaWord(sea, false)} at ${spot}${at}`;
  return item.leadDays === 1 ? `Tomorrow is your window at ${spot}${at}` : `${day} is shaping up at ${spot}${at}`;
}

/**
 * The sentence for one item, used on its own in a single-item email and as the
 * lead line of a digest.
 *
 * A heads-up whose day has already arrived is not a heads-up. That case exists
 * because "the best day in the window" is sometimes today, and warning that
 * today's forecast "can still move" is nonsense, so the caveat is dropped.
 */
function sentenceFor(item: ScoreAlertItem): string {
  const rounded = Math.round(item.score);
  const species = spokenSpecies(item, 'your target species');
  const quality = windowQuality(item);

  let text: string;

  if (item.beat === 'confirm') {
    text =
      item.leadDays === 0
        ? `A ${quality} window for ${species}, scoring ${rounded}. It held. Go.`
        : `Still on for ${species}: a ${quality} window, scoring ${rounded}. It held.`;
  } else if (item.leadDays <= 1) {
    text = `The best day in your next week for ${species}, scoring ${rounded}.`;
  } else {
    text = `The best day in your next week for ${species}, scoring ${rounded}. That is ${leadPhrase(item.leadDays)}, so it can still move.`;
  }

  // The alert promised a species and we scored a different one. Say so rather
  // than quietly letting the number stand in for something it is not about.
  if (!item.speciesMatched) {
    text += ` This is the spot's best species, not the one on your alert.`;
  }

  return text;
}

/**
 * The subject line, which is the only part most people read.
 *
 * The sea state goes first when it is known, because "Glass at Pedder Bay"
 * is a subject an angler opens and "Pedder Bay: Chinook 85" is one they file.
 */
function subjectFor(items: ScoreAlertItem[]): string {
  const top = items[0];
  const rounded = Math.round(top.score);
  const species = spokenSpecies(top, 'your target species');
  const spot = spokenSpot(top);
  const sea = seaState(top);

  const win = windowText(top);
  const at = win ? `, ${win}` : '';

  let lead: string;
  if (top.beat === 'confirm' && top.leadDays === 0) {
    const when = windowPhraseToday(top) ?? partOfToday(top);
    lead = sea
      ? `${seaWord(sea, true)} at ${spot}, ${when}: ${species} ${rounded}`
      : `${spot} is on ${when}: ${species} ${rounded}`;
  } else if (top.beat === 'confirm') {
    lead = `${dayWord(top)} held at ${spot}${at}: ${species} ${rounded}`;
  } else if (top.leadDays === 0) {
    lead = `Today is your best shot at ${spot}${at}: ${species} ${rounded}`;
  } else if (sea) {
    lead = `${dayWord(top)} could be ${seaWord(sea, false)} at ${spot}${at}: ${species} ${rounded}`;
  } else {
    lead = `${dayWord(top)} is shaping up at ${spot}${at}: ${species} ${rounded}`;
  }

  const rest = items.length - 1;
  if (rest === 0) return lead;
  return `${lead}, and ${rest} more ${rest === 1 ? 'window' : 'windows'}`;
}

/**
 * SMS, held to one 160-character segment.
 *
 * A digest does not fit a text message, so past a single item the text stops
 * trying to be the message and becomes a pointer to it. Naming the best day and
 * the count is enough to decide whether to look now or at lunch.
 *
 * Where it points depends on whether an email is actually going out. An
 * angler who picked SMS and nothing else has no email to be sent to, so
 * "full rundown in your email" would be pointing at a message that does not
 * exist. They get sent to the app instead.
 *
 * Built richest-first: with the window and the wind, then without, and only
 * then truncated. A long spot name costs the reader the conditions clause
 * before it costs them the end of the sentence.
 */
function smsFor(items: ScoreAlertItem[], alsoEmailing: boolean): string {
  const top = items[0];
  const rounded = Math.round(top.score);
  const species = spokenSpecies(top, 'your species');
  const spot = spokenSpot(top);
  const day = formatDay(top.targetDate);
  const rest = items.length - 1;
  const sea = seaState(top);
  const win = windowText(top);
  const wind = top.conditions?.wind ?? null;
  const tide = top.conditions?.tide?.split(' ')[0].toLowerCase() ?? null;
  const tidePhrase = tide === 'flood' || tide === 'ebb' ? `, ${tide} tide` : '';

  // The conditions clause, "6 to 10 AM, 3 kn SW, flood tide", or nothing.
  const clause = (rich: boolean) =>
    rich && win ? `, ${win}${wind ? `, ${wind}` : ''}${tidePhrase}` : '';

  const build = (rich: boolean): string => {
    if (rest === 0) {
      if (top.beat === 'confirm') {
        if (top.leadDays === 0) {
          const when = rich ? (windowPhraseToday(top) ?? partOfToday(top)) : 'today';
          const conds = rich ? `${wind ? `, ${wind}` : ''}${tidePhrase}` : '';
          return sea && rich
            ? `${seaWord(sea, true)} at ${spot}, ${when}: ${species} ${rounded}${conds}. Go.`
            : `${spot} is on ${when}: ${species} peaking at ${rounded}${conds}. Go.`;
        }
        const tail = sea && rich ? ` ${seaWord(sea, true)}.` : ' It held.';
        return `${dayWord(top)} held at ${spot}: ${species} ${rounded}${clause(rich)}.${tail}`;
      }
      // The wind is already in the clause, so the sea word is not repeated
      // after it; the headline of the email is where "could be glass" lives.
      if (top.leadDays <= 1) {
        const when = top.leadDays === 0 ? 'Today is your best shot' : 'Tomorrow is your window';
        return `${when} at ${spot}: ${species} ${rounded}${clause(rich)}.`;
      }
      return `${day} is shaping up at ${spot}: ${species} ${rounded}${clause(rich)}, ${leadPhrase(top.leadDays)}. Forecast can still move.`;
    }

    const where = alsoEmailing ? 'Full rundown in your email.' : 'See them all at reelcaster.com/alerts';
    const lead =
      sea && rich && top.leadDays === 0
        ? `${seaWord(sea, true)} at ${spot} ${partOfToday(top)}, ${species} ${rounded}`
        : `${dayWord(top)}: ${spot} ${rounded} for ${species}`;
    return `${lead}, plus ${rest} more ${rest === 1 ? 'window' : 'windows'}. ${where}`;
  };

  const rich = build(true);
  if (rich.length <= SMS_BUDGET) return rich;
  const plain = build(false);
  if (plain.length <= SMS_BUDGET) return plain;
  return `${plain.slice(0, SMS_BUDGET - 3)}...`;
}

// ── HTML ───────────────────────────────────────────────────────────────

/** The species chip the site's score card wears: "COHO SALMON · TODAY". */
function chipHtml(text: string): string {
  return `<span style="display: inline-block; background-color: ${BRAND_SOFT}; color: ${BRAND}; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; padding: 4px 8px; border-radius: 4px;">${escapeHtml(text)}</span>`;
}

/**
 * The 24-hour strip under the homepage score card, with the window solid in
 * the tier colour. The site's strip has a bar per hour scaled to that hour's
 * score; the mint does not keep the hourly curve, so this one is flat and
 * says only WHEN, which is the thing the reader is trying to find. Cells are
 * separated by a white border rather than spacing so Outlook draws them.
 */
function hourStripHtml(item: ScoreAlertItem, tierNum: string): string {
  const c = item.conditions;
  if (!c || c.windowStartHour === null) return '';
  const from = c.windowStartHour;
  const to = c.windowEndHour ?? from + 1;
  const cells = Array.from({ length: 24 }, (_, h) => {
    const on = h >= from && h < to;
    return `<td style="width: 4.1666%; height: 22px; background-color: ${on ? tierNum : RULE_SOFT}; border-left: 3px solid ${PANEL}; border-radius: 2px; font-size: 0; line-height: 0;">&nbsp;</td>`;
  }).join('');
  const tick = (label: string, align: string) =>
    `<td colspan="6" style="font-family: ${MONO}; font-size: 9px; color: ${INK_MUTE}; text-align: ${align}; padding-top: 6px;">${label}</td>`;
  return `
                <tr>
                  <td colspan="2" style="padding: 22px 0 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: separate; margin-left: -3px;">
                      <tr>${cells}</tr>
                      <tr>${tick('6A', 'right')}${tick('12P', 'right')}${tick('6P', 'right')}${tick('12A', 'right')}</tr>
                    </table>
                  </td>
                </tr>`;
}

/**
 * The homepage score card, as an email. Same parts in the same order as
 * src/app/(marketing)/components/hero-score-card.tsx: chip, spot name, the
 * best-window line with its green dot, the score with its pill, the strip.
 */
function scoreCardHtml(item: ScoreAlertItem): string {
  const rounded = Math.round(item.score);
  const tier = tierFor(rounded);
  const c = item.conditions;
  const win = windowText(item);
  const tidePhase = c?.tide?.split(' ')[0];
  const tideWord = tidePhase === 'Flood' || tidePhase === 'Ebb' ? `${tidePhase} tide` : null;
  const chip = `${item.speciesName ?? 'Best species'} · ${dayLabel(item)}`;
  const details = [c?.wind ? `Wind ${c.wind}` : null, c?.tide ?? null, c?.current ? `Current ${c.current}` : null]
    .filter((p): p is string => !!p)
    .map(escapeHtml)
    .join(' &middot; ');

  return `
          <tr>
            <td style="padding: 22px 28px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${PANEL}; border: 1px solid ${RULE}; border-radius: 4px;">
                <tr>
                  <td style="padding: 22px 24px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="vertical-align: top;">
                          ${chipHtml(chip)}
                          <p style="margin: 10px 0 0; font-size: 22px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; color: ${INK};">${escapeHtml(spokenSpot(item))}</p>
                          ${
                            win
                              ? `<p style="margin: 10px 0 0; font-family: ${MONO}; font-size: 12px; line-height: 1.4; color: ${INK};"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 4px; background-color: ${tier.num}; margin-right: 7px; vertical-align: 1px;"></span>Best window ${escapeHtml(win)}${tideWord ? ` &middot; ${tideWord}` : ''}</p>`
                              : ''
                          }
                          ${details ? `<p style="margin: 6px 0 0; font-family: ${MONO}; font-size: 11px; line-height: 1.5; color: ${INK_SOFT};">${details}</p>` : ''}
                        </td>
                        <td style="vertical-align: top; text-align: center; width: 84px; padding-left: 12px;">
                          <div style="font-size: 60px; line-height: 0.85; font-weight: 700; letter-spacing: -0.04em; color: ${tier.num};">${rounded}</div>
                          <span style="display: inline-block; margin-top: 8px; background-color: ${tier.bg}; color: ${tier.ink}; font-family: ${MONO}; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; padding: 4px 14px; border-radius: 4px;">${tier.label.toUpperCase()}</span>
                        </td>
                      </tr>
                      ${hourStripHtml(item, tier.num)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

/** "Wind 3 kn SW · Flood 9.1 ft · Current 0.4 kn", or nothing. */
function conditionsLine(item: ScoreAlertItem): string {
  const c = item.conditions;
  if (!c) return '';
  const parts = [c.wind ? `Wind ${c.wind}` : null, c.tide, c.current ? `Current ${c.current}` : null].filter(
    (p): p is string => !!p,
  );
  return parts.map(escapeHtml).join(' &middot; ');
}

/** One row of the multi-item list: the site's spot strip, one mark per row. */
function rowHtml(item: ScoreAlertItem, appBase: string): string {
  const rounded = Math.round(item.score);
  const tier = tierFor(rounded);
  const species = item.speciesName ?? 'Best species';
  const href = item.spotSlug ? `${appBase}/explore/spot/${item.spotSlug}` : appBase;
  const sea = seaState(item);
  const win = windowText(item);
  const note =
    item.beat === 'confirm'
      ? sea
        ? `Held, ${seaWord(sea, false)}`
        : 'Held'
      : sea
        ? `${leadPhrase(item.leadDays)}, could be ${seaWord(sea, false)}`
        : leadPhrase(item.leadDays);
  const conds = conditionsLine(item);

  return `
    <tr>
      <td style="padding: 16px 0; border-top: 1px solid ${RULE_SOFT};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="vertical-align: top;">
              ${chipHtml(`${species} · ${dayLabel(item)}`)}
              <p style="margin: 8px 0 0; font-size: 17px; line-height: 1.25; font-weight: 700; letter-spacing: -0.02em;"><a href="${href}" style="color: ${INK}; text-decoration: none;">${escapeHtml(spokenSpot(item))}</a></p>
              <p style="margin: 6px 0 0; font-family: ${MONO}; font-size: 11px; line-height: 1.5; color: ${INK};">${
                win
                  ? `<span style="display: inline-block; width: 6px; height: 6px; border-radius: 3px; background-color: ${tier.num}; margin-right: 6px; vertical-align: 1px;"></span>Best window ${escapeHtml(win)} &middot; `
                  : ''
              }${escapeHtml(note)}</p>
              ${conds ? `<p style="margin: 3px 0 0; font-family: ${MONO}; font-size: 11px; color: ${INK_SOFT};">${conds}</p>` : ''}
              ${
                // The alert named a species and we scored a different one. The
                // single-item body says so in its sentence; a row has no
                // sentence, and dropping the caveat here would let the number
                // quietly stand in for something it is not about.
                item.speciesMatched
                  ? ''
                  : `<p style="margin: 4px 0 0; font-size: 12px; font-style: italic; color: ${INK_MUTE};">Spot best, not your species</p>`
              }
              ${
                // One digest can cover several days, so the invitation belongs
                // on the row rather than on the single footer button — that
                // button points at whichever spot happens to be first.
                item.shareUrl
                  ? `<p style="margin: 10px 0 0;"><a href="${item.shareUrl}" style="font-family: ${MONO}; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: ${BRAND}; text-decoration: none;">Send it to someone &rarr;</a></p>`
                  : ''
              }
            </td>
            <td style="vertical-align: top; text-align: center; width: 72px; padding-left: 12px;">
              <div style="font-size: 36px; line-height: 0.85; font-weight: 700; letter-spacing: -0.04em; color: ${tier.num};">${rounded}</div>
              <span style="display: inline-block; margin-top: 6px; background-color: ${tier.bg}; color: ${tier.ink}; font-family: ${MONO}; font-size: 9px; font-weight: 600; letter-spacing: 0.14em; padding: 3px 10px; border-radius: 4px;">${tier.label.toUpperCase()}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function generateScoreAlertDigest(
  params: ScoreAlertDigestParams,
): ScoreAlertMessage {
  const { items, smsItems = items, alsoEmailing, appBase, manageAlertsUrl, footerHtml } = params;

  if (items.length === 0) {
    throw new Error('generateScoreAlertDigest called with no items');
  }

  const subject = subjectFor(items);
  // Empty when none of today's alerts asked for a text. The caller reads this
  // as "no SMS to send" rather than sending an empty message.
  const sms = smsItems.length > 0 ? smsFor(smsItems, alsoEmailing) : '';
  const top = items[0];
  const single = items.length === 1;

  // A single item keeps the hero layout: one headline and one rail is the
  // fastest thing to read, and most digests are one item. Several items
  // become a list, because a hero for one of six spots implies a ranking the
  // score does not support.
  let headline: string;
  let body: string;

  if (single) {
    headline = headlineFor(top);
    body = sentenceFor(top);
  } else {
    const spots = [...new Set(items.map(spokenSpot))];
    const glassy = items.filter((i) => seaState(i) === 'glass').length;
    headline =
      glassy > 0 && glassy === items.length
        ? `${items.length} glass windows`
        : `${items.length} windows worth a look`;
    body = `${joinList(spots.slice(0, 3))}${spots.length > 3 ? ` and ${spots.length - 3} more` : ''}. Soonest first.`;
  }

  const heroHtml = single
    ? `
          <tr>
            <td style="padding: 0 28px;">
              <h1 style="margin: 0; font-size: 24px; line-height: 1.25; font-weight: 700; letter-spacing: -0.02em; color: ${INK};">${escapeHtml(headline)}</h1>
              <p style="margin: 10px 0 0; font-size: 15px; line-height: 1.55; color: ${INK_SOFT};">${escapeHtml(body)}</p>
            </td>
          </tr>
${scoreCardHtml(top)}`
    : `
          <tr>
            <td style="padding: 0 28px;">
              <h1 style="margin: 0; font-size: 24px; line-height: 1.25; font-weight: 700; letter-spacing: -0.02em; color: ${INK};">${escapeHtml(headline)}</h1>
              <p style="margin: 8px 0 0; font-size: 15px; line-height: 1.55; color: ${INK_SOFT};">${escapeHtml(body)}</p>
            </td>
          </tr>

          <tr>
            <td style="padding: 18px 28px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                ${items.map((i) => rowHtml(i, appBase)).join('')}
              </table>
            </td>
          </tr>`;

  const ctaHref = single && top.spotSlug ? `${appBase}/explore/spot/${top.spotSlug}` : `${appBase}/alerts`;
  const ctaLabel = single ? 'See the forecast' : 'See all your spots';
  // The single hero had a share link minted for it and never showed it; the
  // rows did. Same invitation, same place it lives on the rows.
  const shareHtml =
    single && top.shareUrl
      ? `<p style="margin: 14px 0 0;"><a href="${top.shareUrl}" style="font-family: ${MONO}; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: ${BRAND}; text-decoration: none;">Send it to someone &rarr;</a></p>`
      : '';

  const eyebrow = single ? 'Score alert' : 'Your alerts';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: ${SANS}; background-color: ${PAPER};">
  <span style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapeHtml(body)}</span>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${PAPER};">
    <tr>
      <td style="padding: 28px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto;">

          <tr>
            <td style="padding: 0 4px 16px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <a href="${appBase}" style="font-size: 15px; font-weight: 700; letter-spacing: -0.02em; color: ${BRAND}; text-decoration: none;">ReelCaster</a>
                  </td>
                  <td style="vertical-align: middle; text-align: right;">
                    <span style="font-family: ${MONO}; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: ${INK_MUTE};">${eyebrow}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color: ${PANEL}; border: 1px solid ${RULE}; border-radius: 4px; padding: 26px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
${heroHtml}

                <tr>
                  <td style="padding: 24px 28px 26px;">
                    <a href="${ctaHref}" style="display: inline-block; background-color: ${BRAND}; color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; padding: 12px 20px; border-radius: 4px;">${ctaLabel}</a>${shareHtml}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 14px 28px 18px; border-top: 1px solid ${RULE};">
                    <p style="margin: 0; font-family: ${MONO}; font-size: 10px; letter-spacing: 0.04em; line-height: 1.6; color: ${INK_MUTE};">
                      ${footerHtml ?? `One message a day, at most. <a href="${manageAlertsUrl}" style="color: ${INK_SOFT};">Manage your alerts</a>`}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, sms };
}
