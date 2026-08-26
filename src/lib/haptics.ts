/**
 * One light tick of physical feedback, for scrubbing controls.
 *
 * Two scrubbers share this: the 24h chart on the spot page and the map's hour
 * bar. They drive the same `selectedHour`, so they have to feel the same —
 * one of them tapping and the other silent reads as one of them being broken.
 *
 * There is no single API that does this on the web. There are two, and which
 * one a phone has splits cleanly along the platform line:
 *
 *   Android / Chrome   `navigator.vibrate`. Real, spec'd, does what it says.
 *   iOS / Safari       has never implemented `navigator.vibrate` — the call is
 *                      simply absent, so the old `navigator.vibrate?.(8)` was
 *                      a silent no-op on every iPhone.
 *
 * The iPhone path is a trick, and worth stating plainly rather than burying:
 * since iOS 17.4 Safari plays the system toggle haptic when the user flips an
 * `<input type="checkbox" switch>`. A programmatic click on that switch's
 * label, made inside a real user gesture, counts as the user flipping it. So
 * we keep one hidden switch in the document and click it. That is the whole
 * mechanism. It is not a haptics API and Apple has not promised it will keep
 * working, which is why it sits behind a feature test and why every failure
 * mode here is "nothing happens" rather than "something throws".
 *
 * Rules this file lives by:
 *   - Never throws. A missing tap is not worth breaking a drag over.
 *   - Only ever call it from inside a user gesture (pointerdown / pointermove
 *     under a held finger). Outside one, both paths are inert on purpose.
 *   - Mouse input gets nothing. Callers decide that; see `pointerType`.
 */

/** How long a tick is on the `navigator.vibrate` path, in ms. Barely there. */
const VIBRATE_MS = 8;

/**
 * Floor on the gap between ticks, in ms.
 *
 * A finger can flick the length of a 24-hour chart in a few frames, and every
 * hour boundary it crosses asks for a tick. Twenty-odd taps queued back to
 * back stop reading as ticks and start reading as a buzz — worse on the iOS
 * path, where each one is a real toggle the system animates and can fall
 * behind on. 40ms lets a deliberate scrub tick on every hour while a flick
 * degrades to a coarser rattle instead of a smear.
 */
const MIN_GAP_MS = 40;

/**
 * `-Infinity`, not 0. `performance.now()` counts from when the page started
 * loading, so a 0 here would put the whole first 40ms of the page inside the
 * throttle window and silently eat the first tick of anyone who reaches the
 * chart that fast.
 */
let lastTickAt = -Infinity;

/**
 * The hidden iOS switch, built once and kept. `null` until first use on a
 * browser that needs it; stays `null` everywhere else.
 */
let iosSwitch: HTMLInputElement | null = null;
let iosLabel: HTMLLabelElement | null = null;

/**
 * Does this browser have the `switch` attribute on checkboxes?
 *
 * Cached because the answer cannot change for the life of the page, and this
 * runs on a pointermove path. `undefined` means "not asked yet".
 */
let switchSupported: boolean | undefined;

function supportsIosSwitch(): boolean {
  if (switchSupported === undefined) {
    switchSupported =
      typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype;
  }
  return switchSupported;
}

/**
 * Build the hidden switch and its label, once.
 *
 * It has to be genuinely rendered — `display:none`, `visibility:hidden` and a
 * zero-size box all stop the click from counting, and with it the haptic. So
 * it is a real 1px element parked off-screen, transparent, and unreachable by
 * pointer or keyboard: `pointer-events:none` keeps a finger from ever landing
 * on it, `tabindex="-1"` keeps it out of the tab order, and `aria-hidden`
 * keeps it out of the accessibility tree, where an unlabelled switch would
 * otherwise be announced as a control the reader can operate.
 */
function ensureIosSwitch(): HTMLLabelElement | null {
  if (iosLabel) return iosLabel;
  if (typeof document === "undefined") return null;

  const id = "rc-haptic-switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  // Not in the HTMLInputElement typings yet; it is what makes the haptic fire.
  input.setAttribute("switch", "");
  input.id = id;
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;margin:0;border:0;padding:0;appearance:none";

  const label = document.createElement("label");
  label.htmlFor = id;
  label.setAttribute("aria-hidden", "true");
  label.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";

  document.body.append(input, label);
  iosSwitch = input;
  iosLabel = label;
  return label;
}

/**
 * Flip the hidden switch, which is what iOS turns into a tap.
 *
 * The click lands on the label, not the input: Safari plays the haptic for the
 * label-mediated toggle and not for `input.click()`. Direction does not matter
 * — on and off both tick — so the switch just alternates and is never read.
 *
 * Clicking a label focuses its control, which would quietly steal focus from
 * the chart's SVG mid-drag and kill its arrow-key scrubbing for anyone who
 * then reaches for the keyboard. So we put focus back where it was, in the
 * same tick, before anything can observe the difference.
 */
function iosTick(label: HTMLLabelElement) {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  label.click();
  if (document.activeElement === iosSwitch && previouslyFocused?.focus) {
    previouslyFocused.focus({ preventScroll: true });
  }
}

/**
 * Tick once, if this device can.
 *
 * Safe to call anywhere, on any platform, at any rate — a browser with neither
 * path, a server render, and a call inside the throttle window all do nothing
 * and return quietly.
 */
export function haptic(): void {
  try {
    if (typeof window === "undefined") return;

    const now = performance.now();
    if (now - lastTickAt < MIN_GAP_MS) return;
    lastTickAt = now;

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(VIBRATE_MS);
      return;
    }

    if (supportsIosSwitch()) {
      const label = ensureIosSwitch();
      if (label) iosTick(label);
    }
  } catch {
    // A tick is a nicety. Nothing here is worth interrupting a gesture for.
  }
}
