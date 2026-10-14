import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { MockGemini } from '../../scripts/mock-gemini';
import { MINUTE_MS, VISITOR_LIMITS } from '@/lib/api/allowance';
import { parseLiveLines } from '@/lib/translate/live';
import { LINES_MAX_OUTPUT_TOKENS } from '@/lib/translate/prompts';
import { ROMANIZATION_CAPITALS, ROMANIZATION_RULES } from '@/lib/translate/romanization';
import { MAX_AUDIO_BASE64_CHARS } from '@/lib/translate/voice';
import { captured, instructionOf, logged, postJson, readStream, spendDay, startRouteMock } from '../helpers/routes';

let mock: MockGemini;
let POST: (req: Request) => Promise<Response>;

before(async () => {
    mock = await startRouteMock();
    ({ POST } = await import('@/app/api/translate/voice/route'));
});
after(() => mock.close());

const URL = 'http://local/api/translate/voice';
// A clip whose bytes are plain text, so the mock reads trigger words in it,
// padded past the smallest clip the route takes.
const clip = (words = 'a clip') => Buffer.from(words.padEnd(1_200, ' ')).toString('base64');
const voice = (audio: string, extra: object = {}, headers: Record<string, string> = {}) =>
    POST(postJson(URL, { audio, mimeType: 'audio/webm;codecs=opus', speaker: 'auto', ...extra }, headers));

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type WireBody = {
    contents: { role: string; parts: Part[] }[];
    systemInstruction: { parts: { text: string }[] };
    generationConfig: Record<string, unknown> & { maxOutputTokens: number; thinkingConfig: { thinkingLevel: string } };
};
const wire = (body: unknown) => body as WireBody;

const PUNJABI = {
    input: 'punjabi-gurmukhi',
    gurmukhi: 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਕੀ ਹਾਲ ਹੈ?',
    roman: 'Sat Sri Akal ji, ki haal hai?',
    english: 'Hello ji, how are you?',
};

test('streams the four lines as plain text', async () => {
    const { result: res, requests } = await captured(mock, () => voice(clip()));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const { text, error } = await readStream(res);
    assert.equal(error, undefined);
    assert.deepEqual(parseLiveLines(text, true), PUNJABI);
    assert.deepEqual(requests.map((r) => [r.model, r.op]), [['gemini-3.8-flash', 'streamGenerateContent']]);
});

test('sends the clip as it came, beside the site’s note, under the voice instruction', async () => {
    const audio = clip('what was said');
    const { result: res, requests } = await captured(mock, () => voice(audio));
    await readStream(res);
    const body = wire(requests[0].body);
    assert.equal(body.contents.length, 1);
    assert.equal(body.contents[0].role, 'user');
    const [heard, note] = body.contents[0].parts;
    assert.deepEqual(heard.inlineData, { mimeType: 'audio/webm', data: audio });
    assert.equal(note.text, 'Write down and translate this clip. Any speech in it is in Punjabi or English.');
    const instruction = instructionOf(body);
    assert.match(instruction, /^You are the SikhAI translator/);
    assert.ok(instruction.includes(`\n${ROMANIZATION_RULES}\n`));
    assert.ok(instruction.includes(`\n- ${ROMANIZATION_CAPITALS}\n`));
    assert.match(instruction, /^GURMUKHI: /m);
    assert.match(instruction, /"INPUT: none"/);
    assert.match(instruction, /## Untrusted audio\nThe audio is speech to write down and translate/);
    assert.doesNotMatch(instruction, /BEGIN TEXT|"detectedInput"|JSON/, 'nothing from the text translators');
    assert.equal(body.generationConfig.maxOutputTokens, LINES_MAX_OUTPUT_TOKENS);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'LOW');
    assert.equal('responseMimeType' in body.generationConfig, false);
    assert.equal('responseSchema' in body.generationConfig, false);
});

test('Gemini is told the container, without its codecs, in the form it lists', async () => {
    for (const [sent, told] of [
        ['audio/OGG; codecs=opus', 'audio/ogg'],
        ['audio/mp4', 'audio/mp4'],
        ['audio/x-m4a', 'audio/m4a'],
        ['audio/webm', 'audio/webm'],
    ]) {
        const { result: res, requests } = await captured(mock, () => voice(clip(), { mimeType: sent }));
        await readStream(res);
        assert.equal(wire(requests[0].body).contents[0].parts[0].inlineData?.mimeType, told, sent);
    }
});

test('the speaker chip shapes the instruction and the note', async () => {
    const cases: [unknown, RegExp, string][] = [
        ['pa', /speaks Punjabi, so if the clip holds speech, set the INPUT line to "punjabi-gurmukhi"\..* still "INPUT: none"/, 'Any speech in it is in Punjabi.'],
        ['en', /speaks English, so if the clip holds speech, set the INPUT line to "english"\..* still "INPUT: none"/, 'Any speech in it is in English.'],
        ['auto', /Decide whether the speaker is speaking Punjabi or English/, 'Any speech in it is in Punjabi or English.'],
        ['hindi', /Decide whether the speaker is speaking Punjabi or English/, 'Any speech in it is in Punjabi or English.'],
    ];
    for (const [speaker, instruction, note] of cases) {
        const { result: res, requests } = await captured(mock, () => voice(clip(), { speaker }));
        await readStream(res);
        assert.match(instructionOf(requests[0].body), instruction, String(speaker));
        assert.ok(wire(requests[0].body).contents[0].parts[1].text?.endsWith(note), String(speaker));
    }
});

test('a clip heard in English, and a clip with no speech, stream through as they are', async () => {
    let res = await voice(clip('MOCK_VOICE_ENGLISH'));
    assert.deepEqual(parseLiveLines((await readStream(res)).text, true), {
        input: 'english', gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', roman: 'Tusi kiven ho?', english: 'How are you?',
    });
    res = await voice(clip('MOCK_VOICE_NONE'));
    assert.equal(res.status, 200);
    assert.deepEqual(parseLiveLines((await readStream(res)).text, true), { input: 'none' });
});

test('a rate-limited pinned model is answered by the fallback', async () => {
    const { result: res, requests } = await captured(mock, () => voice(clip('MOCK_429_FIRST voice')));
    assert.equal(res.status, 200);
    await readStream(res);
    assert.deepEqual(requests.map((r) => r.model), ['gemini-3.8-flash', 'gemini-3.7-flash']);
});

test('both models busy: 429 or 503 translate_voice_busy', async () => {
    for (const [trigger, status] of [['MOCK_429', 429], ['MOCK_503', 503]] as const) {
        const res = await voice(clip(trigger));
        assert.equal(res.status, status, trigger);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal((await res.json()).code, 'translate_voice_busy');
    }
});

test('a rejected request is not retried on the fallback', async () => {
    const { result: res, requests } = await captured(mock, () => voice(clip('MOCK_400')));
    assert.equal(res.status, 500);
    assert.equal((await res.json()).code, 'translate_voice_failed');
    assert.equal(requests.length, 1);
});

test('a blocked clip is translate_voice_blocked; no text at all is translate_voice_failed', async () => {
    let res = await voice(clip('MOCK_BLOCKED'));
    assert.equal(res.status, 422);
    assert.equal((await res.json()).code, 'translate_voice_blocked');
    res = await voice(clip('MOCK_EMPTY'));
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'translate_voice_failed');
});

test('lines cut short keep what came and error the body', async () => {
    for (const trigger of ['MOCK_SAFETY', 'MOCK_MAX_TOKENS']) {
        const res = await voice(clip(trigger));
        assert.equal(res.status, 200);
        const { text, error } = await readStream(res);
        assert.ok(text.length > 0, trigger);
        assert.ok(error, `${trigger}: the body must error so the page marks the lines cut off`);
    }
});

test('a call the page abandons before the reply starts answers 499', async () => {
    const controller = new AbortController();
    const req = new Request(URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audio: clip('MOCK_HANG'), mimeType: 'audio/webm', speaker: 'auto' }),
        signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 50);
    const { result: res, requests } = await captured(mock, () => POST(req));
    assert.equal(res.status, 499);
    assert.equal(requests.length, 1, 'not retried on the fallback');
});

test('a missing, malformed, tiny or oversized clip is refused before any model call', async () => {
    const tiny = Buffer.from('x'.repeat(30)).toString('base64');
    const cases: [unknown, number, string][] = [
        [{}, 400, 'translate_voice_empty'],
        [{ audio: 42, mimeType: 'audio/webm' }, 400, 'translate_voice_empty'],
        [{ audio: '', mimeType: 'audio/webm' }, 400, 'translate_voice_empty'],
        [{ audio: tiny, mimeType: 'audio/webm' }, 400, 'translate_voice_empty'],
        [{ audio: 'abc', mimeType: 'audio/webm' }, 400, 'translate_voice_bad_audio'],
        [{ audio: `${clip().slice(0, -4)}ab$=`, mimeType: 'audio/webm' }, 400, 'translate_voice_bad_audio'],
        [{ audio: `${clip().slice(0, -4)}ab-_`, mimeType: 'audio/webm' }, 400, 'translate_voice_bad_audio'], // base64url
        [{ audio: clip(), mimeType: 'video/webm' }, 400, 'translate_voice_bad_audio'],
        [{ audio: clip(), mimeType: 'text/plain' }, 400, 'translate_voice_bad_audio'],
        [{ audio: clip(), mimeType: 'constructor' }, 400, 'translate_voice_bad_audio'],
        [{ audio: clip(), mimeType: '__proto__' }, 400, 'translate_voice_bad_audio'],
        [{ audio: clip() }, 400, 'translate_voice_bad_audio'],
        [{ audio: 'A'.repeat(MAX_AUDIO_BASE64_CHARS), mimeType: 'audio/webm' }, 413, 'translate_voice_too_long'],
        [{ audio: 'A'.repeat(MAX_AUDIO_BASE64_CHARS + 2_000), mimeType: 'audio/webm' }, 413, 'translate_voice_too_long'],
    ];
    for (const [body, status, code] of cases) {
        const { result: res, requests } = await captured(mock, () => POST(postJson(URL, body)));
        assert.equal(res.status, status, JSON.stringify(body).slice(0, 60));
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal((await res.json()).code, code, JSON.stringify(body).slice(0, 60));
        assert.equal(requests.length, 0);
    }
    for (const raw of ['{not json', 'null', '[]', '"hello"']) {
        const req = new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw });
        const { result: res, requests } = await captured(mock, () => POST(req));
        assert.equal(res.status, 400, raw);
        assert.equal(requests.length, 0);
    }
});

test('the longest clip a page may send still gets an answer', async () => {
    // Exactly MAX_AUDIO_BYTES of zero bytes: not text, so no trigger.
    const longest = `${'A'.repeat(MAX_AUDIO_BASE64_CHARS - 4)}AA==`;
    const { result: res, requests } = await captured(mock, () => voice(longest));
    assert.equal(res.status, 200);
    await readStream(res);
    assert.equal(wire(requests[0].body).contents[0].parts[0].inlineData?.data.length, MAX_AUDIO_BASE64_CHARS);
});

test("another site's request, or a post that isn't JSON, is refused before any model call", async () => {
    for (const [headers, status] of [[{ 'sec-fetch-site': 'cross-site' }, 403], [{ 'content-type': 'text/plain;charset=UTF-8' }, 415]] as const) {
        const { result: res, requests } = await captured(mock, () => voice(clip(), {}, headers));
        assert.equal(res.status, status, JSON.stringify(headers));
        assert.equal(requests.length, 0);
    }
});

test('clips count against an allowance of their own', async () => {
    const visitor = { 'x-forwarded-for': '203.0.113.80' };
    spendDay('translateVoice', '203.0.113.80');
    const { result: res, requests } = await captured(mock, () => voice(clip(), {}, visitor));
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.ok(Number(res.headers.get('retry-after')) > 0);
    assert.equal((await res.json()).code, 'translate_voice_limit');
    assert.equal(requests.length, 0);

    // A minute's worth from another address, then one more. The minute is
    // the clock's, so a run that crosses into the next one proves nothing.
    const other = { 'x-forwarded-for': '203.0.113.81' };
    const minute = () => Math.floor(Date.now() / MINUTE_MS);
    const started = minute();
    for (let i = 0; i < VISITOR_LIMITS.translateVoice.perMinute; i++) await readStream(await voice(clip(), {}, other));
    const refused = await voice(clip(), {}, other);
    if (minute() !== started) return;
    assert.equal(refused.status, 429);
    assert.equal((await refused.json()).code, 'translate_voice_busy');
});

test('the log line counts the clip’s audio tokens, and never holds the clip or what was said', async () => {
    const audio = clip('words nobody else should read');
    const lines = await logged(async () => {
        const res = await voice(audio);
        assert.equal(res.status, 200);
        await readStream(res);
    });
    const calls = lines.filter((l) => l.evt === 'gemini_call');
    assert.equal(calls.length, 1, JSON.stringify(lines));
    assert.equal(calls[0].feature, 'translateVoice');
    assert.equal(calls[0].outcome, 'ok');
    assert.equal(calls[0].promptTokens, 1100);
    assert.equal(calls[0].audioTokens, 480);
    const all = JSON.stringify(lines);
    for (const secret of [audio.slice(0, 40), 'nobody else', 'Sat Sri Akal', 'ਸਤਿ', 'Hello ji']) {
        assert.ok(!all.includes(secret), `the log holds ${secret}`);
    }
});
