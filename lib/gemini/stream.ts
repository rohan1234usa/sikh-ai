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

import { FinishReason, type GenerateContentParameters, type GenerateContentResponse, type GoogleGenAI } from '@google/genai';
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
export async function openTextStream(
    ai: GoogleGenAI,
    request: GenerateContentParameters,
    opts: { signal: AbortSignal; deadline: number; firstTextMs: number },
): Promise<Opened> {
    const started = Date.now();
    // Aborted by the first-text timer below, or by the client going away once
    // the reply is streaming (the body's cancel()).
    const upstream = new AbortController();
    const timer = setTimeout(
        () => upstream.abort(new DOMException('No text before the first-text timeout', 'TimeoutError')),
        opts.firstTextMs,
    );
    try {
        const stream = await ai.models.generateContentStream(withTransport(request, {
            signal: AbortSignal.any([opts.signal, upstream.signal]),
            timeoutMs: opts.deadline - Date.now(),
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
