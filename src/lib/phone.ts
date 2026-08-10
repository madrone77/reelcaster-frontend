/**
 * Phone entry for SMS alerts — North American Numbering Plan only.
 *
 * Every region we sell (see COVERED_PROVINCES: BC, WA) is +1, so asking an
 * angler to type a country code is asking them to restate something we already
 * know. These helpers let the UI show a fixed "+1" and collect ten digits,
 * while still accepting whatever someone pastes in — "(250) 555-0134",
 * "250-555-0134", "+1 250 555 0134", and "12505550134" all land on the same
 * E.164 string.
 *
 * The wire format never changes: Twilio Verify still receives +12505550134,
 * and `lib/twilio.ts` still validates full E.164 server-side. This is a typing
 * convenience, not a new contract — the day we sell somewhere outside +1, the
 * input grows a country selector and `toE164` learns other prefixes.
 */

/** NANP: area code and exchange code both start 2–9. Catches most typos. */
const NANP_RE = /^[2-9]\d{2}[2-9]\d{6}$/;

/** Just the digits of whatever was typed or pasted. */
export function digitsOf(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * National digits with the +1 country code stripped, NOT truncated. Validation
 * reads this rather than `nationalDigits` so an over-long paste fails instead
 * of being cut down to something plausible: "+44 20 7946 0958" must be
 * rejected, not silently turned into +14420794609.
 */
function untruncatedNational(raw: string): string {
  const d = digitsOf(raw);
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/**
 * The ten national digits, from any of the shapes above. A leading "1" is the
 * country code, not an area code (no NANP area code starts with 1), so it's
 * dropped. Capped at 10 so the controlled input simply stops accepting digits
 * rather than growing past a valid number.
 */
export function nationalDigits(raw: string): string {
  return untruncatedNational(raw).slice(0, 10);
}

/**
 * Display form, formatted progressively so it reads correctly while typing:
 * "250" → "(250) 555" → "(250) 555-0134".
 */
export function formatNational(raw: string): string {
  const d = nationalDigits(raw);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** True once the input holds a plausible NANP number. */
export function isValidNational(raw: string): boolean {
  return NANP_RE.test(untruncatedNational(raw));
}

/** E.164 for the wire (+12505550134), or null if it isn't a valid NANP number. */
export function toE164(raw: string): string | null {
  const d = untruncatedNational(raw);
  return NANP_RE.test(d) ? `+1${d}` : null;
}

/** E.164 back to display form, for showing a number we already stored. */
export function fromE164(e164: string | null | undefined): string {
  return e164 ? formatNational(e164) : "";
}
