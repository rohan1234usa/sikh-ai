import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { verify, type KeyObject } from 'node:crypto';
import { SILENT_MP3, mockServiceAccount, type MockGemini } from '../../scripts/mock-gemini';
import { MINUTE_MS, VISITOR_LIMITS } from '@/lib/api/allowance';
import type * as Speak from '@/lib/translate/speak';
import { MAX_SPEAK_CHARS } from '@/lib/translate/voice';
import { captured, postJson, spendDay, startRouteMock } from '../helpers/routes';

// Its own file: the day's characters and the access token are module state,
// and these tests spend them. Google's token endpoint and Cloud
// Text-to-Speech are the mock's (scripts/mock-gemini.ts).
let mock: MockGemini;
let POST: (req: Request) => Promise<Response>;
let speak: typeof Speak;
let account: { json: string; publicKey: KeyObject };

before(async () => {
    mock = await startRouteMock();
    account = mockServiceAccount(mock.url);
    ({ POST } = await import('@/app/api/translate/speak/route'));
    speak = await import('@/lib/translate/speak');
});
after(() => mock.close());
beforeEach(() => {
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = account.json;
    for (const name of ['SPEAK', 'SPEAK_VOICE_PA', 'SPEAK_VOICE_EN']) delete process.env[name];
});

const URL = 'http://local/api/translate/speak';
const LINE = 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?';
const say = (text: unknown, lang: unknown = 'pa', headers: Record<string, string> = {}) =>
    POST(postJson(URL, { text, lang }, headers));
const ops = (requests: MockGemini['requests']) => requests.map((r) => r.op);

// Runs `run` with logging on, and collects the JSON lines it writes, with
// the level each was written at.
async function logged(run: () => Promise<unknown>): Promise<{ evt: string; level: string; [k: string]: unknown }[]> {
    delete process.env.APP_LOG;
    const lines: { evt: string; level: string }[] = [];
    const saved = { log: console.log, warn: console.warn, error: console.error };
    const at = (level: string) => (line: string) => { lines.push({ ...JSON.parse(line), level }); };
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

test('a Punjabi line comes back as an MP3, never cached', async () => {
    const res = await say(LINE);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const audio = Buffer.from(await res.arrayBuffer());
    assert.equal(res.headers.get('content-length'), String(audio.length));
    assert.deepEqual(audio, SILENT_MP3);
});

test('it signs in as the service account, then asks for the Punjabi voice', async () => {
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = mockServiceAccount(mock.url, 'fresh@sikhai-mock.iam.gserviceaccount.com').json;
    const fresh = JSON.parse(process.env.GOOGLE_TTS_SERVICE_ACCOUNT) as { client_email: string };
    const { result: res, requests } = await captured(mock, () => say(`  ${LINE} `));
    assert.equal(res.status, 200);
    assert.deepEqual(ops(requests), ['token', 'synthesize']);
    const { grantType, claims } = requests[0].body as { grantType: string; claims: Record<string, unknown> };
    assert.equal(grantType, 'urn:ietf:params:oauth:grant-type:jwt-bearer');
    assert.equal(claims.iss, fresh.client_email);
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/cloud-platform');
    assert.equal(claims.aud, `${mock.url}/token`);
    assert.equal(Number(claims.exp) - Number(claims.iat), 3600);
    assert.deepEqual(requests[1].body, {
        input: { text: LINE },
        voice: { languageCode: 'pa-IN', name: 'pa-IN-Wavenet-A' },
        audioConfig: { audioEncoding: 'MP3' },
    });
});

test('a token is kept for its hour: the next line signs in no more', async () => {
    const first = await captured(mock, () => say(LINE));
    assert.equal(first.result.status, 200);
    const { result: res, requests } = await captured(mock, () => say('ਹਾਂਜੀ, ਮੈਂ ਠੀਕ ਹਾਂ।'));
    assert.equal(res.status, 200);
    assert.deepEqual(ops(requests), ['synthesize']);
});

test('the token request is an RS256 JWT signed with the account’s own key, read from JSON or base64', async () => {
    const own = mockServiceAccount(mock.url, 'verified@sikhai-mock.iam.gserviceaccount.com');
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = Buffer.from(own.json).toString('base64');
    const { result: res, requests } = await captured(mock, () => say(LINE));
    assert.equal(res.status, 200);
    const { assertion } = requests[0].body as { assertion: string };
    const [header, payload, signature] = assertion.split('.');
    assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), { alg: 'RS256', typ: 'JWT', kid: 'mock-key-1' });
    const signed = Buffer.from(`${header}.${payload}`);
    const sig = Buffer.from(signature, 'base64url');
    assert.ok(verify('sha256', signed, own.publicKey, sig), 'its own key signed it');
    assert.ok(!verify('sha256', signed, account.publicKey, sig), 'and no other');
});

test('English, when the device can’t read it, gets an English voice; the voices can be chosen', async () => {
    let { result: res, requests } = await captured(mock, () => say('Hello ji, how are you?', 'en'));
    assert.equal(res.status, 200);
    assert.deepEqual((requests.at(-1)!.body as { voice: unknown }).voice, { languageCode: 'en-US', name: 'en-US-Wavenet-F' });
    process.env.SPEAK_VOICE_PA = ' pa-IN-Standard-B ';
    ({ result: res, requests } = await captured(mock, () => say(LINE)));
    assert.equal(res.status, 200);
    assert.deepEqual((requests.at(-1)!.body as { voice: unknown }).voice, { languageCode: 'pa-IN', name: 'pa-IN-Standard-B' });
});

test('a missing, overlong or unreadable line is refused before Google hears of it', async () => {
    const cases: [unknown, unknown, number, string][] = [
        [undefined, 'pa', 400, 'speak_empty'],
        ['   ', 'pa', 400, 'speak_empty'],
        [42, 'pa', 400, 'speak_empty'],
        ['ਹ'.repeat(MAX_SPEAK_CHARS + 1), 'pa', 400, 'speak_too_long'],
        [LINE, 'hi', 400, 'speak_invalid'],
        ['Sat Sri Akal ji, tusi kiven ho?', 'pa', 400, 'speak_invalid'],
    ];
    for (const [text, lang, status, code] of cases) {
        const { result: res, requests } = await captured(mock, () => say(text, lang));
        assert.equal(res.status, status, `${String(text).slice(0, 20)} / ${String(lang)}`);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal((await res.json()).code, code);
        assert.equal(requests.length, 0);
    }
    const noLang = await captured(mock, () => POST(postJson(URL, { text: LINE })));
    assert.equal(noLang.result.status, 400);
    assert.equal((await noLang.result.json()).code, 'speak_invalid');
    assert.equal(noLang.requests.length, 0);
    const { result: res } = await captured(mock, () => say('"'.repeat(MAX_SPEAK_CHARS + 300)));
    assert.equal(res.status, 413);
    assert.equal((await res.json()).code, 'speak_too_long');
    assert.equal((await say('ਹ'.repeat(MAX_SPEAK_CHARS))).status, 200, 'the longest line is read');
});

test('switched off, or not set up, it says so before counting anyone', async () => {
    const visitor = { 'x-forwarded-for': '203.0.113.90' };
    for (const flag of ['off', 'OFF', '0', 'false']) {
        process.env.SPEAK = flag;
        const { result: res, requests } = await captured(mock, () => say(LINE, 'pa', visitor));
        assert.equal(res.status, 503, flag);
        assert.equal((await res.json()).code, 'speak_unavailable');
        assert.equal(requests.length, 0);
    }
    delete process.env.SPEAK;
    delete process.env.GOOGLE_TTS_SERVICE_ACCOUNT;
    const lines = await logged(async () => {
        const res = await say(LINE, 'pa', visitor);
        assert.equal(res.status, 503);
        assert.equal((await res.json()).code, 'speak_unavailable');
    });
    assert.deepEqual(lines.map((l) => [l.evt, l.level, l.why]), [['speak_unavailable', 'warn', 'not_set_up']]);
    // None of that counted: the visitor's minute is untouched.
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = account.json;
    for (let i = 0; i < VISITOR_LIMITS.speak.perMinute; i++) assert.equal((await say(LINE, 'pa', visitor)).status, 200);
});

test('an account that isn’t a key file is an error the owner hears about', async () => {
    for (const bad of ['not json', '{"client_email":"x@y"}', Buffer.from('{"private_key":"k"}').toString('base64')]) {
        process.env.GOOGLE_TTS_SERVICE_ACCOUNT = bad;
        const lines = await logged(async () => {
            const res = await say(LINE);
            assert.equal(res.status, 503, bad);
            assert.equal((await res.json()).code, 'speak_unavailable');
        });
        assert.ok(lines.some((l) => l.evt === 'config_error' && l.level === 'error' && l.missing === 'GOOGLE_TTS_SERVICE_ACCOUNT'), bad);
    }
    // A key file whose key can't sign.
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'broken@x', private_key: 'not a key', token_uri: `${mock.url}/token` });
    const lines = await logged(async () => {
        const res = await say(LINE);
        assert.equal(res.status, 502);
        assert.equal((await res.json()).code, 'speak_failed');
    });
    assert.ok(lines.some((l) => l.evt === 'config_error' && l.level === 'error' && l.why === 'unsigned'), JSON.stringify(lines));
    assert.ok(!JSON.stringify(lines).includes('not a key'), 'never the key');
});

test('Google refusing the sign-in is an error; nothing is read', async () => {
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = mockServiceAccount(mock.url, 'MOCK_OAUTH_400@sikhai-mock.iam.gserviceaccount.com').json;
    const lines = await logged(async () => {
        const { result: res, requests } = await captured(mock, () => say(LINE));
        assert.equal(res.status, 502);
        assert.equal((await res.json()).code, 'speak_failed');
        assert.deepEqual(ops(requests), ['token']);
    });
    assert.ok(lines.some((l) => l.evt === 'upstream_error' && l.upstream === 'google_oauth' && l.status === 400 && l.level === 'error'));
});

test('Text-to-Speech failing is speak_failed: busy or down a warning, anything else an error', async () => {
    for (const [trigger, status, level] of [['MOCK_TTS_500', 500, 'warn'], ['MOCK_TTS_429', 429, 'warn'], ['MOCK_TTS_403', 403, 'error']] as const) {
        const lines = await logged(async () => {
            const res = await say(`${trigger} read this aloud`, 'en');
            assert.equal(res.status, 502, trigger);
            assert.equal((await res.json()).code, 'speak_failed');
        });
        const line = lines.find((l) => l.evt === 'upstream_error');
        assert.deepEqual([line?.upstream, line?.status, line?.level], ['cloud_tts', status, level], trigger);
    }
    const res = await say('MOCK_TTS_EMPTY read this aloud', 'en');
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'speak_failed');
});

test('a line the page abandons answers 499', async () => {
    const controller = new AbortController();
    const req = new Request(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'MOCK_TTS_HANG read this aloud', lang: 'en' }),
        signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    const res = await POST(req);
    assert.equal(res.status, 499);
});

test("another site's request, or a post that isn't JSON, is refused before Google hears of it", async () => {
    for (const [headers, status] of [[{ 'sec-fetch-site': 'cross-site' }, 403], [{ 'content-type': 'text/plain;charset=UTF-8' }, 415]] as const) {
        const { result: res, requests } = await captured(mock, () => say(LINE, 'pa', headers));
        assert.equal(res.status, status, JSON.stringify(headers));
        assert.equal(requests.length, 0);
    }
});

test('lines read aloud count against an allowance of their own', async () => {
    const visitor = { 'x-forwarded-for': '203.0.113.91' };
    spendDay('speak', '203.0.113.91');
    const { result: res, requests } = await captured(mock, () => say(LINE, 'pa', visitor));
    assert.equal(res.status, 429);
    assert.ok(Number(res.headers.get('retry-after')) > 0);
    assert.equal((await res.json()).code, 'speak_limit');
    assert.equal(requests.length, 0);

    const other = { 'x-forwarded-for': '203.0.113.92' };
    const minute = () => Math.floor(Date.now() / MINUTE_MS);
    const started = minute();
    for (let i = 0; i < VISITOR_LIMITS.speak.perMinute; i++) await say(LINE, 'pa', other);
    const refused = await say(LINE, 'pa', other);
    if (minute() !== started) return;
    assert.equal(refused.status, 429);
    assert.equal((await refused.json()).code, 'speak_busy');
});

test('the log line says what a call cost, and never what was read', async () => {
    const lines = await logged(async () => {
        assert.equal((await say(LINE)).status, 200);
        assert.equal((await say('MOCK_TTS_500 a private sentence', 'en')).status, 502);
    });
    const call = lines.find((l) => l.evt === 'tts_call');
    assert.ok(call, JSON.stringify(lines));
    assert.deepEqual([call.lang, call.voice, call.chars, call.bytes], ['pa', 'pa-IN-Wavenet-A', LINE.length, SILENT_MP3.length]);
    const all = JSON.stringify(lines);
    for (const secret of ['ਸਤਿ', 'private sentence', 'BEGIN PRIVATE KEY']) assert.ok(!all.includes(secret), secret);
});

// Last: it spends the server's whole day.
test("past the server's characters for the day, it says it isn't available, and asks Google nothing", async () => {
    assert.ok(speak.speakAllowance.spend(speak.speakAllowance.remaining()));
    const lines = await logged(async () => {
        const { result: res, requests } = await captured(mock, () => say(LINE));
        assert.equal(res.status, 503);
        assert.equal((await res.json()).code, 'speak_unavailable');
        assert.equal(requests.length, 0);
    });
    assert.ok(lines.some((l) => l.evt === 'speak_ceiling' && l.level === 'warn'));
});
