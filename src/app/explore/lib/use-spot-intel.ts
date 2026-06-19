"use client";

import { useEffect, useState } from "react";
import {
  fetchSpotLive,
  fetchIntelEvidence,
  fetchPoolIntelligence,
} from "@/lib/bluecaster-client";
import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";
import type { IntelEvidence, PoolIntelligence } from "@/lib/bluecaster/intel-types";

// Lazy, cached, progressive intel for the Explore spot drawer. The drawer
// renders instantly from the in-memory RailSpot; this hook enriches it with
// BlueCaster's live spot-page (catch signals, drivers, regs, season, water
// temp), the anonymized community catch pool, and — only when the "why this
// score" panel is opened — the evidence breakdown. All three degrade to null
// silently (the drawer just hides those sections). Module-level caches dedupe
// refetches as the user reopens spots.

const pageCache = new Map<string, SpotPageInitial | null>();
const poolCache = new Map<string, PoolIntelligence | null>();
const evidenceCache = new Map<string, IntelEvidence | null>();

export function useSpotIntel({
  slug,
  spotId,
  speciesId,
  evidenceEnabled,
}: {
  slug: string | null;
  spotId: string | null;
  speciesId: string | null;
  evidenceEnabled: boolean;
}) {
  const [page, setPage] = useState<SpotPageInitial | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pool, setPool] = useState<PoolIntelligence | null>(null);
  const [evidence, setEvidence] = useState<IntelEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // Live spot-page on slug change.
  useEffect(() => {
    if (!slug) {
      setPage(null);
      return;
    }
    if (pageCache.has(slug)) {
      setPage(pageCache.get(slug) ?? null);
      setPageLoading(false);
      return;
    }
    let cancelled = false;
    setPageLoading(true);
    setPage(null);
    fetchSpotLive(slug)
      .then((p) => {
        if (cancelled) return;
        pageCache.set(slug, p);
        setPage(p);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Community pool on spot×species change.
  useEffect(() => {
    if (!spotId || !speciesId) {
      setPool(null);
      return;
    }
    const key = `${spotId}:${speciesId}`;
    if (poolCache.has(key)) {
      setPool(poolCache.get(key) ?? null);
      return;
    }
    let cancelled = false;
    setPool(null);
    fetchPoolIntelligence(spotId, speciesId)
      .then((p) => {
        if (cancelled) return;
        poolCache.set(key, p);
        setPool(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spotId, speciesId]);

  // Evidence only once the "why this score" panel is opened.
  useEffect(() => {
    if (!evidenceEnabled || !spotId || !speciesId) return;
    const key = `${spotId}:${speciesId}`;
    if (evidenceCache.has(key)) {
      setEvidence(evidenceCache.get(key) ?? null);
      setEvidenceLoading(false);
      return;
    }
    let cancelled = false;
    setEvidenceLoading(true);
    setEvidence(null);
    fetchIntelEvidence(spotId, speciesId)
      .then((e) => {
        if (cancelled) return;
        evidenceCache.set(key, e);
        setEvidence(e);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEvidenceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [evidenceEnabled, spotId, speciesId]);

  return { page, pageLoading, pool, evidence, evidenceLoading };
}
