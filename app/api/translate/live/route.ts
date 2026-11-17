import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { limitVisitor } from "@/lib/api/allowance";
import { refuseCrossSite } from "@/lib/api/guard";
import { LIVE_TRANSLATE_BUDGET_MS, LIVE_TRANSLATE_FIRST_TEXT_MS } from "@/lib/gemini/budgets";
import { isCapacityError, statusOf, withModelFallback } from "@/lib/gemini/fallback";
import { openTextStream, settleNoText, textStreamResponse } from "@/lib/gemini/stream";
import { logEvent, logRouteError, withRequestLog } from "@/lib/log";
import { isSourceHint } from "@/lib/translate/config";
import { detectScript } from "@/lib/translate/detect";
import { MAX_LIVE_CHARS } from "@/lib/translate/live";
import { buildLiveTranslateRequest } from "@/lib/translate/prompts";

// POST /api/translate/live: the lines shown under the translator's text box
// while someone types. It streams four labelled lines as plain text
// (lib/translate/live.ts reads them), like the chat and the tutor stream
// their replies (lib/gemini/stream.ts). No Cloud Translation fallback: the
// page asks again at the next pause, and the Translate button has one.
//
// The page aborts a call as soon as the text changes. Before the reply
// starts that answers 499; once it is streaming, the body's cancel() stops
// the generation, so a call nobody will read stops costing.
export const maxDuration = 30;

// The page shows none of these: the live lines say they are unavailable, and
// the Translate button still works. The English is for the logs.
const FRIENDLY_ERROR = "Sorry, the live translation failed.";
const BUSY_ERROR = "The live translator is busy right now.";
const BLOCKED_ERROR = "The live translator couldn't translate that text.";
const TOO_LONG_ERROR = "That text is too long for live translation. Please use the Translate button.";
const NO_STORE = { "Cache-Control": "no-store" };
// Room for the text plus JSON escaping (at worst twice its length) and the
// wrapper. Anything larger is refused before it is parsed.
const MAX_BODY_CHARS = 2 * MAX_LIVE_CHARS + 500;

async function handlePost(req: Request) {
  try {
    // Another site's page, or a post that isn't JSON: refused before the
    // body is read (lib/api/guard.ts).
    const refused = refuseCrossSite(req);
    if (refused) return refused;
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_live_too_long" }, { status: 413, headers: NO_STORE });
    }
    // A body that isn't a JSON object has no text: a 400, not a crash.
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { /* answered below */ }
    const { sourceHint, text } =
      body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

    if (typeof text !== "string" || text.trim() === "") {
      return NextResponse.json({ error: "Please enter some text to translate.", code: "translate_live_empty" }, { status: 400, headers: NO_STORE });
    }
    // Trimmed, as the page counts it (liveEligible).
    if (text.trim().length > MAX_LIVE_CHARS) {
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_live_too_long" }, { status: 400, headers: NO_STORE });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logEvent("config_error", { missing: "GEMINI_API_KEY" }, "error");
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_live_failed" }, { status: 500, headers: NO_STORE });
    }
    // One visitor's too many (lib/api/allowance.ts), counted only now that
    // the request is good and about to cost something. Live calls have an
    // allowance of their own, so they never spend the Translate button's.
    const limited = limitVisitor(req, "translateLive");
    if (limited) return limited;

    // As in /api/translate: an unknown hint is 'auto', and the script is
    // checked here rather than taken from the page.
    const input = text.trim();
    const opts = { sourceHint: isSourceHint(sourceHint) ? sourceHint : "auto", detectedScript: detectScript(input) } as const;

    const ai = new GoogleGenAI({ apiKey });
    const deadline = Date.now() + LIVE_TRANSLATE_BUDGET_MS;

    let attempt;
    try {
      attempt = await withModelFallback(
        "translateLive",
        model => openTextStream(ai, buildLiveTranslateRequest(model, input, opts), {
          signal: req.signal,
          deadline,
          firstTextMs: LIVE_TRANSLATE_FIRST_TEXT_MS,
        }),
        { signal: req.signal, deadline },
      );
    } catch (error) {
      // Each failed attempt was already logged by withModelFallback. The
      // usual end of a live call: the user typed on.
      if (req.signal.aborted) return new Response(null, { status: 499 });
      // Overloaded, rate-limited, timed out, or out of prepaid credit (402).
      if (isCapacityError(error) || statusOf(error) === 402) {
        return NextResponse.json(
          { error: BUSY_ERROR, code: "translate_live_busy" },
          { status: statusOf(error) === 429 ? 429 : 503, headers: NO_STORE },
        );
      }
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_live_failed" }, { status: 500, headers: NO_STORE });
    }

    const { model, depth, value: opened } = attempt;

    if (opened.kind !== "text") {
      return settleNoText(opened, { feature: "translateLive", model, depth }) === "blocked"
        ? NextResponse.json({ error: BLOCKED_ERROR, code: "translate_live_blocked" }, { status: 422, headers: NO_STORE })
        : NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_live_failed" }, { status: 502, headers: NO_STORE });
    }

    return textStreamResponse(opened, { feature: "translateLive", model, depth }, req.signal);

  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    logRouteError(error);
    return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_live_failed" }, { status: 500, headers: NO_STORE });
  }
}

export const POST = withRequestLog("/api/translate/live", handlePost);
