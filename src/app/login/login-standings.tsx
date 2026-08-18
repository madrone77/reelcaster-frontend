'use client'

import { useEffect, useState } from 'react'
import { formatHour12 } from '@/lib/time-format'

// Same Salish Sea extent the marketing map uses — the region with scored spots.
const SALISH_BBOX = '-125.60,48.00,-122.60,49.60'

type State = 'Good' | 'Fair' | 'Poor'
type Spot = {
  name: string
  species: string | null
  score: number
  state: State
  hours: (number | null)[] | null // 0–100 per local hour, for the rank-1 sparkline
  peakHour: number | null
}

// Same thresholds as explore-data's tierFor.
function tier(score: number): State {
  return score >= 75 ? 'Good' : score >= 55 ? 'Fair' : 'Poor'
}

function fmt12(h: number | null): string | null {
  return h == null ? null : formatHour12(h)
}

const CHIP: Record<State, string> = {
  Good: 'bg-rc-good-bg text-rc-good-ink',
  Fair: 'bg-rc-fair-bg text-rc-fair-ink',
  Poor: 'bg-rc-poor-bg text-rc-poor-ink',
}
const NUM: Record<State, string> = {
  Good: 'text-rc-good-ink',
  Fair: 'text-rc-fair-ink',
  Poor: 'text-rc-ink-soft',
}

// Shown immediately and whenever live data is unavailable (e.g. the BlueCaster
// API is unreachable in this environment). The panel always has content.
const FALLBACK: Spot[] = [
  {
    name: 'Constance Bank',
    species: 'Chinook',
    score: 82,
    state: 'Good',
    hours: [
      22, 28, 25, 30, 26, 35, 32, 28, 40, 34, 30, 44, 40, 38, 52, 62, 80, 88,
      84, 55, 45, 40, 36, 30,
    ],
    peakHour: 17,
  },
  { name: 'Sooke Bluffs', species: null, score: 76, state: 'Good', hours: null, peakHour: null },
  { name: 'Race Rocks', species: null, score: 71, state: 'Fair', hours: null, peakHour: null },
  { name: 'Oak Bay Flats', species: null, score: 68, state: 'Fair', hours: null, peakHour: null },
  { name: 'Sheringham', species: null, score: 61, state: 'Fair', hours: null, peakHour: null },
]

export default function LoginStandings() {
  const [spots, setSpots] = useState<Spot[]>(FALLBACK)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Same-origin proxy → live top-scored public spots (key stays server-side).
    // On any failure (incl. the data API being down) we keep the fallback.
    fetch(`/api/bluecaster/map/spots?bbox=${encodeURIComponent(SALISH_BBOX)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.spots?.length) return
        const species: Record<string, { name: string }> = payload.species ?? {}
        const derived: Spot[] = payload.spots
          .map((s: Record<string, unknown>): Spot => {
            const scores = (s.scores ?? {}) as Record<
              string,
              { peak?: number; peak_hour?: number; hours?: ({ s?: number } | null)[] }
            >
            let best = 0
            let bestId: string | null = null
            let bestStrip: (typeof scores)[string] | null = null
            for (const [id, strip] of Object.entries(scores)) {
              if (typeof strip?.peak === 'number' && strip.peak > best) {
                best = strip.peak
                bestId = id
                bestStrip = strip
              }
            }
            const score = Math.round(best * 100)
            const hours = bestStrip?.hours
              ? bestStrip.hours.map((h) =>
                  h && typeof h.s === 'number' ? Math.round(h.s * 100) : null,
                )
              : null
            return {
              name: String(s.name ?? ''),
              species: (bestId && species[bestId]?.name) || null,
              score,
              state: tier(score),
              hours,
              peakHour: typeof bestStrip?.peak_hour === 'number' ? bestStrip.peak_hour : null,
            }
          })
          .filter((x: Spot) => x.score > 0)
          .sort((a: Spot, b: Spot) => b.score - a.score)
          .slice(0, 5)
        if (derived.length) {
          setSpots(derived)
          setIsLive(true)
        }
      })
      .catch(() => {
        /* keep fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const [top, ...rest] = spots
  const topWindow = fmt12(top.peakHour)

  return (
    <div className="mt-6">
      {/* RANK 1 — the "live now" spot: full card + window chart. */}
      <div className="rounded border border-rc-rule bg-rc-panel p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-rc-ink">{top.name}</p>
            <p className="mt-0.5 font-rc-mono text-xs text-rc-ink-soft">
              {[top.species, topWindow && `peak ${topWindow}`].filter(Boolean).join(' · ') ||
                'Best window today'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-3xl font-black leading-none tabular-nums ${NUM[top.state]}`}>
              {top.score}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${CHIP[top.state]}`}
            >
              {top.state}
            </span>
          </div>
        </div>

        {top.hours && top.hours.length > 0 && (
          <div className="mt-3">
            {/* 24-hour sparkline; the best-window run (peak hour ±1) is
                rc-good-ink (#166534), the rest rc-rule (#DEE2EA). The caption
                below carries the meaning, so state is never color-only. */}
            <svg
              viewBox="0 0 240 32"
              className="h-7 w-full"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {top.hours.slice(0, 24).map((h, i) => {
                const height = Math.max(3, Math.round(((h ?? 0) / 100) * 30))
                const isWindow = top.peakHour != null && Math.abs(i - top.peakHour) <= 1
                return (
                  <rect
                    key={i}
                    x={i * 10}
                    y={32 - height}
                    width={6}
                    height={height}
                    rx={1}
                    fill={isWindow ? '#166534' : '#DEE2EA'}
                  />
                )
              })}
            </svg>
            {topWindow && (
              <p className="mt-1.5 font-rc-mono text-[11px] text-rc-ink-soft">
                Best window ~{topWindow} today
              </p>
            )}
          </div>
        )}
      </div>

      {/* THE BREAK — a wide seam (mt-8 ≈ 32px) separates "live now" from the
          waiting pack, which sits on a tight 8px gutter (space-y-2). */}
      <div className="mt-8 space-y-2">
        {rest.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between rounded border border-rc-rule bg-rc-panel px-3 py-2"
          >
            <span className="text-sm text-rc-ink">{s.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tabular-nums text-rc-ink">{s.score}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${CHIP[s.state]}`}
              >
                {s.state}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Honest data cue: live top public spots vs. the sample fallback. */}
      <p className="mt-6 text-center font-rc-mono text-[10px] uppercase tracking-wider text-rc-ink-soft">
        {isLive ? 'Live · top spots right now' : 'Sample standings · live after sign-in'}
      </p>
    </div>
  )
}
