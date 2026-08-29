'use client';

import { useEffect, useRef, useState } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { ADSENSE_CLIENT, AD_SLOTS, type AdPlacement } from '@/lib/adsense';
import TrialModalButton from '@/app/components/paywall/trial-modal-button';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Matches the `lg:` breakpoint the Explore surfaces switch on. */
const DESKTOP_QUERY = '(min-width:1024px)';

/**
 * How long to wait for AdSense to say anything before calling the slot empty.
 *
 * A blocked loader is silent by definition — it never runs, so it never stamps
 * `data-ad-status`, and there is no event to wait for. Only a clock can tell
 * that apart from a request still in flight. Long enough that a slow network
 * isn't mistaken for a blocker (a working loader stamps in a few hundred ms);
 * short enough that the house card isn't a late arrival. An explicit
 * "unfilled" stamp doesn't wait for this at all — that answer is definitive.
 */
const SETTLE_MS = 2500;

/** What the ad request came back with, if it came back. */
type AdState = 'pending' | 'filled' | 'empty';

interface AdSlotProps {
  placement: AdPlacement;
  /**
   * Restrict the unit to one side of the `lg` breakpoint.
   *
   * Explore renders the desktop rail and the mobile sheet at the same time and
   * lets CSS hide the loser, so a placement in both lists puts two units for
   * one visible slot in the DOM. Deciding between them at runtime — by measured
   * width or visibility — is a race, and an observably flaky one: whichever
   * copy happened to be measurable first claimed the slot, and on a desktop
   * viewport that was as often the hidden mobile sheet as the visible rail.
   * Gating the render on the same media query CSS uses means only one is ever
   * mounted, so there is nothing to race.
   */
  only?: 'desktop' | 'mobile';
  /** Wrapper classes — margins/width belong to the surface, not the unit. */
  className?: string;
}

/**
 * One AdSense display unit, shown only to viewers who should see ads.
 *
 * ── The tier gate ──────────────────────────────────────────────────────────
 *
 * `isPaid` starts `false` and only becomes true once `user_settings` lands, so
 * rendering on `!isPaid` alone would show every Pro account an ad for the first
 * few hundred milliseconds of every page load — and on a cold /explore, where
 * ~140 consumers share one request, historically for as long as nine seconds.
 * Waiting for `loading` to clear first is the same guard the free-tier upsells
 * use (see the 14-day CTA in spot-detail-shell), and for the same reason: an
 * ad flashed at someone who paid to not see ads is worse than an ad shown a
 * beat late.
 *
 * Anonymous viewers do not pay that cost. Signed-out resolves to free without a
 * request, so the gate opens as soon as auth settles.
 *
 * The unit is client-only by nature — tier is not knowable during SSR, and the
 * prerendered spot pages are shared by every viewer, so an ad baked into that
 * HTML would be served to Pro accounts out of the CDN cache. Nothing here is
 * threaded through server props, which also keeps these placements clear of the
 * stale-ISR-payload failure mode.
 */
export default function AdSlot({ placement, only, className }: AdSlotProps) {
  const { isPaid, loading } = useSubscription();
  const insRef = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  // `null` until measured — there is no viewport on the server, and guessing
  // would mount the wrong copy for a tick and let it claim the slot.
  const [breakpointOk, setBreakpointOk] = useState<boolean | null>(null);
  // Whether Google actually put an ad in the box, and what to show if not.
  //
  // AdSense stamps `data-ad-status` on the element it answers for, so that
  // attribute is the only honest signal that there is an ad on the page. It
  // decides both halves of what renders here: the "remove ads" link needs an
  // ad to be removing — offering to remove one the reader cannot see reads as
  // a bug at best and an invented excuse to sell at worst — and the house card
  // needs the opposite, an empty slot to stand in for.
  const [adState, setAdState] = useState<AdState>('pending');

  useEffect(() => {
    if (!only) return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const sync = () =>
      setBreakpointOk(only === 'desktop' ? mql.matches : !mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, [only]);

  const unit = AD_SLOTS[placement];
  const shouldRender =
    !loading && !isPaid && unit.slot !== '' && (!only || breakpointOk === true);

  useEffect(() => {
    if (!shouldRender) return;

    const el = insRef.current;
    if (!el) return;

    const enqueue = () => {
      // One push per <ins>, ever. React runs effects twice under StrictMode in
      // development, and AdSense rejects the whole queue entry with "All ins
      // elements in the body of the page already have ads in them" if the same
      // element is enqueued again. `data-adsbygoogle-status` is what the script
      // stamps on an element it has claimed — checking it covers the remount
      // case that a ref alone would miss.
      if (pushed.current) return true;
      if (el.getAttribute('data-adsbygoogle-status')) return true;

      // AdSense sizes a responsive unit from the width of the element at the
      // moment it is enqueued, and rejects the push outright — "No slot size
      // for availableWidth=0" — if that width is zero. The tier gate makes this
      // the normal case rather than a rare one: the unit does not exist until
      // `loading` clears, so it is inserted and enqueued in the same commit,
      // ahead of the layout pass that would give it a width. Waiting for a real
      // measurement is the difference between an ad slot and a logged error.
      if (el.offsetWidth === 0) return false;
      // Width alone does not prove the unit is on screen — a hidden ancestor
      // can still leave a measurable box. `only` already keeps Explore from
      // mounting both breakpoints' copies, so this is the backstop for any
      // surface that hides a subtree without unmounting it: never spend an ad
      // request on a slot nobody can see.
      if (el.offsetParent === null) return false;

      pushed.current = true;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // An ad that fails to enqueue is not worth a broken page. The most
        // common cause is the loader being blocked, which is not ours to fix.
        pushed.current = false;
      }
      return true;
    };

    if (enqueue()) return;

    // Not measurable yet. Retry on every size change until it is.
    //
    // This is deliberately a ResizeObserver and not an IntersectionObserver.
    // An unfilled <ins> is zero-height, so it already counts as intersecting
    // the moment it is observed — the callback fires once, finds no width yet,
    // and then never fires again, because intersection observers report
    // changes in intersection, not in size. Watching size is what actually
    // tracks the thing being waited on, and it fires on observe, so an element
    // that is already measurable enqueues immediately.
    const observer = new ResizeObserver(() => {
      if (enqueue()) observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldRender]);

  // Watch for the answer. Separate from the enqueue effect above because it
  // outlives it: that one disconnects the moment the push succeeds, and the
  // status attribute doesn't land until the ad request comes back after it.
  useEffect(() => {
    if (!shouldRender) return;
    const el = insRef.current;
    if (!el) return;

    const sync = () => {
      const status = el.getAttribute('data-ad-status');
      if (status !== 'filled' && status !== 'unfilled') return false;
      setAdState(status === 'filled' ? 'filled' : 'empty');
      return true;
    };

    if (sync()) return;

    // The two reference each other — whichever resolves first cancels the
    // other. Both closures run long after this block, so the forward reference
    // to `timer` is only a textual one.
    const observer = new MutationObserver(() => {
      if (!sync()) return;
      observer.disconnect();
      clearTimeout(timer);
    });
    observer.observe(el, {
      attributes: true,
      attributeFilter: ['data-ad-status'],
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      setAdState('empty');
    }, SETTLE_MS);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  // Nothing came back and the placement has a house card, so run it instead.
  //
  // The <ins> is unmounted rather than hidden. A hidden one could still be
  // filled later, which spends an impression on an ad nobody can see — worse
  // than losing the slot, and not something to do to an advertiser. This is
  // also why SETTLE_MS is generous: by the time we get here the slot is being
  // given away, so the only mistake worth guarding against is calling it too
  // early.
  //
  // Covers a blocked loader and an honest no-fill alike. They are not
  // distinguishable from here and don't need to be: either way there is a
  // card-shaped hole in the rail and nothing in it.
  if (adState === 'empty') {
    if (!unit.house) return null;
    return (
      <div className={className} data-ad-placement={placement}>
        <HouseCard placement={placement} />
      </div>
    );
  }

  // An in-feed unit is shaped by its layout key and takes its width from the
  // list row it occupies; `full-width-responsive` is an `auto` concept and is
  // not meaningful there. Sending both would describe two different units.
  const shapeAttrs =
    unit.format === 'fluid'
      ? { 'data-ad-layout-key': unit.layoutKey }
      : { 'data-full-width-responsive': 'true' };

  return (
    <div className={className} data-ad-placement={placement}>
      <ins
        ref={insRef}
        className="adsbygoogle block"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={unit.slot}
        data-ad-format={unit.format}
        {...shapeAttrs}
      />

      {/* The way out, offered where the reason to want it is. This is the one
          upgrade prompt on the site that doesn't have to argue for itself: the
          reader is looking at the ad while they read it.

          It opens the same trial modal every other wall does, on the row that
          covers it, so "remove ads" and "here is what else Pro is" are one
          click rather than two. Deliberately quiet — small, muted, and set off
          from the unit — because a loud CTA butted against an ad is both worse
          copy and the kind of adjacency AdSense treats as encouraging
          accidental clicks. */}
      {adState === 'filled' && (
        <div className="mt-2 text-center">
          <TrialModalButton
            feature="remove-ads"
            from={`ads-${placement}`}
            data-testid="ad-remove-cta"
            className="text-[11px] leading-none text-rc-ink-mute underline underline-offset-2 transition-colors hover:text-rc-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 rounded-sm"
          >
            Click here to remove ads
          </TrialModalButton>
        </div>
      )}
    </div>
  );
}

/**
 * The house ad: what fills the slot when nothing else did.
 *
 * Built to the rail card's own shell — same panel, same rule, same rounding,
 * same body padding, same footer step — because a slot in a list of cards
 * should be a card. Anything that reads as "an ad failed here" is worse than
 * the ad would have been.
 *
 * The ask is plain, and deliberately not aggrieved. Most of the people reading
 * this blocked the ad on purpose; scolding them is how you turn a maybe into a
 * no. It states what pays for the map, asks once, and gets out of the way.
 */
function HouseCard({ placement }: { placement: AdPlacement }) {
  return (
    <div
      className="bg-rc-panel border border-rc-rule rounded overflow-hidden"
      data-testid="ad-house-card"
    >
      <div className="px-3 pt-3 pb-2.5">
        <p className="text-[15px] font-medium text-rc-ink">
          Enjoying ReelCaster?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-rc-ink-soft">
          Ads keep the map free. Please support us by upgrading to Pro.
        </p>
      </div>

      {/* The footer step, exactly where a spot card puts FULL REPORT — so the
          eye lands on the action in the place it has already learned to. */}
      <div className="flex items-stretch border-t border-rc-rule bg-rc-surface">
        <TrialModalButton
          feature="support-the-map"
          from={`ads-house-${placement}`}
          data-testid="ad-house-cta"
          className="flex-1 text-left px-3 py-2 font-rc-mono text-[11px] font-semibold tracking-[0.08em] text-rc-brand hover:bg-rc-brand-soft/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rc-brand"
        >
          UPGRADE TO PRO →
        </TrialModalButton>
      </div>
    </div>
  );
}
