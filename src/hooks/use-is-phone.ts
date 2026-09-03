'use client';

import { useSyncExternalStore } from 'react';

/**
 * True on a phone-width screen.
 *
 * For the rare case where a phone and a desktop need different COMPONENTS
 * rather than different classes: a bottom sheet versus a centred dialog, say,
 * which cannot be one tree with a breakpoint on it. Prefer Tailwind's `sm:`
 * for anything CSS can express: this costs a listener.
 *
 * Measured on the very first client render, not in an effect. The trial modal
 * mounts on the tap that opens it, and the effect version answered `false`
 * for that first render: the centred desktop dialog mounted and opened, then
 * one frame later was torn down and replaced by the sheet. On WebKit the
 * sheet's outside-tap listener, attached a frame after the tap, could catch
 * the tail of that same tap and close the sheet it had just opened. The wall
 * flashed and vanished, and the reader tapped again. iOS sessions were
 * dismissing five walls each.
 *
 * `useSyncExternalStore` keeps the server story honest without an effect:
 * while HYDRATING, React uses the server snapshot (`false`) so the markup
 * agrees, then re-renders with the real answer; on a client-only mount it
 * reads the media query straight away. Nothing renders in the phone shape on
 * the server, and nothing opens in the wrong shape on the client.
 *
 * 640px is Tailwind's `sm`, so a component that switches on this and a
 * stylesheet that switches on `sm:` break at the same width.
 */
const PHONE = '(max-width: 639px)';

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(PHONE).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
