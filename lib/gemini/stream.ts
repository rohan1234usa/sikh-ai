// SERVER-ONLY: a Gemini reply streamed to the browser as plain text, shared
// by the chat (app/api/chat) and the Punjabi tutor (app/api/learn). Do not
// import from client components.
//
// A route opens the stream with openTextStream, which reads up to the first
// text before any Response exists. Gemini 3.x opens with a chunk that carries
// only a thought signature, and a blocked prompt produces no text at all, so
// deciding before answering means those get a proper JSON error instead of a
// broken stream. With text in hand, textStreamResponse streams the rest and
// writes the call's one log line.

import {
    FinishReason,
    type GenerateContentParameters,
    type GenerateContentResponse,
    type GenerateContentResponseUsageMetadata,
    type GoogleGenAI,
} from '@google/genai';
import { isAbortError, withTransport } from './fallback';
import { errorFields, logGeminiCall, usageFields, type GeminiOutcome } from './log';
import type { GeminiFeature } from './models';

// Finish reasons for a reply that ended on its own terms. MAX_TOKENS is not
// one: a reply stopped by the output cap is cut short, and must read that way.
const ENDED_NORMALLY = new Set<FinishReason | undefined>([
    undefined,
    FinishReason.FINISH_REASON_UNSPECIFIED,
    FinishReason.STOP,
]);

export type OpenedText = {
    kind: 'text';
    stream: AsyncGenerator<GenerateContentResponse>;
    first: GenerateContentResponse;
    text: string;
    upstream: AbortController;
    started: number;
    ttftMs: number;
};

export type OpenedNoText =
    | { kind: 'blocked'; reason: string; last?: GenerateContentResponse; started: number }
    | { kind: 'empty'; finishReason?: FinishReason; last?: GenerateContentResponse; started: number };

export type Opened = OpenedText | OpenedNoText;

// Which call a log line is about.
export type StreamCall = { feature: GeminiFeature; model: string; depth: 0 | 1 };

// Opens the stream and reads up to its first text. `firstTextMs` is how long
// to wait for it: past that the call is stuck, and the timeout (a capacity
// failure to withModelFallback) leaves time to ask the fallback model.
//
// `serverTimeoutMs` is for a route that needs all of its budget (#83). The
// SDK sends its timeout to Google as X-Server-Timeout, and Google ends the
// call with its own 504 1.5 to 1.9 s before that, so by default a deadline
// comes about 1.7 s early, logged as an error. Given `serverTimeoutMs`, Google
// is sent that later deadline instead, and a timer of the route's own ends
// the call at `deadline`, still writing or not: logged as a timeout.
export async function openTextStream(
    ai: GoogleGenAI,
    request: GenerateContentParameters,
    opts: { signal: AbortSignal; deadline: number; firstTextMs: number; serverTimeoutMs?: number },
): Promise<Opened> {
    const started = Date.now();
    // Aborted by the first-text timer below, or by the client going away once
    // the reply is streaming (the body's cancel()).
    const upstream = new AbortController();
    const timer = setTimeout(
        () => upstream.abort(new DOMException('No text before the first-text timeout', 'TimeoutError')),
        opts.firstTextMs,
    );
    // The route's own deadline, when Google is sent a later one. Whole and
    // never negative: AbortSignal.timeout throws for anything else.
    const ownDeadline = opts.serverTimeoutMs === undefined
        ? []
        : [AbortSignal.timeout(Math.max(0, Math.floor(opts.deadline - Date.now())))];
    try {
        const stream = await ai.models.generateContentStream(withTransport(request, {
            signal: AbortSignal.any([opts.signal, upstream.signal, ...ownDeadline]),
            timeoutMs: opts.serverTimeoutMs ?? opts.deadline - Date.now(),
        }));
        let last: GenerateContentResponse | undefined;
        for (;;) {
            const next = await stream.next();
            if (next.done) return { kind: 'empty', finishReason: last?.candidates?.[0]?.finishReason, last, started };
            last = next.value;
            const blockReason = last.promptFeedback?.blockReason;
            if (blockReason) {
                upstream.abort();
                return { kind: 'blocked', reason: blockReason, last, started };
            }
            const text = last.text;
            if (text) return { kind: 'text', stream, first: last, text, upstream, started, ttftMs: Date.now() - started };
        }
    } finally {
        clearTimeout(timer);
    }
}

// No text at all: a refused prompt, a reply filtered before its first word,
// or (rarely) a model that stopped without saying anything. Logs the call and
// says which it was, so the route can answer "blocked" (rephrase) or "empty"
// (try again).
export function settleNoText(opened: OpenedNoText, call: StreamCall): 'blocked' | 'empty' {
    const finishReason = opened.kind === 'empty' ? opened.finishReason : undefined;
    const blocked = opened.kind === 'blocked'
        || (!ENDED_NORMALLY.has(finishReason) && finishReason !== FinishReason.MAX_TOKENS);
    logGeminiCall({
        ...call, ms: Date.now() - opened.started,
        outcome: blocked ? 'blocked' : 'empty',
        modelVersion: opened.last?.modelVersion, ...usageFields(opened.last?.usageMetadata),
        finishReason, blockReason: opened.kind === 'blocked' ? opened.reason : undefined,
    });
    return blocked ? 'blocked' : 'empty';
}

// The reply as a text/plain stream: the first text, then every piece as it
// comes. `signal` is the request's, read to tell a user who left from a
// timeout in the log.
export function textStreamResponse(opened: OpenedText, call: StreamCall, signal: AbortSignal): Response {
    const { stream: chunks, first, text, upstream, started, ttftMs } = opened;
    const encoder = new TextEncoder();
    let cancelled = false;

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let last = first;
            let finishReason = first.candidates?.[0]?.finishReason;
            let blockReason: string | undefined;
            let outcome: GeminiOutcome = 'ok';
            let failure: unknown;
            try {
                controller.enqueue(encoder.encode(text));
                for await (const chunk of chunks) {
                    last = chunk;
                    // Undefined on chunks that carry only metadata
                    const piece = chunk.text;
                    if (piece) controller.enqueue(encoder.encode(piece));
                    finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
                    blockReason = chunk.promptFeedback?.blockReason ?? blockReason;
                }
                // The SDK doesn't throw when a reply is filtered or capped — the
                // stream just ends. Erroring the body keeps the client's contract:
                // partial text is kept and marked interrupted, never passed off as
                // complete.
                if (blockReason || !ENDED_NORMALLY.has(finishReason)) {
                    outcome = finishReason === FinishReason.MAX_TOKENS ? 'truncated' : 'cut';
                    throw new Error(`Reply cut short: ${blockReason ?? finishReason}`);
                }
                controller.close();
            } catch (err) {
                failure = err;
                if (outcome === 'ok') {
                    outcome = cancelled || signal.aborted ? 'aborted' : isAbortError(err) ? 'timeout' : 'error';
                }
                // Aborts the HTTP body; the client's reader throws and keeps partial text
                controller.error(err);
            } finally {
                logGeminiCall({
                    ...call, outcome, ms: Date.now() - started, ttftMs,
                    modelVersion: last.modelVersion, ...usageFields(last.usageMetadata),
                    finishReason, blockReason,
                    ...(outcome === 'error' ? errorFields(failure) : {}),
                });
            }
        },
        cancel() {
            // The user pressed Stop or left: stop generating instead of paying
            // for a reply nobody will read.
            cancelled = true;
            upstream.abort();
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Accel-Buffering': 'no',
        },
    });
}

// The reply read to its end, for a route that answers with all of it at once
// (the translator's JSON) but reads it as a stream, so that a stuck call is
// told apart from a slow one by its first text. The route judges the reply,
// then `settle` writes the call's one line, saying what it made of it.
export type WholeText = {
    text: string; // '' when no text came: a refused prompt, or an empty reply
    finishReason?: FinishReason;
    blockReason?: string;
    settle(outcome: Extract<GeminiOutcome, 'ok' | 'truncated' | 'unusable' | 'blocked'>): void;
};

// Reads an opened reply to its end. A failure on the way (the route's own
// deadline, the visitor leaving, an error mid-reply) is the call's line,
// written here with what came before it, and thrown. A reply with no text
// comes back empty, with its reasons, so the route judges it as any other.
export async function readWholeText(opened: Opened, call: StreamCall, signal: AbortSignal): Promise<WholeText> {
    let text = '';
    let ttftMs: number | undefined;
    let last = opened.kind === 'text' ? opened.first : opened.last;
    // Kept from whichever chunk last carried it, in case the last one didn't.
    let usage: GenerateContentResponseUsageMetadata | undefined = last?.usageMetadata;
    let finishReason = opened.kind === 'empty' ? opened.finishReason : last?.candidates?.[0]?.finishReason;
    let blockReason = opened.kind === 'blocked' ? opened.reason : undefined;

    let logged = false;
    const line = (outcome: GeminiOutcome, failure?: unknown) => {
        if (logged) return;
        logged = true;
        logGeminiCall({
            ...call, outcome, ms: Date.now() - opened.started, ttftMs,
            modelVersion: last?.modelVersion, ...usageFields(usage),
            finishReason, blockReason,
            ...(outcome === 'error' ? errorFields(failure) : {}),
        });
    };

    if (opened.kind === 'text') {
        text = opened.text;
        ttftMs = opened.ttftMs;
        try {
            for await (const chunk of opened.stream) {
                last = chunk;
                // Undefined on chunks that carry only metadata
                text += chunk.text ?? '';
                usage = chunk.usageMetadata ?? usage;
                finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
                blockReason = chunk.promptFeedback?.blockReason ?? blockReason;
            }
        } catch (err) {
            // Leaving the loop by a throw lets go of the reader, not the
            // request: stop it, or Gemini writes (and bills) the rest.
            opened.upstream.abort();
            line(signal.aborted ? 'aborted' : isAbortError(err) ? 'timeout' : 'error', err);
            throw err;
        }
    }
    return { text, finishReason, blockReason, settle: outcome => line(outcome) };
}
