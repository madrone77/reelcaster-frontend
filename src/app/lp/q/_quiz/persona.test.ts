import assert from "node:assert";
import { buildQuestions, recapLine, scorePersona, type QuizAnswers } from "./persona";

// Run with: npx tsx src/app/lp/q/_quiz/persona.test.ts

const tests: Array<[string, () => void]> = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const base: QuizAnswers = {
  access: "boat",
  species: "coho-salmon",
  frequency: "monthly",
  pain: "skunked",
  experience: "seasons",
  planning: "night",
};

test("a monthly boater tired of bad days is the weekend boater", () => {
  assert.equal(scorePersona(base).persona, "weekend");
});

test("shore wins whenever they fish from shore", () => {
  assert.equal(scorePersona({ ...base, access: "shore" }).persona, "shore");
  assert.equal(scorePersona({ ...base, access: "shore", frequency: "weekly", experience: "lifelong" }).persona, "shore");
});

test("new to it and unsure what's open is the newcomer", () => {
  assert.equal(scorePersona({ ...base, experience: "new", pain: "regs", frequency: "few" }).persona, "newcomer");
});

test("weekly, lifelong, watching the weather is the die-hard", () => {
  assert.equal(
    scorePersona({ ...base, frequency: "weekly", experience: "lifelong", pain: "conditions", planning: "morning" }).persona,
    "hardcore",
  );
});

test("every persona is reachable", () => {
  const seen = new Set<string>();
  const qs = buildQuestions("Seattle", [{ slug: "coho-salmon", name: "Coho" }]);
  const opts = (id: string) => qs.find((q) => q.id === id)!.options.map((o) => o.value);
  for (const access of opts("access"))
    for (const frequency of opts("frequency"))
      for (const pain of opts("pain"))
        for (const experience of opts("experience"))
          for (const planning of opts("planning"))
            seen.add(scorePersona({ species: "any", access, frequency, pain, experience, planning } as QuizAnswers).persona);
  assert.deepEqual([...seen].sort(), ["hardcore", "newcomer", "shore", "weekend"]);
});

test("the recap has no dashes and names the species", () => {
  const line = recapLine(base, "Coho");
  assert.match(line, /mostly for Coho/);
  assert.doesNotMatch(line, /[–—]/);
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL ${name}`);
    console.log(err);
  }
}
if (failed) process.exit(1);
