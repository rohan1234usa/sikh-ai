import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { TRANSLATE_ATTEMPT_MS, TRANSLATE_BUDGET_MS } from "@/lib/gemini/budgets";
import { isCapacityError, statusOf, withModelFallback, withTransport } from "@/lib/gemini/fallback";
import { logEvent, logGeminiCall, usageFields } from "@/lib/gemini/log";
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

// Budget for Gemini, fallback model included, sized so the Cloud Translation
// fallback (8 s timeout) still fits inside maxDuration after it. A full
// 1,000-character input glossed word by word takes ~11 s on 3.8 Flash. The
// numbers, and why the gap between them matters, live in lib/gemini/budgets.
const GEMINI_BUDGET_MS = TRANSLATE_BUDGET_MS;
const ATTEMPT_TIMEOUT_MS = TRANSLATE_ATTEMPT_MS;

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
    const res = await cloudTranslate({ text: trimmed, source: 'pa', target: 'en' });
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
    const res = await cloudTranslate({ text: trimmed, source: 'en', target: 'pa' });
    return res ? synthesize('english', res.translatedText, trimmed) : null;
  }

  // 'auto' + Latin that reads as English: let Cloud confirm. Its own verdict is
  // a second line of defence, not the only one — see the screen above.
  const res = await cloudTranslate({ text: trimmed, target: 'pa' });
  if (!res || res.detectedSourceLanguage !== 'en') return null;
  return synthesize('english', res.translatedText, trimmed);
}

export async function POST(req: Request) {
  // Hoisted so the catch block can tell whether Gemini was actually attempted:
  // a malformed body or a validation throw lands in the same catch, and those
  // must not spend Cloud Translation credit.
  let text = '';
  let hint: SourceHint = 'auto';
  let detectedScript: 'gurmukhi' | 'latin' = 'latin';

  try {
    // The `code` field lets clients render a translated message; the English
    // `error` string stays for logs and older clients.
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_too_long" }, { status: 413 });
    }
    const body = JSON.parse(raw);
    const sourceHint = body?.sourceHint;
    const rawText = body?.text;

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
      console.error("Translate Error: GEMINI_API_KEY is missing");
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 500 });
    }

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
    const deadline = Date.now() + GEMINI_BUDGET_MS;
    const started = Date.now();
    const { value: result, model, depth } = await withModelFallback(
      "translate",
      m => ai.models.generateContent(withTransport(
        buildTranslateRequest(m, text, { sourceHint: hint, detectedScript }),
        { signal: req.signal, timeoutMs: Math.min(ATTEMPT_TIMEOUT_MS, deadline - Date.now()) },
      )),
      { signal: req.signal, deadline },
    );
    const finishReason = result.candidates?.[0]?.finishReason;
    const blockReason = result.promptFeedback?.blockReason;
    const logCall = (outcome: "ok" | "truncated" | "unusable" | "blocked") => logGeminiCall({
      feature: "translate", model, depth, outcome, ms: Date.now() - started,
      modelVersion: result.modelVersion, ...usageFields(result.usageMetadata), finishReason, blockReason,
    });

    // The SDK returns a truncated response as ordinary text, so it would only
    // fail later at JSON.parse. Catch it here to give advice the user can
    // actually act on.
    if (finishReason === FinishReason.MAX_TOKENS) {
      logCall("truncated");
      // MAX_TOKENS is an output-budget signal, not an input-length one: the
      // model's own thinking trace draws from the same budget, so a short input
      // can truncate while a near-cap one does not. "Shorten it" is therefore
      // often wrong advice — try a basic rendering before falling back to it.
      const viaCloud = await attemptCloudFallback(text, hint, detectedScript);
      logEvent("cloud_fallback", { feature: "translate", reason: "truncated", served: !!viaCloud });
      if (viaCloud) return NextResponse.json(viaCloud, { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_too_long" }, { status: 400 });
    }

    const parsed = parseTranslationResult(result.text ?? "", fallbackDetected);

    if (!parsed) {
      // Blocked or filtered replies land here too: the SDK returns them with
      // no text rather than throwing.
      logCall(blockReason ? "blocked" : "unusable");
      // Gemini answered, just not usably — a plain rendering still beats an error.
      const viaCloud = await attemptCloudFallback(text, hint, detectedScript);
      logEvent("cloud_fallback", { feature: "translate", reason: "unusable", served: !!viaCloud });
      if (viaCloud) return NextResponse.json(viaCloud, { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 502 });
    }

    logCall("ok");
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
    if (!text || !(error instanceof ApiError)) console.error("Translate Error:", error);

    // Both models failed (overloaded, rate-limited, out of prepaid credit, or
    // timed out) or the request itself was rejected. Either way a basic
    // translation beats an error — that is the whole point of this path.
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
