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
//   MOCK_LONG         a reply as long as a whole Ang explained line by line,
//                     in small pieces (for profiling the chat's rendering)
// Anything else gets a normal reply naming the model that served it; a
// streamed translator request (/api/translate/live) gets its four lines.
//
// A request with an audio clip (Talk's /api/translate/voice) gets the four
// lines of a clip heard in Punjabi, or in English when the clip, or the
// route's note on who is speaking, says English. The triggers above work in
// a clip too, when its bytes are plain text, as the tests send them (real
// audio never is):
//   MOCK_VOICE_ENGLISH  heard in English          MOCK_VOICE_NONE  no speech heard
//
// It also stands in for two Google services the speak route
// (/api/translate/speak) uses, when GOOGLE_TTS_BASE_URL points here and the
// service account's token_uri is this server's /token (mockServiceAccount()):
//   POST /token                   a service account's access token, for any
//                                 well-formed JWT; an issuer containing
//                                 MOCK_OAUTH_400 is refused, and one with
//                                 MOCK_OAUTH_HTML answered with a web page
//   POST /v1/text:synthesize      a short silent MP3, for a token /token gave;
//                                 MOCK_TTS_500, MOCK_TTS_403, MOCK_TTS_429, MOCK_TTS_400,
//                                 MOCK_TTS_EMPTY or MOCK_TTS_HANG in the text
//                                 to fail instead

import { generateKeyPairSync } from 'node:crypto';
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
    // A reply with an image from another site, which the chat shows as a link.
    image: 'Harmandir Sahib at dawn: ![Harmandir Sahib](https://example.org/harmandir-sahib.jpg)',
    // The Punjabi tutor's shape: Punjabi in three forms, a short list, a next step.
    tutor: 'Good question! In the past tense, the verb agrees with the **thing** that was done, not with you:\n\n'
        + '- ਮੈਂ ਕੰਮ ਕੀਤਾ — Main kamm kita — I did the work. ਕੰਮ (kamm, work) is masculine.\n'
        + '- ਮੈਂ ਗੱਲ ਕੀਤੀ — Main gall kiti — I had a talk. ਗੱਲ (gall, a talk) is feminine.\n\n'
        + 'Try one: how would you say “I made tea”?',
};

function fixtureReplies(): { id: string; text: string }[] {
    try {
        const file = resolve(import.meta.dirname, '../tests/gurbani/fixtures/replies.json');
        return JSON.parse(readFileSync(file, 'utf8')) as { id: string; text: string }[];
    } catch {
        return [];
    }
}

function cannedReply(name: string): string | undefined {
    if (CANNED[name] !== undefined) return CANNED[name];
    return fixtureReplies().find(r => r.id === name)?.text;
}

// About 12,000 characters of real model answers (headings, lists, Gurmukhi
// quotes), roughly what a whole Ang explained line by line comes to.
const LONG_REPLY_CHARS = 12_000;
function longReply(): string {
    const parts: string[] = [];
    let length = 0;
    for (const { text } of [...fixtureReplies()].sort((a, b) => b.text.length - a.text.length)) {
        if (length >= LONG_REPLY_CHARS) break;
        parts.push(text);
        length += text.length;
    }
    return parts.join('\n\n');
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

// The audio clip in the last user message (Talk's voice route sends one).
function lastUserAudio(body: Json): { mimeType: string; data: string } | null {
    const contents = Array.isArray(body.contents) ? body.contents as Json[] : [];
    const last = contents[contents.length - 1] ?? {};
    const parts = Array.isArray(last.parts) ? last.parts as Json[] : [];
    for (const p of parts) {
        const inline = p.inlineData as Json | undefined;
        if (typeof inline?.mimeType === 'string' && inline.mimeType.startsWith('audio/') && typeof inline.data === 'string') {
            return { mimeType: inline.mimeType, data: inline.data };
        }
    }
    return null;
}

// A clip's bytes as text, when they are plain text: how the tests put a
// trigger in a clip. Real audio starts with binary (WebM's 1A 45 DF A3,
// MP4's box sizes), so it never reads as text.
function clipText(data: string): string {
    const bytes = Buffer.from(data, 'base64');
    for (const b of bytes) if (b < 0x20 ? b !== 0x09 && b !== 0x0a && b !== 0x0d : b > 0x7e) return '';
    return bytes.toString('latin1');
}

// The four lines for a clip, as lib/translate/live.ts reads them: heard in
// Punjabi unless the clip, or the route's note on who is speaking, says
// English; nothing heard for MOCK_VOICE_NONE.
function voiceLines(probe: string): string {
    if (probe.includes('MOCK_VOICE_NONE')) return 'INPUT: none';
    if (probe.includes('MOCK_VOICE_ENGLISH') || /is in English\./.test(probe)) {
        return 'INPUT: english\nGURMUKHI: ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?\nROMAN: Tusi kiven ho?\nENGLISH: How are you?';
    }
    return 'INPUT: punjabi-gurmukhi\nGURMUKHI: ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਕੀ ਹਾਲ ਹੈ?\nROMAN: Sat Sri Akal ji, ki haal hai?\nENGLISH: Hello ji, how are you?';
}

// A short MP3 of silence: MPEG-1 Layer III frames (128 kbit/s, 44.1 kHz,
// mono) whose side information is all zeros, which decoders play as
// silence. Enough for a browser to play and end, while driving the app.
export const SILENT_MP3: Buffer = (() => {
    const FRAME_BYTES = 417; // 144 × 128,000 / 44,100, no padding
    const frame = Buffer.alloc(FRAME_BYTES);
    frame.set([0xff, 0xfb, 0x90, 0xc4]);
    return Buffer.concat(Array.from({ length: 12 }, () => frame));
})();

// A service account for the mock's /token, in the shape Google's JSON key
// file has: the speak route signs its token request with this key, and the
// mock gives a token for any well-formed request. For the tests, and for
// GOOGLE_TTS_SERVICE_ACCOUNT when driving the app against the mock.
export function mockServiceAccount(url: string, clientEmail = 'talk@sikhai-mock.iam.gserviceaccount.com') {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    return {
        json: JSON.stringify({
            type: 'service_account',
            client_email: clientEmail,
            private_key_id: 'mock-key-1',
            private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
            token_uri: `${url}/token`,
        }),
        publicKey,
    };
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

// The live translator's four lines for the fenced input, in the shape
// lib/translate/live.ts reads.
function liveLines(userText: string): string {
    const { detectedInput, gurmukhi, roman, english } = translation(userText);
    return `INPUT: ${detectedInput}\nGURMUKHI: ${gurmukhi}\nROMAN: ${roman}\nENGLISH: ${english}`;
}

// A reply in `count` pieces, split between words.
function pieces(text: string, count = 4): string[] {
    const words = text.split(/(?<=\s)/);
    const size = Math.max(1, Math.ceil(words.length / count));
    const out: string[] = [];
    for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(''));
    return out;
}

export async function startMockGemini(opts: MockOptions = {}): Promise<MockGemini> {
    const requests: MockRequest[] = [];
    const calls = new Map<string, number>();
    const failedOnce = new Set<string>();
    // Access tokens /token gave, which /v1/text:synthesize accepts.
    const tokens = new Set<string>();
    let tokensIssued = 0;
    const delay = opts.chunkDelayMs ?? 0;

    const server = http.createServer(async (req, res) => {
        const chunks: Buffer[] = [];
        // Concatenated before decoding: a Gurmukhi character split across two
        // socket reads would otherwise decode to U+FFFD in each half.
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');
        const path = (req.url ?? '').split('?')[0];

        const json = (status: number, payload: unknown) => {
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(payload));
        };

        // Google's OAuth token endpoint, as a service account's token_uri.
        if (path === '/token') {
            const form = new URLSearchParams(raw);
            const assertion = form.get('assertion') ?? '';
            let claims: Json = {};
            try {
                claims = JSON.parse(Buffer.from(assertion.split('.')[1] ?? '', 'base64url').toString('utf8')) as Json;
            } catch { /* answered below */ }
            requests.push({ model: '', op: 'token', text: '', body: { grantType: form.get('grant_type'), assertion, claims } });
            const wellFormed = form.get('grant_type') === 'urn:ietf:params:oauth:grant-type:jwt-bearer'
                && assertion.split('.').length === 3 && typeof claims.iss === 'string';
            if (!wellFormed || String(claims.iss).includes('MOCK_OAUTH_400')) {
                return json(400, { error: 'invalid_grant', error_description: 'Invalid JWT Signature.' });
            }
            if (String(claims.iss).includes('MOCK_OAUTH_HTML')) {
                res.writeHead(200, { 'content-type': 'text/html' });
                res.end('<html>Sign in</html>');
                return;
            }
            const token = `mock-token-${++tokensIssued}`;
            tokens.add(token);
            return json(200, { access_token: token, expires_in: 3599, token_type: 'Bearer' });
        }

        // Cloud Text-to-Speech.
        if (path === '/v1/text:synthesize') {
            let body: Json = {};
            try { body = JSON.parse(raw) as Json; } catch { /* answered below */ }
            const text = String((body.input as Json | undefined)?.text ?? '');
            requests.push({ model: String((body.voice as Json | undefined)?.name ?? ''), op: 'synthesize', text, body });
            const auth = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1];
            if (!auth || !tokens.has(auth)) {
                return json(401, { error: { code: 401, message: 'Request had invalid authentication credentials.', status: 'UNAUTHENTICATED' } });
            }
            if (text.includes('MOCK_TTS_500')) return json(500, { error: { code: 500, message: 'Internal error.', status: 'INTERNAL' } });
            if (text.includes('MOCK_TTS_403')) {
                return json(403, { error: { code: 403, message: 'Cloud Text-to-Speech API has not been used in project 0 before or it is disabled.', status: 'PERMISSION_DENIED' } });
            }
            if (text.includes('MOCK_TTS_429')) return json(429, { error: { code: 429, message: 'Quota exceeded.', status: 'RESOURCE_EXHAUSTED' } });
            if (text.includes('MOCK_TTS_400')) return json(400, { error: { code: 400, message: 'This request contains sentences that are too long.', status: 'INVALID_ARGUMENT' } });
            if (text.includes('MOCK_TTS_EMPTY')) return json(200, {});
            if (text.includes('MOCK_TTS_HANG')) {
                const timer = setTimeout(() => res.destroy(), 60_000);
                timer.unref();
                req.on('close', () => clearTimeout(timer));
                return;
            }
            return json(200, { audioContent: SILENT_MP3.toString('base64') });
        }

        const body: Json = raw ? JSON.parse(raw) : {};
        const match = /models\/([^:]+):(generateContent|streamGenerateContent)/.exec(req.url ?? '');
        const model = match?.[1] ?? '?';
        const op = match?.[2] ?? '?';
        const text = lastUserText(body);
        requests.push({ model, op, text, body });
        // Triggers are read from the text and from a clip that is plain text.
        const audio = lastUserAudio(body);
        const probe = audio ? `${text}\n${clipText(audio.data)}` : text;

        const used = (calls.get(model) ?? 0) + 1;
        calls.set(model, used);
        const limit = opts.dailyLimit?.[model];
        if (limit !== undefined && used > limit) return json(429, quotaError(true));
        // Keyed without the translator's per-attempt nonce fence, so the
        // fallback model's retry of the same text counts as the second call.
        const onceKey = probe.replace(/--- (?:BEGIN|END) TEXT [0-9a-f]+ ---/g, '');
        if (probe.includes('MOCK_429_FIRST') && !failedOnce.has(onceKey)) {
            failedOnce.add(onceKey);
            return json(429, quotaError(false));
        }
        if (probe.includes('MOCK_429') && !probe.includes('MOCK_429_FIRST')) return json(429, quotaError(true));
        if (probe.includes('MOCK_503')) return json(503, { error: { code: 503, message: 'The model is overloaded.', status: 'UNAVAILABLE' } });
        if (probe.includes('MOCK_400')) return json(400, { error: { code: 400, message: 'Invalid argument.', status: 'INVALID_ARGUMENT' } });
        if (probe.includes('MOCK_HANG')) {
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
        const usage = audio
            // A fifteen-second clip is 480 tokens of audio, beside the instruction.
            ? {
                promptTokenCount: 1100, candidatesTokenCount: 120, thoughtsTokenCount: 0, totalTokenCount: 1220,
                promptTokensDetails: [{ modality: 'TEXT', tokenCount: 620 }, { modality: 'AUDIO', tokenCount: 480 }],
            }
            : { promptTokenCount: 812, candidatesTokenCount: 120, thoughtsTokenCount: 0, totalTokenCount: 932 };

        if (op === 'streamGenerateContent') {
            res.writeHead(200, { 'content-type': 'text/event-stream' });
            const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
            if (probe.includes('MOCK_BLOCKED')) {
                send({ promptFeedback: { blockReason: 'SAFETY' }, modelVersion: model });
                return res.end();
            }
            // Gemini 3.x style: a chunk carrying only a thought signature comes first.
            send(candidate([{ text: '', thoughtSignature: 'c2lnbmF0dXJl' }]));
            if (probe.includes('MOCK_EMPTY')) {
                send({ ...candidate([{ text: '' }], { finishReason: 'STOP' }), usageMetadata: usage });
                return res.end();
            }
            if (probe.includes('MOCK_SAFETY')) {
                send(candidate([{ text: 'Partial answer before the filter' }]));
                await sleep(delay);
                send(candidate([], { finishReason: 'SAFETY' }));
                return res.end();
            }
            const canned = /MOCK_REPLY:([\w:-]+)/.exec(probe)?.[1];
            const long = probe.includes('MOCK_LONG');
            // Only the translators fence their text, and only the live one streams.
            const live = /--- BEGIN TEXT [0-9a-f]+ ---/.test(text);
            const reply = (long ? longReply() : canned && cannedReply(canned))
                || (audio ? voiceLines(probe) : '')
                || (live ? liveLines(text) : '')
                || `Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh. This is a **mock** reply from \`${model}\`.`;
            // A long reply comes in about as many pieces as Gemini sends: one
            // every ~80 characters.
            for (const piece of pieces(reply, long ? Math.ceil(reply.length / 80) : 4)) {
                await sleep(long ? Math.min(delay, 40) : delay);
                send(candidate([{ text: piece }]));
            }
            const finishReason = probe.includes('MOCK_MAX_TOKENS') ? 'MAX_TOKENS' : 'STOP';
            send({ ...candidate([{ text: '' }], { finishReason }), usageMetadata: usage });
            return res.end();
        }

        if (op === 'generateContent') {
            if (probe.includes('MOCK_BLOCKED')) return json(200, { promptFeedback: { blockReason: 'SAFETY' }, modelVersion: model });
            if (probe.includes('MOCK_MAX_TOKENS')) {
                return json(200, candidate([{ text: '{"detectedInput":"engl' }], { finishReason: 'MAX_TOKENS' }));
            }
            if (probe.includes('MOCK_GARBAGE')) return json(200, candidate([{ text: 'not json' }], { finishReason: 'STOP' }));
            if (probe.includes('MOCK_EMPTY')) return json(200, candidate([], { finishReason: 'STOP' }));
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
        // A throwaway key: the mock gives a token for any well-formed request.
        const account = Buffer.from(mockServiceAccount(mock.url).json).toString('base64');
        console.log(`For Talk's read-aloud, add: GOOGLE_TTS_BASE_URL=${mock.url} GOOGLE_TTS_SERVICE_ACCOUNT=${account}`);
    });
}
