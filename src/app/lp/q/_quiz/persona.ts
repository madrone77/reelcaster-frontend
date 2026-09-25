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
 * The questions, in order. Species options come from the city's own roster,
 * so they are passed in rather than listed here.
 */
export function buildQuestions(
  cityName: string,
  species: Array<{ slug: string; name: string }>,
): QuizQuestion[] {
  return [
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
      id: "experience",
      title: `How long have you fished around ${cityName}?`,
      options: [
        { value: "new", label: "I'm new to it" },
        { value: "seasons", label: "A few seasons" },
        { value: "lifelong", label: "Most of my life" },
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
