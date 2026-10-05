// Shared setup for route tests: a mock Gemini on a free port, the env the
// routes read, and small request/response helpers.

import { startMockGemini, type MockGemini } from '../../scripts/mock-gemini';
import { DAY_MS, MINUTE_MS, VISITOR_LIMITS, allowances, type Feature } from '@/lib/api/allowance';

export async function startRouteMock(): Promise<MockGemini> {
    const mock = await startMockGemini();
    // The routes build a fresh SDK client per request, and the SDK reads
    // these at construction, so setting them here is enough.
    process.env.GOOGLE_GEMINI_BASE_URL = mock.url;
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.APP_LOG = 'off';
    return mock;
}

// A POST as the site's own pages send it. `headers` adds to the JSON content
// type, or replaces it. No address goes with it unless a test sets one
// (x-forwarded-for), and a request without one isn't counted against any
// visitor's allowance (lib/api/allowance.ts).
export function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Request {
    return new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
}

// Reads a streamed body to the end, or until it errors — in which case the
// partial text is returned with the error, the way the chat client sees it.
export async function readStream(res: Response): Promise<{ text: string; error?: unknown }> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) return { text };
            text += decoder.decode(value, { stream: true });
        }
    } catch (error) {
        return { text, error };
    }
}

// Requests the mock received while `run` executed.
export async function captured<T>(mock: MockGemini, run: () => Promise<T>) {
    const start = mock.requests.length;
    const result = await run();
    return { result, requests: mock.requests.slice(start) };
}

// Spends a visitor's day with one feature, all but `leave` of it, as if a
// request came every minute from midnight UTC, so no minute's limit stops it
// first. The routes share these counts: they run in the test's own process.
export function spendDay(feature: Feature, visitor: string, leave = 0): void {
    const midnight = Math.floor(Date.now() / DAY_MS) * DAY_MS;
    for (let i = 0; i < VISITOR_LIMITS[feature].perDay - leave; i++) allowances[feature].take(visitor, midnight + i * MINUTE_MS);
}
