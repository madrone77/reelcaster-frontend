'use client';

import { useEffect, useState } from 'react';

/**
 * True on a phone-width screen.
 *
 * For the rare case where a phone and a desktop need different COMPONENTS
 * rather than different classes — a bottom sheet versus a centred dialog, say,
 * which cannot be one tree with a breakpoint on it. Prefer Tailwind's `sm:`
 * for anything CSS can express: this costs a render and a listener.
 *
 * Starts false and stays false until the effect has measured, so the server
 * render and the first client render agree. Anything that renders on the
 * server in the phone shape would hydrate wrong; anything that opens on a tap
 * has already measured by then.
 *
 * 640px is Tailwind's `sm`, so a component that switches on this and a
 * stylesheet that switches on `sm:` break at the same width.
 */
const PHONE = '(max-width: 639px)';

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    setPhone(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPhone(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return phone;
}
