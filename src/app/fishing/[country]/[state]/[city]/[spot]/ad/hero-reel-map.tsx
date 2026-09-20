"use client";

/**
 * The hero reel's map screen, with the signed-out locks applied.
 *
 * MarketingMap itself cannot ask who is looking: it also draws on the
 * homepage, which mounts outside the auth provider. This wrapper lives under
 * /fishing, where the providers are, decides the locked set for a signed-out
 * viewer, and hands MarketingMap a plain prop. The featured spots
 * stay open, because the card the reel shows is about them.
 */

import { useMemo, type ComponentProps } from "react";
import MarketingMap from "@/app/(marketing)/components/marketing-map";
import { isSpotLocked } from "@/app/explore/lib/spot-locks";
import { useLockedSpots } from "@/app/components/split-test/use-locked-spots";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";

type Props = Omit<ComponentProps<typeof MarketingMap>, "lockedSlugs">;

export default function HeroReelMap(props: Props) {
  const { spots, featuredSlug, featuredSlugs } = props;
  const { user, loading: authLoading } = useAuth();
  const { isPaid } = useSubscription();
  const lockSplit = useLockedSpots(
    !authLoading && !user && !isPaid ? "hero_reel" : null,
  );
  const keepSet = useMemo(
    () => new Set([...(featuredSlug ? [featuredSlug] : []), ...(featuredSlugs ?? [])]),
    [featuredSlug, featuredSlugs],
  );
  const lockedSlugs = useMemo(() => {
    if (!lockSplit.locksOn) return new Set<string>();
    return new Set(spots.filter((s) => isSpotLocked(s, keepSet)).map((s) => s.slug));
  }, [spots, lockSplit.locksOn, keepSet]);
  return <MarketingMap {...props} lockedSlugs={lockedSlugs} />;
}
