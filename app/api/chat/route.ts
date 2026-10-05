import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { refuseCrossSite } from "@/lib/api/guard";
import { DEFAULT_PREFS, MAX_MESSAGE_CHARS, isLensId, isModeId, isLanguageId, isScript, type ChatContext } from "@/lib/chat/config";
import { MAX_CHAT_BODY_CHARS, buildChatRequest, toChatHistory, type ChatInput } from "@/lib/chat/request";
import { CHAT_BUDGET_MS, CHAT_FIRST_TEXT_MS } from "@/lib/gemini/budgets";
import { isCapacityError, statusOf, withModelFallback } from "@/lib/gemini/fallback";
import { openTextStream, settleNoText, textStreamResponse } from "@/lib/gemini/stream";
import { logEvent, logRouteError, withRequestLog } from "@/lib/log";

export const maxDuration = 30;

// The whole exchange, fallback included, has to finish inside maxDuration;
// see lib/gemini/budgets for how these two relate to the fallback.
const STREAM_DEADLINE_MS = CHAT_BUDGET_MS;
// Time to first text is ~1 s on 3.8 Flash. Ten means the call is stuck, and
// still leaves time to ask the fallback model.
const FIRST_TEXT_TIMEOUT_MS = CHAT_FIRST_TEXT_MS;

const FRIENDLY_ERROR = "Sorry, something went wrong on our end. Please try again.";
const BUSY_ERROR = "SikhAI is very busy right now. Please wait a minute and try again.";
const BLOCKED_ERROR = "SikhAI couldn't respond to that message. Please try rephrasing your question.";
const NO_STORE = { "Cache-Control": "no-store" };

// Whitelist the deep-link context: unknown type drops the whole thing, and
// title/text are truncated inside composeSystemInstruction. Client strings
// never become prompt instructions — only the quoted passage block.
function sanitizeContext(raw: unknown): ChatContext | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as { type?: unknown; title?: unknown; text?: unknown };
  if (c.type !== "hukamnama" && c.type !== "shabad") return null;
  if (typeof c.text !== "string" || c.text.trim() === "") return null;
  return {
    type: c.type,
    title: typeof c.title === "string" ? c.title : "",
    text: c.text,
    capturedAt: Date.now(),
  };
}

async function handlePost(req: Request) {
  try {
    // Another site's page, or a post that isn't JSON: refused before the
    // body is read (lib/api/guard.ts).
    const refused = refuseCrossSite(req);
    if (refused) return refused;
    // The `code` field lets clients render a translated message; the English
    // `error` string stays for logs and older clients.
    const raw = await req.text();
    if (raw.length > MAX_CHAT_BODY_CHARS) {
      return NextResponse.json({ error: "That message is too long. Please shorten it and try again.", code: "chat_too_long" }, { status: 413 });
    }
    // A body that isn't a JSON object has no message: a 400, not a crash.
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { /* answered below */ }
    const { message, history, lensId, modeId, languageId, script, context } =
      body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

    if (typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: "Please enter a message.", code: "chat_empty" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: "That message is too long. Please shorten it and try again.", code: "chat_too_long" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logEvent("config_error", { missing: "GEMINI_API_KEY" }, "error");
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "chat_failed" }, { status: 500 });
    }

    // Unknown IDs fall back to defaults silently: stale localStorage or an
    // old client must never brick the chat. IDs are lookup keys only.
    const input: ChatInput = {
      message,
      history: toChatHistory(history),
      lensId: isLensId(lensId) ? lensId : DEFAULT_PREFS.lensId,
      modeId: isModeId(modeId) ? modeId : DEFAULT_PREFS.modeId,
      languageId: isLanguageId(languageId) ? languageId : DEFAULT_PREFS.languageId,
      script: isScript(script) ? script : undefined,
      context: sanitizeContext(context),
    };

    const ai = new GoogleGenAI({ apiKey });
    const deadline = Date.now() + STREAM_DEADLINE_MS;

    let attempt;
    try {
      attempt = await withModelFallback(
        "chat",
        model => openTextStream(ai, buildChatRequest(model, input), {
          signal: req.signal,
          deadline,
          firstTextMs: FIRST_TEXT_TIMEOUT_MS,
        }),
        { signal: req.signal, deadline },
      );
    } catch (error) {
      // Each failed attempt was already logged by withModelFallback.
      if (req.signal.aborted) return new Response(null, { status: 499 });
      // Overloaded, rate-limited, timed out, or out of prepaid credit (402):
      // all "wait and try again" for the user, none of them a bad question.
      if (isCapacityError(error) || statusOf(error) === 402) {
        return NextResponse.json(
          { error: BUSY_ERROR, code: "chat_busy" },
          { status: statusOf(error) === 429 ? 429 : 503, headers: NO_STORE },
        );
      }
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "chat_failed" }, { status: 500, headers: NO_STORE });
    }

    const { model, depth, value: opened } = attempt;

    if (opened.kind !== "text") {
      // No text at all (lib/gemini/stream.ts): a refused prompt gets
      // "couldn't respond", anything else "something went wrong".
      return settleNoText(opened, { feature: "chat", model, depth }) === "blocked"
        ? NextResponse.json({ error: BLOCKED_ERROR, code: "chat_blocked" }, { status: 422, headers: NO_STORE })
        : NextResponse.json({ error: FRIENDLY_ERROR, code: "chat_failed" }, { status: 502, headers: NO_STORE });
    }

    return textStreamResponse(opened, { feature: "chat", model, depth }, req.signal);

  } catch (error) {
    logRouteError(error);
    return NextResponse.json({ error: FRIENDLY_ERROR, code: "chat_failed" }, { status: 500, headers: NO_STORE });
  }
}

export const POST = withRequestLog("/api/chat", handlePost);
