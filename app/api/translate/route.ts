import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { MAX_TRANSLATE_CHARS, isSourceHint, type DetectedInput } from "@/lib/translate/config";
import { detectScript } from "@/lib/translate/detect";
import { RESPONSE_SCHEMA, buildUserMessage, composeTranslateInstruction } from "@/lib/translate/prompts";
import { parseTranslationResult } from "@/lib/translate/parse";

export const maxDuration = 30;

const FRIENDLY_ERROR = "Sorry, the translation failed. Please try again.";
const TOO_LONG_ERROR = "That text is too long. Please try up to 1,000 characters.";
const BUSY_ERROR = "The translator is busy right now. Please wait a moment and try again.";

export async function POST(req: Request) {
  try {
    const { text, sourceHint } = await req.json();

    // The `code` field lets clients render a translated message; the English
    // `error` string stays for logs and older clients.
    if (typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: "Please enter some text to translate.", code: "translate_empty" }, { status: 400 });
    }
    // Trimmed, to match the client's own pre-check — otherwise trailing
    // whitespace makes the two disagree about where the limit falls.
    if (text.trim().length > MAX_TRANSLATE_CHARS) {
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_too_long" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Translate Error: GEMINI_API_KEY is missing");
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 500 });
    }

    // Unknown hints fall back to 'auto' silently — a stale client must never
    // brick the translator. The script check is re-run server-side; the
    // client's live hint is UI-only.
    const hint = isSourceHint(sourceHint) ? sourceHint : 'auto';
    const detectedScript = detectScript(text);

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
      return NextResponse.json({ error: TOO_LONG_ERROR, code: "translate_too_long" }, { status: 400 });
    }

    const parsed = parseTranslationResult(result.response.text(), fallbackDetected);

    if (!parsed) {
      console.error("Translate Error: unusable model output");
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 502 });
    }

    return NextResponse.json(parsed, { headers: { "Cache-Control": "no-store" } });

  } catch (error) {
    console.error("Translate Error:", error);
    // Quota/rate-limit exhaustion is a routine condition on Gemini's free tier,
    // and "try again" is actively wrong advice for it — waiting is the fix.
    const status = (error as { status?: number })?.status;
    if (status === 429) {
      return NextResponse.json({ error: BUSY_ERROR, code: "translate_busy" }, { status: 429 });
    }
    return NextResponse.json({ error: FRIENDLY_ERROR, code: "translate_failed" }, { status: 500 });
  }
}
