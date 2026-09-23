'use client';

import { useEffect, useState, type ComponentType } from 'react';

/**
 * A code-split component, loaded on demand, WITHOUT Suspense.
 *
 * `next/dynamic` is the obvious tool for this and it is the wrong one for a
 * modal, for a reason that only shows up once the chunk is already warm.
 * `dynamic()` renders through `React.lazy`, so the first render of the modal
 * suspends, React commits the boundary's fallback — which is nothing, since
 * these have no `loading` — and then holds the real content back for React's
 * fallback throttle before revealing it. That throttle exists so a fallback
 * that flashes for 10ms does not flash at all, and it is measured in
 * hundreds of milliseconds.
 *
 * Measured on /explore, production build, tap on a locked day with the chunk
 * already preloaded (see ../lib/paywall-preload):
 *
 *     +4ms    <ProTrialModal> renders, suspends on the lazy boundary
 *     +308ms  it renders again — the throttle, not the network
 *     +345ms  the sheet is in the DOM
 *
 * Nothing was being fetched in that 300ms gap and the main thread was idle.
 * Opening the same sheet a second time, with the boundary already resolved,
 * took 16ms.
 *
 * So the module is loaded the plain way instead: an effect, a promise, a
 * state update. The component is null for exactly as long as the import takes
 * — a microtask, once the chunk is warm — and React never sees a suspended
 * render, so there is no fallback to throttle.
 *
 * `load` MUST be a module-level constant. Passed inline it is a new function
 * every render, and the effect would re-run forever.
 *
 * @param load    The dynamic import, e.g. `() => import('./heavy-modal')`.
 * @param active  Whether to load it yet. Usually the modal's own `open`,
 *                latched by `useMountedOnce` so a close does not unload it.
 */
export function useLazyComponent<P>(
  load: () => Promise<{ default: ComponentType<P> }>,
  active: boolean,
): ComponentType<P> | null {
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);

  useEffect(() => {
    if (!active || Component) return;
    let alive = true;
    void load()
      .then((mod) => {
        // The setState updater form, or React calls the component as one.
        if (alive) setComponent(() => mod.default);
      })
      .catch(() => {
        // Nothing renders, which is what a failed `dynamic()` does too. The
        // next open tries again; a wall that cannot load must not take the
        // page down with it.
      });
    return () => {
      alive = false;
    };
  }, [active, Component, load]);

  return Component;
}
