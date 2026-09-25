/**
 * The quiz landing page's brain: the questions, the persona they add up to,
 * and what the result page says to each persona.
 *
 * Pure and client-safe. No imports from the data layer, so the whole quiz can
 * be tested with `npx tsx` and the scoring cannot drift from what the page
 * renders.
 *
 * The shape is the Hims/Hers funnel: one tap per screen, easy questions
 * first, and a result page that repeats the reader's own answers back and
 * frames the product as their plan. The persona is a points table, not a
 * model. Every answer adds weight to one or more personas, and the heaviest
 * wins, with ties broken in PERSONA_ORDER.
 *
 * Copy rules, same as every other landing page: no em or en dashes, plain
 * words, and no claim about a feature the product does not have.
 */

export type Persona = "weekend" | "shore" | "newcomer" | "hardcore";

/** Tie-break order, most specific first. Shore is a hard fact about how
 *  someone fishes; weekend is the default for everyone else. */
export const PERSONA_ORDER: Persona[] = ["shore", "newcomer", "hardcore", "weekend"];

export type Access = "boat" | "kayak" | "shore" | "both";
export type Frequency = "few" | "monthly" | "weekly";
export type Pain = "skunked" | "regs" | "conditions" | "where";
export type Experience = "new" | "seasons" | "lifelong";
export type Planning = "night" | "morning" | "week";

export interface QuizAnswers {
  access: Access;
  /** Species slug from the city's roster, or "any". */
  species: string;
  frequency: Frequency;
  pain: Pain;
  experience: Experience;
  planning: Planning;
}

export type QuestionId = keyof QuizAnswers;

export interface QuizOption<V extends string = string> {
  value: V;
  label: string;
  /** Small line under the label. */
  hint?: string;
}

export interface QuizQuestion {
  id: QuestionId;
  title: string;
  sub?: string;
  options: QuizOption[];
}

/** Points each answer adds. Anything absent adds nothing. */
const WEIGHTS: {
  [K in Exclude<QuestionId, "species">]: Record<QuizAnswers[K], Partial<Record<Persona, number>>>;
} = {
  access: {
    boat: { weekend: 2, hardcore: 1 },
    kayak: { hardcore: 1, weekend: 1 },
    shore: { shore: 5 }, // decisive, see scorePersona
    both: { weekend: 1, shore: 1 },
  },
  frequency: {
    few: { newcomer: 1, weekend: 1 },
    monthly: { weekend: 2 },
    weekly: { hardcore: 3 },
  },
  pain: {
    skunked: { weekend: 2 },
    regs: { newcomer: 3 },
    conditions: { hardcore: 2, weekend: 1 },
    where: { newcomer: 2, shore: 1 },
  },
  experience: {
    new: { newcomer: 4 },
    seasons: { weekend: 1 },
    lifelong: { hardcore: 3 },
  },
  planning: {
    night: { weekend: 1 },
    morning: { hardcore: 1 },
    week: { weekend: 1, hardcore: 1 },
  },
};

/** Sum the points and pick the heaviest persona. */
export function scorePersona(a: QuizAnswers): { persona: Persona; points: Record<Persona, number> } {
  const points: Record<Persona, number> = { weekend: 0, shore: 0, newcomer: 0, hardcore: 0 };
  const add = (w: Partial<Record<Persona, number>> | undefined) => {
    if (!w) return;
    for (const [p, n] of Object.entries(w) as [Persona, number][]) points[p] += n;
  };
  add(WEIGHTS.access[a.access]);
  add(WEIGHTS.frequency[a.frequency]);
  add(WEIGHTS.pain[a.pain]);
  add(WEIGHTS.experience[a.experience]);
  add(WEIGHTS.planning[a.planning]);

  // Shore is a fact about the reader, not a leaning: their spot, their map
  // filter and their whole result page change with it. Points can't outvote it.
  if (a.access === "shore") return { persona: "shore", points };

  let best: Persona = PERSONA_ORDER[0];
  for (const p of PERSONA_ORDER) if (points[p] > points[best]) best = p;
  return { persona: best, points };
}

/** Does this reader fish from shore? Decides which spot the result shows. */
export function wantsShore(a: Pick<QuizAnswers, "access">): boolean {
  return a.access === "shore";
}

/**
 * The questions, in order. Experience leads (Casey, 2026-09-24): the easiest
 * question to answer, and it frames the rest as being about the reader. Species options come from the city's own roster,
 * so they are passed in rather than listed here.
 */
export function buildQuestions(
  cityName: string,
  species: Array<{ slug: string; name: string }>,
): QuizQuestion[] {
  return [
    {
      id: "experience",
      title: `How long have you fished around ${cityName}?`,
      options: [
        { value: "new", label: "I'm new to it" },
        { value: "seasons", label: "A few seasons" },
        { value: "lifelong", label: "Most of my life" },
      ],
    },
    {
      id: "access",
      title: `How do you fish around ${cityName}?`,
      options: [
        { value: "boat", label: "From a boat" },
        { value: "kayak", label: "From a kayak" },
        { value: "shore", label: "From shore", hint: "Piers, beaches, docks" },
        { value: "both", label: "A bit of both" },
      ],
    },
    {
      id: "species",
      title: "What are you after most?",
      options: [
        ...species.map((s) => ({ value: s.slug, label: s.name })),
        { value: "any", label: "Whatever's biting" },
      ],
    },
    {
      id: "frequency",
      title: "How often do you get out?",
      options: [
        { value: "few", label: "A few times a year" },
        { value: "monthly", label: "Once or twice a month" },
        { value: "weekly", label: "Every week, or close to it" },
      ],
    },
    {
      id: "pain",
      title: "What costs you the most fish?",
      sub: "Pick the one that stings.",
      options: [
        { value: "skunked", label: "Going on the wrong day", hint: "Long drive, no bites" },
        { value: "regs", label: "Not sure what's open", hint: "Seasons, limits, closures" },
        { value: "conditions", label: "Wind, tide and current", hint: "Getting blown off the water" },
        { value: "where", label: "Not knowing where to go", hint: "Too much water, no plan" },
      ],
    },
    {
      id: "planning",
      title: "When do you decide to go?",
      options: [
        { value: "night", label: "The night before" },
        { value: "morning", label: "That morning" },
        { value: "week", label: "A week or more ahead" },
      ],
    },
  ];
}

export interface PersonaCopy {
  /** "The Weekend Boater" */
  name: string;
  /** The promise, one line under the name. */
  promise: string;
  /** Three things ReelCaster does for this reader. */
  benefits: string[];
  /** The button. */
  cta: string;
}

/**
 * What the result page says. `species` is the display name the reader picked
 * ("Coho"), or "every species" for "Whatever's biting". `regulator` is DFO or WDFW.
 */
export function personaCopy(
  persona: Persona,
  ctx: { species: string; regulator: string; cityName: string },
): PersonaCopy {
  const { species, regulator, cityName } = ctx;
  switch (persona) {
    case "shore":
      return {
        name: "The Shore Caster",
        promise: `The right pier or beach, at the right tide, without a boat.`,
        benefits: [
          `Shore spots around ${cityName} scored for ${species}, hour by hour.`,
          "The tide and current timing that brings fish in close.",
          `What's open and the limits at each spot, from ${regulator}.`,
        ],
        cta: "Show me my shore spot",
      };
    case "newcomer":
      return {
        name: "The Explorer",
        promise: `Fish ${cityName} like you've been doing it for years.`,
        benefits: [
          `What's open and the limits at every spot, straight from ${regulator}.`,
          `The spots locals fish, ranked for ${species} today.`,
          "The best time to go, in plain words. No charts to decode.",
        ],
        cta: "Show me where to go",
      };
    case "hardcore":
      return {
        name: "The Die-Hard",
        promise: "Every mark, every hour, 14 days out. Pick your day first.",
        benefits: [
          "Wind, sea, tide and current by the hour at every mark.",
          `Scores for ${species} at every spot, 14 days ahead with Pro.`,
          "Fresh catch reports and the marks running hot right now.",
        ],
        cta: "Open my marks",
      };
    case "weekend":
    default:
      return {
        name: "The Weekend Boater",
        promise: "Stop burning Saturdays. Go when the bite is on.",
        benefits: [
          `A score for every spot and every hour, built for ${species}.`,
          "The best window each day, so you launch at the right time.",
          "Alerts when your spot turns good, so you never miss a day.",
        ],
        cta: "Show me my best spot",
      };
  }
}

/**
 * The reader's own answers, as one sentence. This is the moment the page
 * proves it listened.
 *
 *   "You fish from a boat, mostly for Coho, once or twice a month,
 *    and going on the wrong day costs you the most."
 */
export function recapLine(a: QuizAnswers, speciesName: string): string {
  const how: Record<Access, string> = {
    boat: "You fish from a boat",
    kayak: "You fish from a kayak",
    shore: "You fish from shore",
    both: "You fish from a boat and from shore",
  };
  const often: Record<Frequency, string> = {
    few: "a few times a year",
    monthly: "once or twice a month",
    weekly: "most weeks",
  };
  const pain: Record<Pain, string> = {
    skunked: "going on the wrong day costs you the most",
    regs: "working out what's open costs you the most",
    conditions: "wind, tide and current cost you the most",
    where: "not knowing where to go costs you the most",
  };
  const what = a.species === "any" ? "for whatever's biting" : `mostly for ${speciesName}`;
  return `${how[a.access]}, ${what}, ${often[a.frequency]}, and ${pain[a.pain]}.`;
}

/** Is a value one of the options for that question? Guards stored state. */
export function isAnswer(q: QuizQuestion, value: unknown): value is string {
  return typeof value === "string" && q.options.some((o) => o.value === value);
}

/* -------------------------------------------------------------------------
 * The result page's showcase: which screens each reader is shown, in what
 * order, and what the headline over each one says.
 *
 * Four screens exist, all drawn from the reader's own spot and fish:
 *   day    the spot's real day, hour by hour, on the conditions phone
 *   map    the scored spots around the city, the pick featured
 *   regs   what is open there and the limits, from the regulator
 *   alert  the text that arrives when the spot turns good
 *
 * The order is the persona's, and then the screen that answers the pain the
 * reader named goes first, because that is the one thing they told us they
 * would pay to fix. The headline over each screen changes with the pain
 * and the persona for the same reason. Copy rules as above: plain words,
 * no dashes, nothing the product does not do.
 * ---------------------------------------------------------------------- */

export type ShowcaseId = "day" | "map" | "regs" | "alert";

export interface ShowcaseBlock {
  id: ShowcaseId;
  /** The kicker over the headline, e.g. "Hour by hour". */
  kicker: string;
  headline: string;
  /** One line under the headline saying what the reader is looking at. */
  lede: string;
}

const PERSONA_ORDER_OF_BLOCKS: Record<Persona, ShowcaseId[]> = {
  weekend: ["day", "alert", "map", "regs"],
  shore: ["map", "day", "regs", "alert"],
  newcomer: ["regs", "map", "day", "alert"],
  hardcore: ["day", "map", "alert", "regs"],
};

/** The screen that answers each pain. */
const PAIN_BLOCK: Record<Pain, ShowcaseId> = {
  skunked: "day",
  regs: "regs",
  conditions: "day",
  where: "map",
};

export interface ShowcaseContext {
  cityName: string;
  spotName: string;
  /** "Coho", or "whatever's biting". */
  species: string;
  regulator: string;
  shore: boolean;
}

function blockCopy(id: ShowcaseId, persona: Persona, a: QuizAnswers, c: ShowcaseContext): ShowcaseBlock {
  const { cityName, spotName, species, regulator, shore } = c;
  switch (id) {
    case "day": {
      let headline = `Your day at ${spotName}, hour by hour`;
      if (a.pain === "skunked") headline = "Never drive out on the wrong day again";
      else if (a.pain === "conditions") headline = "Wind, tide and current, on the same line as the score";
      else if (a.planning === "morning") headline = "Check it with your coffee. The line sits on this hour.";
      else if (persona === "hardcore") headline = `Every reading at ${spotName}, by the hour`;
      return {
        id,
        kicker: "Hour by hour",
        headline,
        lede: `This is ${spotName} today, scored for ${species}. Tide, current, wind, sea and sky sit on the same hour as the score. Drag the line yourself.`,
      };
    }
    case "map": {
      const kayak = a.access === "kayak";
      let headline = `Every spot near ${cityName}, scored for ${species} today`;
      if (shore) headline = `Shore spots around ${cityName} you can reach on foot, scored`;
      else if (kayak) headline = `Water you can paddle to from ${cityName}, scored for ${species}`;
      else if (a.pain === "where") headline = "Stop guessing where to go";
      else if (persona === "newcomer") headline = "The spots locals fish, ranked for today";
      return {
        id,
        kicker: shore ? "No boat needed" : kayak ? "Within a paddle" : "Where to go",
        headline,
        lede: shore
          ? `Piers, beaches and docks scored for ${species}, so you know which one to walk onto before you leave.`
          : kayak
            ? `Only spots close in, never a crossing. The number on each pin is that spot's score for ${species} today.`
            : `Green is go. The number on each pin is that spot's score for ${species} today, so the best water stands out before you pick a launch.`,
      };
    }
    case "regs": {
      let headline = `What's open at ${spotName}, from ${regulator}`;
      if (a.pain === "regs") headline = "Know what's open before you leave the driveway";
      else if (persona === "newcomer") headline = "Limits and openings, on the same screen as the score";
      return {
        id,
        kicker: "The rules, checked daily",
        headline,
        lede: `Openings, daily limits and sizes for the exact water you are looking at, straight from ${regulator}. No pamphlet to decode.`,
      };
    }
    case "alert":
    default: {
      let headline = `A text when ${spotName} turns good`;
      if (a.pain === "skunked" || a.planning === "night") headline = "We watch the water. You get a text.";
      else if (persona === "hardcore") headline = "Up to 10 spots watched around the clock";
      else if (a.frequency === "few") headline = "Fish more days without checking every day";
      return {
        id,
        kicker: "Alerts",
        headline,
        lede: `Set the score you care about on up to 10 spots. When ${spotName} clears it, your phone tells you, days ahead, so there is still time to plan.`,
      };
    }
  }
}

/** The showcase, in order, for this reader. Always all four. */
export function showcaseFor(persona: Persona, a: QuizAnswers, c: ShowcaseContext): ShowcaseBlock[] {
  const first = PAIN_BLOCK[a.pain];
  const order = [first, ...PERSONA_ORDER_OF_BLOCKS[persona].filter((b) => b !== first)];
  return order.map((id) => blockCopy(id, persona, a, c));
}

/**
 * The plan's other features, listed after the screens. What is not shown as
 * a screen is still promised here, so no persona's plan reads shorter than
 * another's. Claims stay inside the tier matrix: 14 days, 10 alerts, custom
 * spots inside covered water.
 */
export function planFeatures(persona: Persona, ctx: { species: string; regulator: string }): Array<{ title: string; desc: string }> {
  const { species, regulator } = ctx;
  const forecast = {
    title: "14 days ahead, every spot",
    desc: `Scores for ${species} at every spot, hour by hour, two weeks out. Pick your day before you pick your spot.`,
  };
  const custom = {
    title: "Your own spots, scored",
    desc: "Drop a pin on the ledge or the rip you found yourself. It gets the full model, private to you.",
  };
  const log = {
    title: "A catch log that reads the water back",
    desc: "Log a fish and the tide, current and pressure are saved with it. Over a season the pattern shows.",
  };
  const regs = {
    title: "Rules on the same screen",
    desc: `Openings, limits and sizes from ${regulator} beside every score.`,
  };
  const fresh = {
    title: "What's biting right now",
    desc: "Fresh catch reports and dockside counts, so the score is checked against real fish.",
  };
  switch (persona) {
    case "hardcore":
      return [forecast, custom, log, fresh];
    case "shore":
      return [forecast, fresh, log];
    case "newcomer":
      return [forecast, fresh, log];
    case "weekend":
    default:
      return [forecast, custom, fresh, regs];
  }
}
