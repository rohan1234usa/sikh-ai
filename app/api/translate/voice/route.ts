import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { limitVisitor } from "@/lib/api/allowance";
import { refuseCrossSite } from "@/lib/api/guard";
import { VOICE_TRANSLATE_BUDGET_MS, VOICE_TRANSLATE_FIRST_TEXT_MS } from "@/lib/gemini/budgets";
import { isCapacityError, statusOf, withModelFallback } from "@/lib/gemini/fallback";
import { openTextStream, settleNoText, textStreamResponse } from "@/lib/gemini/stream";
import { logEvent, logRouteError, withRequestLog } from "@/lib/log";
import { buildVoiceTranslateRequest } from "@/lib/translate/prompts";
import {
  MAX_AUDIO_BASE64_CHARS,
  MAX_AUDIO_BYTES,
  MIN_AUDIO_BYTES,
  audioMimeFor,
  base64Bytes,
  isBase64,
  isSpeaker,
} from "@/lib/translate/voice";

// POST /api/translate/voice: Talk's voice translator (/translate/talk, #37).
// The page sends a recorded clip, base64 inside JSON (lib/api/guard.ts takes
// nothing else), and this streams back the live translator's four labelled
// lines, written down and translated in one Gemini call: INPUT says which
// language was spoken, or none for a clip with no speech, and the page reads
// the rest with lib/translate/live.ts. No Cloud Translation fallback: Cloud
// can't hear audio.
//
// The clip goes to Gemini as it came and is never kept or logged; nor are the
// lines. A page that is left, or starts a new conversation, aborts this call:
// before the reply starts that answers 499, and once it streams the body's
// cancel() stops the generation.
export const maxDuration = 30;

// The English is the dictionary's for the same code (lib/i18n/dictionaries),
// for the logs and for a page loaded before a code existed.
const FRIENDLY_ERROR = "Sorry, the voice translation failed. Please try again.";
const BUSY_ERROR = "The voice translator is busy right now. Please wait a minute and try again.";
const BLOCKED_ERROR = "The voice translator couldn't translate that recording. Please try saying it another way.";
const EMPTY_ERROR = "Nothing was recorded. Please hold the button while you speak.";
const TOO_LONG_ERROR = "That recording is too long to send. Please keep it shorter.";
const BAD_AUDIO_ERROR = "That recording couldn't be read. Please try again.";
const NO_STORE = { "Cache-Control": "no-store" };
// Room for the longest clip's base64 plus the JSON around it (its media type
// and the speaker). Anything larger is refused before it is parsed.
const MAX_BODY_CHARS = MAX_AUDIO_BASE64_CHARS + 1_000;

const refuse = (status: number, code: string, error: string) =>
  NextResponse.json({ error, code }, { status, headers: NO_STORE });

async function handlePost(req: Request) {
  try {
    // Another site's page, or a post that isn't JSON: refused before the
    // body is read (lib/api/guard.ts).
    const refused = refuseCrossSite(req);
    if (refused) return refused;
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return refuse(413, "translate_voice_too_long", TOO_LONG_ERROR);
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { /* answered below */ }
    const { audio, mimeType, speaker } =
      body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

    if (typeof audio !== "string" || audio === "") return refuse(400, "translate_voice_empty", EMPTY_ERROR);
    // What Gemini is told the clip is; a type it doesn't hear is refused.
    const mime = audioMimeFor(mimeType);
    if (!mime || !isBase64(audio)) return refuse(400, "translate_voice_bad_audio", BAD_AUDIO_ERROR);
    // Measured without decoding: the clip goes on as it came.
    const bytes = base64Bytes(audio);
    if (bytes < MIN_AUDIO_BYTES) return refuse(400, "translate_voice_empty", EMPTY_ERROR);
    if (bytes > MAX_AUDIO_BYTES) return refuse(413, "translate_voice_too_long", TOO_LONG_ERROR);
    // As the live route's hint: anything unknown is Auto.
    const who = isSpeaker(speaker) ? speaker : "auto";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logEvent("config_error", { missing: "GEMINI_API_KEY" }, "error");
      return refuse(500, "translate_voice_failed", FRIENDLY_ERROR);
    }
    // One visitor's too many (lib/api/allowance.ts), counted only now that
    // the clip is good and about to cost something.
    const limited = limitVisitor(req, "translateVoice");
    if (limited) return limited;

    const ai = new GoogleGenAI({ apiKey });
    const deadline = Date.now() + VOICE_TRANSLATE_BUDGET_MS;

    let attempt;
    try {
      attempt = await withModelFallback(
        "translateVoice",
        model => openTextStream(ai, buildVoiceTranslateRequest(model, { mimeType: mime, data: audio }, who), {
          signal: req.signal,
          deadline,
          firstTextMs: VOICE_TRANSLATE_FIRST_TEXT_MS,
        }),
        { signal: req.signal, deadline },
      );
    } catch (error) {
      // Each failed attempt was already logged by withModelFallback.
      if (req.signal.aborted) return new Response(null, { status: 499 });
      // Overloaded, rate-limited, timed out, or out of prepaid credit (402).
      if (isCapacityError(error) || statusOf(error) === 402) {
        return refuse(statusOf(error) === 429 ? 429 : 503, "translate_voice_busy", BUSY_ERROR);
      }
      return refuse(500, "translate_voice_failed", FRIENDLY_ERROR);
    }

    const { model, depth, value: opened } = attempt;

    if (opened.kind !== "text") {
      return settleNoText(opened, { feature: "translateVoice", model, depth }) === "blocked"
        ? refuse(422, "translate_voice_blocked", BLOCKED_ERROR)
        : refuse(502, "translate_voice_failed", FRIENDLY_ERROR);
    }

    return textStreamResponse(opened, { feature: "translateVoice", model, depth }, req.signal);

  } catch (error) {
    if (req.signal.aborted) return new Response(null, { status: 499 });
    logRouteError(error);
    return refuse(500, "translate_voice_failed", FRIENDLY_ERROR);
  }
}

export const POST = withRequestLog("/api/translate/voice", handlePost);
