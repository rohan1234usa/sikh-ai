import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import {
    MAX_AUDIO_BYTES,
    MIN_RECORD_MS,
    isAllowedAudioMime,
    type IdentifyResult,
    type Transcription,
} from "@/lib/identify/config";
import { corroborate, rankCandidates, topMatches, THRESHOLDS, type Candidate } from "@/lib/identify/match";
import { parseCleanup, transcriptionFromWords, type Cleanup } from "@/lib/identify/parse";
import { CLEANUP_SCHEMA, buildCleanupMessage, composeCleanupInstruction } from "@/lib/identify/prompts";
import { planQueries } from "@/lib/identify/queries";
import { fetchShabad, searchGurbani, type FullShabad, type GurbaniVerse } from "@/lib/identify/search";
import { isSttFailure, transcribe, type TranscriptResult } from "@/lib/identify/stt";

// Transcription (up to 25s with a retry) plus six parallel searches plus an
// optional verification fetch. The typical request finishes in well under ten
// seconds; this is the ceiling for a bad day, not the target.
export const maxDuration = 60;

const FRIENDLY_ERROR = "Sorry, we could not process that recording. Please try again.";
const BUSY_ERROR = "Shabad identification is busy right now. Please wait a moment and try again.";
const UNAVAILABLE_ERROR = "Shabad identification is not available right now. Please try again later.";

// Past this point the verification fetch is skipped: the answer we already
// have beats a better answer the user has stopped waiting for.
const ENRICHMENT_DEADLINE_MS = 12_000;

// Some engines report the language they heard. A confident non-Punjabi verdict
// means the clip was speech, just not scripture — worth saying plainly instead
// of searching Gurbani for English words. Punjabi and Hindi share enough
// phonology that recognisers sometimes label Gurbani 'hin', so only clearly
// unrelated languages are rejected here; everything else goes to the matcher,
// where a wrong guess simply fails to score.
//
// Engines that report no language (Gemini) or no confidence (Whisper) skip this
// gate entirely — an unknown must not be read as a rejection. Locale forms
// ('pa-IN') are matched on their primary subtag.
const RELATED_LANGUAGES = new Set(['pan', 'pa', 'hin', 'hi', 'urd', 'ur', 'san', 'sa']);
const LANGUAGE_REJECT_CONFIDENCE = 0.75;

function heardUnrelatedLanguage(stt: TranscriptResult): boolean {
    if (!stt.languageCode || stt.languageProbability < LANGUAGE_REJECT_CONFIDENCE) return false;
    const primary = stt.languageCode.toLowerCase().split(/[-_]/)[0];
    return !RELATED_LANGUAGES.has(primary);
}

function ok(result: IdentifyResult) {
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

// The cleanup pass is an improvement, not a dependency: it rewrites colloquial
// transcription into scripture orthography, which makes searches land. When it
// fails, the raw transcript still identifies many recordings, so the pipeline
// continues on word timings alone rather than failing the request.
//
// It runs on every engine's output, including Gemini's. That costs a second
// Gemini call when Gemini is also the transcriber, and it is worth it: an
// engine that both hears and interprets would be measuring something different
// from the others, which defeats the point of being able to swap them.
async function runCleanup(stt: TranscriptResult): Promise<Cleanup | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("Identify Error: GEMINI_API_KEY is missing — continuing without cleanup");
        return null;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            systemInstruction: composeCleanupInstruction(),
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: CLEANUP_SCHEMA,
                // Lower than the translator's 0.2: this is a fidelity task, and
                // run-to-run stability matters when the output feeds a search.
                temperature: 0.1,
                // A few lines of Gurmukhi is tiny, but the model's own thinking
                // draws from the same budget.
                maxOutputTokens: 4096,
            },
        });

        const result = await model.generateContent(buildCleanupMessage(stt.text));
        if (result.response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
            console.error("Identify Error: cleanup response truncated at maxOutputTokens");
            return null;
        }
        return parseCleanup(result.response.text());
    } catch (error) {
        console.error("Identify Error: cleanup failed", error instanceof Error ? error.message : error);
        return null;
    }
}

// Runs the whole query plan at once. Distinguishes "nothing matched" (some
// query answered with an empty list) from "the source is down" (every query
// failed at the transport level) — only the latter is an error for the user.
async function gatherVerses(
    heard: Transcription,
    guessedFirstLine: string,
): Promise<{ verses: GurbaniVerse[]; reachable: boolean }> {
    const plan = planQueries(heard.lines, guessedFirstLine);
    if (plan.length === 0) return { verses: [], reachable: true };

    const settled = await Promise.allSettled(
        plan.map(query => searchGurbani(query.text, query.searchtype, query.results)),
    );

    const verses: GurbaniVerse[] = [];
    let reachable = false;
    for (const outcome of settled) {
        if (outcome.status !== 'fulfilled' || outcome.value === null) continue;
        reachable = true;
        verses.push(...outcome.value);
    }
    return { verses, reachable };
}

// Re-scores the leaders against their complete Shabad text. Only worth doing
// when there is more than one heard line to corroborate with, and only for
// candidates close enough to the top that the outcome could change.
async function enrich(
    candidates: Candidate[],
    heard: Transcription,
    startedAt: number,
): Promise<{ candidates: Candidate[]; fullShabadLines: FullShabad['lines'] | null }> {
    if (candidates.length === 0 || heard.lines.length < 2) {
        return { candidates, fullShabadLines: null };
    }
    if (Date.now() - startedAt > ENRICHMENT_DEADLINE_MS) {
        return { candidates, fullShabadLines: null };
    }

    const targets = [candidates[0]];
    if (candidates[1] && candidates[0].score - candidates[1].score < THRESHOLDS.enrichmentGap) {
        targets.push(candidates[1]);
    }

    const fetched = await Promise.allSettled(targets.map(c => fetchShabad(c.shabadId)));

    const enriched = new Map<string, Candidate>();
    const fullById = new Map<string, FullShabad>();
    targets.forEach((candidate, i) => {
        const outcome = fetched[i];
        if (outcome.status !== 'fulfilled' || outcome.value === null) return;
        fullById.set(candidate.shabadId, outcome.value);
        enriched.set(candidate.shabadId, corroborate(candidate, heard.lines, outcome.value.verses));
    });

    if (enriched.size === 0) return { candidates, fullShabadLines: null };

    const merged = candidates
        .map(c => enriched.get(c.shabadId) ?? c)
        .sort((a, b) => b.score - a.score || b.matchedLines - a.matchedLines || b.base - a.base);

    // Only the new leader's full text is attached — it is the one a reader
    // wants to open, and shipping every candidate's Shabad would bloat both the
    // response and localStorage.
    const leader = fullById.get(merged[0].shabadId);
    return { candidates: merged, fullShabadLines: leader?.lines ?? null };
}

export async function POST(req: Request) {
    const startedAt = Date.now();

    // Hoisted so a failure after transcription can still return what we heard:
    // "we heard this, but the Gurbani source is down" is a far better answer
    // than a bare error.
    let heard: Transcription | null = null;

    try {
        let form: FormData;
        try {
            form = await req.formData();
        } catch {
            return NextResponse.json({ error: "No recording was received.", code: "identify_empty" }, { status: 400 });
        }

        const audio = form.get('audio');
        // The `code` field lets clients render a translated message; the English
        // `error` string stays for logs and older clients.
        if (!(audio instanceof Blob) || audio.size === 0) {
            return NextResponse.json({ error: "No recording was received.", code: "identify_empty" }, { status: 400 });
        }
        // Size before format: a huge upload should be rejected on the cheap
        // check, not after inspecting its type.
        if (audio.size > MAX_AUDIO_BYTES) {
            return NextResponse.json({ error: "That recording is too long.", code: "identify_too_large" }, { status: 413 });
        }
        if (!isAllowedAudioMime(audio.type)) {
            return NextResponse.json({ error: "That recording format is not supported.", code: "identify_bad_audio" }, { status: 400 });
        }
        // Advisory: the recorder sends its own measurement because a container's
        // duration is not readable without decoding it. A missing value is fine
        // — an over-short clip simply reaches the model and comes back empty.
        const durationMs = Number(form.get('durationMs'));
        if (Number.isFinite(durationMs) && durationMs > 0 && durationMs < MIN_RECORD_MS) {
            return NextResponse.json({ error: "That recording was too short.", code: "identify_too_short" }, { status: 400 });
        }

        const stt = await transcribe(audio, audio.type);
        if (isSttFailure(stt)) {
            if (stt === 'busy') {
                return NextResponse.json({ error: BUSY_ERROR, code: "identify_busy" }, { status: 429 });
            }
            if (stt === 'unconfigured') {
                return NextResponse.json({ error: UNAVAILABLE_ERROR, code: "identify_unavailable" }, { status: 503 });
            }
            // The recording is fine; the selected engine cannot read this
            // container. Accurate for the user, and the log names the fix.
            if (stt === 'unsupported-audio') {
                return NextResponse.json({ error: "That recording format is not supported.", code: "identify_bad_audio" }, { status: 400 });
            }
            return NextResponse.json({ error: FRIENDLY_ERROR, code: "identify_failed" }, { status: 502 });
        }

        if (!stt.text) {
            return ok({ status: 'no_speech', heard: null, matches: [] });
        }
        if (heardUnrelatedLanguage(stt)) {
            return ok({ status: 'not_gurbani', heard: null, matches: [] });
        }

        const cleanup = await runCleanup(stt);
        heard = cleanup?.heard ?? transcriptionFromWords(stt.text, stt.words);

        if (cleanup?.kind === 'no-vocals' || heard.lines.length === 0) {
            return ok({ status: 'no_speech', heard: null, matches: [] });
        }
        // Searching Gurbani for Gurmukhi-spelled English is pure noise, and the
        // user is better served by being told what we heard.
        if (cleanup?.kind === 'other-speech') {
            return ok({ status: 'not_gurbani', heard, matches: [] });
        }

        const { verses, reachable } = await gatherVerses(heard, cleanup?.guessedFirstLine ?? '');
        if (!reachable) {
            return ok({ status: 'search_unavailable', heard, matches: [] });
        }

        const ranked = rankCandidates(heard.lines, verses);
        if (ranked.length === 0) {
            return ok({ status: 'no_match', heard, matches: [] });
        }

        const { candidates, fullShabadLines } = await enrich(ranked, heard, startedAt);
        const matches = topMatches(candidates);
        if (fullShabadLines && matches[0]) matches[0].fullShabad = fullShabadLines;

        return ok({ status: 'matched', heard, matches });

    } catch (error) {
        console.error("Identify Error:", error);

        // Transcription already succeeded, so the user gets the words back
        // even though the matching half fell over.
        if (heard) {
            return ok({ status: 'search_unavailable', heard, matches: [] });
        }

        // Quota exhaustion is routine on Gemini's free tier, and "try again" is
        // actively wrong advice for it — waiting is the fix.
        const status = (error as { status?: number })?.status;
        if (status === 429) {
            return NextResponse.json({ error: BUSY_ERROR, code: "identify_busy" }, { status: 429 });
        }
        return NextResponse.json({ error: FRIENDLY_ERROR, code: "identify_failed" }, { status: 500 });
    }
}
