"use client";

import { useMemo } from "react";
import { angleFrom } from "../../_shared/lp-angles";
import {
  reportCampaignCta,
  useCampaignHit,
  type CampaignTarget,
  type LpCtaId,
} from "../../_shared/lp-telemetry";

/**
 * Counting /lp/seattle/1.
 *
 * This page recorded NOTHING -- not a view, not a click -- from the day it
 * shipped. `useLpHit` and `reportLpCta` read the variant off the path with
 * `/^[0-9]{1,2}$/`, which is true of `/lp/6/seattle-wa` and false of
 * `/lp/seattle/1`: `parseLpPath` returned an empty landing, and both counters
 * treat that as "not a landing page" and return early. Silent, and the kind of
 * silence that looks exactly like a page nobody visited.
 *
 * The dimensions are passed in here rather than teaching the path parser a
 * second grammar, which is what lp-telemetry.tsx already prescribes for
 * surfaces that are not `/lp/<n>/<city>`. Two reasons it is the better fix:
 * the parser is shared with five running variants and is not worth the risk,
 * and it could not get the city right anyway -- this route's path segment is
 * `seattle`, while every existing row in the table carries a full slug like
 * `seattle-wa`. Reading the segment would quietly split this city across two
 * values of the column the report groups by.
 *
 * Anything else with a city-first path will need its own call like this one.
 * That is a real cost and it is written down in the PR.
 */

/**
 * The landing key. Matches the `from=` key the page used while it had a
 * checkout, so the campaign counters and any historic conversion rows line up
 * on one name for this page.
 */
const LANDING = "lpseattle1";

/** The full slug, not the `seattle` in the path. See above. */
const TARGET_CITY = "seattle-wa";

/**
 * The angle is read from the URL on the client, not passed down from the
 * server.
 *
 * The page component deliberately does not touch searchParams: reading them
 * there opts the route out of ISR and makes every ad click render from
 * scratch. `campaignDims` already reads the query string in this same file's
 * neighbour for the UTM fields, so the angle rides along the same way and the
 * page stays cacheable.
 */
function currentAngle(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  return angleFrom({
    a: q.get("a") ?? undefined,
    utm_content: q.get("utm_content") ?? undefined,
  }).id;
}

function targetFor(angle: string): CampaignTarget {
  return {
    landing: LANDING,
    target_city: TARGET_CITY,
    target_spot: "",
    wall: "",
    angle,
  };
}

/** Count this visit, once per tab. Renders nothing. */
export function LpSeattleHit() {
  const angle = useMemo(currentAngle, []);
  useCampaignHit(targetFor(angle));
  return null;
}

/**
 * A CTA that counts the press before it navigates.
 *
 * `cta` is the POSITION, never the label -- that is what makes the hero here
 * comparable with the hero on every other variant, and it is why renaming the
 * button does not break the series.
 *
 * The counter is fired on click rather than on the destination page: these
 * links leave immediately, and `reportCampaignCta` uses sendBeacon precisely
 * so a navigation cannot race the count away.
 */
export function TrackedCta({
  cta,
  href,
  className,
  children,
}: {
  cta: LpCtaId;
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className={className}
      href={href}
      onClick={() => reportCampaignCta(cta, targetFor(currentAngle()))}
    >
      {children}
    </a>
  );
}
