import { NextResponse } from "next/server";
import { limitVisitor } from "@/lib/api/allowance";
import { refuseCrossSite } from "@/lib/api/guard";
import { logRouteError, withRequestLog } from "@/lib/log";
import { speakReady, synthesize } from "@/lib/translate/speak";
import { MAX_SPEAK_CHARS, isSpeakLang, speakable } from "@/lib/translate/voice";

// POST /api/translate/speak: Talk's read-aloud (/translate/talk, #37). The
// page sends a translated line, { text, lang }, and gets back an MP3 of it
// read by Google Cloud Text-to-Speech (lib/translate/speak.ts): always for
// Punjabi, which few devices can read, and for English where the device has
// no voice of its own, or its voice fails or doesn't start in time (the page
// waits 3 s). Nothing is kept: the page holds the MP3 for
// a replay, and this keeps neither the text nor the audio.
//
// A POST, not a cacheable GET, so the line never sits in a URL, which
// Vercel's request log would record.
export const maxDuration = 15;

// The page shows the last four (lib/i18n/talk, errors), whose English is the
// same; it never sends what earns the first three.
const EMPTY_ERROR = "There is nothing to read aloud.";
const TOO_LONG_ERROR = "That is too long to read aloud.";
const INVALID_ERROR = "That can't be read aloud in that language.";
const UNAVAILABLE_ERROR = "Reading aloud isn't available right now.";
const FAILED_ERROR = "Sorry, that couldn't be read aloud. Please try again.";
const NO_STORE = { "Cache-Control": "no-store" };
// Room for the line plus JSON escaping (at worst twice its length) and the
// wrapper. Anything larger is refused before it is parsed.
const MAX_BODY_CHARS = 2 * MAX_SPEAK_CHARS + 500;

const refuse = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status, headers: NO_STORE });
// Off, not set up, held back, or out of characters: the page waits as long
// as Retry-After says, then asks again (lib/translate/speak.ts says how long).
const unavailable = (retryAfter: number) =>
  NextResponse.json(
    { error: UNAVAILABLE_ERROR, code: "speak_unavailable" },
    { status: 503, headers: { ...NO_STORE, "Retry-After": String(retryAfter) } },
  );

async function handlePost(req: Request) {
  try {
    const refused = refuseCrossSite(req);
    if (refused) return refused;
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return refuse(413, "speak_too_long", TOO_LONG_ERROR);
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { /* answered below */ }
    const { text, lang } =
      body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

    if (typeof text !== "string" || text.trim() === "") return refuse(400, "speak_empty", EMPTY_ERROR);
    const line = text.trim();
    if (line.length > MAX_SPEAK_CHARS) return refuse(400, "speak_too_long", TOO_LONG_ERROR);
    // A Punjabi voice reads Gurmukhi only: romanized text would be nonsense
    // bought for nothing.
    if (!isSpeakLang(lang) || !speakable(line, lang)) return refuse(400, "speak_invalid", INVALID_ERROR);

    // Off, not set up, held back, or out of characters for the day: said
    // before a visitor is counted, so nothing is spent on it. A line too long
    // for this server's characters left fails alone.
    const ready = speakReady(line.length);
    if (ready.kind === "unavailable") return unavailable(ready.retryAfter);
    if (ready.kind === "failed") return refuse(502, "speak_failed", FAILED_ERROR);
    // One visitor's too many (lib/api/allowance.ts), counted in characters,
    // since characters are what run out: no one visitor can spend a server's
    // whole day of reading aloud. Like every route's count, it comes before
    // the call, so a line Google then fails still counts. A line too long for
    // what's left of the visitor's day fails alone, as one too long for this
    // server's does, and shorter ones are still read.
    const limited = limitVisitor(req, "speak", {
      cost: line.length,
      tooBig: () => refuse(502, "speak_failed", FAILED_ERROR),
    });
    if (limited) return limited;

    const spoken = await synthesize(ready.account, line, lang, req.signal);
    switch (spoken.kind) {
      case "audio":
        return new Response(spoken.audio, {
          headers: { "Content-Type": "audio/mpeg", "Content-Length": String(spoken.audio.byteLength), ...NO_STORE },
        });
      case "unavailable":
        return unavailable(spoken.retryAfter);
      case "aborted":
        return new Response(null, { status: 499 });
      default:
        return refuse(502, "speak_failed", FAILED_ERROR);
    }
  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    logRouteError(error);
    return refuse(502, "speak_failed", FAILED_ERROR);
  }
}

export const POST = withRequestLog("/api/translate/speak", handlePost);
