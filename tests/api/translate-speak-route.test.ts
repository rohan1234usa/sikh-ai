import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { verify, type KeyObject } from 'node:crypto';
import { SILENT_MP3, mockServiceAccount, type MockGemini } from '../../scripts/mock-gemini';
import { MINUTE_MS, VISITOR_LIMITS } from '@/lib/api/allowance';
import type * as Speak from '@/lib/translate/speak';
import { MAX_SPEAK_CHARS } from '@/lib/translate/voice';
import { captured, logged, postJson, spendDay, startRouteMock } from '../helpers/routes';

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
        assert.equal(res.headers.get('retry-after'), '600', 'asked again in ten minutes: the owner may switch it on');
        assert.equal((await res.json()).code, 'speak_unavailable');
        assert.equal(requests.length, 0);
    }
    delete process.env.SPEAK;
    delete process.env.GOOGLE_TTS_SERVICE_ACCOUNT;
    const lines = await logged(async () => {
        const res = await say(LINE, 'pa', visitor);
        assert.equal(res.status, 503);
        assert.equal(res.headers.get('retry-after'), '600');
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
    // A key file whose key can't be read, as a key mangled in pasting (its
    // newlines escaped twice): off like any key file that doesn't work,
    // nobody counted and Google never asked, and logged once, not each line.
    const key = JSON.parse(account.json) as Record<string, string>;
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = JSON.stringify({ ...key, private_key: key.private_key.replace(/\n/g, '\\n') });
    const visitor = { 'x-forwarded-for': '203.0.113.95' };
    const minute = () => Math.floor(Date.now() / MINUTE_MS);
    const started = minute();
    const lines = await logged(async () => {
        for (let i = 0; i <= VISITOR_LIMITS.speak.perMinute; i++) {
            const { result: res, requests } = await captured(mock, () => say(LINE, 'pa', visitor));
            assert.equal(res.status, 503, `line ${i + 1}: never the visitor's 429`);
            assert.equal(res.headers.get('retry-after'), '600');
            assert.equal(requests.length, 0, 'Google is never asked');
        }
    });
    const errors = lines.filter((l) => l.evt === 'config_error');
    assert.ok(errors.length >= 1 && errors.every((l) => l.level === 'error' && l.why === 'unreadable'), JSON.stringify(lines));
    if (minute() === started) assert.equal(errors.length, 1, 'once a minute, however many lines');
    assert.ok(!JSON.stringify(lines).includes('PRIVATE KEY'), 'never the key');
});

test('a sign-in that fails on the way is logged as the sign-in, not as Text-to-Speech', async () => {
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = mockServiceAccount(mock.url, 'MOCK_OAUTH_HTML@sikhai-mock.iam.gserviceaccount.com').json;
    const lines = await logged(async () => {
        const { result: res, requests } = await captured(mock, () => say(LINE));
        assert.equal(res.status, 502);
        assert.equal((await res.json()).code, 'speak_failed');
        assert.deepEqual(ops(requests), ['token'], 'Text-to-Speech is never reached');
    });
    const line = lines.find((l) => l.evt === 'upstream_error');
    assert.deepEqual([line?.upstream, line?.error, line?.level], ['google_oauth', 'SyntaxError', 'warn'], JSON.stringify(lines));
});

test('Google refusing the sign-in is an error, and read-aloud waits a minute before asking again', async () => {
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = mockServiceAccount(mock.url, 'MOCK_OAUTH_400@sikhai-mock.iam.gserviceaccount.com').json;
    const lines = await logged(async () => {
        const { result: res, requests } = await captured(mock, () => say(LINE));
        assert.equal(res.status, 503);
        assert.equal(res.headers.get('retry-after'), '60', 'the page waits a minute, not for good');
        assert.equal((await res.json()).code, 'speak_unavailable');
        assert.deepEqual(ops(requests), ['token']);
    });
    assert.ok(lines.some((l) => l.evt === 'upstream_error' && l.upstream === 'google_oauth' && l.status === 400 && l.level === 'error'));
    // For a minute, that account isn't tried again, nor logged again.
    const again = await logged(async () => {
        const { result: res, requests } = await captured(mock, () => say(LINE));
        assert.equal(res.status, 503);
        const wait = Number(res.headers.get('retry-after'));
        assert.ok(wait >= 1 && wait <= 60, `what is left of the minute: ${wait}`);
        assert.deepEqual(requests, []);
    });
    assert.deepEqual(again.filter((l) => l.level === 'error'), []);
});

test('Text-to-Speech busy or down is speak_failed, a warning: the next line may work', async () => {
    for (const [trigger, status] of [['MOCK_TTS_500', 500], ['MOCK_TTS_429', 429]] as const) {
        const lines = await logged(async () => {
            const res = await say(`${trigger} read this aloud`, 'en');
            assert.equal(res.status, 502, trigger);
            assert.equal((await res.json()).code, 'speak_failed');
        });
        const line = lines.find((l) => l.evt === 'upstream_error');
        assert.deepEqual([line?.upstream, line?.status, line?.level], ['cloud_tts', status, 'warn'], trigger);
    }
    const res = await say('MOCK_TTS_EMPTY read this aloud', 'en');
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'speak_failed');
    assert.equal((await say('Hello ji, how are you?', 'en')).status, 200, 'and the next one is read');
});

test('one line Text-to-Speech refuses is speak_failed, an error the owner hears about, and holds nobody back', async () => {
    const lines = await logged(async () => {
        const res = await say('MOCK_TTS_400 read this aloud', 'en');
        assert.equal(res.status, 502);
        assert.equal(res.headers.get('retry-after'), null);
        assert.equal((await res.json()).code, 'speak_failed');
    });
    const line = lines.find((l) => l.evt === 'upstream_error');
    assert.deepEqual([line?.upstream, line?.status, line?.level], ['cloud_tts', 400, 'error']);
    const { result: res, requests } = await captured(mock, () => say(LINE));
    assert.equal(res.status, 200, 'the next line is read: a 400 is about its line, not the account');
    assert.ok(ops(requests).includes('synthesize'));
});

test('Text-to-Speech refusing the account is an error, and read-aloud is unavailable until it is fixed', async () => {
    // An account of its own: a refusal blocks its account for a minute.
    process.env.GOOGLE_TTS_SERVICE_ACCOUNT = mockServiceAccount(mock.url, 'switched-off@sikhai-mock.iam.gserviceaccount.com').json;
    const lines = await logged(async () => {
        const res = await say('MOCK_TTS_403 read this aloud', 'en');
        assert.equal(res.status, 503);
        assert.equal(res.headers.get('retry-after'), '60');
        assert.equal((await res.json()).code, 'speak_unavailable');
    });
    const line = lines.find((l) => l.evt === 'upstream_error');
    assert.deepEqual([line?.upstream, line?.status, line?.level], ['cloud_tts', 403, 'error']);
    const { result: res, requests } = await captured(mock, () => say('Hello ji, how are you?', 'en'));
    assert.equal(res.status, 503, 'the API is still off: Google isn’t asked again for a minute');
    assert.deepEqual(requests, []);
    // Nor is anyone counted while it waits: past a minute's allowance of
    // lines, the answer is still 503, never the visitor's 429.
    const visitor = { 'x-forwarded-for': '203.0.113.93' };
    for (let i = 0; i <= VISITOR_LIMITS.speak.perMinute; i++) assert.equal((await say(LINE, 'pa', visitor)).status, 503, `line ${i + 1}`);
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

test("a visitor's day counts characters, not lines", async () => {
    const visitor = { 'x-forwarded-for': '203.0.113.96' };
    spendDay('speak', '203.0.113.96', LINE.length);
    assert.equal((await say(LINE, 'pa', visitor)).status, 200, 'exactly what was left');
    const { result: res, requests } = await captured(mock, () => say('ਹਾਂਜੀ', 'pa', visitor));
    assert.equal(res.status, 429, 'a short line is still past the day');
    assert.equal((await res.json()).code, 'speak_limit');
    assert.equal(requests.length, 0);
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
test("near the server's characters for the day, a line too long for what's left fails alone; with none left, the page waits minutes, not hours", async () => {
    const minute = () => Math.floor(Date.now() / MINUTE_MS);
    const started = minute();
    assert.ok(speak.speakAllowance.spend(speak.speakAllowance.remaining() - 10));
    const lines = await logged(async () => {
        // Ten characters left: a longer line fails alone, with nothing to
        // wait for, and a shorter one is still read.
        let { result: res, requests } = await captured(mock, () => say(LINE));
        assert.equal(res.status, 502);
        assert.equal(res.headers.get('retry-after'), null, 'the next line may fit');
        assert.equal((await res.json()).code, 'speak_failed');
        assert.equal(requests.length, 0);
        res = await say('ਹਾਂਜੀ');
        assert.equal(res.status, 200, 'a line that fits is read');
        // None left: unavailable, and asked again in a quarter of an hour at
        // most, since each server keeps its own count.
        assert.ok(speak.speakAllowance.spend(speak.speakAllowance.remaining()));
        ({ result: res, requests } = await captured(mock, () => say(LINE)));
        assert.equal(res.status, 503);
        const wait = Number(res.headers.get('retry-after'));
        assert.ok(wait >= 1 && wait <= 15 * 60, `a quarter of an hour at most: ${wait}`);
        assert.equal((await res.json()).code, 'speak_unavailable');
        assert.equal(requests.length, 0);
        // Nobody is counted for lines that can't be read.
        const visitor = { 'x-forwarded-for': '203.0.113.94' };
        for (let i = 0; i <= VISITOR_LIMITS.speak.perMinute; i++) assert.equal((await say(LINE, 'pa', visitor)).status, 503, `line ${i + 1}`);
    });
    const ceiling = lines.filter((l) => l.evt === 'speak_ceiling');
    assert.ok(ceiling.length >= 1 && ceiling.every((l) => l.level === 'warn'), JSON.stringify(lines));
    if (minute() === started) assert.equal(ceiling.length, 1, 'a line a minute at most, however many are refused');
});
