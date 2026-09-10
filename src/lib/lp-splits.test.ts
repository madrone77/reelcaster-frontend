import assert from "node:assert";
import {
  CONTROL_ARM,
  LP_SPLITS,
  TREATMENT_ARM,
  isPageSplit,
  parseLpSplitCookie,
  resolveLpArm,
  serializeLpSplitArms,
  splitForPath,
  type LpPageSplit,
} from "./lp-splits";

const tests: Array<[string, () => void]> = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

const SPLIT: LpPageSplit = {
  key: "vancouver_4_5",
  control: "/lp/vancouver/4",
  treatment: "/lp/vancouver/5",
  share: 0.5,
};
const ONLY = [SPLIT];

test("the control path matches, with or without a trailing slash", () => {
  assert.equal(splitForPath("/lp/vancouver/4", ONLY), SPLIT);
  assert.equal(splitForPath("/lp/vancouver/4/", ONLY), SPLIT);
});

test("the treatment and every other path do not match", () => {
  for (const p of ["/lp/vancouver/5", "/lp/vancouver/1", "/lp/seattle/4", "/lp/vancouver", "/"]) {
    assert.equal(splitForPath(p, ONLY), null, p);
  }
});

test("a new visitor is assigned by the roll: below the share is the treatment", () => {
  const b = resolveLpArm(SPLIT, {}, 0.2, ONLY);
  assert.equal(b.arm, TREATMENT_ARM);
  assert.equal(b.changed, true);
  assert.deepEqual(b.arms, { vancouver_4_5: "b" });

  const a = resolveLpArm(SPLIT, {}, 0.7, ONLY);
  assert.equal(a.arm, CONTROL_ARM);
  assert.equal(a.changed, true);

  // The boundary belongs to the control, so share 0 sends nobody.
  assert.equal(resolveLpArm(SPLIT, {}, 0.5, ONLY).arm, CONTROL_ARM);
});

test("a visitor already in an arm keeps it whatever the roll says", () => {
  const keepB = resolveLpArm(SPLIT, { vancouver_4_5: "b" }, 0.99, ONLY);
  assert.equal(keepB.arm, TREATMENT_ARM);
  assert.equal(keepB.changed, false);

  const keepA = resolveLpArm(SPLIT, { vancouver_4_5: "a" }, 0.01, ONLY);
  assert.equal(keepA.arm, CONTROL_ARM);
  assert.equal(keepA.changed, false);
});

test("share 0 never sends to the treatment and share 1 always does", () => {
  const never = { ...SPLIT, share: 0 };
  const always = { ...SPLIT, share: 1 };
  for (const roll of [0, 0.25, 0.5, 0.999]) {
    assert.equal(resolveLpArm(never, {}, roll, [never]).arm, CONTROL_ARM);
    assert.equal(resolveLpArm(always, {}, roll, [always]).arm, TREATMENT_ARM);
  }
});

test("an even share over even rolls is an even split", () => {
  let treatment = 0;
  const n = 1000;
  for (let i = 0; i < n; i++) {
    if (resolveLpArm(SPLIT, {}, i / n, ONLY).arm === TREATMENT_ARM) treatment++;
  }
  assert.equal(treatment, n / 2);
});

test("a key for a split that no longer exists is dropped", () => {
  const r = resolveLpArm(SPLIT, { retired_test: "b", vancouver_4_5: "a" }, 0, ONLY);
  assert.equal(r.arm, CONTROL_ARM);
  assert.equal(r.changed, true);
  assert.deepEqual(r.arms, { vancouver_4_5: "a" });
});

test("the cookie round-trips and refuses what it did not write", () => {
  const arms = parseLpSplitCookie("vancouver_4_5:b|other_1:a");
  assert.deepEqual(arms, { vancouver_4_5: "b", other_1: "a" });
  assert.equal(serializeLpSplitArms(arms), "vancouver_4_5:b|other_1:a");

  // The browser sends back exactly what Set-Cookie wrote, colon encoded.
  assert.deepEqual(parseLpSplitCookie("vancouver_4_5%3Ab"), { vancouver_4_5: "b" });
  assert.deepEqual(parseLpSplitCookie("%E0%A4%A"), {});
  assert.deepEqual(parseLpSplitCookie(""), {});
  assert.deepEqual(parseLpSplitCookie(undefined), {});
  // A made-up arm, a bad key, a missing colon: none of them get in.
  assert.deepEqual(parseLpSplitCookie("vancouver_4_5:z|Bad-Key:a|noarm"), {});
});

test("the live table is well formed", () => {
  const keys = LP_SPLITS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "keys are unique");
  for (const s of LP_SPLITS) {
    assert.match(s.key, /^[a-z0-9_]{1,64}$/);
    assert.ok(s.share >= 0 && s.share <= 1);
    if (!isPageSplit(s)) continue;
    assert.ok(s.control.startsWith("/lp/"), s.control);
    assert.ok(s.treatment.startsWith("/lp/"), s.treatment);
    assert.notEqual(s.control, s.treatment);
    // The treatment must never itself be a control, or a visitor could be
    // bounced twice.
    assert.equal(splitForPath(s.treatment), null);
  }
});

test("a stale arm from a concluded split is dropped, not honoured", () => {
  // meta_lp5_explore ran until 10 Sep and its cookie lives for thirty days,
  // so browsers are still sending the key back. The Meta hop no longer
  // consults an arm at all, and resolveLpArm must not carry an unknown key
  // forward: a returning arm-a visitor gets the map like everybody else.
  const stale = { meta_lp5_explore: "a" as const, vancouver_4_5: "b" as const };
  const resolved = resolveLpArm(SPLIT, stale, 0.9, ONLY);
  assert.deepEqual(resolved.arms, { vancouver_4_5: "b" });
  assert.equal(resolved.changed, true, "the tidied cookie is written back");
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
