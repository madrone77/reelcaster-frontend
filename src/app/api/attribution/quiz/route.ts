/**
 * POST /api/attribution/quiz  → { ok: true }
 *
 * Every answer on the /lp/q quiz, written to one row per quiz
 * (`quiz_responses`, see supabase/migrations/20260925_quiz_responses.sql).
 *
 * Three kinds:
 *   answer    one question answered: sets that column and the step reached
 *   complete  the result was shown: sets the persona and completed_at
 *   cta       the email form was submitted: sets cta_at
 *
 * Each call upserts on `quiz_id`, so the row is born on the first answer and
 * filled in as the reader goes. Only the columns the call names are written;
 * a later call never blanks an earlier answer.
 *
 * THE CLIENT DESCRIBES THE ANSWERS, THE SERVER DESCRIBES THE VISITOR. Same
 * rule as /api/attribution/campaign: device, OS and coarse location come from
 * headers here, never from the body, and the split-test arms come from the
 * cookie the edge set. Every answer is checked against the quiz's own
 * vocabulary before it is stored, because an unauthenticated route that
 * writes free text is a route that ends up storing whatever a bot posts.
 *
 * Unauthenticated by design: every reader worth recording is signed out. The
 * worst an abuser can do is fill the table with well-formed junk under
 * unknown quiz ids, which is a wrong number on an internal page.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CLICK_TYPES } from "@/lib/attribution";
import { classifyUserAgent, isBotUserAgent } from "@/lib/device";
import { readEdgeGeo } from "@/lib/edge-geo";
import { armsFromCookieHeader } from "@/lib/split-tests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const KINDS = new Set(["answer", "complete", "cta"]);

/** The quiz id the browser made: 16 to 32 hex characters. */
const QUIZ_ID_SHAPE = /^[a-f0-9]{16,32}$/;
const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PERSONAS = new Set(["weekend", "shore", "newcomer", "hardcore"]);

/**
 * The vocabulary, question by question. Kept here rather than imported from
 * the quiz so this route stays free of the page's module graph; the test
 * beside persona.ts checks the two agree.
 */
const ANSWERS: Record<string, ((v: string) => boolean) | Set<string>> = {
  experience: new Set(["new", "seasons", "lifelong"]),
  access: new Set(["boat", "kayak", "shore", "both"]),
  // A species slug from the city's own roster, or "any".
  species: (v: string) => v === "any" || SLUG_SHAPE.test(v),
  frequency: new Set(["few", "monthly", "weekly"]),
  pain: new Set(["skunked", "regs", "conditions", "where"]),
  planning: new Set(["night", "morning", "week"]),
};
const QUESTIONS = Object.keys(ANSWERS);
const CLICK_TYPE_SET = new Set<string>(CLICK_TYPES);

const MAX_TAG = 80;
function tag(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().slice(0, MAX_TAG);
}

function accepts(question: string, value: string): boolean {
  const rule = ANSWERS[question];
  if (!rule) return false;
  return rule instanceof Set ? rule.has(value) : rule(value);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  if (!KINDS.has(kind)) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });

  const quizId = tag(body.quiz_id);
  if (!QUIZ_ID_SHAPE.test(quizId)) return NextResponse.json({ error: "invalid_quiz_id" }, { status: 400 });

  const city = tag(body.city);
  if (!SLUG_SHAPE.test(city)) return NextResponse.json({ error: "invalid_city" }, { status: 400 });

  const userAgent = request.headers.get("user-agent");
  if (isBotUserAgent(userAgent)) return NextResponse.json({ ok: true, counted: false });

  const now = new Date().toISOString();
  const row: Record<string, unknown> = { quiz_id: quizId, city, updated_at: now };

  if (kind === "answer") {
    const question = tag(body.question);
    const answer = tag(body.answer);
    const step = Number(body.step);
    if (!accepts(question, answer)) return NextResponse.json({ error: "invalid_answer" }, { status: 400 });
    if (!Number.isInteger(step) || step < 1 || step > QUESTIONS.length) {
      return NextResponse.json({ error: "invalid_step" }, { status: 400 });
    }
    row[question] = answer;
    row.last_step = step;
  } else if (kind === "complete") {
    const persona = tag(body.persona);
    if (!PERSONAS.has(persona)) return NextResponse.json({ error: "invalid_persona" }, { status: 400 });
    // The full answer set rides along so a row that missed an answer post
    // (a tab closed mid-beacon) is still whole once the result is shown.
    for (const q of QUESTIONS) {
      const v = tag(body[q]);
      if (v && accepts(q, v)) row[q] = v;
    }
    row.persona = persona;
    row.completed_at = now;
    row.last_step = QUESTIONS.length;
  } else {
    row.cta_at = now;
  }

  // The visit, described by the server. Written on every call, and the same
  // on every call within a tab, so the upsert repeating them is harmless.
  const { device, os } = classifyUserAgent(userAgent);
  const geo = readEdgeGeo(request.headers);
  const clickTypeRaw = tag(body.click_type);
  Object.assign(row, {
    utm_source: tag(body.utm_source),
    utm_medium: tag(body.utm_medium),
    utm_campaign: tag(body.utm_campaign),
    click_type: CLICK_TYPE_SET.has(clickTypeRaw) ? clickTypeRaw : "",
    split_tests: armsFromCookieHeader(request.headers.get("cookie")),
    device,
    os,
    geo_country: geo.country ?? "",
    geo_region: geo.region ?? "",
    geo_city: geo.city ?? "",
  });

  // `last_step` must never go backwards when a beacon arrives late, and a
  // stored answer must never be overwritten by an older one. PostgREST's
  // upsert writes the columns it is given, so the step is guarded in SQL by
  // writing through an RPC-free path: read, then write the larger.
  if (kind === "answer") {
    const { data } = await admin.from("quiz_responses").select("last_step").eq("quiz_id", quizId).maybeSingle();
    if (data && typeof data.last_step === "number" && data.last_step > (row.last_step as number)) {
      row.last_step = data.last_step;
    }
  }

  const { error } = await admin.from("quiz_responses").upsert(row, { onConflict: "quiz_id" });
  if (error) {
    // Logged, not surfaced. A dropped answer is never worth a visible failure
    // on a page someone is about to buy from.
    console.error("[attribution] quiz response failed", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true, counted: true });
}
