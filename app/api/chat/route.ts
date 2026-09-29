import { FinishReason, GoogleGenAI, type GenerateContentResponse } from "@google/genai";
import { NextResponse } from "next/server";
import { DEFAULT_PREFS, MAX_MESSAGE_CHARS, isLensId, isModeId, isLanguageId, isScript, type ChatContext } from "@/lib/chat/config";
import { MAX_CHAT_BODY_CHARS, buildChatRequest, toChatHistory, type ChatInput } from "@/lib/chat/request";
import { CHAT_BUDGET_MS, CHAT_FIRST_TEXT_MS } from "@/lib/gemini/budgets";
import { isAbortError, isCapacityError, statusOf, withModelFallback, withTransport } from "@/lib/gemini/fallback";
import { errorFields, logGeminiCall, usageFields, type GeminiOutcome } from "@/lib/gemini/log";

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

// Finish reasons for a reply that ended on its own terms. MAX_TOKENS is not
// one: a reply stopped by the output cap is cut short, and must read that way.
const ENDED_NORMALLY = new Set<FinishReason | undefined>([
  undefined,
  FinishReason.FINISH_REASON_UNSPECIFIED,
  FinishReason.STOP,
]);

type Opened =
  | {
    kind: "text";
    stream: AsyncGenerator<GenerateContentResponse>;
    first: GenerateContentResponse;
    text: string;
    upstream: AbortController;
    started: number;
    ttftMs: number;
  }
  | { kind: "blocked"; reason: string; last?: GenerateContentResponse; started: number }
  | { kind: "empty"; finishReason?: FinishReason; last?: GenerateContentResponse; started: number };

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

// Opens the stream and reads up to its first text. Gemini 3.x opens with a
// chunk that carries only a thought signature, and a blocked prompt produces
// no text at all — deciding before the Response exists means those get a real
// JSON error instead of a broken stream.
async function openStream(
  ai: GoogleGenAI,
  model: string,
  input: ChatInput,
  callerSignal: AbortSignal,
  deadline: number,
): Promise<Opened> {
  const started = Date.now();
  // Aborted by the first-text timer below, or by the client going away once
  // the reply is streaming (the body's cancel()).
  const upstream = new AbortController();
  const timer = setTimeout(
    () => upstream.abort(new DOMException("No text before the first-text timeout", "TimeoutError")),
    FIRST_TEXT_TIMEOUT_MS,
  );
  try {
    const stream = await ai.models.generateContentStream(withTransport(buildChatRequest(model, input), {
      signal: AbortSignal.any([callerSignal, upstream.signal]),
      timeoutMs: deadline - Date.now(),
    }));
    let last: GenerateContentResponse | undefined;
    for (;;) {
      const next = await stream.next();
      if (next.done) return { kind: "empty", finishReason: last?.candidates?.[0]?.finishReason, last, started };
      last = next.value;
      const blockReason = last.promptFeedback?.blockReason;
      if (blockReason) {
        upstream.abort();
        return { kind: "blocked", reason: blockReason, last, started };
      }
      const text = last.text;
      if (text) return { kind: "text", stream, first: last, text, upstream, started, ttftMs: Date.now() - started };
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  try {
    // The `code` field lets clients render a translated message; the English
    // `error` string stays for logs and older clients.
    const raw = await req.text();
    if (raw.length > MAX_CHAT_BODY_CHARS) {
      return NextResponse.json({ error: "That message is too long. Please shorten it and try again.", code: "chat_too_long" }, { status: 413 });
    }
    const { message, history, lensId, modeId, languageId, script, context } = JSON.parse(raw);

    if (typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: "Please enter a message.", code: "chat_empty" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: "That message is too long. Please shorten it and try again.", code: "chat_too_long" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Chat Error: GEMINI_API_KEY is missing");
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
        model => openStream(ai, model, input, req.signal, deadline),
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
      // No text at all: a refused prompt, a reply filtered before its first
      // word, or (rarely) a model that stopped without saying anything.
      const finishReason = opened.kind === "empty" ? opened.finishReason : undefined;
      const blocked = opened.kind === "blocked"
        || (!ENDED_NORMALLY.has(finishReason) && finishReason !== FinishReason.MAX_TOKENS);
      logGeminiCall({
        feature: "chat", model, depth, ms: Date.now() - opened.started,
        outcome: blocked ? "blocked" : "empty",
        modelVersion: opened.last?.modelVersion, ...usageFields(opened.last?.usageMetadata),
        finishReason, blockReason: opened.kind === "blocked" ? opened.reason : undefined,
      });
      return blocked
        ? NextResponse.json({ error: BLOCKED_ERROR, code: "chat_blocked" }, { status: 422, headers: NO_STORE })
        : NextResponse.json({ error: FRIENDLY_ERROR, code: "chat_failed" }, { status: 502, headers: NO_STORE });
    }

    const { stream: chunks, first, text, upstream, started, ttftMs } = opened;
    const encoder = new TextEncoder();
    let cancelled = false;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let last = first;
        let finishReason = first.candidates?.[0]?.finishReason;
        let blockReason: string | undefined;
        let outcome: GeminiOutcome = "ok";
        let failure: unknown;
        try {
          controller.enqueue(encoder.encode(text));
          for await (const chunk of chunks) {
            last = chunk;
            // Undefined on chunks that carry only metadata
            const piece = chunk.text;
            if (piece) controller.enqueue(encoder.encode(piece));
            finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
            blockReason = chunk.promptFeedback?.blockReason ?? blockReason;
          }
          // The SDK doesn't throw when a reply is filtered or capped — the
          // stream just ends. Erroring the body keeps the client's contract:
          // partial text is kept and marked interrupted, never passed off as
          // complete.
          if (blockReason || !ENDED_NORMALLY.has(finishReason)) {
            outcome = finishReason === FinishReason.MAX_TOKENS ? "truncated" : "cut";
            throw new Error(`Reply cut short: ${blockReason ?? finishReason}`);
          }
          controller.close();
        } catch (err) {
          failure = err;
          if (outcome === "ok") {
            outcome = cancelled || req.signal.aborted ? "aborted" : isAbortError(err) ? "timeout" : "error";
          }
          // Aborts the HTTP body; the client's reader throws and keeps partial text
          controller.error(err);
        } finally {
          logGeminiCall({
            feature: "chat", model, depth, outcome, ms: Date.now() - started, ttftMs,
            modelVersion: last.modelVersion, ...usageFields(last.usageMetadata),
            finishReason, blockReason,
            ...(outcome === "error" ? errorFields(failure) : {}),
          });
        }
      },
      cancel() {
        // The user pressed Stop or left: stop generating instead of paying
        // for a reply nobody will read.
        cancelled = true;
        upstream.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (error) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: FRIENDLY_ERROR, code: "chat_failed" }, { status: 500, headers: NO_STORE });
  }
}
