// SERVER-ONLY: one JSON line per Gemini call, so cost, latency, fallbacks and
// failures can be read straight out of the host's runtime logs. Never logs
// message text: the prompt and reply stay between the user and the model.

import type { GenerateContentResponseUsageMetadata } from '@google/genai';
import type { GeminiFeature } from './models';

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
    outputTokens?: number;
    thoughtTokens?: number;
    finishReason?: string;
    blockReason?: string;
    status?: number;        // HTTP status of a failed call
    quotaId?: string;       // which limit a 429 hit
    error?: string;         // SDK/API error message, never user text
};

// Tests run the routes against a local mock; they switch this off so the
// output stays readable.
const silenced = () => process.env.GEMINI_LOG === 'off';

export function logEvent(evt: string, fields: object, level: 'info' | 'warn' = 'info'): void {
    if (silenced()) return;
    const line = JSON.stringify({ evt, ...fields });
    if (level === 'warn') console.warn(line);
    else console.log(line);
}

export function logGeminiCall(entry: GeminiCallLog): void {
    logEvent('gemini_call', entry, entry.outcome === 'ok' ? 'info' : 'warn');
}

export function usageFields(usage?: GenerateContentResponseUsageMetadata) {
    return {
        promptTokens: usage?.promptTokenCount,
        cachedTokens: usage?.cachedContentTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        thoughtTokens: usage?.thoughtsTokenCount,
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
        error: readable.slice(0, 200),
    };
}
