// ─── ReelCaster FAQ content + helpers ────────────────────────────────
//
// Single source of truth for the /faq surface. Pure data + pure helpers
// (no React, no client APIs) so it can be imported from server pages, the
// client search component, and JSON-LD builders alike.
//
// Customer-facing language (no internal jargon). Anything not yet shipped
// is marked `status: "soon"` so the UI can badge it.

export const SUPPORT_EMAIL = "support@reelcaster.com";

/** A paragraph is plain text (with inline **bold** / [links](/href)) or a bullet list. */
export type FaqPara = string | { list: string[] };

export type FaqCategoryId =
  | "basics"
  | "scoring"
  | "coverage"
  | "spots-species"
  | "regulations"
  | "data"
  | "alerts"
  | "logging"
  | "account"
  | "privacy";

export type FaqItem = {
  /** Stable kebab-case slug — used as the anchor id and the search key. */
  id: string;
  q: string;
  a: FaqPara[];
  category: FaqCategoryId;
  /** Top-10 questions shown on the main /faq page. */
  featured?: boolean;
  /** Feature exists on the roadmap but isn't live yet. */
  status?: "soon";
  /** Extra search terms that don't appear verbatim in the question/answer. */
  keywords?: string[];
};

export type FaqCategory = {
  id: FaqCategoryId;
  title: string;
  blurb: string;
  icon: string;
};

// ─── Categories (also the browse order) ──────────────────────────────

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "basics",
    title: "Getting started",
    blurb: "What ReelCaster is, what it costs, and how to start.",
    icon: "🎣",
  },
  {
    id: "scoring",
    title: "How the score works",
    blurb: "What the number means and why it moves through the day.",
    icon: "📊",
  },
  {
    id: "coverage",
    title: "Coverage & cities",
    blurb: "Where ReelCaster is live and what's coming next.",
    icon: "🗺️",
  },
  {
    id: "spots-species",
    title: "Spots & species",
    blurb: "Finding the right spot, the right fish, and the right hour.",
    icon: "📍",
  },
  {
    id: "regulations",
    title: "Regulations & safety",
    blurb: "Closures, limits, marine weather, and what you must verify.",
    icon: "⚠️",
  },
  {
    id: "data",
    title: "Data & accuracy",
    blurb: "Where the numbers come from and how good they are.",
    icon: "🔬",
  },
  {
    id: "alerts",
    title: "Alerts & emails",
    blurb: "Getting told when your spot is about to go off.",
    icon: "🔔",
  },
  {
    id: "logging",
    title: "Catch logging",
    blurb: "Logging trips and how it sharpens your forecast.",
    icon: "📷",
  },
  {
    id: "account",
    title: "Account & billing",
    blurb: "Signing in, plans, payments, and deleting your account.",
    icon: "👤",
  },
  {
    id: "privacy",
    title: "Privacy & your data",
    blurb: "What we collect, what we don't, and your spots.",
    icon: "🔒",
  },
];

// ─── Questions ───────────────────────────────────────────────────────

export const FAQ_ITEMS: FaqItem[] = [
  // ── Getting started ────────────────────────────────────────────────
  {
    id: "what-is-reelcaster",
    category: "basics",
    featured: true,
    q: "What is ReelCaster?",
    keywords: ["about", "overview", "what does it do", "fishing forecast app"],
    a: [
      "ReelCaster is a fishing forecast for BC waters. Instead of a generic weather panel, it scores **every spot, every species, and every hour for the next 14 days** — so you can launch when the bite is on, not just when the calendar says Saturday.",
      "For each spot we pull together the things that actually move fish — tide, current, light, barometric pressure, wind, and the season — and turn them into a single 0–100 score per species per hour. Green means the conditions line up; red means save your gas.",
      "Maps and current fishing regulations are built in, so you can see where to go, what's biting, and whether it's open — in one place.",
    ],
  },
  {
    id: "how-does-it-work",
    category: "basics",
    q: "How does ReelCaster work, in a nutshell?",
    keywords: ["how it works", "explain"],
    a: [
      "Pick a spot. ReelCaster shows you, hour by hour for the next two weeks, how good the conditions are for each species there — as a 0–100 score.",
      "Behind each score is a profile of what a given species responds to (tide stage, current speed, light, pressure, time of year) matched against the real forecast for that exact location. The better the match, the higher the score.",
      "You use it two ways: **\"when should I go?\"** (scan the 14-day view for the best windows) and **\"where should I go right now?\"** (compare today's live scores across spots and species).",
    ],
  },
  {
    id: "is-it-free",
    category: "basics",
    featured: true,
    q: "Is ReelCaster free?",
    keywords: ["cost", "price", "pricing", "free", "catch", "trial"],
    a: [
      "Yes. Browsing is free and open — anyone can see today's live scores on the map and on city and spot pages, with no account.",
      "A **free account** unlocks the full 14-day planner, hour-by-hour breakdowns, and the ability to save your home spot and set alerts.",
      "We're working on a paid **Pro** tier later for power features (more on that below), but the core forecast does not cost anything, and there's no card required to sign up.",
    ],
  },
  {
    id: "do-i-need-account",
    category: "basics",
    featured: true,
    q: "Do I need an account, and what do I get with one?",
    keywords: ["sign up", "register", "login", "what do i get"],
    a: [
      "You can explore a lot without one: the live map, today's (and often tomorrow's) scores, spot pages, and regulations are all open.",
      "A free account adds the parts you'll actually plan around:",
      {
        list: [
          "The full **14-day** forecast for every spot, hour by hour",
          "A saved **home spot** so your week is one tap away",
          "**Alerts** when your spot's conditions are about to line up",
          "The weekly \"your week on the water\" email",
        ],
      },
      "It's free, takes about a minute, and needs only an email.",
    ],
  },
  {
    id: "is-there-a-mobile-app",
    category: "basics",
    featured: true,
    q: "Is there a mobile app?",
    keywords: ["ios", "android", "app store", "download", "phone"],
    a: [
      "ReelCaster runs in your phone's web browser today — there's nothing to download, and it's built mobile-first, so it works great from the dock or the truck.",
      "You can add it to your home screen for an app-like icon: on iPhone tap **Share → Add to Home Screen**; on Android use your browser's **Add to Home screen** menu.",
      "Native iOS/Android apps may come later, but the web app already does everything the forecast needs.",
    ],
  },
  {
    id: "offline",
    category: "basics",
    q: "Does it work offline / without cell service?",
    keywords: ["no signal", "data", "connection", "ocean"],
    a: [
      "ReelCaster needs a connection to load live scores and maps, so plan to pull up your spot before you lose signal offshore.",
      "A good habit: check your 14-day windows the night before, and rely on the forecast you saw at the dock once you're out of range.",
    ],
  },
  {
    id: "who-is-it-for",
    category: "basics",
    q: "Who is ReelCaster for — beginners or experienced anglers?",
    keywords: ["beginner", "experienced", "guide", "audience"],
    a: [
      "Both, from opposite directions. If you're learning, the score gives you a confident starting point and teaches you which conditions matter. If you've fished BC for decades, it saves you the mental math of cross-referencing tide, current, light, and pressure across two weeks and a dozen spots.",
      "It's built to respect what good anglers already know — not replace your judgment, but sharpen when and where you spend it.",
    ],
  },
  {
    id: "report-a-bug",
    category: "basics",
    q: "How do I report a bug or send feedback?",
    keywords: ["contact", "support", "help", "broken", "feedback", "email"],
    a: [
      `Email us at **${SUPPORT_EMAIL}**. We're a small team and we read everything — bug reports, missing spots, scores that didn't match your day on the water, all of it genuinely helps.`,
      "If you're reporting something that looks wrong, a screenshot and the spot + date make it much faster to track down.",
    ],
  },

  // ── How the score works ────────────────────────────────────────────
  {
    id: "how-is-score-calculated",
    category: "scoring",
    featured: true,
    q: "How is the score calculated?",
    keywords: ["score", "number", "algorithm", "computed", "formula", "how"],
    a: [
      "Each species has a profile of the conditions it responds to. For a given hour at a given spot, we compare the real forecast against that profile and grade the match on a 0–100 scale.",
      "The main ingredients:",
      {
        list: [
          "**Tide** — stage and movement (many species feed hardest on the change, not slack water)",
          "**Current** — speed and direction at that spot, from a fine-grained ocean model",
          "**Light** — dawn/dusk windows and sun position, which drive feeding behaviour",
          "**Barometric pressure** — and which way it's trending",
          "**Comfort conditions** — wind, cloud, precipitation, and temperature",
          "**Season** — whether that fish is realistically around at that time of year",
        ],
      },
      "Those combine into one number per species per hour. We tune the recipe per species, because what fires up a Chinook isn't what fires up a lingcod.",
    ],
  },
  {
    id: "what-is-good-score",
    category: "scoring",
    featured: true,
    q: "What's a good score? What does 80 mean?",
    keywords: ["good score", "80", "70", "scale", "high", "low", "rating"],
    a: [
      "Treat it like a percentage of \"how well the conditions line up\":",
      {
        list: [
          "**80–100** — prime. Conditions are stacking in your favour; this is a window to prioritize.",
          "**60–79** — solid. Worth going, especially if it fits your schedule.",
          "**40–59** — marginal. Catchable, but you're working for it.",
          "**Below 40** — tough. Better windows are usually nearby in the 14-day view.",
        ],
      },
      "The score grades the *conditions*, not a guarantee — but a green window stacks the odds in your favour, and over time you'll learn how your spots fish relative to their scores.",
    ],
  },
  {
    id: "why-score-changes-through-day",
    category: "scoring",
    q: "Why does the score change hour to hour?",
    keywords: ["hourly", "changes", "varies", "time of day", "window"],
    a: [
      "Because the conditions do. The tide turns, the current builds and slacks, the light shifts at dawn and dusk, and pressure moves through the day. A spot can be an 85 at first light and a 40 by mid-morning.",
      "That hourly detail is the whole point — it tells you not just *whether* to fish a day, but *which two hours* of it to fish.",
    ],
  },
  {
    id: "why-no-after-dark",
    category: "scoring",
    q: "Why doesn't it ever recommend fishing after dark?",
    keywords: ["dark", "night", "dusk", "evening", "twilight", "late"],
    a: [
      "By design. Dawn gets full credit because the light is climbing into prime feeding time. Dusk is treated more carefully: as the sky goes from civil to nautical twilight we ease the score down, and we won't steer you toward launching into pitch black.",
      "So a 9pm \"window\" that's really just nightfall won't show up as a top recommendation, even if the tide looks perfect on paper.",
    ],
  },
  {
    id: "score-high-no-fish",
    category: "scoring",
    q: "The score was high but I didn't catch anything. What gives?",
    keywords: ["high score", "skunked", "no fish", "wrong", "didn't catch"],
    a: [
      "The score grades the conditions, not the fish's mood on the day — and fishing always keeps a vote. Presentation, exact location, bait, boat traffic, and plain luck all still matter.",
      "Think of a high score like a poker hand with the odds in your favour: you'll lose some, but you want to be at the table when conditions stack up. Over many trips, the green windows out-fish the red ones.",
      "If a high-scoring window flat-out missed, tell us — logging that trip is exactly the kind of signal that sharpens future forecasts.",
    ],
  },
  {
    id: "score-low-caught-fish",
    category: "scoring",
    q: "The score was low but I slayed them. Can I tell you?",
    keywords: ["low score", "caught", "wrong", "feedback", "correct"],
    a: [
      "Please do. A great day during a low-scored window is valuable feedback — it's a hint that the profile for that species or spot has more to learn.",
      "Catch logging (rolling out — see that section) is how this becomes automatic: your real results feed back in and help the forecast for that spot get more accurate over time.",
    ],
    status: "soon",
  },
  {
    id: "how-far-ahead",
    category: "scoring",
    q: "How far ahead does the forecast go?",
    keywords: ["14 days", "days", "ahead", "future", "two weeks", "range"],
    a: [
      "Fourteen days. The near days are the most reliable; the back end of the window is more of a planning sketch that firms up as it approaches.",
      "Tide and light that far out are essentially known; wind and pressure are genuine forecasts, so treat day 12 as \"pencil it in\" and day 2 as \"set the alarm.\"",
    ],
  },
  {
    id: "how-often-updates",
    category: "scoring",
    q: "How often do the scores update?",
    keywords: ["update", "refresh", "frequency", "new forecast"],
    a: [
      "Regularly throughout the day as fresh forecast data lands. That's also why today's score for a given hour can differ from what yesterday's forecast predicted for it — the underlying wind and pressure forecasts have simply been updated. Newer is more accurate.",
    ],
  },
  {
    id: "species-specific",
    category: "scoring",
    q: "Is the score specific to the species I'm targeting?",
    keywords: ["species", "chinook", "coho", "halibut", "lingcod", "target"],
    a: [
      "Yes — that's a core idea. Every score is per species, because different fish respond to different conditions. The same hour at the same spot can be an 85 for Chinook and a 50 for lingcod.",
      "So you can plan around the fish you actually want, or scan to see what the conditions favour most at a spot today.",
    ],
  },
  {
    id: "is-this-ai",
    category: "scoring",
    q: "Do you use AI? Is this just ChatGPT for fishing?",
    keywords: ["ai", "chatgpt", "machine learning", "model", "made up"],
    a: [
      "No — the scores aren't a chatbot guessing. They come from real forecast data (tides, currents, weather) run through condition models tuned per species.",
      "We do use AI in supporting roles — for example, reading regulation notices or helping structure species profiles — but the number you see is grounded in physical forecasts for your exact spot, not invented.",
    ],
  },

  // ── Coverage & cities ──────────────────────────────────────────────
  {
    id: "which-areas-covered",
    category: "coverage",
    featured: true,
    q: "Which areas do you cover?",
    keywords: ["cities", "coverage", "area", "where", "victoria", "salish sea", "locations"],
    a: [
      "We're launching in **Victoria, BC** as our quality anchor and rolling out across the Salish Sea from there — southern Vancouver Island, the Gulf Islands, and onward as the data for each area is ready.",
      "The fastest way to see exactly what's live right now is the [live map](/map). If your area isn't there yet, it's coming.",
    ],
  },
  {
    id: "when-my-area",
    category: "coverage",
    q: "When are you adding my area?",
    keywords: ["my area", "request", "expand", "next city", "coming soon"],
    a: [
      "We add a region only once we can do it well — real spots, accurate currents, and current regulations — rather than blanketing the map with thin pages.",
      `Tell us where you fish at **${SUPPORT_EMAIL}**. Demand genuinely helps us prioritize what's next.`,
    ],
  },
  {
    id: "us-waters",
    category: "coverage",
    q: "Do you cover US waters too, or just Canada?",
    keywords: ["usa", "washington", "puget sound", "san juan", "border", "wdfw"],
    a: [
      "Our forecast model spans the whole Salish Sea, which crosses the border — the same body of water runs from Victoria down to the San Juans and Puget Sound.",
      "We're starting on the BC side, and US areas come online as we add local spots and the matching state regulations. Check the [map](/map) for what's live today.",
    ],
  },

  // ── Spots & species ────────────────────────────────────────────────
  {
    id: "how-spots-chosen",
    category: "spots-species",
    q: "How do you choose which spots to include?",
    keywords: ["spots", "locations", "chosen", "selected"],
    a: [
      "We focus on real, fishable spots in each area — the places people actually run to — rather than dropping a generic grid over the chart. Each spot gets its own bathymetry, currents, and species profiles.",
      "Quality over quantity: we'd rather have ten spots that score well than a hundred that don't mean anything.",
    ],
  },
  {
    id: "suggest-a-spot",
    category: "spots-species",
    q: "Can I suggest a spot you're missing?",
    keywords: ["add spot", "suggest", "missing spot", "request spot"],
    a: [
      `Absolutely — email **${SUPPORT_EMAIL}** with the spot name or a rough location and what you fish there. Angler-sourced spots are some of the best, and we'd love to add the ones people are really fishing.`,
    ],
  },
  {
    id: "home-spot",
    category: "spots-species",
    q: "Can I set a home spot?",
    keywords: ["home spot", "favourite", "save spot", "default"],
    a: [
      "Yes, with a free account. Your home spot puts your week's best windows one tap away every time you open ReelCaster, and it's what your alerts and weekly email are tuned to.",
    ],
  },
  {
    id: "find-best-spot-today",
    category: "spots-species",
    q: "How do I find the best spot for today?",
    keywords: ["best spot", "today", "where to go now", "compare"],
    a: [
      "Open the [map](/map) and compare today's live scores across spots. The highest-scoring spot for your target species right now is your answer — and the hourly view tells you which part of the day to be there.",
    ],
  },
  {
    id: "species-missing",
    category: "spots-species",
    q: "Why isn't the species I fish for in the rankings?",
    keywords: ["missing species", "not listed", "species", "rockfish", "release"],
    a: [
      "A few reasons it might not show: it isn't realistically in season at that spot, we don't yet have a tuned profile for it there, or it's a **release-only / closed** species that we deliberately keep out of the \"what to target\" rankings.",
      "Closed and release-only species still appear in the regulations so you know the rules — we just don't rank them as targets, since you can't keep them.",
    ],
  },
  {
    id: "why-no-yelloweye",
    category: "spots-species",
    q: "Why don't I see yelloweye / some rockfish as a target?",
    keywords: ["yelloweye", "rockfish", "release only", "closed", "rca"],
    a: [
      "Some species — yelloweye rockfish is the classic example — are closed to retention across BC. We keep them in the regulations layer so you know they're protected, but we never rank them as something to go target, since keeping one isn't legal.",
      "Always release these carefully (with a descending device where required) if you hook one incidentally.",
    ],
  },

  // ── Regulations & safety ───────────────────────────────────────────
  {
    id: "do-you-cover-regulations",
    category: "regulations",
    featured: true,
    q: "Do you cover fishing regulations?",
    keywords: ["regulations", "regs", "rules", "open", "closed", "limits", "dfo"],
    a: [
      "Yes — and it's one of the things that makes ReelCaster different. We show the current regulations relevant to each spot: whether a species is open, retention limits, and active closures or notices.",
      "We track DFO's standing regulations as the baseline and layer the latest **notices** (emergency openings and closures) on top, so what you see reflects the current state — not a static table from the start of the season.",
    ],
  },
  {
    id: "can-i-rely-on-regs",
    category: "regulations",
    q: "Can I rely on your regulations? Are they official?",
    keywords: ["official", "reliable", "trust", "legal", "verify", "accurate regs"],
    a: [
      "We work hard to keep them accurate and current, and we cite the source. But regulations change fast — sometimes day to day — and **you are always responsible for confirming the rules before you fish.**",
      "Treat ReelCaster as your heads-up and your shortcut, then verify anything you're keeping against the official source (DFO in Canada; the relevant state agency in US waters). If you ever spot a discrepancy, tell us — see below.",
    ],
  },
  {
    id: "how-current-regs",
    category: "regulations",
    q: "How up to date are the regulations?",
    keywords: ["current", "updated", "notices", "fresh", "out of date"],
    a: [
      "We refresh regulations and notices regularly and resolve the *effective* state at the moment you look — base rules with any active notices applied on top.",
      "Because emergency notices can drop with little warning, always sanity-check a closure or opening against the official source before relying on it.",
    ],
  },
  {
    id: "what-is-a-notice",
    category: "regulations",
    q: "What's a \"notice\" or emergency closure?",
    keywords: ["notice", "closure", "emergency", "fishery notice", "opening"],
    a: [
      "Fisheries managers issue notices that temporarily change the standing rules — closing a species or area, or opening a window. They supersede the baseline regulation for as long as they're in effect.",
      "When a notice affects a spot you're looking at, we surface it so you're not caught out by a rule that changed since the season started.",
    ],
  },
  {
    id: "report-wrong-reg",
    category: "regulations",
    q: "A regulation looks wrong — how do I report it?",
    keywords: ["wrong regulation", "report", "incorrect", "error", "mistake"],
    a: [
      `Please tell us right away at **${SUPPORT_EMAIL}** — include the spot, species, and what you believe the correct rule is. Regulation accuracy is a safety and trust issue, so these reports jump the queue.`,
    ],
  },
  {
    id: "size-retention-limits",
    category: "regulations",
    q: "Do you show size and retention limits?",
    keywords: ["size limit", "retention", "limit", "bag limit", "slot"],
    a: [
      "Where we have them, yes — open/closed status and retention limits relevant to the spot. For finer details (exact slot sizes, gear restrictions, special area rules), confirm against the official source before keeping fish.",
    ],
  },
  {
    id: "is-high-score-safe",
    category: "regulations",
    q: "Does a high score mean it's safe to go out?",
    keywords: ["safe", "safety", "weather", "wind", "small craft", "dangerous"],
    a: [
      "**No.** The score is about fish, not safety. A spot can score 90 in conditions that are still too rough for your boat.",
      "Always check the marine forecast, wind and sea state, and small-craft warnings, and make your own call based on your vessel and experience. ReelCaster never overrides your judgment about whether it's safe to launch.",
    ],
  },
  {
    id: "marine-weather",
    category: "regulations",
    q: "Do you factor in marine weather warnings?",
    keywords: ["marine weather", "wind warning", "swell", "forecast", "conditions"],
    a: [
      "Wind and comfort conditions feed into the score, so genuinely nasty weather will pull a window down. But the score is not a marine-safety product and doesn't replace the official marine forecast or warnings.",
      "Always pair ReelCaster with the marine weather forecast for your area before heading out.",
    ],
  },

  // ── Data & accuracy ────────────────────────────────────────────────
  {
    id: "where-data-comes-from",
    category: "data",
    featured: true,
    q: "Where does your data come from?",
    keywords: ["data", "sources", "tides", "currents", "weather", "bathymetry"],
    a: [
      "From authoritative, science-grade sources — not scraped guesses:",
      {
        list: [
          "**Tides & water levels** — Fisheries and Oceans Canada (DFO)",
          "**Currents** — UBC's SalishSeaCast ocean model, a fine-grained model of the Salish Sea",
          "**Weather** — Environment Canada observation and forecast stations",
          "**Sea floor / bathymetry** — Canadian government depth data (NONNA) and NRCan elevation models",
          "**Regulations** — DFO standing rules plus live fishery notices",
        ],
      },
      "We combine these for your exact spot, which is what lets the score be specific instead of generic.",
    ],
  },
  {
    id: "how-accurate",
    category: "data",
    featured: true,
    q: "How accurate is ReelCaster?",
    keywords: ["accurate", "accuracy", "reliable", "track record", "trust", "proven"],
    a: [
      "The inputs are strong: tides and light are essentially known in advance, currents come from a validated ocean model, and weather uses the same forecasts the marine sector relies on. The score is only as good as those forecasts, so near-term days are more reliable than the back of the 14-day window.",
      "What no forecast can promise is the fish. ReelCaster tilts the odds in your favour and tells you *when* and *where* they're best — it doesn't guarantee a catch. As more anglers log trips, the species profiles keep getting sharper.",
    ],
  },
  {
    id: "real-bathymetry",
    category: "data",
    q: "Do you use real sea-floor maps?",
    keywords: ["bathymetry", "depth", "sea floor", "contours", "chart", "structure"],
    a: [
      "Yes. Our maps use real bathymetry — actual depth and bottom structure — rather than a flat background. That structure matters for fishing, and it also feeds the currents and the scores at each spot.",
      "Depths are shown in feet by default (BC anglers think in feet), with a metres toggle.",
    ],
  },
  {
    id: "currents-accuracy",
    category: "data",
    q: "How good are the current predictions?",
    keywords: ["currents", "tidal current", "accuracy", "salishseacast", "flow"],
    a: [
      "Currents come from UBC's SalishSeaCast model, which reproduces the real circulation of the Salish Sea well. Timing of the flood and ebb is reliable across the region.",
      "In a few very narrow, high-flow channels the model can under-read the absolute peak speed, but the timing and the open-water picture are solid — which is what matters for picking your window.",
    ],
  },
  {
    id: "guarantee-fish",
    category: "data",
    q: "Do you guarantee I'll catch fish?",
    keywords: ["guarantee", "promise", "catch fish", "skunked"],
    a: [
      "No, and anyone who does is selling something. Fishing has too many variables for a guarantee.",
      "What ReelCaster does is put the odds on your side and tell you the best windows so your time on the water is better spent. The fish still get a vote.",
    ],
  },
  {
    id: "how-different",
    category: "data",
    q: "How is this different from a tide app, Windy, or Fishbrain?",
    keywords: ["different", "competitor", "windy", "fishbrain", "tide app", "vs"],
    a: [
      "A tide app or Windy gives you raw conditions and leaves the interpretation to you. ReelCaster does the interpretation — it combines tide, current, light, pressure, and weather into a single per-species, per-hour score, so you don't have to cross-reference five tools.",
      "And unlike a social catch-log app, the forecast is the product: built on government and academic data for your exact spot, with current regulations attached.",
    ],
  },
  {
    id: "affiliated-with-dfo",
    category: "data",
    q: "Are you affiliated with DFO or the government?",
    keywords: ["dfo", "government", "official", "affiliated", "endorsed"],
    a: [
      "No. ReelCaster is independent. We *use* open government and academic data (DFO tides, Environment Canada weather, UBC's ocean model, and public regulations), but we're not affiliated with or endorsed by any agency.",
    ],
  },

  // ── Alerts & emails ────────────────────────────────────────────────
  {
    id: "how-alerts-work",
    category: "alerts",
    q: "Can I get alerted when my spot is about to go off?",
    keywords: ["alerts", "notifications", "alert me", "notify", "spot goes off"],
    a: [
      "Yes — this is one of the best reasons to make an account. Set an alert on your spot and we'll email you when its conditions are about to line up for the species you care about, with the exact window.",
      "An alert reads like \"Constance Bank hits 86 for Chinook Thursday 5–9am\" — a real heads-up, not noise.",
    ],
  },
  {
    id: "will-you-spam-me",
    category: "alerts",
    q: "Will you spam me?",
    keywords: ["spam", "too many emails", "frequency", "unsubscribe"],
    a: [
      "No. The whole point is to email you when it *matters* — a window worth fishing — not to fill your inbox. You control which spots alert you, and every email has a one-click unsubscribe.",
    ],
  },
  {
    id: "weekly-email",
    category: "alerts",
    q: "What's the weekly \"week on the water\" email?",
    keywords: ["weekly", "digest", "thursday", "email", "newsletter"],
    a: [
      "A short Thursday email built for weekend planning: your home spot's best windows, the best alternative, what's biting around your city, and any regulation changes. It's a forecast, not marketing — the kind of pre-weekend check anglers actually open.",
    ],
  },
  {
    id: "manage-emails",
    category: "alerts",
    q: "How do I change or turn off emails?",
    keywords: ["unsubscribe", "turn off", "stop emails", "manage", "preferences", "not getting emails"],
    a: [
      "Every email has an unsubscribe link, and you can manage alerts from your account. If you've stopped getting emails you expected, check your spam folder and add us to your contacts — forecast emails can get filtered.",
      `Still stuck? Email **${SUPPORT_EMAIL}** and we'll sort it out.`,
    ],
  },
  {
    id: "push-notifications",
    category: "alerts",
    status: "soon",
    q: "Do you support push notifications?",
    keywords: ["push", "notifications", "browser", "mobile push"],
    a: [
      "Email is the alert channel today. Web push notifications are on the roadmap as a fast follow, so you'll be able to get the same heads-up as a notification instead of an email if you prefer.",
    ],
  },

  // ── Catch logging ──────────────────────────────────────────────────
  {
    id: "can-i-log-catches",
    category: "logging",
    status: "soon",
    q: "Can I log my catches?",
    keywords: ["log", "catch log", "journal", "record", "photos"],
    a: [
      "Catch logging is rolling out. The idea: snap a photo, log what you caught and where, and keep a private journal of your trips.",
      "It's more than a diary — your logged catches feed back into the forecast, helping the scores for your spots get sharper over time.",
    ],
  },
  {
    id: "why-log-catches",
    category: "logging",
    status: "soon",
    q: "Why should I bother logging catches?",
    keywords: ["why log", "benefit", "improve forecast", "data"],
    a: [
      "Two reasons. First, it's your own record — what you caught, when, and in what conditions, which is gold for learning your spots.",
      "Second, it closes the loop: forecast → fish → log → better forecast. Your real results help ReelCaster's species profiles learn, so the more the community logs, the better everyone's scores get.",
    ],
  },
  {
    id: "photos-private",
    category: "logging",
    status: "soon",
    q: "Are my catch photos and spots private?",
    keywords: ["private", "photos", "location", "exif", "share", "secret spot"],
    a: [
      "Your log is yours. We don't publish your catches or expose your private spots to other users.",
      "Photos can carry location data (EXIF), which—with your permission—helps place a catch accurately and improve the forecast. We treat that as private trip data, not something to broadcast. See the Privacy section for the full picture.",
    ],
  },

  // ── Account & billing ──────────────────────────────────────────────
  {
    id: "how-to-sign-up",
    category: "account",
    q: "How do I sign up?",
    keywords: ["sign up", "register", "create account", "join"],
    a: [
      "Open the [map](/map) and tap **Get started** when you reach the 14-day view. All it takes is an email — no name, no survey, no card. You'll be looking at your spot's full forecast in about a minute.",
    ],
  },
  {
    id: "how-to-log-in",
    category: "account",
    q: "How do I log in?",
    keywords: ["log in", "sign in", "magic link", "password"],
    a: [
      "Use the email you signed up with. Depending on the option you chose, you'll either set a password or get a one-tap magic link emailed to you — no password to remember.",
    ],
  },
  {
    id: "forgot-password",
    category: "account",
    q: "I forgot my password.",
    keywords: ["password", "reset", "forgot", "can't log in", "locked out"],
    a: [
      "Use the **Forgot password** link on the sign-in screen and we'll email you a reset. If you signed up with a magic link, you don't have a password at all — just request a fresh link.",
      `If you're still locked out, email **${SUPPORT_EMAIL}**.`,
    ],
  },
  {
    id: "change-email",
    category: "account",
    q: "How do I change my email address?",
    keywords: ["change email", "update email", "new email"],
    a: [
      `You can update your email from your account settings. If you run into trouble, email us from your current address at **${SUPPORT_EMAIL}** and we'll help move it.`,
    ],
  },
  {
    id: "delete-account",
    category: "account",
    q: "How do I delete my account and my data?",
    keywords: ["delete account", "close account", "remove", "erase", "gdpr", "pipeda"],
    a: [
      `You can request account deletion at any time — email **${SUPPORT_EMAIL}** from your account address and we'll permanently delete your account and personal data.`,
      "Deletion removes your profile, saved spots, alerts, and logs. Some records may persist briefly in backups before they age out, and we may keep the minimum required for legal or anti-abuse reasons — but your account and personal data are gone.",
    ],
  },
  {
    id: "when-is-pro",
    category: "account",
    status: "soon",
    q: "When is Pro / a paid plan launching, and what will it cost?",
    keywords: ["pro", "paid", "premium", "subscription", "price", "upgrade", "tiers"],
    a: [
      "Pro isn't live yet — today everything runs on the free account. When it arrives, the free forecast stays free; Pro will add depth for serious anglers (think alerts on more spots, every species, and custom thresholds).",
      "Pricing isn't set yet. We'll be clear about exactly what's free and what's Pro before anyone is ever asked to pay.",
    ],
  },
  {
    id: "how-to-cancel",
    category: "account",
    status: "soon",
    q: "How do I cancel my subscription?",
    keywords: ["cancel", "unsubscribe", "stop paying", "end subscription"],
    a: [
      "There's nothing to cancel right now — there are no paid plans yet. When Pro launches, you'll be able to cancel yourself anytime from a self-serve billing portal, no email required.",
    ],
  },
  {
    id: "refunds",
    category: "account",
    status: "soon",
    q: "How do refunds work?",
    keywords: ["refund", "money back", "charge", "billing issue"],
    a: [
      "Since there are no paid plans yet, there's nothing to refund. Once Pro exists, we'll have a clear, fair refund policy and a self-serve way to manage your billing.",
      `If you ever see a charge you don't recognize, email **${SUPPORT_EMAIL}** right away.`,
    ],
  },
  {
    id: "pause-subscription",
    category: "account",
    status: "soon",
    q: "Can I pause my plan in the off-season?",
    keywords: ["pause", "off season", "winter", "hold", "suspend"],
    a: [
      "That's exactly the kind of thing we want to support when Pro launches — fishing is seasonal, and paying year-round for a summer fishery makes no sense. Pausing (instead of cancelling) is planned for the off-season.",
    ],
  },

  // ── Privacy & your data ────────────────────────────────────────────
  {
    id: "what-data-collected",
    category: "privacy",
    q: "What data do you collect about me?",
    keywords: ["data collection", "privacy", "what do you collect", "personal data"],
    a: [
      "The minimum to run the service: your email and account settings, your saved spot and alert preferences, and—if you log trips—your catch logs. Plus basic, standard usage analytics to keep the app working.",
      "We don't ask for your name or a survey at signup, and we don't require a phone number.",
    ],
  },
  {
    id: "sell-my-data",
    category: "privacy",
    q: "Do you sell my data?",
    keywords: ["sell data", "advertisers", "third party", "share data"],
    a: [
      "No. We don't sell your personal data. We use it to run ReelCaster and improve the forecast — that's it.",
    ],
  },
  {
    id: "secret-spots-private",
    category: "privacy",
    q: "Are my saved spots and logs kept private?",
    keywords: ["secret spot", "private", "share spots", "honey hole", "location"],
    a: [
      "Yes. Your saved spots, alerts, and any catch logs are your private account data — we don't expose them to other users or publish where you fish.",
      "Aggregate, de-identified patterns may help improve forecasts generally, but your personal honey holes aren't shared.",
    ],
  },
  {
    id: "location-tracking",
    category: "privacy",
    q: "Do you track my location?",
    keywords: ["location", "gps", "tracking", "follow"],
    a: [
      "Only if you let your browser share it, and only to do something useful — like centring the map on you or placing a logged catch. We don't track your movements in the background.",
    ],
  },
  {
    id: "request-my-data",
    category: "privacy",
    q: "How do I request or delete my data?",
    keywords: ["request data", "export", "delete data", "gdpr", "pipeda", "access"],
    a: [
      `Email **${SUPPORT_EMAIL}** from your account address and we'll help you access or delete your personal data. You can delete your whole account anytime (see Account & billing).`,
    ],
  },
  {
    id: "where-data-stored",
    category: "privacy",
    q: "Where is my data stored?",
    keywords: ["stored", "servers", "hosting", "where", "cloud"],
    a: [
      "On reputable, secured cloud infrastructure. Access is limited to what's needed to run the service, and we don't keep more personal data than we need.",
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

export function getCategory(id: string): FaqCategory | undefined {
  return FAQ_CATEGORIES.find((c) => c.id === id);
}

export function getFeaturedItems(): FaqItem[] {
  return FAQ_ITEMS.filter((it) => it.featured);
}

export function getItemsByCategory(id: FaqCategoryId): FaqItem[] {
  return FAQ_ITEMS.filter((it) => it.category === id);
}

export function countByCategory(id: FaqCategoryId): number {
  return getItemsByCategory(id).length;
}

/** Flatten an answer to plain text (drops **bold** / [link](href) markup). */
export function paraToPlain(para: FaqPara): string {
  const raw = typeof para === "string" ? para : para.list.join(" ");
  return raw
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1");
}

export function itemPlainAnswer(item: FaqItem): string {
  return item.a.map(paraToPlain).join(" ");
}

/** Lowercased haystack for client-side search (question + answer + keywords). */
export function itemSearchText(item: FaqItem): string {
  return [item.q, itemPlainAnswer(item), ...(item.keywords ?? [])]
    .join(" ")
    .toLowerCase();
}

/** Build schema.org FAQPage JSON-LD for a set of items. */
export function faqPageJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: itemPlainAnswer(it),
      },
    })),
  };
}
