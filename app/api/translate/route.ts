import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import {
  MAX_TRANSLATE_CHARS,
  isSourceHint,
  type DetectedInput,
  type SourceHint,
  type TranslationResult,
} from "@/lib/translate/config";
import { detectScript, looksRomanizedPunjabi } from "@/lib/translate/detect";
import { cloudTranslate } from "@/lib/translate/cloud";
import { RESPONSE_SCHEMA, buildUserMessage, composeTranslateInstruction } from "@/lib/translate/prompts";
import { parseTranslationResult } from "@/lib/translate/parse";

export const maxDuration = 30;

const FRIENDLY_ERROR = "Sorry, the translation failed. Please try again.";
const TOO_LONG_ERROR = "That text is too long. Please try up to 1,000 characters.";
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
    const body = await req.json();
    const sourceHint = body?.sourceHint;
    const rawText = body?.text;

    // The `code` field lets clients render a translated message; the English
    // `error` string stays for logs and older clients.
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: composeTranslateInstruction({ sourceHint: hint, detectedScript }),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // Low for fidelity and run-to-run stability, non-zero so phrasing
        // stays natural rather than stilted word-for-word.
        temperature: 0.2,
        // Headroom for the worst case: a full 1,000-char input glossed word by
        // word, with the model's own thinking tokens drawn from the same budget.
        maxOutputTokens: 8192,
      },
    });

    const result = await model.generateContent(buildUserMessage(text));

    // MAX_TOKENS is not one of the SDK's "bad finish reasons", so a truncated
    // response returns as ordinary text and only fails later at JSON.parse.
    // Catch it here to give advice the user can actually act on.
    if (result.response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      console.error("Translate Error: response truncated at maxOutputTokens");
      // MAX_TOKENS is an output-budget signal, not an input-length one: the
      // model's own thinking trace draws from the same budget, so a short input
      // can truncate while a near-cap one does not. "Shorten it" is therefore
      // often wrong advice — try a basic rendering before falling back to it.
      const viaCloud = await attemptCloudFallback(text, hint, detectedScript);
      if (viaCloud) return NextResponse.json(viaCloud, { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_too_long" }, { status: 400 });
    }

    const parsed = parseTranslationResult(result.response.text(), fallbackDetected);

    if (!parsed) {
      console.error("Translate Error: unusable model output");
      // Gemini answered, just not usably — a plain rendering still beats an error.
      const viaCloud = await attemptCloudFallback(text, hint, detectedScript);
      if (viaCloud) return NextResponse.json(viaCloud, { headers: { "Cache-Control": "no-store" } });
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 502 });
    }

    return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store" } });

  } catch (error) {
    console.error("Translate Error:", error);

    // `text` is only non-empty once validation passed, so a bad body or a
    // validation throw skips this and costs nothing. Gemini's free tier is 20
    // requests/day, which makes the 429 below an everyday event rather than an
    // edge case — serving a basic translation is the whole point of this path.
    if (text) {
      const viaCloud = await attemptCloudFallback(text, hint, detectedScript);
      if (viaCloud) return NextResponse.json(viaCloud, { headers: { "Cache-Control": "no-store" } });
    }

    // Quota/rate-limit exhaustion is a routine condition on Gemini's free tier,
    // and "try again" is actively wrong advice for it — waiting is the fix.
    const status = (error as { status?: number })?.status;
    if (status === 429) {
      return NextResponse.json({ error: BUSY_ERROR, code: "translate_busy" }, { status: 429 });
    }
    return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 500 });
  }
}
