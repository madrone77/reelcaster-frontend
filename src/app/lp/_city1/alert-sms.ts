/**
 * The alert text the phone in the alerts band shows.
 *
 * WHY THE STRING IS BUILT HERE RATHER THAN TYPED
 *
 * It is a picture of a message the product actually sends, so the shape has to
 * be the product's shape. `format` below mirrors the composite-alert subject in
 * src/lib/email-templates/custom-alert.ts, which is also the SMS body (the
 * sender truncates that subject to 160). Typed as a finished sentence, the two
 * would drift the first time anyone touched the real one and nobody would
 * notice: nothing renders the landing page and the alert engine side by side.
 *
 * ⚠ Keep this and custom-alert.ts's `subject` identical. If the real one grows
 * a field or drops "today", this has to move with it.
 *
 * WHY THE NUMBERS ARE CONFIGURED AND NOT LIVE
 *
 * Unlike the conditions phone, which renders the real components on the real
 * payload, this is a picture of a text message: whatever it shows is frozen
 * when the page is built. Rather than pretend otherwise, the parts are written
 * down per city and reviewed as copy. The one rule is that the mark has to be
 * a mark we really score, and the hour has to be an hour it really peaks --
 * see the note on each city's own value.
 */
export interface AlertSmsParts {
  /** Species display name, as the alert would print it. */
  species: string;
  /** Mark name, spelled as `fishing_spots.name` spells it. */
  spot: string;
  /** 0-100. */
  score: number;
  /** Local hour, 0-23. */
  hour: number;
}

/**
 * "7am" / "12pm" — the alert's own hour format, which drops the space and the
 * minutes. Mirrors custom-alert.ts:
 *   toLocaleTimeString('en-US', {hour:'numeric', hour12:true})
 *     .toLowerCase().replace(' ', '')
 */
function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${hour < 12 ? "am" : "pm"}`;
}

/** `Alert: Chinook peak today at Jefferson Head, 95 at 7am` */
export function formatAlertSms(p: AlertSmsParts): string {
  return `Alert: ${p.species} peak today at ${p.spot}, ${p.score} at ${hourLabel(p.hour)}`;
}
