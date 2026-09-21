import { NextResponse } from "next/server";
import { MAX_VERIFY_CHARS, hasGurmukhiRun } from "@/lib/gurbani/citations";
import { verifyReply } from "@/lib/gurbani/verify";

// Checks the Gurbani a finished chat reply quotes against GurbaniNow. No
// Gemini call. The chat never waits on this or breaks because of it: the
// client asks after the reply has streamed, and any failure just means no
// cards — so the source being down is answered with an empty list, not an error.

export const maxDuration = 15;

const DEADLINE_MS = 8000;
// Room for the reply plus JSON escaping; anything larger is not a chat reply.
const MAX_BODY_CHARS = 40_000;
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: "Too large", code: "verify_too_large" }, { status: 413, headers: NO_STORE });
    }
    let text: unknown;
    try {
      text = (JSON.parse(raw) as { text?: unknown })?.text;
    } catch {
      text = undefined;
    }
    if (typeof text !== "string" || text.trim() === "") {
      return NextResponse.json({ error: "Invalid request", code: "verify_invalid" }, { status: 400, headers: NO_STORE });
    }
    if (text.length > MAX_VERIFY_CHARS) {
      return NextResponse.json({ error: "Too long", code: "verify_too_long" }, { status: 400, headers: NO_STORE });
    }
    // Most replies quote nothing; answer those without any lookup.
    if (!hasGurmukhiRun(text)) return NextResponse.json({ citations: [] }, { headers: NO_STORE });

    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(DEADLINE_MS)]);
    const citations = await verifyReply(text, { signal });
    return NextResponse.json({ citations }, { headers: NO_STORE });
  } catch (error) {
    // Never the reply text — only what went wrong.
    console.error("Verify Error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Verification failed", code: "verify_failed" }, { status: 500, headers: NO_STORE });
  }
}
