// One request to the live API, with the pacing and error handling shared by
// the eval and `npm run build:phrasebook`. A per-minute 429 is waited out
// once; anything that would fail every later request the same way (daily
// quota, empty prepaid balance, bad model name, rejected key) stops the run,
// and whatever was answered before it stays cached.

import { ApiError, type GenerateContentParameters, type GenerateContentResponse, type GoogleGenAI } from '@google/genai';
import type { CachedRun } from './cache';

export type Outcome = { run: CachedRun } | { stop: string } | { skip: string };

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// The API's error message is the JSON error body; pull out its human part.
function brief(message: string): string {
    try {
        const text = (JSON.parse(message) as { error?: { message?: string } }).error?.message;
        if (text) return text.slice(0, 200);
    } catch { /* not JSON — use it as is */ }
    return message.slice(0, 200);
}

function retryDelayMs(message: string): number {
    const match = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(message);
    return (match ? Number(match[1]) : 60) * 1000 + 1000;
}

function toRun(model: string, res: GenerateContentResponse, latencyMs: number): CachedRun {
    return {
        model,
        modelVersion: res.modelVersion,
        text: res.text ?? '',
        finishReason: res.candidates?.[0]?.finishReason,
        blockReason: res.promptFeedback?.blockReason,
        usage: {
            prompt: res.usageMetadata?.promptTokenCount,
            output: res.usageMetadata?.candidatesTokenCount,
            thoughts: res.usageMetadata?.thoughtsTokenCount,
        },
        latencyMs: Math.round(latencyMs),
        at: new Date().toISOString(),
    };
}

// Spaces calls at most `rpm` a minute per key (a model name), so two models
// under trial each get their own allowance.
export function pacer(rpm: number): (key: string) => () => Promise<void> {
    const gap = 60_000 / rpm;
    const lastCall = new Map<string, number>();
    return key => async () => {
        const wait = (lastCall.get(key) ?? -Infinity) + gap - Date.now();
        if (wait > 0) await sleep(wait);
        lastCall.set(key, Date.now());
    };
}

export async function generate(
    ai: GoogleGenAI,
    request: GenerateContentParameters,
    pace: () => Promise<void>,
): Promise<Outcome> {
    for (let attempt = 1; ; attempt++) {
        await pace();
        const started = performance.now();
        try {
            const res = await ai.models.generateContent(request);
            return { run: toRun(request.model, res, performance.now() - started) };
        } catch (err) {
            if (!(err instanceof ApiError)) throw err;
            if (err.status === 429) {
                // The daily quota resets at midnight Pacific; a per-minute limit
                // clears after the delay the API suggests, so wait once.
                if (/PerDay/i.test(err.message)) return { stop: 'daily quota reached; rerun after midnight Pacific to continue' };
                if (attempt === 1) {
                    await sleep(retryDelayMs(err.message));
                    continue;
                }
                return { stop: `still rate-limited after waiting: ${brief(err.message)}` };
            }
            if (err.status === 402) return { stop: '402: the prepaid balance is used up; top it up in AI Studio, then rerun' };
            // A bad model name, an unsupported setting, or a rejected key fails
            // every request the same way, so stop rather than repeat it.
            if ([400, 401, 403, 404].includes(err.status)) return { stop: `${err.status}: ${brief(err.message)}` };
            return { skip: `${err.status}: ${brief(err.message)}` };
        }
    }
}
