// Shared setup for route tests: a mock Gemini on a free port, the env the
// routes read, and small request/response helpers.

import { startMockGemini, type MockGemini } from '../../scripts/mock-gemini';

export async function startRouteMock(): Promise<MockGemini> {
    const mock = await startMockGemini();
    // The routes build a fresh SDK client per request, and the SDK reads
    // these at construction, so setting them here is enough.
    process.env.GOOGLE_GEMINI_BASE_URL = mock.url;
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_LOG = 'off';
    return mock;
}

export function postJson(url: string, body: unknown): Request {
    return new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
