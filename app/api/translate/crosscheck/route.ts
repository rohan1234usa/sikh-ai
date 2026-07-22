import { NextResponse } from "next/server";
import { MAX_TRANSLATE_CHARS, isCrosscheckDirection, type CrosscheckDirection } from "@/lib/translate/config";
import { cloudTranslate, type CloudLang } from "@/lib/translate/cloud";

// Deliberately separate from /api/translate: this shares none of the Gemini
// machinery (no prompts, no schema, no hint resolution) and its request
// contract is consumed only by the results card.
export const maxDuration = 15;

const DIRECTIONS: Record<CrosscheckDirection, { source: CloudLang; target: CloudLang }> = {
  'en-pa': { source: 'en', target: 'pa' },
  'pa-en': { source: 'pa', target: 'en' },
};

// The client sends a *rendition* here, not the user's typed input, and a
// 1,000-char English input can render longer than that in Gurmukhi. Measuring
// model output against the input cap would reject results the user legitimately
// produced, so this cap is its own, larger number.
const MAX_CROSSCHECK_CHARS = MAX_TRANSLATE_CHARS * 2;

// Identical renditions get compared repeatedly — the same phrase from history,
// a re-submitted input, a second user asking about the same thing. Cloud has no
// free repeat, so remember answers rather than re-buying them. Server-side so
// it dedupes across users; bounded because a warm Vercel instance is long-lived.
const MAX_MEMO_ENTRIES = 200;
const memo = new Map<string, string>();

function remember(key: string, value: string): void {
  // Oldest-first eviction: Map preserves insertion order, so the first key is
  // the least recently added.
  if (memo.size >= MAX_MEMO_ENTRIES) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, value);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, direction } = body ?? {};

    if (typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: "Nothing to compare.", code: "translate_empty" }, { status: 400 });
    }
    if (text.trim().length > MAX_CROSSCHECK_CHARS) {
      return NextResponse.json({ error: "That text is too long to compare.", code: "translate_too_long" }, { status: 400 });
    }
    if (!isCrosscheckDirection(direction)) {
      return NextResponse.json({ error: "Invalid direction.", code: "translate_failed" }, { status: 400 });
    }

    const trimmed = text.trim();
    const memoKey = `${direction}:${trimmed}`;
    const cached = memo.get(memoKey);
    if (cached) {
      return NextResponse.json(
        { translatedText: cached },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Source is always explicit here — the caller sends a rendition whose
    // language is already known, so there is no detection ambiguity to resolve.
    const result = await cloudTranslate({ text: trimmed, ...DIRECTIONS[direction] });

    if (!result) {
      // `crosscheck_failed` is intentionally absent from the i18n `errors`
      // block: the card renders its own inline message and never routes this
      // through the page-level alert. The code exists for logs.
      return NextResponse.json(
        { error: "Google Translate comparison is unavailable right now.", code: "crosscheck_failed" },
        { status: 502 },
      );
    }

    remember(memoKey, result.translatedText);

    return NextResponse.json(
      { translatedText: result.translatedText },
      { headers: { "Cache-Control": "no-store" } },
    );

  } catch (error) {
    console.error("Crosscheck Error:", error);
    return NextResponse.json(
      { error: "Google Translate comparison is unavailable right now.", code: "crosscheck_failed" },
      { status: 502 },
    );
  }
}
