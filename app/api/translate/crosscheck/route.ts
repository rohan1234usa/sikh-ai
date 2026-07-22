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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, direction } = body ?? {};

    if (typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: "Nothing to compare.", code: "translate_empty" }, { status: 400 });
    }
    if (text.trim().length > MAX_TRANSLATE_CHARS) {
      return NextResponse.json({ error: "That text is too long to compare.", code: "translate_too_long" }, { status: 400 });
    }
    if (!isCrosscheckDirection(direction)) {
      return NextResponse.json({ error: "Invalid direction.", code: "translate_failed" }, { status: 400 });
    }

    // Source is always explicit here — the caller sends a rendition whose
    // language is already known, so there is no detection ambiguity to resolve.
    const result = await cloudTranslate({ text: text.trim(), ...DIRECTIONS[direction] });

    if (!result) {
      // `crosscheck_failed` is intentionally absent from the i18n `errors`
      // block: the card renders its own inline message and never routes this
      // through the page-level alert. The code exists for logs.
      return NextResponse.json(
        { error: "Google Translate comparison is unavailable right now.", code: "crosscheck_failed" },
        { status: 502 },
      );
    }

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
