'use client'

import { useEffect } from 'react'
import { sendVitals, surfaceFor } from '@/lib/web-vitals-beacon'

/**
 * How long the paywall took to appear, as the reader felt it: from the tap
 * that asked for it to the first frame with the sheet painted. Reported as
 * metric MODAL into web_vitals_daily, by surface, beside LCP and INP, and
 * read back by the admin's Mission Control ("Modal open p75").
 *
 * WHY A GLOBAL INPUT CLOCK. A wall is opened from a dozen call sites (locked
 * days, the star, spot cards, the hero, the licence CTA), and the modal is a
 * code-split chunk that can arrive after the tap. So nothing at the call
 * site is timed: a capture-phase listener, mounted with the page, notes when
 * the last pointerdown or key landed, and the modal reads it when it paints.
 * `event.timeStamp` is on the same clock as `performance.now()`, and it is
 * when the finger landed, not when the handler ran, so time the main thread
 * spent busy before the handler is counted, the way INP counts it.
 *
 * WHEN IT IS NOT A TAP. A wall can open with no input behind it (the
 * engagement nag, a return from sign-in). Anything more than STALE_MS after
 * the last input is not a response to it and is not reported, and an input
 * is spent once, so a second wall on the same tap cannot report twice.
 *
 * PAINTED, NOT RENDERED. The open effect runs after React commits, before the
 * browser paints; a requestAnimationFrame callback runs just before the next
 * paint, and a task queued from it runs after that paint. That is the frame
 * the reader first sees the sheet in.
 */

const STALE_MS = 10_000

let lastInput: number | null = null
let installed = false

function note(e: Event) {
  lastInput = e.timeStamp
}

/** Mount once, high in the tree (the web-vitals reporter does). */
export function useInputClock(): void {
  useEffect(() => {
    if (installed) return
    installed = true
    const opts = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', note, opts)
    window.addEventListener('keydown', note, opts)
    return () => {
      installed = false
      window.removeEventListener('pointerdown', note, opts)
      window.removeEventListener('keydown', note, opts)
    }
  }, [])
}

/** Call from the modal's open effect. Never throws, never reports twice per tap. */
export function reportModalOpen(): void {
  try {
    const from = lastInput
    lastInput = null
    if (from === null) return
    const surface = surfaceFor(window.location.pathname)
    if (!surface) return
    requestAnimationFrame(() => {
      setTimeout(() => {
        const ms = performance.now() - from
        if (ms < 0 || ms > STALE_MS) return
        if (document.visibilityState !== 'visible') return
        sendVitals([{ surface, metric: 'MODAL', value: Math.round(ms) }])
      }, 0)
    })
  } catch {
    // A timer is never worth an error to the reader.
  }
}
