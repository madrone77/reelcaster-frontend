// Unit tests for src/app/explore/lib/reg-status.ts, and the surfaces that read
// it: a regulation row nobody has read yet (bluecaster #442).
//
// Such a row keeps status "Closed" so it never scores as open. The flag
// `rulesNotLoaded` is what the reader sees instead. Two edges matter: a flagged
// row must never say Closed, catch and release, or a limit; and a row WITHOUT
// the flag, including a real closure, must read exactly as it did before.
//
// Run with: npx tsx src/app/explore/lib/reg-status.test.ts

import assert from "node:assert/strict";
import type { Forecast14dPayload, LiveRegulation } from "@/lib/bluecaster/live-spot-types";
import { regulatorFor } from "@/lib/regions";
import {
  isRulesNotLoaded,
  regDisplayKind,
  regulatorCheckLink,
  RULES_NOT_LOADED_LABEL,
  speciesCardRegLabel,
} from "./reg-status";
import { regHighlights } from "./reg-limits";
import { buildForecastDays } from "./forecast-strip";

const reg = (over: Partial<LiveRegulation> = {}): LiveRegulation => ({
  speciesId: "sp-1",
  speciesCommon: "Kelp Bass",
  status: "Open",
  dailyLimit: 5,
  possessionLimit: null,
  sizeLimitCm: 35.56,
  sizeLimitMaxCm: null,
  gearRestrictions: null,
  annualLimit: null,
  confidence: "confirmed",
  notes: null,
  source: null,
  detail: "5/day",
  seasonOpenDate: null,
  seasonCloseDate: null,
  nextOpenDate: null,
  nextOpenSummary: null,
  ...over,
});

// The placeholder row exactly as the spot page payload sends it.
const placeholder = reg({
  speciesCommon: "Dungeness Crab",
  status: "Closed",
  dailyLimit: null,
  sizeLimitCm: 16,
  confidence: "expected",
  source: "city_wizard_no_rules",
  detail: "Rules not loaded yet, check WDFW",
  rulesNotLoaded: true,
  regulatorUrl: "https://wdfw.wa.gov/fishing/regulations",
});

const CDFW = regulatorFor("CA");
const WDFW = regulatorFor("WA");
const DFO = regulatorFor("BC");

// ── The flag ─────────────────────────────────────────────────────────────
{
  assert.equal(isRulesNotLoaded(placeholder), true);
  assert.equal(isRulesNotLoaded(reg({ status: "Closed" })), false);
  // Only an explicit true counts: older payloads have no key at all.
  assert.equal(isRulesNotLoaded(reg({ rulesNotLoaded: false })), false);
  assert.equal(isRulesNotLoaded(null), false);
  assert.equal(isRulesNotLoaded(undefined), false);
}

// ── Status mapping ───────────────────────────────────────────────────────
{
  assert.equal(regDisplayKind(placeholder), "unknown");
  // The flag wins whatever status the row carries.
  assert.equal(regDisplayKind({ ...placeholder, status: "Release" }), "unknown");
  assert.equal(regDisplayKind(reg({ status: "Open" })), "open");
  assert.equal(regDisplayKind(reg({ status: "Release" })), "release");
  assert.equal(regDisplayKind(reg({ status: "Closed" })), "closed");
}

// ── Species card label ───────────────────────────────────────────────────
{
  assert.equal(speciesCardRegLabel(placeholder), RULES_NOT_LOADED_LABEL);
  assert.equal(RULES_NOT_LOADED_LABEL, "Rules not loaded yet");
  // Unchanged for rows without the flag.
  assert.equal(speciesCardRegLabel(reg({ status: "Closed" })), "Closed");
  assert.equal(speciesCardRegLabel(reg({ status: "Release" })), "Non-retention");
  assert.equal(speciesCardRegLabel(reg({ status: "Open" })), null);
}

// ── Score card highlights: no limit, no closure words ────────────────────
{
  const out = regHighlights(placeholder, WDFW);
  assert.deepEqual(out, [RULES_NOT_LOADED_LABEL]);
  const joined = out.join(" ");
  assert.doesNotMatch(joined, /closed|no retention|release|per day|min|max/i);

  // A real closure still says so, with its reopening date.
  assert.deepEqual(
    regHighlights(reg({ status: "Closed", nextOpenDate: "2026-10-01" }), DFO),
    ["No retention", "reopens Oct 1"],
  );
  assert.deepEqual(regHighlights(reg({ status: "Release", dailyLimit: 0 }), DFO), [
    "Catch and release",
  ]);
  assert.deepEqual(regHighlights(reg(), CDFW), ["5 per day", 'min 14"']);
}

// ── Check link ───────────────────────────────────────────────────────────
{
  // The payload's URL wins and is named for the agency it points at, even
  // when the page resolved a different regulator for the spot's city.
  assert.deepEqual(regulatorCheckLink(placeholder, DFO), {
    label: "Check WDFW",
    url: "https://wdfw.wa.gov/fishing/regulations",
  });
  assert.deepEqual(
    regulatorCheckLink({ regulatorUrl: "https://wildlife.ca.gov/Fishing/Ocean/Regulations" }, WDFW),
    { label: "Check CDFW", url: "https://wildlife.ca.gov/Fishing/Ocean/Regulations" },
  );
  assert.equal(
    regulatorCheckLink({ regulatorUrl: "https://myodfw.com/fishing/regulations" }, CDFW).label,
    "Check ODFW",
  );
  assert.equal(
    regulatorCheckLink({ regulatorUrl: "https://www.pac.dfo-mpo.gc.ca/fm-gp/rec/index-eng.html" }, WDFW).label,
    "Check DFO",
  );
  // No URL: fall back to the spot's regulator.
  assert.deepEqual(regulatorCheckLink({ regulatorUrl: null }, CDFW), {
    label: "Check CDFW",
    url: CDFW.url,
  });
  assert.deepEqual(regulatorCheckLink({}, regulatorFor("OR")), {
    label: "Check ODFW",
    url: regulatorFor("OR").url,
  });
  // An unknown host keeps the URL and borrows the fallback's name.
  assert.deepEqual(regulatorCheckLink({ regulatorUrl: "https://example.org/regs" }, WDFW), {
    label: "Check WDFW",
    url: "https://example.org/regs",
  });
}

// ── 14-day strip: same gating, different words ───────────────────────────
{
  const payload: Forecast14dPayload = {
    daily14: [
      { iso: "2026-09-14", dow: "MON", date: "Sep 14", glyph: null, score: 40, high: null, low: null },
      { iso: "2026-09-15", dow: "TUE", date: "Sep 15", glyph: null, score: 50, high: null, low: null },
    ],
    hourlyScoreGrid: {},
    hourlyConditionsGrid: [],
    tide14d: [],
  };
  const unknown = buildForecastDays(payload, "sp-1", "pro", null, placeholder);
  for (const d of unknown.days) {
    assert.equal(d.nonRetention, true);
    assert.equal(d.rulesNotLoaded, true);
  }

  // A real closure: non-retention, and no rulesNotLoaded key at all, so the
  // day objects are what they were before the flag existed.
  const closed = buildForecastDays(payload, "sp-1", "pro", null, reg({ status: "Closed" }));
  for (const d of closed.days) {
    assert.equal(d.nonRetention, true);
    assert.equal("rulesNotLoaded" in d, false);
  }

  const open = buildForecastDays(payload, "sp-1", "pro", null, reg());
  for (const d of open.days) {
    assert.equal(d.nonRetention, false);
    assert.equal("rulesNotLoaded" in d, false);
  }
}

console.log("reg-status tests passed");
