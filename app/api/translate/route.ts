import { FinishReason, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { limitVisitor } from "@/lib/api/allowance";
import { refuseCrossSite } from "@/lib/api/guard";
import { TRANSLATE_BUDGET_MS, TRANSLATE_FIRST_TEXT_MS } from "@/lib/gemini/budgets";
import { isCapacityError, statusOf, withModelFallback } from "@/lib/gemini/fallback";
import { openTextStream, readWholeText } from "@/lib/gemini/stream";
import { logEvent, logRouteError, withRequestLog } from "@/lib/log";
import {
  MAX_TRANSLATE_CHARS,
  isSourceHint,
  type DetectedInput,
  type SourceHint,
  type TranslationResult,
} from "@/lib/translate/config";
import { detectScript, looksRomanizedPunjabi } from "@/lib/translate/detect";
import { cloudTranslate } from "@/lib/translate/cloud";
import { buildTranslateRequest } from "@/lib/translate/prompts";
import { parseTranslationResult } from "@/lib/translate/parse";

export const maxDuration = 30;

// Gemini's reply is read as a stream, though the page gets one JSON result: a
// full answer to 1,000 characters takes up to about 21 s on 3.8 Flash, and
// its first text about 2 s. So a call with no text after
// TRANSLATE_FIRST_TEXT_MS is stuck, and one that is writing gets until
// TRANSLATE_BUDGET_MS, which leaves the Cloud Translation fallback (8 s
// timeout) its turn inside maxDuration. The numbers, as measured, live in
// lib/gemini/budgets. Google is told the function's own limit: it ends a call
// 1.5 to 1.9 s before the deadline it's sent, so sending the budget would cut
// the slowest answers short, and log them as Google's 504s (#83).
const GOOGLE_DEADLINE_MS = maxDuration * 1000;

const FRIENDLY_ERROR = "Sorry, the translation failed. Please try again.";
const TOO_LONG_ERROR = "That text is too long. Please try up to 1,000 characters.";
// Room for the text plus JSON escaping (at worst twice its length) and the
// wrapper. Anything larger is refused before it is parsed.
const MAX_BODY_CHARS = 2 * MAX_TRANSLATE_CHARS + 1000;
const BUSY_ERROR = "The translator is busy right now. Please wait a moment and try again.";

// Gemini is the only source of the learning aids, so when it fails we fall
// back to a plain Cloud Translation rendering rather than nothing at all.
// Returns null when no trustworthy translation is possible — the caller then
// emits the error it would have sent anyway.
//
// Kept here rather than in lib/translate/cloud.ts: shaping a TranslationResult
// is this route's policy, while cloud.ts stays a generic transport.
async function attemptCloudFallback(
  text: string,
  hint: SourceHint,
  detectedScript: 'gurmukhi' | 'latin',
): Promise<TranslationResult | null> {
  const trimmed = text.trim();

  const synthesize = (
    detectedInput: DetectedInput,
    gurmukhi: string,
    english: string,
  ): TranslationResult => ({
    detectedInput,
    gurmukhi,
    roman: '', // Cloud Translation cannot romanize Punjabi — the UI omits the row
    english,
    words: [],
    notes: [],
    pronunciation: [],
    fallback: 'cloud',
  });

  // Gurmukhi input is unambiguous regardless of what the chip claims.
  if (detectedScript === 'gurmukhi') {
    const res = await cloudTranslate({ text: trimmed, source: 'pa', target: 'en', purpose: 'fallback' });
    return res ? synthesize('punjabi-gurmukhi', trimmed, res.translatedText) : null;
  }

  // Latin script the user has labelled Punjabi: Cloud can neither read
  // romanized Punjabi nor produce it, so anything it returned would be
  // confident nonsense. Bail before spending a single character.
  if (hint === 'punjabi-latin' || hint === 'punjabi-gurmukhi') return null;

  // Same reasoning on the default 'auto' chip, which is where romanized input
  // actually arrives. Cloud has no romanized-Punjabi language code, so asking
  // it would likely come back labelled 'en' and pass the check below — a
  // confident mistranslation aimed at a learner who cannot spot it. Screening
  // here also means those characters are never billed.
  if (hint === 'auto' && looksRomanizedPunjabi(trimmed)) return null;

  if (hint === 'english') {
    const res = await cloudTranslate({ text: trimmed, source: 'en', target: 'pa', purpose: 'fallback' });
    return res ? synthesize('english', res.translatedText, trimmed) : null;
  }

  // 'auto' + Latin that reads as English: let Cloud confirm. Its own verdict is
  // a second line of defence, not the only one — see the screen above.
  const res = await cloudTranslate({ text: trimmed, target: 'pa', purpose: 'fallback' });
  if (!res || res.detectedSourceLanguage !== 'en') return null;
  return synthesize('english', res.translatedText, trimmed);
}

async function handlePost(req: Request) {
  // Hoisted so the catch block can tell whether Gemini was actually attempted:
  // a body that can't be read, or a validation throw, lands in the same catch,
  // and those must not spend Cloud Translation credit.
  let text = '';
  let hint: SourceHint = 'auto';
  let detectedScript: 'gurmukhi' | 'latin' = 'latin';
  // Whether the error came out of the Gemini call itself, which logged it.
  let geminiFailed = false;

  try {
    // Another site's page, or a post that isn't JSON: refused before the
    // body is read (lib/api/guard.ts).
    const refused = refuseCrossSite(req);
    if (refused) return refused;
    // The `code` field lets clients render a translated message; the English
    // `error` string stays for logs and older clients.
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_too_long" }, { status: 413 });
    }
    // A body that isn't a JSON object has no text: a 400, not a crash.
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { /* answered below */ }
    const { sourceHint, text: rawText } =
      body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

    if (typeof rawText !== 'string' || rawText.trim() === '') {
      return NextResponse.json({ error: "Please enter some text to translate.", code: "translate_empty" }, { status: 400 });
    }
    // Trimmed, to match the client's own pre-check — otherwise trailing
    // whitespace makes the two disagree about where the limit falls.
    if (rawText.trim().length > MAX_TRANSLATE_CHARS) {
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_too_long" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logEvent("config_error", { missing: "GEMINI_API_KEY" }, "error");
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 500 });
    }
    // One visitor's too many (lib/api/allowance.ts), counted only now that
    // the request is good and about to cost something, and before `text` is
    // set, so a refusal can't reach the Cloud fallback below.
    const limited = limitVisitor(req, "translate");
    if (limited) return limited;

    // Only now is the input known good — assigning the hoisted bindings here
    // is what arms the Cloud fallback in the catch block.
    text = rawText;
    // Unknown hints fall back to 'auto' silently — a stale client must never
    // brick the translator. The script check is re-run server-side; the
    // client's live hint is UI-only.
    hint = isSourceHint(sourceHint) ? sourceHint : 'auto';
    detectedScript = detectScript(text);

    // If the model's detectedInput is missing/invalid, this is the best guess
    // we can substitute: script when it's objective, else the explicit hint.
    // A 'punjabi-gurmukhi' hint on Latin-script text collapses to
    // 'punjabi-latin', matching what inputSection() tells the model.
    const fallbackDetected: DetectedInput =
      detectedScript === 'gurmukhi' ? 'punjabi-gurmukhi'
        : hint === 'punjabi-gurmukhi' ? 'punjabi-latin'
          : hint !== 'auto' ? hint
            : 'english';

    const ai = new GoogleGenAI({ apiKey });
    const deadline = Date.now() + TRANSLATE_BUDGET_MS;
    const reply = await withModelFallback(
      "translate",
      m => openTextStream(ai, buildTranslateRequest(m, text, { sourceHint: hint, detectedScript }), {
        signal: req.signal,
        deadline,
        firstTextMs: TRANSLATE_FIRST_TEXT_MS,
        serverTimeoutMs: GOOGLE_DEADLINE_MS,
      }),
      { signal: req.signal, deadline },
    )
      // The rest of the reply, read to its end. A fallback model, if one is
      // named, is only for a call that never started writing.
      .then(({ value: opened, model, depth }) => readWholeText(opened, { feature: "translate", model, depth }, req.signal))
      .catch((error: unknown) => {
        // Each attempt's failure is already a gemini_call line, at the level
        // it deserves (lib/gemini/log.ts), and so is a reply that failed
        // while it was being read: a timeout or an unreachable Gemini passes
        // on its own, and mustn't become a route_error, which goes to Sentry
        // (lib/log.ts).
        geminiFailed = true;
        throw error;
      });
    const { finishReason, blockReason } = reply;

    // The SDK returns a truncated response as ordinary text, so it would only
    // fail later at JSON.parse. Catch it here to give advice the user can
    // actually act on.
    if (finishReason === FinishReason.MAX_TOKENS) {
      reply.settle("truncated");
      // MAX_TOKENS is an output-budget signal, not an input-length one: the
      // model's own thinking trace draws from the same budget, so a short input
      // can truncate while a near-cap one does not. "Shorten it" is therefore
      // often wrong advice — try a basic rendering before falling back to it.
      const viaCloud = await attemptCloudFallback(text, hint, detectedScript);
      logEvent("cloud_fallback", { feature: "translate", reason: "truncated", served: !!viaCloud });
      if (viaCloud) return NextResponse.json(viaCloud, { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_too_long" }, { status: 400 });
    }

    const parsed = parseTranslationResult(reply.text, fallbackDetected);

    if (!parsed) {
      // Blocked or filtered replies land here too: the SDK returns them with
      // no text rather than throwing.
      reply.settle(blockReason ? "blocked" : "unusable");
      // Gemini answered, just not usably — a plain rendering still beats an error.
      const viaCloud = await attemptCloudFallback(text, hint, detectedScript);
      logEvent("cloud_fallback", { feature: "translate", reason: "unusable", served: !!viaCloud });
      if (viaCloud) return NextResponse.json(viaCloud, { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 502 });
    }

    reply.settle("ok");
    return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store" } });

  } catch (error) {
    // A newer request replaced this one (the page aborts the old fetch); the
    // answer would go nowhere, so don't spend Cloud credit on it.
    if (req.signal.aborted) return new Response(null, { status: 499 });

    // `text` is only non-empty once validation passed, so a bad body or a
    // validation throw skips the fallback and costs nothing. Past that point a
    // Gemini failure is already logged by logGeminiCall — but anything else
    // (a response shape the SDK changed, a bug in the code around the call)
    // would otherwise 500 with nothing in the host's log to explain it.
    if (!text || !geminiFailed) logRouteError(error);

    // Gemini failed (overloaded, rate-limited, out of prepaid credit, stuck
    // before its first text, or still writing at the deadline) or the request
    // itself was rejected. Either way a basic translation beats an error —
    // that is the whole point of this path.
    if (text) {
      const viaCloud = await attemptCloudFallback(text, hint, detectedScript);
      logEvent("cloud_fallback", { feature: "translate", reason: "gemini_failed", served: !!viaCloud });
      if (viaCloud) return NextResponse.json(viaCloud, { headers: { "Cache-Control": "no-store" } });
    }

    // Capacity failures (429, 5xx, a timeout, or 402 when the prepaid balance
    // is used up) are "wait and retry" conditions, not a bad request — and
    // "try again" right now is the wrong advice for them.
    if (isCapacityError(error) || statusOf(error) === 402) {
      return NextResponse.json(
        { error: BUSY_ERROR, code: "translate_busy" },
        { status: statusOf(error) === 429 ? 429 : 503 },
      );
    }
    return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 500 });
  }
}

export const POST = withRequestLog("/api/translate", handlePost);
