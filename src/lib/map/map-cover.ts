"use client";

import { useSyncExternalStore } from "react";
import type { Map as MlMap } from "maplibre-gl";

/**
 * Whether something is covering the whole screen, so a map under it can stop
 * drawing.
 *
 * Why this exists (2026-09-22): Casey opened the phone trial sheet on /explore
 * a few seconds after landing, tapped the email field, and the page froze for
 * about 8 seconds. Nothing runs on that field's focus. The map was still
 * loading underneath: every tile that arrived asked MapLibre for a frame, and
 * each frame (placement, symbol layout, the WebGL draw) ran on the main
 * thread. iOS Safari does not take a tap while the main thread is busy, so the
 * field could not focus and the keyboard could not come up. A probe of prod at
 * 4x CPU showed ~3 s of back-to-back long tasks after the sheet opened, most of
 * it in the MapLibre chunk; opened once the map had settled, one 0.2 s blip.
 *
 * The sheet hides the map completely, so nobody can see it stop. A surface
 * that covers the screen calls `coverMap()` while it is open; the map pauses
 * for as long as anything holds a cover. A count, not a flag, so two covers
 * that overlap do not release each other.
 */
let covers = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Hold the map paused. Returns the release; calling it twice is harmless. */
export function coverMap(): () => void {
  covers += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    covers -= 1;
    emit();
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMapCovered(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => covers > 0,
    () => false,
  );
}

/**
 * Stop a MapLibre map from drawing until the returned function is called.
 *
 * Every piece of MapLibre work that reaches the main thread is started by
 * `triggerRepaint()`: a tile arriving, a source's data changing, an animation
 * frame, the flow overlay's particles. `_render` is also where the source
 * caches request new tiles, so no frame means no new tile work either. Tiles
 * already in flight still finish in the workers; they just are not laid out or
 * drawn until the map resumes. The canvas keeps its last frame.
 *
 * The pause shadows the prototype method on the instance; resuming deletes the
 * shadow and asks for one frame, which restarts MapLibre's own loop (a frame
 * that finds sources still loading asks for the next).
 */
export function pauseMap(map: MlMap): () => void {
  map.triggerRepaint = () => {};
  return () => {
    delete (map as { triggerRepaint?: unknown }).triggerRepaint;
    map.triggerRepaint();
  };
}
