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
  // Whether Google actually put an ad in the box. The "remove ads" link below
  // is gated on it: an unfilled <ins> is a zero-height nothing, and offering to
  // remove an ad the reader cannot see reads as a bug at best and an invented
  // excuse to sell at worst. AdSense stamps `data-ad-status` on the element it
  // fills, so that attribute is the only honest signal that there is an ad on
  // the page — no stamp (loader blocked, or no fill) means no link.
  const [filled, setFilled] = useState(false);

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

  // Watch for the fill stamp. Separate from the enqueue effect above because
  // it outlives it: that one disconnects the moment the push succeeds, and the
  // status attribute doesn't land until the ad request comes back after it.
  useEffect(() => {
    if (!shouldRender) return;
    const el = insRef.current;
    if (!el) return;

    const sync = () =>
      setFilled(el.getAttribute('data-ad-status') === 'filled');
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(el, {
      attributes: true,
      attributeFilter: ['data-ad-status'],
    });
    return () => observer.disconnect();
  }, [shouldRender]);

  if (!shouldRender) return null;

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
      {filled && (
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
