"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";
import { timezoneFor } from "@/lib/regions";
import { stripPaidIntel } from "@/app/fishing/[country]/[state]/[city]/[spot]/strip-paid-intel";
import type {
  SpotCityLink,
  SpotPageForClient,
} from "@/app/fishing/[country]/[state]/[city]/[spot]/spot-detail-shell";
import type { RailSpot } from "../lib/explore-data";
import type { AdMode } from "@/lib/ad-mode";

// The whole spot page, as a client chunk. Explore never renders it on the
// server, and it is by far the heaviest thing this map can open, so it loads
// on the first tap rather than riding in with the map.
const SpotDetailShell = dynamic(
  () => import("@/app/fishing/[country]/[state]/[city]/[spot]/spot-detail-shell"),
  { ssr: false },
);

/** How long a tap waits for auth to settle before fetching anonymous. */
const AUTH_WAIT_MS = 1500;
/** How long a payload request may take before it counts as failed. */
const FETCH_TIMEOUT_MS = 20_000;

/** The history.state key that marks "a spot sheet is open" on this entry. */
const HISTORY_KEY = "rcSpotSheet";

/** Country segment of a /fishing path → breadcrumb label. */
const COUNTRY_LABEL: Record<string, string> = { ca: "Canada", us: "USA" };

/**
 * The spot's place in the directory, read off the canonical path the rail
 * already carries: `/fishing/<country>/<state>/<city>/<spot>`. Null when the
 * spot has no public home (a custom spot, a city still building), which is
 * also when the page itself has no breadcrumb to show.
 */
function cityLinkFrom(spot: RailSpot | null): SpotCityLink | null {
  const parts = spot?.path?.split("/").filter(Boolean);
  if (!spot || !parts || parts.length !== 5) return null;
  const [root, country, state, city] = parts;
  return {
    cityName: spot.cityName,
    cityPath: `/${root}/${country}/${state}/${city}`,
    provinceName: spot.regionName,
    provincePath: `/${root}/${country}/${state}`,
    countryName: COUNTRY_LABEL[country] ?? country.toUpperCase(),
  };
}

type Loaded = {
  slug: string;
  page: SpotPageForClient;
  tz: string;
  /** Fixed at load, not re-read per render: the shell's clock hook seeds
   *  itself from it once and ticks on its own. */
  nowMs: number;
};

/**
 * The phone's spot page, as a sheet over the Explore map.
 *
 * A card or pin tap on a phone used to navigate to the spot's page, and the
 * only way back to the map was the browser's Back button or a link near the
 * top of a long read. Comparing two spots cost four navigations and lost the
 * map's state in between. This keeps the map mounted underneath and slides
 * the same page up over it, the way a listing opens over a map on Zillow or
 * a place opens over Apple Maps.
 *
 * It is the SAME page: `SpotDetailShell` with its `sheet` prop set, fed by
 * the same live payload the page's server loader reads, fetched through the
 * same-origin proxy. Nothing about the spot is rendered differently, only
 * the frame around it. See the `sheet` prop on the shell for what changes.
 *
 * Only ever mounted under `lg`. Desktop has the rail drawer and never sets
 * a slug here.
 *
 * ── Back button ──────────────────────────────────────────────────────
 * Opening pushes one history entry, marked in `history.state`, so the
 * hardware Back on Android and the swipe-back on iOS close the sheet rather
 * than leaving Explore. Closing from the sheet's own controls pops that same
 * entry, so the two ways out leave the stack in the same shape. The URL does
 * not change: the spot page's own URL would make a reload land on the page,
 * but it would also move `usePathname` out from under the map, and the map
 * keeps `?spot=` and friends in this URL with replaceState. `history.state`
 * is spread rather than replaced because Next keeps its own router state in
 * it and reloads the page on a popstate whose state it does not recognise.
 */
export default function MobileSpotSheet({
  slug,
  spot,
  onClose,
  onOpenSpot,
  ad = null,
}: {
  /** The spot to show, or null for closed. */
  slug: string | null;
  /** The ad frame this map is under, when it is: the sheet's page keeps the
   *  wall's forecast tier and counts the campaign hit the way the framed spot
   *  page does. Null is the product. */
  ad?: AdMode | null;
  /** The rail's row for it, when it is in the loaded viewport: names the
   *  sheet while the payload loads and places the spot in the directory. A
   *  searched spot can arrive without one. */
  spot: RailSpot | null;
  onClose: () => void;
  /** Swap to another spot without closing (a nearby card). */
  onOpenSpot: (slug: string) => void;
}) {
  const { session, loading: authLoading } = useAuth();
  // The string, not the session object: a token refresh hands out a new
  // object with the same token, and that is not a reason to fetch again.
  const accessToken = session?.access_token;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Has the reader scrolled into the page? Drives the header's collapse and
  // the sheet going edge to edge. Hysteresis so a bounce at the top does not
  // flap it.
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback(() => {
    const top = scrollerRef.current?.scrollTop ?? 0;
    setScrolled((cur) => (cur ? top > 4 : top > 24));
  }, []);

  // ── Data ────────────────────────────────────────────────────────────
  // The token, when there is one, is what lets an owner open their own
  // private custom spot; the proxy verifies it and vouches downstream. The
  // fetch waits for auth to settle so a signed-in angler's first tap does not
  // go out anonymous and 404, but only for a moment: Supabase reads the
  // session under a cross-tab Navigator lock with no timeout, and on Android
  // Chrome a frozen background tab can hold that lock for as long as it
  // lives. Then `authLoading` never clears, and a sheet that waited on it
  // showed its dots forever (seen 2026-09-06). After AUTH_WAIT_MS the fetch
  // goes out anonymous; every curated spot answers the same either way, and
  // if auth settles later the effect runs again with the token, which is
  // what a private custom spot needs.
  //
  // The request itself is bounded too. A stalled connection used to leave
  // the same dots with no way out but closing the sheet; now it lands in
  // the failed state, where Try again is.
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!slug) return;
    const key = `${slug}#${attempt}`;
    if (fetchedFor.current === key) return;
    // A swap to another spot shows that spot's skeleton, not the last page.
    setLoaded((cur) => (cur?.slug === slug ? cur : null));
    setFailed(null);
    let cancelled = false;
    let authTimer: number | undefined;
    let fetchTimer: number | undefined;
    const controller = new AbortController();

    const run = (token: string | undefined) => {
      fetchedFor.current = key;
      fetchTimer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      fetch(`/api/bluecaster/spots/${encodeURIComponent(slug)}/spot-page`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: SpotPageInitial | null) => {
          if (cancelled) return;
          if (!data) {
            setFailed(slug);
            return;
          }
          setLoaded({
            slug,
            page: stripPaidIntel(data),
            tz: timezoneFor(spot?.regionName ?? data.spot.region),
            nowMs: Date.now(),
          });
          scrollerRef.current?.scrollTo({ top: 0 });
          setScrolled(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(slug);
        })
        .finally(() => window.clearTimeout(fetchTimer));
    };

    if (authLoading) {
      authTimer = window.setTimeout(() => run(undefined), AUTH_WAIT_MS);
    } else {
      run(accessToken);
    }
    return () => {
      cancelled = true;
      window.clearTimeout(authTimer);
      window.clearTimeout(fetchTimer);
      controller.abort();
      // Cancelled before it landed: let the next run ask again.
      if (fetchedFor.current === key) fetchedFor.current = null;
    };
    // `spot` is only a label source here; a payload does not need refetching
    // when the rail re-ranks around it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, accessToken, authLoading, attempt]);

  // Closed: drop the payload so the next open starts from its skeleton
  // rather than flashing the last spot.
  useEffect(() => {
    if (!slug) {
      setLoaded(null);
      setFailed(null);
      setScrolled(false);
      fetchedFor.current = null;
    }
  }, [slug]);

  // ── History ─────────────────────────────────────────────────────────
  const open = !!slug;
  const pushedRef = useRef(false);
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    if (!pushedRef.current) {
      window.history.pushState(
        { ...window.history.state, [HISTORY_KEY]: true },
        "",
        window.location.href,
      );
      pushedRef.current = true;
    }
    const onPop = (e: PopStateEvent) => {
      if (e.state?.[HISTORY_KEY]) return;
      pushedRef.current = false;
      onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, onClose]);

  const close = useCallback(() => {
    if (
      typeof window !== "undefined" &&
      pushedRef.current &&
      window.history.state?.[HISTORY_KEY]
    ) {
      // Pops the entry we pushed; the popstate handler above does the close.
      window.history.back();
      return;
    }
    pushedRef.current = false;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // ── Enter ───────────────────────────────────────────────────────────
  // Slides up from the bottom edge, then drops the translate entirely. A
  // lingering transform, even the identity one a `forwards` animation
  // leaves, becomes the containing block for every `position: fixed`
  // descendant, and the page inside opens dialogs that are fixed to the
  // viewport.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  const title = spot?.name ?? loaded?.page.spot.name ?? "Loading spot";

  return (
    <div className="lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      {/* Above the floating tab bar's z-50: the sheet is a modal over the
          whole app, tab bar included, the way a place sheet covers the tabs
          in Maps. */}
      <div
        className={`fixed inset-0 z-[60] bg-black/30 transition-opacity duration-300 ${
          entered ? "opacity-100" : "opacity-0"
        }`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className={`fixed inset-x-0 bottom-0 z-[61] overflow-y-auto overscroll-contain bg-rc-panel shadow-rc-panel transition-[transform,top,border-radius] duration-300 ease-out ${
          entered ? "" : "translate-y-full"
        } ${scrolled ? "rounded-none" : "rounded-t-2xl"}`}
        // At the top a sliver of map stays visible above the sheet, so it
        // reads as a sheet over the map and not as a new page. Once the
        // reader scrolls into the page the sheet takes the whole screen: the
        // sliver only says "you are over the map", and a long read wants the
        // height more, the 24h chart above all.
        style={{
          top: scrolled
            ? 0
            : "max(2.5rem, calc(env(safe-area-inset-top) + 1.25rem))",
        }}
        data-testid="mobile-spot-sheet"
        data-scrolled={scrolled ? "" : undefined}
      >
        {loaded ? (
          <SpotDetailShell
            key={loaded.slug}
            page={loaded.page}
            slug={loaded.slug}
            cityLink={loaded.slug === spot?.slug ? cityLinkFrom(spot) : null}
            tz={loaded.tz}
            serverNowMs={loaded.nowMs}
            ad={ad}
            sheet={{
              onClose: close,
              onOpenSpot: (next) => onOpenSpot(next),
              scrolled,
              scroller: scrollerRef,
            }}
          />
        ) : (
          <SheetPlaceholder
            title={title}
            failed={failed === slug}
            onClose={close}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The sheet before its payload lands, or after it fails: the same header row
 * the loaded page pins, so the way out is in the same place from the first
 * frame, then either a pulse or the failure and a retry.
 */
function SheetPlaceholder({
  title,
  failed,
  onClose,
  onRetry,
}: {
  title: string;
  failed: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-30 border-b border-rc-rule bg-rc-panel">
        <div className="flex justify-center pt-2" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-rc-rule" />
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 font-rc-mono text-[11px] text-rc-brand hover:underline"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to map
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-rc-ink-mute hover:bg-rc-surface hover:text-rc-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="px-4 pt-6 sm:px-6">
        <h1 className="text-2xl font-black tracking-[-0.02em] text-rc-ink">
          {title}
        </h1>
        {failed ? (
          <div className="mt-4">
            <p className="text-sm text-rc-ink-mute">
              This spot could not be loaded. It may be private, or the
              connection dropped.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex min-h-11 items-center rounded-sm bg-rc-brand px-5 text-sm font-bold uppercase tracking-wide text-white hover:bg-rc-brand-hover"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="mt-6 flex gap-1" aria-label="Loading">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rc-brand" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-rc-brand/70 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-rc-brand/40 [animation-delay:300ms]" />
          </div>
        )}
      </div>
    </div>
  );
}
