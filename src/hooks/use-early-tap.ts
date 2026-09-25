'use client';

import { useCallback, useEffect, useId, useRef } from 'react';

type EarlyTapWindow = Window & { __rcEarlyTap?: string | null };
type LiveElement = HTMLElement & { __rcLive?: boolean };

/**
 * Replays a tap the head snippet caught before this button hydrated.
 * See src/lib/early-tap-snippet.ts.
 *
 * Spread the returned props onto the button. `useId` is the same string in
 * the server HTML and on the client, which is what lets the snippet name the
 * button before React has seen it. The ref claims the element at commit, so
 * from then on the snippet stands aside and React's own onClick handles it.
 */
export function useEarlyTap(onTap: () => void) {
  const id = useId();
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;

  const ref = useCallback((el: HTMLElement | null) => {
    if (el) (el as LiveElement).__rcLive = true;
  }, []);

  useEffect(() => {
    const w = window as EarlyTapWindow;
    if (w.__rcEarlyTap !== id) return;
    w.__rcEarlyTap = null;
    document
      .querySelector(`[data-early-tap="${CSS.escape(id)}"]`)
      ?.removeAttribute('data-early-tapped');
    onTapRef.current();
  }, [id]);

  return { ref, 'data-early-tap': id };
}
