"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True once `ref`'s element has come within `margin` of the viewport, and true
 * from then on.
 *
 * For the maps on the landing pages. Every one of them sits below the fold on
 * a phone, and each one booted the moment the page hydrated anyway: 350 kB of
 * MapLibre on the wire, then a 1.8 s main-thread task (4x CPU) building the
 * style, right in the window a paid visitor taps "Try Pro free" in. A tap that
 * lands inside that task waits for it. Mounted on approach instead, a reader
 * who never scrolls to a map never pays for it, and the one who does pays
 * while they are reading the section above it.
 *
 * The flip waits for an idle frame so the boot never lands inside the scroll
 * frame that revealed it. Without IntersectionObserver it is true at once,
 * which is the old behaviour.
 */
export function useNearViewport(
  ref: RefObject<Element | null>,
  margin = "100px",
): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        // Safari has no requestIdleCallback.
        if (typeof window.requestIdleCallback === "function") {
          idleId = window.requestIdleCallback(() => setNear(true), { timeout: 400 });
        } else {
          timeoutId = window.setTimeout(() => setNear(true), 50);
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [near, ref, margin]);

  return near;
}
