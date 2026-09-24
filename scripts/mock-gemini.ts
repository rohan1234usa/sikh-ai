// A stand-in for generativelanguage.googleapis.com, for tests and for driving
// the app locally without a key or spend. The SDK talks to it when
// GOOGLE_GEMINI_BASE_URL points here:
//
//   npm run mock:gemini                        # listens on :8787
//   GOOGLE_GEMINI_BASE_URL=http://127.0.0.1:8787 GEMINI_API_KEY=mock \
//     TRANSLATE_FALLBACK=off npm run dev
//
// Tests start it in-process on a free port with startMockGemini().
//
// Behaviour is chosen by a trigger anywhere in the last user message:
//   MOCK_429          always 429 (daily quota)      MOCK_429_FIRST   429 once, then normal
//   MOCK_503          always 503                    MOCK_400         always 400
//   MOCK_HANG         never answers                 MOCK_EMPTY       no text at all
//   MOCK_BLOCKED      prompt refused                MOCK_SAFETY      text, then cut by a filter
//   MOCK_MAX_TOKENS   hits the output cap           MOCK_GARBAGE     translator gets non-JSON
//   MOCK_REPLY:<name> a canned chat reply (CANNED below, or a citation fixture id)
// Anything else gets a normal reply naming the model that served it.

import { readFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export type MockRequest = { model: string; op: string; text: string; body: unknown };

export type MockGemini = {
    url: string;
    requests: MockRequest[];
    close(): Promise<void>;
};

export type MockOptions = {
    port?: number;
    chunkDelayMs?: number; // gap between streamed chunks (visible streaming in the UI)
    dailyLimit?: Record<string, number>; // model → calls allowed before a daily 429
};

// Canned chat replies, streamed in a few pieces. Any reply saved in the
// citation fixtures can be replayed too, by its id — e.g.
// MOCK_REPLY:arjan-grief-gurbani-first:36 streams a real model answer that
// misquotes Gurbani, to watch the citation check at work.
export const CANNED: Record<string, string> = {
    plain: 'Seva is selfless service, offered without any expectation of reward.',
};

function cannedReply(name: string): string | undefined {
    if (CANNED[name] !== undefined) return CANNED[name];
    try {
        const file = resolve(import.meta.dirname, '../tests/gurbani/fixtures/replies.json');
        const replies = JSON.parse(readFileSync(file, 'utf8')) as { id: string; text: string }[];
        return replies.find(r => r.id === name)?.text;
    } catch {
        return undefined;
    }
}

const GURMUKHI = /[਀-੿]/;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Json = Record<string, unknown>;

function lastUserText(body: Json): string {
    const contents = Array.isArray(body.contents) ? body.contents as Json[] : [];
    const last = contents[contents.length - 1] ?? {};
    const parts = Array.isArray(last.parts) ? last.parts as Json[] : [];
    return parts.map(p => (typeof p.text === 'string' ? p.text : '')).join('');
}

function quotaError(perDay: boolean) {
    return {
        error: {
            code: 429,
            message: 'You exceeded your current quota.',
            status: 'RESOURCE_EXHAUSTED',
            details: [{
                '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                violations: [{
                    quotaId: perDay
                        ? 'GenerateRequestsPerDayPerProjectPerModel-FreeTier'
                        : 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
                }],
            }],
        },
    };
}

// A plausible translator payload that echoes the fenced input in the script it
// arrived in, so scoring code has something real to compare.
function translation(userText: string) {
    const fenced = /---\n([\s\S]*)\n--- END TEXT/.exec(userText);
    const text = (fenced ? fenced[1] : userText).trim();
    const gurmukhiInput = GURMUKHI.test(text);
    return {
        detectedInput: gurmukhiInput ? 'punjabi-gurmukhi' : 'punjabi-latin',
        gurmukhi: gurmukhiInput ? text : 'ਕੀ ਹਾਲ ਹੈ?',
        roman: gurmukhiInput ? 'Ki haal hai?' : text,
        english: 'How are you?',
        words: [
            { source: text.split(/\s+/)[0], gurmukhi: 'ਕੀ', roman: 'ki', meaning: 'what' },
            { source: 'haal', gurmukhi: 'ਹਾਲ', roman: 'haal', meaning: 'condition' },
        ],
        notes: [{ kind: 'honorific', title: 'Casual register', body: 'Add ji for elders.' }],
        pronunciation: [{ gurmukhi: 'ਹਾਲ', roman: 'haal', tip: 'Long aa, as in father.' }],
    };
}

function pieces(text: string): string[] {
    const words = text.split(/(?<=\s)/);
    const size = Math.max(1, Math.ceil(words.length / 4));
    const out: string[] = [];
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(''));
    return out;
}

export async function startMockGemini(opts: MockOptions = {}): Promise<MockGemini> {
    const requests: MockRequest[] = [];
    const calls = new Map<string, number>();
    const failedOnce = new Set<string>();
    const delay = opts.chunkDelayMs ?? 0;

    const server = http.createServer(async (req, res) => {
            const chunks: Buffer[] = [];
    // Concatenated before decoding: a Gurmukhi character split across two
    // socket reads would otherwise decode to U+FFFD in each half.
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
        const body: Json = raw ? JSON.parse(raw) : {};
        const match = /models\/([^:]+):(generateContent|streamGenerateContent)/.exec(req.url ?? '');
        const model = match?.[1] ?? '?';
        const op = match?.[2] ?? '?';
        const text = lastUserText(body);
        requests.push({ model, op, text, body });

        const json = (status: number, payload: unknown) => {
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(payload));
        };

        const used = (calls.get(model) ?? 0) + 1;
        calls.set(model, used);
        const limit = opts.dailyLimit?.[model];
        if (limit !== undefined && used > limit) return json(429, quotaError(true));
        // Keyed without the translator's per-attempt nonce fence, so the
        // fallback model's retry of the same text counts as the second call.
        const onceKey = text.replace(/--- (?:BEGIN|END) TEXT [0-9a-f]+ ---/g, '');
        if (text.includes('MOCK_429_FIRST') && !failedOnce.has(onceKey)) {
            failedOnce.add(onceKey);
            return json(429, quotaError(false));
        }
        if (text.includes('MOCK_429') && !text.includes('MOCK_429_FIRST')) return json(429, quotaError(true));
        if (text.includes('MOCK_503')) return json(503, { error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' } });
        if (text.includes('MOCK_400')) return json(400, { error: { code: 400, message: 'Invalid argument.', status: 'INVALID_ARGUMENT' } });
        if (text.includes('MOCK_HANG')) {
            // Hold the socket until the client gives up.
            const timer = setTimeout(() => res.destroy(), 60_000);
            timer.unref();
            req.on('close', () => clearTimeout(timer));
            return;
        }

        const candidate = (parts: Json[], extra: Json = {}) => ({
            candidates: [{ content: { role: 'model', parts }, index: 0, ...extra }],
            modelVersion: model,
        });
        const usage = { promptTokenCount: 812, candidatesTokenCount: 120, thoughtsTokenCount: 0, totalTokenCount: 932 };

        if (op === 'streamGenerateContent') {
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
            if (text.includes('MOCK_BLOCKED')) {
                send({ promptFeedback: { blockReason: 'SAFETY' }, modelVersion: model });
                return res.end();
            }
            // Gemini 3.x style: a chunk carrying only a thought signature comes first.
            send(candidate([{ text: '', thoughtSignature: 'c2lnbmF0dXJl' }]));
            if (text.includes('MOCK_EMPTY')) {
                send({ ...candidate([{ text: '' }], { finishReason: 'STOP' }), usageMetadata: usage });
                return res.end();
            }
            if (text.includes('MOCK_SAFETY')) {
                send(candidate([{ text: 'Partial answer before the filter' }]));
                await sleep(delay);
                send(candidate([], { finishReason: 'SAFETY' }));
                return res.end();
            }
            const canned = /MOCK_REPLY:([\w:-]+)/.exec(text)?.[1];
            const reply = (canned && cannedReply(canned))
                ?? `Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh. This is a **mock** reply from \`${model}\`.`;
            for (const piece of pieces(reply)) {
                await sleep(delay);
                send(candidate([{ text: piece }]));
            }
            const finishReason = text.includes('MOCK_MAX_TOKENS') ? 'MAX_TOKENS' : 'STOP';
            send({ ...candidate([{ text: '' }], { finishReason }), usageMetadata: usage });
            return res.end();
        }

        if (op === 'generateContent') {
            if (text.includes('MOCK_BLOCKED')) return json(200, { promptFeedback: { blockReason: 'SAFETY' }, modelVersion: model });
            if (text.includes('MOCK_MAX_TOKENS')) {
                return json(200, candidate([{ text: '{"detectedInput":"engl' }], { finishReason: 'MAX_TOKENS' }));
            }
            if (text.includes('MOCK_GARBAGE')) return json(200, candidate([{ text: 'not json' }], { finishReason: 'STOP' }));
            if (text.includes('MOCK_EMPTY')) return json(200, candidate([], { finishReason: 'STOP' }));
            return json(200, {
                ...candidate([{ text: JSON.stringify(translation(text)) }], { finishReason: 'STOP' }),
                usageMetadata: { ...usage, candidatesTokenCount: 340 },
            });
        }

        json(404, { error: { code: 404, message: `mock: unhandled ${req.method} ${req.url}`, status: 'NOT_FOUND' } });
    });

    await new Promise<void>(resolve => server.listen(opts.port ?? 0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise<void>(resolve => {
            server.closeAllConnections();
            server.close(() => resolve());
        }),
    };
}

// Run directly: a long-lived mock for driving the app by hand.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const port = Number(process.env.PORT ?? 8787);
    startMockGemini({ port, chunkDelayMs: 150 }).then(mock => {
        console.log(`Mock Gemini on ${mock.url}`);
        console.log(`Point the app at it: GOOGLE_GEMINI_BASE_URL=${mock.url} GEMINI_API_KEY=mock TRANSLATE_FALLBACK=off npm run dev`);
    });
}
