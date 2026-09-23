// SERVER-ONLY: try the pinned model, then — only when it failed for reasons of
// capacity, before producing anything — its one fallback model.
//
// Deliberately narrow. A rejected request (400), a bad key (401/403) or an
// empty prepaid balance (402) fails the same way on every model, so trying
// another would only double the wait. A user who went away is not retried.
// The fallback is skipped when too little of the route's time budget is left
// for it to finish. And there is exactly one: the SDK's own retry-with-backoff
// stays off, because its 1-2-4 s waits would eat the whole budget.

import type { GenerateContentParameters } from '@google/genai';
import { errorFields, logGeminiCall, type GeminiCallLog } from './log';
import { geminiFallbackModel, geminiModel, type GeminiFeature } from './models';

// Less than this left before the deadline and the fallback is not worth starting.
export const MIN_FALLBACK_MS = 6000;

// 404 is here so a pinned model Google retires degrades to the fallback
// instead of taking the feature down.
const RETRYABLE_STATUS = new Set([404, 429, 500, 502, 503, 504]);
// "Try again in a minute" conditions, as opposed to a broken request.
const CAPACITY_STATUS = new Set([429, 500, 502, 503, 504]);

export type Attempt<T> = { value: T; model: string; depth: 0 | 1 };

export type FallbackOptions = {
    signal?: AbortSignal;   // the caller's; once aborted, nothing is retried
    deadline?: number;      // epoch ms by which the whole exchange must be done
    log?: (entry: GeminiCallLog) => void;
};

export function statusOf(err: unknown): number | undefined {
    const status = (err as { status?: unknown })?.status;
    return typeof status === 'number' ? status : undefined;
}

// The SDK reports its own timeout and a caller abort the same way, so which
// one happened is read off the caller's signal.
export function isAbortError(err: unknown): boolean {
    const name = (err as { name?: unknown })?.name;
    return name === 'AbortError' || name === 'TimeoutError';
}

function isRetryable(err: unknown, callerAborted: boolean): boolean {
    if (callerAborted) return false;
    const status = statusOf(err);
    return status !== undefined ? RETRYABLE_STATUS.has(status) : isAbortError(err);
}

// Overloaded, rate-limited, or timed out: the user should wait, not rephrase.
export function isCapacityError(err: unknown, callerAborted = false): boolean {
    if (callerAborted) return false;
    const status = statusOf(err);
    return status !== undefined ? CAPACITY_STATUS.has(status) : isAbortError(err);
}

export async function withModelFallback<T>(
    feature: GeminiFeature,
    call: (model: string, depth: 0 | 1) => Promise<T>,
    opts: FallbackOptions = {},
): Promise<Attempt<T>> {
    const log = opts.log ?? logGeminiCall;
    const aborted = () => opts.signal?.aborted === true;

    const attempt = async (model: string, depth: 0 | 1): Promise<Attempt<T>> => {
        const started = Date.now();
        try {
            return { value: await call(model, depth), model, depth };
        } catch (err) {
            log({
                feature, model, depth, ms: Date.now() - started,
                outcome: aborted() ? 'aborted' : isAbortError(err) ? 'timeout' : 'error',
                ...errorFields(err),
            });
            throw err;
        }
    };

    const primary = geminiModel(feature);
    try {
        return await attempt(primary, 0);
    } catch (primaryErr) {
        const fallback = geminiFallbackModel(feature);
        const timeLeft = opts.deadline === undefined ? Infinity : opts.deadline - Date.now();
        if (!fallback || timeLeft < MIN_FALLBACK_MS || !isRetryable(primaryErr, aborted())) throw primaryErr;
        try {
            return await attempt(fallback, 1);
        } catch (fallbackErr) {
            // A misconfigured fallback (say, a typo'd model name) must not
            // hide that the real problem was the primary being overloaded.
            throw isCapacityError(fallbackErr, aborted()) ? fallbackErr : primaryErr;
        }
    }
}

// Adds per-request transport settings without touching the shared request
// builders, so a timeout change never alters an eval or phrasebook fingerprint.
export function withTransport(
    req: GenerateContentParameters,
    t: { signal?: AbortSignal; timeoutMs?: number },
): GenerateContentParameters {
    return {
        ...req,
        config: {
            ...req.config,
            ...(t.signal ? { abortSignal: t.signal } : {}),
            ...(t.timeoutMs !== undefined
                ? { httpOptions: { ...req.config?.httpOptions, timeout: Math.max(1000, Math.floor(t.timeoutMs)) } }
                : {}),
        },
    };
}
