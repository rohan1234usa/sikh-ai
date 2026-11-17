// SERVER-ONLY: one JSON line per Gemini call, so cost, latency, fallbacks and
// failures can be read straight out of the host's runtime logs. Never logs
// message text: the prompt and reply stay between the user and the model.

import { MediaModality, type GenerateContentResponseUsageMetadata } from '@google/genai';
import type { GeminiFeature } from './models';
import { cutWords } from '../errors/scrub';
import { logEvent } from '../log';

export type GeminiOutcome =
    | 'ok'
    | 'blocked'   // the prompt or reply was refused by a safety filter
    | 'empty'     // the call finished without any text
    | 'cut'       // a streamed reply ended early (safety, recitation, …)
    | 'truncated' // the reply hit maxOutputTokens
    | 'unusable'  // text arrived but could not be used (bad JSON)
    | 'aborted'   // the user went away
    | 'timeout'   // our own deadline expired
    | 'error';

export type GeminiCallLog = {
    feature: GeminiFeature;
    model: string;          // what was requested
    depth: 0 | 1;           // 1 = the fallback model
    outcome: GeminiOutcome;
    ms: number;
    ttftMs?: number;
    modelVersion?: string;  // what the API says served it
    promptTokens?: number;
    // The part of promptTokens that Gemini's implicit cache served at a
    // discount. Nothing else shows whether a repeated prompt opening is
    // actually getting cheaper.
    cachedTokens?: number;
    // The part of promptTokens that was audio: a Talk clip, 32 tokens a
    // second. What a clip costs, apart from the instruction around it.
    audioTokens?: number;
    outputTokens?: number;
    thoughtTokens?: number;
    finishReason?: string;
    blockReason?: string;
    status?: number;        // HTTP status of a failed call
    quotaId?: string;       // which limit a 429 hit
    error?: string;         // SDK/API error message, never user text
};

// "Try again in a minute" conditions, as opposed to a broken request: what
// lib/gemini/fallback.ts treats as the service being busy.
export const CAPACITY_STATUS = new Set([429, 500, 502, 503, 504]);

// How loud a call's line is. A failure the owner has to fix is an error,
// which reaches Sentry (lib/log.ts): an HTTP status that waiting won't change,
// such as a bad or revoked key (Gemini answers 400), prepaid credit run out
// (402), or a pinned model Google retired (404, even when the fallback model
// then answers). Busy, rate-limited, timed out or cancelled calls pass on
// their own, and stay warnings.
export function geminiCallLevel({ outcome, status }: Pick<GeminiCallLog, 'outcome' | 'status'>): 'info' | 'warn' | 'error' {
    if (outcome === 'ok') return 'info';
    return outcome === 'error' && status !== undefined && !CAPACITY_STATUS.has(status) ? 'error' : 'warn';
}

export function logGeminiCall(entry: GeminiCallLog): void {
    logEvent('gemini_call', entry, geminiCallLevel(entry));
}

export function usageFields(usage?: GenerateContentResponseUsageMetadata) {
    const audioTokens = usage?.promptTokensDetails?.find(d => d.modality === MediaModality.AUDIO)?.tokenCount;
    return {
        promptTokens: usage?.promptTokenCount,
        cachedTokens: usage?.cachedContentTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        thoughtTokens: usage?.thoughtsTokenCount,
        // Only for a prompt with audio in it, so other lines don't grow.
        ...(audioTokens !== undefined ? { audioTokens } : {}),
    };
}

// The SDK's ApiError carries the HTTP status and the API's JSON error body as
// its message; pull out what helps triage and cap the rest.
export function errorFields(err: unknown): Pick<GeminiCallLog, 'status' | 'quotaId' | 'error'> {
    const status = (err as { status?: unknown })?.status;
    const message = err instanceof Error ? err.message : String(err);
    let readable = message;
    try {
        readable = (JSON.parse(message) as { error?: { message?: string } }).error?.message ?? message;
    } catch { /* not the API's JSON body — keep it as is */ }
    return {
        status: typeof status === 'number' ? status : undefined,
        quotaId: /"quotaId"\s*:\s*"([^"]+)"/.exec(message)?.[1],
        error: cutWords(readable, 200),
    };
}
