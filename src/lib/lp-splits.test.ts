import assert from "node:assert";
import {
  CITY_QUIZ_SPLIT,
  CONTROL_ARM,
  TREATMENT_ARM,
  isPaidClick,
  parseLpSplitCookie,
  quizPathFor,
  resolveLpArm,
  serializeLpSplitArms,
  splitForRequest,
} from "./lp-splits";

const tests: Array<[string, () => void]> = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const META = "?ad=today&fbclid=IwAR0x&utm_source=meta&utm_campaign=120247917503690452";
const GOOGLE = "?ad=today&gclid=Cj0x&utm_source=google";

test("a bought click is a click id or a paid utm_source", () => {
  assert.equal(isPaidClick(META), true);
  assert.equal(isPaidClick(GOOGLE), true);
  assert.equal(isPaidClick("?ad=today&gbraid=x"), true);
  assert.equal(isPaidClick("?fbclid=IwSentinel&utm_source=meta"), true);
  assert.equal(isPaidClick("?utm_source=Facebook"), true);
  assert.equal(isPaidClick("?utm_source=google&utm_medium=cpc"), true);
});

test("organic readers, shared links and the Sentinel's ?ad=today are not", () => {
  assert.equal(isPaidClick(""), false);
  assert.equal(isPaidClick("?ad=today"), false);
  assert.equal(isPaidClick("?utm_source=newsletter"), false);
  assert.equal(isPaidClick("?loc=seattle-wa&ad=day2&via=lpq"), false);
});

test("the framed city page is sent to that city's quiz", () => {
  assert.equal(quizPathFor("/fishing/us/wa/seattle", "?ad=today"), "/lp/q/seattle");
  assert.equal(quizPathFor("/fishing/ca/bc/vancouver/", "?ad=day2"), "/lp/q/vancouver");
  assert.equal(quizPathFor("/fishing/us/wa/tacoma", META), "/lp/q/tacoma");
});

test("a city page without ?ad= is the public page, not a landing", () => {
  assert.equal(quizPathFor("/fishing/us/wa/seattle", "?fbclid=x"), null);
  assert.equal(quizPathFor("/fishing/us/wa/seattle", ""), null);
});

test("spot pages, the state page and the ad frame itself are not city landings", () => {
  assert.equal(quizPathFor("/fishing/us/wa/seattle/shilshole-bay-abc123", "?ad=today"), null);
  assert.equal(quizPathFor("/fishing/us/wa", "?ad=today"), null);
  assert.equal(quizPathFor("/fishing/us/wa/seattle/ad", "?ad=today"), null);
  assert.equal(quizPathFor("/explore", "?loc=seattle-wa&ad=day2"), null);
  assert.equal(quizPathFor("/", ""), null);
});

test("every /lp address the ads were bought against names its city", () => {
  assert.equal(quizPathFor("/lp/seattle/5"), "/lp/q/seattle");
  assert.equal(quizPathFor("/lp/seattle/1"), "/lp/q/seattle");
  assert.equal(quizPathFor("/lp/vancouver/4"), "/lp/q/vancouver");
  assert.equal(quizPathFor("/lp/tacoma/5"), "/lp/q/tacoma");
  assert.equal(quizPathFor("/lp/5/seattle-wa"), "/lp/q/seattle-wa");
  assert.equal(quizPathFor("/lp/7/victoria-bc"), "/lp/q/victoria-bc");
  assert.equal(quizPathFor("/lp/5", "?city=seattle-wa&fbclid=x"), "/lp/q/seattle-wa");
  assert.equal(quizPathFor("/lp/seattle-wa"), "/lp/q/seattle-wa");
  assert.equal(quizPathFor("/LP/Seattle/5"), "/lp/q/seattle");
});

test("an /lp address with no city goes to the quiz's own country default", () => {
  assert.equal(quizPathFor("/lp/6"), "/lp/q");
  assert.equal(quizPathFor("/lp/5", "?city=Not%20A%20City"), "/lp/q");
  assert.equal(quizPathFor("/lp"), "/lp/q");
});

test("the quiz itself is never a control", () => {
  assert.equal(quizPathFor("/lp/q/seattle", META), null);
  assert.equal(quizPathFor("/lp/q", "?city=seattle-wa"), null);
  assert.equal(quizPathFor("/lp/q/seattle/extra"), null);
});

test("splitForRequest needs both a city landing and a bought click", () => {
  const hit = splitForRequest("/fishing/us/wa/seattle", META);
  assert.ok(hit);
  assert.equal(hit.split, CITY_QUIZ_SPLIT);
  assert.equal(hit.treatment, "/lp/q/seattle");
  assert.equal(splitForRequest("/fishing/us/wa/seattle", "?ad=today"), null);
  assert.equal(splitForRequest("/lp/vancouver/5", "?fbclid=x&utm_source=meta")?.treatment, "/lp/q/vancouver");
  assert.equal(splitForRequest("/lp/vancouver/5", ""), null);
  assert.equal(splitForRequest("/lp/q/seattle", META), null);
  assert.equal(splitForRequest("/fishing/us/wa/seattle", META, null), null);
});

test("a new visitor is assigned by the roll: below the share is the treatment", () => {
  const b = resolveLpArm(CITY_QUIZ_SPLIT, {}, 0.2);
  assert.equal(b.arm, TREATMENT_ARM);
  assert.equal(b.changed, true);
  assert.deepEqual(b.arms, { city_quiz: "b" });

  const a = resolveLpArm(CITY_QUIZ_SPLIT, {}, 0.7);
  assert.equal(a.arm, CONTROL_ARM);
  assert.equal(a.changed, true);

  // The boundary belongs to the control, so share 0 sends nobody.
  assert.equal(resolveLpArm(CITY_QUIZ_SPLIT, {}, 0.5).arm, CONTROL_ARM);
  assert.equal(resolveLpArm({ key: "city_quiz", share: 0 }, {}, 0).arm, CONTROL_ARM);
  assert.equal(resolveLpArm({ key: "city_quiz", share: 1 }, {}, 0.999).arm, TREATMENT_ARM);
});

test("a visitor already in an arm keeps it whatever the roll says", () => {
  const keepB = resolveLpArm(CITY_QUIZ_SPLIT, { city_quiz: "b" }, 0.99);
  assert.equal(keepB.arm, TREATMENT_ARM);
  assert.equal(keepB.changed, false);

  const keepA = resolveLpArm(CITY_QUIZ_SPLIT, { city_quiz: "a" }, 0.01);
  assert.equal(keepA.arm, CONTROL_ARM);
  assert.equal(keepA.changed, false);
});

test("a key for a split that no longer runs is dropped, and that is a change", () => {
  const r = resolveLpArm(CITY_QUIZ_SPLIT, { seattle_city_quiz: "b", city_quiz: "a" }, 0.1);
  assert.equal(r.arm, CONTROL_ARM);
  assert.deepEqual(r.arms, { city_quiz: "a" });
  assert.equal(r.changed, true);
});

test("the cookie round-trips, encoded or not", () => {
  const arms = { city_quiz: "b" as const };
  const raw = serializeLpSplitArms(arms);
  assert.equal(raw, "city_quiz:b");
  assert.deepEqual(parseLpSplitCookie(raw), arms);
  assert.deepEqual(parseLpSplitCookie(encodeURIComponent(raw)), arms);
  assert.deepEqual(parseLpSplitCookie("city_quiz:b|other:a"), { city_quiz: "b", other: "a" });
});

test("a malformed cookie is refused, not corrected", () => {
  assert.deepEqual(parseLpSplitCookie(""), {});
  assert.deepEqual(parseLpSplitCookie(null), {});
  assert.deepEqual(parseLpSplitCookie("city_quiz:c"), {});
  assert.deepEqual(parseLpSplitCookie("City-Quiz:b"), {});
  assert.deepEqual(parseLpSplitCookie(":b"), {});
  assert.deepEqual(parseLpSplitCookie("%E0%A4%A"), {});
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}\n     ${(e as Error).message}`);
  }
}
if (failed) process.exit(1);
console.log(`\n${tests.length} passed`);
