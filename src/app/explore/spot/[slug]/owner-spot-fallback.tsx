"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";
import SpotDetailShell from "./spot-detail-shell";

/**
 * Last resort for a spot the SERVER couldn't load.
 *
 * BlueCaster 404s a private custom spot to anyone who can't prove they own it,
 * and the server render has no session — sessions here are Bearer tokens held
 * by the browser, not cookies. So an owner opening their own spot would get a
 * 404 page. This retries the same read through the authenticated same-origin
 * proxy, which verifies the token server-side and vouches for the user.
 *
 * Anyone who isn't the owner gets 404 from BlueCaster again and lands on the
 * same "not found" copy — the gate lives on the server; this only re-asks.
 */
export default function OwnerSpotFallback({ slug }: { slug: string }) {
  const { session, loading: authLoading } = useAuth();
  const [page, setPage] = useState<SpotPageInitial | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "denied">("idle");

  useEffect(() => {
    if (authLoading) return;
    const token = session?.access_token;
    if (!token) {
      setState("denied");
      return;
    }

    let cancelled = false;
    setState("loading");

    fetch(`/api/bluecaster/spots/${encodeURIComponent(slug)}/spot-page`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SpotPageInitial | null) => {
        if (cancelled) return;
        if (data) setPage(data);
        else setState("denied");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });

    return () => {
      cancelled = true;
    };
  }, [slug, session, authLoading]);

  if (page) return <SpotDetailShell page={page} slug={slug} />;

  if (state === "denied") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-black tracking-[-0.02em] text-rc-ink">
          Spot not found
        </h1>
        <p className="mt-2 max-w-sm text-pretty text-sm text-rc-ink-mute">
          This spot doesn&apos;t exist, or it&apos;s a private spot belonging to
          another angler.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rc-brand" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-rc-brand/70 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-rc-brand/40 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
