// Shared setup for route tests: a mock Gemini on a free port, the env the
// routes read, and small request/response helpers.

import { startMockGemini, type MockGemini } from '../../scripts/mock-gemini';
import { DAY_MS, VISITOR_LIMITS, allowances, type Feature } from '@/lib/api/allowance';

export async function startRouteMock(): Promise<MockGemini> {
    const mock = await startMockGemini();
    // The routes build a fresh SDK client per request, and the SDK reads
    // these at construction, so setting them here is enough.
    process.env.GOOGLE_GEMINI_BASE_URL = mock.url;
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.APP_LOG = 'off';
    // Never Sentry, whatever the shell running the tests has set.
    delete process.env.SENTRY_DSN;
    // Text-to-Speech goes to the mock too, and only with an account a test
    // sets up (mockServiceAccount), never one from the shell.
    process.env.GOOGLE_TTS_BASE_URL = mock.url;
    delete process.env.GOOGLE_TTS_SERVICE_ACCOUNT;
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

// The system instruction of a Gemini request the mock received.
export const instructionOf = (body: unknown) =>
    (body as { systemInstruction: { parts: { text: string }[] } }).systemInstruction.parts[0].text;

export type LogLine = { evt: string; level: 'info' | 'warn' | 'error'; [k: string]: unknown };

// Runs `run` with logging on, and returns the JSON lines it wrote, each with
// the level it was written at (console.log is info).
export async function logged(run: () => Promise<unknown>): Promise<LogLine[]> {
    delete process.env.APP_LOG;
    const lines: LogLine[] = [];
    const saved = { log: console.log, warn: console.warn, error: console.error };
    const at = (level: LogLine['level']) => (line: string) => { lines.push({ ...JSON.parse(line), level }); };
    console.log = at('info');
    console.warn = at('warn');
    console.error = at('error');
    try {
        await run();
    } finally {
        Object.assign(console, saved);
        process.env.APP_LOG = 'off';
    }
    return lines;
}

// Requests the mock received while `run` executed.
export async function captured<T>(mock: MockGemini, run: () => Promise<T>) {
    const start = mock.requests.length;
    const result = await run();
    return { result, requests: mock.requests.slice(start) };
}

// Spends the day of a visitor not yet counted today with one feature, all
// but `leave` of it, in one request at midnight UTC that costs that much, so
// no minute's limit stops it. It throws for a visitor already counted, by
// however little, which would leave less than the test expects. The routes
// share these counts: they run in the test's own process.
export function spendDay(feature: Feature, visitor: string, leave = 0): void {
    const midnight = Math.floor(Date.now() / DAY_MS) * DAY_MS;
    const allowance = allowances[feature];
    if (allowance.used(visitor, midnight) > 0) throw new Error(`spendDay: ${visitor} was already counted today for ${feature}`);
    if (!allowance.take(visitor, midnight, VISITOR_LIMITS[feature].perDay - leave).ok) throw new Error(`spendDay: ${feature}'s day couldn't be spent for ${visitor}`);
}
