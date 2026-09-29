import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { LEARN_BUDGET_MS, LEARN_FIRST_TEXT_MS } from "@/lib/gemini/budgets";
import { isCapacityError, statusOf, withModelFallback } from "@/lib/gemini/fallback";
import { openTextStream, settleNoText, textStreamResponse } from "@/lib/gemini/stream";
import { isLessonSlug } from "@/lib/learn/config";
import { getLesson } from "@/lib/learn/curriculum";
import { MAX_LEARN_BODY_CHARS, buildTutorRequest, toTutorHistory, type TutorInput } from "@/lib/learn/request";
import { MAX_TUTOR_MESSAGE_CHARS } from "@/lib/learn/tutor";
import { logEvent, logRouteError, withRequestLog } from "@/lib/log";

// POST /api/learn: the Punjabi tutor. It streams like the chat
// (lib/gemini/stream.ts) and answers failures the same way, with its own
// codes (learn_*). The page sends the lesson it was opened from as an id
// only; the lesson's text comes from the site's own curriculum, here.
export const maxDuration = 30;

const FRIENDLY_ERROR = "Sorry, something went wrong on our end. Please try again.";
const BUSY_ERROR = "The tutor is very busy right now. Please wait a minute and try again.";
const BLOCKED_ERROR = "The tutor couldn't respond to that message. Please try rephrasing it.";
const TOO_LONG_ERROR = "That message is too long. Please keep it to 1,000 characters.";
const NO_STORE = { "Cache-Control": "no-store" };

async function handlePost(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_LEARN_BODY_CHARS) {
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "learn_too_long" }, { status: 413 });
    }
    const { message, history, lesson } = JSON.parse(raw);

    if (typeof message !== "string" || message.trim() === "") {
      return NextResponse.json({ error: "Please enter a message.", code: "learn_empty" }, { status: 400 });
    }
    if (message.length > MAX_TUTOR_MESSAGE_CHARS) {
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "learn_too_long" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logEvent("config_error", { missing: "GEMINI_API_KEY" }, "error");
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "learn_failed" }, { status: 500 });
    }

    // An unknown lesson id is ignored, so a stale link still gets a tutor.
    const input: TutorInput = {
      message,
      history: toTutorHistory(history),
      lesson: isLessonSlug(lesson) ? getLesson(lesson) : null,
    };

    const ai = new GoogleGenAI({ apiKey });
    const deadline = Date.now() + LEARN_BUDGET_MS;

    let attempt;
    try {
      attempt = await withModelFallback(
        "learn",
        model => openTextStream(ai, buildTutorRequest(model, input), {
          signal: req.signal,
          deadline,
          firstTextMs: LEARN_FIRST_TEXT_MS,
        }),
        { signal: req.signal, deadline },
      );
    } catch (error) {
      // Each failed attempt was already logged by withModelFallback.
      if (req.signal.aborted) return new Response(null, { status: 499 });
      // Overloaded, rate-limited, timed out, or out of prepaid credit (402):
      // "wait and try again", never "rephrase".
      if (isCapacityError(error) || statusOf(error) === 402) {
        return NextResponse.json(
          { error: BUSY_ERROR, code: "learn_busy" },
          { status: statusOf(error) === 429 ? 429 : 503, headers: NO_STORE },
        );
      }
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "learn_failed" }, { status: 500, headers: NO_STORE });
    }

    const { model, depth, value: opened } = attempt;

    if (opened.kind !== "text") {
      return settleNoText(opened, { feature: "learn", model, depth }) === "blocked"
        ? NextResponse.json({ error: BLOCKED_ERROR, code: "learn_blocked" }, { status: 422, headers: NO_STORE })
        : NextResponse.json({ error: FRIENDLY_ERROR, code: "learn_failed" }, { status: 502, headers: NO_STORE });
    }

    return textStreamResponse(opened, { feature: "learn", model, depth }, req.signal);

  } catch (error) {
    logRouteError(error);
    return NextResponse.json({ error: FRIENDLY_ERROR, code: "learn_failed" }, { status: 500, headers: NO_STORE });
  }
}

export const POST = withRequestLog("/api/learn", handlePost);
