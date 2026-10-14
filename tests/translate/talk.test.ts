import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    EMPTY_TALK,
    MAX_EXCHANGES,
    MIC_TROUBLES,
    MIN_VOICED_MS,
    PROMPT_DELAY_MS,
    VOICE_RMS,
    bytesToBase64,
    clipCheck,
    isMicTrouble,
    micTrouble,
    pickEnglishVoice,
    pickRecordingMime,
    rms,
    silentWav,
    speakErrorCode,
    talkReducer,
    talkView,
    voiceErrorCode,
    type TalkEvent,
    type TalkState,
} from '@/lib/translate/talk';
import { MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, MIN_CLIP_MS } from '@/lib/translate/voice';

test('the recorder takes the first type the browser records, or lets it choose', () => {
    assert.equal(pickRecordingMime(t => t === 'audio/mp4'), 'audio/mp4', 'Safari');
    assert.equal(pickRecordingMime(t => t.startsWith('audio/webm')), 'audio/webm;codecs=opus', 'Chrome');
    assert.equal(pickRecordingMime(t => t === 'audio/ogg;codecs=opus'), 'audio/ogg;codecs=opus', 'an older Firefox');
    assert.equal(pickRecordingMime(() => false), '');
    assert.equal(pickRecordingMime(undefined), '', 'no isTypeSupported at all');
    assert.equal(pickRecordingMime(() => { throw new Error('old'); }), '');
});

test('a microphone error says what the visitor can do about it', () => {
    const named = (name: string) => new DOMException('x', name);
    assert.equal(micTrouble(named('NotAllowedError')), 'denied');
    assert.equal(micTrouble(named('SecurityError')), 'denied');
    assert.equal(micTrouble(named('NotFoundError')), 'unavailable');
    assert.equal(micTrouble(named('OverconstrainedError')), 'unavailable');
    assert.equal(micTrouble(named('NotReadableError')), 'busy');
    assert.equal(micTrouble(named('AbortError')), 'busy');
    assert.equal(micTrouble(named('NotSupportedError')), 'unsupported');
    assert.equal(micTrouble(new TypeError('no')), 'failed');
    assert.equal(micTrouble(undefined), 'failed');
    assert.equal(micTrouble({ name: 'NotAllowedError' }), 'denied', 'older browsers throw plain objects');
    // Every answer is one the page shows as an error, and no other note is.
    for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'NotSupportedError', 'TypeError']) {
        assert.ok(isMicTrouble(micTrouble(named(name))), name);
    }
    assert.equal(MIC_TROUBLES.length, 6);
    for (const note of ['tooShort', 'tooLong', 'micReady', 'interrupted', 'nothingHeard']) assert.ok(!isMicTrouble(note), note);
});

test('a clip is sent only when it holds something, and fits', () => {
    const ok = { durationMs: 2_000, bytes: 30_000 };
    assert.equal(clipCheck(ok, 200), 'ok');
    assert.equal(clipCheck({ ...ok, durationMs: MIN_CLIP_MS - 1 }, 200), 'short');
    assert.equal(clipCheck({ ...ok, durationMs: MIN_CLIP_MS }, 200), 'ok');
    assert.equal(clipCheck({ ...ok, bytes: MIN_AUDIO_BYTES - 1 }, 200), 'silent', 'held, but a muted microphone’s silence');
    assert.equal(clipCheck({ durationMs: MIN_CLIP_MS - 1, bytes: 0 }, 200), 'short', 'a tap');
    assert.equal(clipCheck({ durationMs: 0, bytes: 0 }, PROMPT_DELAY_MS + 1), 'prompted', 'the permission question took the press');
    assert.equal(clipCheck({ durationMs: 0, bytes: 0 }, PROMPT_DELAY_MS), 'short');
    assert.equal(clipCheck({ ...ok, bytes: MAX_AUDIO_BYTES + 1 }, 200), 'long');
    assert.equal(clipCheck({ ...ok, bytes: MAX_AUDIO_BYTES }, 200), 'ok');
    // Silence is never sent: Gemini writes words down even from that.
    assert.equal(clipCheck({ ...ok, voicedMs: 0 }, 200), 'silent');
    assert.equal(clipCheck({ ...ok, voicedMs: MIN_VOICED_MS - 100 }, 200), 'silent');
    assert.equal(clipCheck({ ...ok, voicedMs: MIN_VOICED_MS }, 200), 'ok');
    assert.equal(clipCheck({ ...ok, voicedMs: undefined }, 200), 'ok', 'not measured: sent');
});

test('loudness is the root mean square, and speech is well above a quiet room', () => {
    assert.equal(rms([]), 0);
    assert.equal(rms(new Float32Array(480)), 0);
    assert.ok(Math.abs(rms([0.5, -0.5, 0.5, -0.5]) - 0.5) < 1e-9);
    const tone = Float32Array.from({ length: 4800 }, (_, i) => 0.1 * Math.sin((2 * Math.PI * 220 * i) / 48_000));
    assert.ok(rms(tone) > VOICE_RMS, 'a tenth-scale tone, as quiet speech is');
    const hiss = Float32Array.from({ length: 4800 }, (_, i) => 0.002 * Math.sin(i * 12.9898));
    assert.ok(rms(hiss) < VOICE_RMS, 'a quiet room');
});

test('base64 in slices is the same as all at once', () => {
    assert.equal(bytesToBase64(new Uint8Array()), '');
    assert.equal(bytesToBase64(new TextEncoder().encode('hi')), 'aGk=');
    const big = new Uint8Array(100_000).map((_, i) => (i * 31 + 7) % 256);
    assert.equal(bytesToBase64(big), Buffer.from(big).toString('base64'));
});

test('the silent WAV is a well-formed RIFF file of silence', () => {
    const wav = silentWav(100);
    const text = (from: number, to: number) => Buffer.from(wav.subarray(from, to)).toString('latin1');
    assert.equal(text(0, 4), 'RIFF');
    assert.equal(text(8, 12), 'WAVE');
    assert.equal(text(12, 16), 'fmt ');
    assert.equal(text(36, 40), 'data');
    const view = new DataView(wav.buffer);
    assert.equal(wav.length, 44 + 800);
    assert.equal(view.getUint32(4, true), wav.length - 8);
    assert.equal(view.getUint32(40, true), 800);
    assert.ok(wav.subarray(44).every(b => b === 128));
});

test('English is read only by a voice on the device, its default first', () => {
    const v = (lang: string, localService: boolean, isDefault = false) => ({ lang, localService, default: isDefault, name: `${lang}-${localService}` });
    assert.equal(pickEnglishVoice([v('pa-IN', true), v('en-US', false, true), v('en-GB', true)])?.name, 'en-GB-true');
    assert.equal(pickEnglishVoice([v('en-US', true), v('en_GB', true, true)])?.name, 'en_GB-true', 'the default among local ones');
    assert.equal(pickEnglishVoice([v('en-US', false), v('en-IN', false, true)]), null, 'an online voice would send the line elsewhere');
    assert.equal(pickEnglishVoice([v('pa-IN', true), v('hi-IN', true)]), null);
    assert.equal(pickEnglishVoice([v('eng', true)]), null, 'not a language tag for English');
    assert.equal(pickEnglishVoice([]), null);
});

test('a failed call’s code, or what its status means', () => {
    assert.equal(voiceErrorCode(422, { code: 'translate_voice_blocked' }), 'translate_voice_blocked');
    assert.equal(voiceErrorCode(429, { code: 'translate_voice_limit' }), 'translate_voice_limit');
    assert.equal(voiceErrorCode(429, null), 'translate_voice_busy', 'the firewall’s 429');
    assert.equal(voiceErrorCode(503, { code: 'nonsense' }), 'translate_voice_busy');
    assert.equal(voiceErrorCode(413, null), 'translate_voice_too_long', 'the platform’s body cap');
    assert.equal(voiceErrorCode(500, { code: 'chat_failed' }), 'translate_voice_failed');
    assert.equal(voiceErrorCode(0, undefined), 'translate_voice_failed');
});

test('a failed read-aloud’s code, or what its status means', () => {
    assert.equal(speakErrorCode(503, { code: 'speak_unavailable' }), 'speak_unavailable');
    assert.equal(speakErrorCode(429, { code: 'speak_limit' }), 'speak_limit');
    assert.equal(speakErrorCode(429, null), 'speak_busy', 'the firewall’s 429');
    assert.equal(speakErrorCode(503, null), 'speak_unavailable');
    assert.equal(speakErrorCode(400, { code: 'speak_invalid' }), 'speak_failed', 'a code the page never shows');
    assert.equal(speakErrorCode(502, undefined), 'speak_failed');
});

const run = (...events: TalkEvent[]) => events.reduce(talkReducer, EMPTY_TALK as TalkState);
const LINES = { input: 'english', gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', roman: 'Tusi kiven ho?', english: 'How are you?' } as const;
const translating = (s: TalkState) => talkView({ state: s, recorder: 'idle' }).status?.kind === 'translating';

test('a clip sent becomes an exchange that streams, then settles', () => {
    let s = run({ type: 'sent', id: 'a', speaker: 'auto' });
    assert.deepEqual(s.exchanges, [{ id: 'a', speaker: 'auto', lines: {}, status: 'streaming' }]);
    assert.ok(translating(s));
    s = talkReducer(s, { type: 'lines', id: 'a', lines: { input: 'english' } });
    assert.deepEqual(s.exchanges[0].lines, { input: 'english' });
    s = talkReducer(s, { type: 'settled', id: 'a', lines: LINES, how: 'whole' });
    assert.deepEqual(s.exchanges[0], { id: 'a', speaker: 'auto', lines: LINES, status: 'done' });
    assert.ok(!translating(s));
    // A late piece for a reply that has settled changes nothing.
    assert.equal(talkReducer(s, { type: 'lines', id: 'a', lines: {} }), s);
    assert.equal(talkReducer(s, { type: 'lines', id: 'gone', lines: {} }), s);
});

test('nothing heard: the card goes and the note says so', () => {
    const s = run({ type: 'sent', id: 'a', speaker: 'pa' }, { type: 'settled', id: 'a', lines: { input: 'none' }, how: 'whole' });
    assert.deepEqual(s.exchanges, []);
    assert.equal(s.note, 'nothingHeard');
    assert.equal(talkReducer(s, { type: 'pressed' }).note, null, 'until the next press');
});

test('a reply cut short keeps what came; one with nothing fails', () => {
    const cut = run({ type: 'sent', id: 'a', speaker: 'en' }, { type: 'settled', id: 'a', lines: { input: 'english', gurmukhi: 'ਤੁਸੀਂ' }, how: 'cut' });
    assert.equal(cut.exchanges[0].status, 'cut');
    const nothing = run({ type: 'sent', id: 'a', speaker: 'en' }, { type: 'settled', id: 'a', lines: { input: 'english' }, how: 'whole' });
    assert.deepEqual([nothing.exchanges[0].status, nothing.exchanges[0].error], ['failed', 'translate_voice_failed']);
    const cutBare = run({ type: 'sent', id: 'a', speaker: 'en' }, { type: 'settled', id: 'a', lines: {}, how: 'cut' });
    assert.deepEqual([cutBare.exchanges[0].status, cutBare.exchanges[0].error], ['failed', 'translate_voice_failed']);
});

test('a failure keeps its card with the reason; a refusal pauses, and the pause ends', () => {
    const failed = run({ type: 'sent', id: 'a', speaker: 'auto' }, { type: 'failed', id: 'a', code: 'translate_voice_blocked' });
    assert.deepEqual([failed.exchanges[0].status, failed.exchanges[0].error, translating(failed)], ['failed', 'translate_voice_blocked', false]);
    const refused = run({ type: 'sent', id: 'a', speaker: 'auto' }, { type: 'refused', id: 'a', until: 5_000, code: 'translate_voice_limit' });
    assert.deepEqual([refused.exchanges, refused.pause, translating(refused)], [[], { until: 5_000, code: 'translate_voice_limit' }, false]);
    const over = talkReducer(refused, { type: 'pauseOver' });
    assert.equal(over.pause, null);
    assert.equal(talkReducer(over, { type: 'pauseOver' }), over);
});

test('replies overlap: still translating until the last one is in, whichever ends first', () => {
    let s = run(
        { type: 'sent', id: 'a', speaker: 'auto' },
        { type: 'lines', id: 'a', lines: { input: 'english', gurmukhi: 'ਤੁਸੀਂ' } },
        { type: 'sent', id: 'b', speaker: 'auto' },
        { type: 'settled', id: 'b', lines: LINES, how: 'whole' },
    );
    assert.deepEqual(s.exchanges.map(e => [e.id, e.status]), [['a', 'streaming'], ['b', 'done']]);
    assert.ok(translating(s), 'the newer one is done, the older one still coming');
    s = talkReducer(s, { type: 'settled', id: 'a', lines: LINES, how: 'whole' });
    assert.ok(!translating(s));
});

test('the conversation keeps its last MAX_EXCHANGES exchanges', () => {
    let s: TalkState = EMPTY_TALK;
    for (let i = 0; i < MAX_EXCHANGES + 5; i++) s = talkReducer(s, { type: 'sent', id: String(i), speaker: 'auto' });
    assert.equal(s.exchanges.length, MAX_EXCHANGES);
    assert.equal(s.exchanges[0].id, '5');
});

test('a new conversation empties the thread, and a pause still holds', () => {
    const s = run(
        { type: 'sent', id: 'a', speaker: 'auto' },
        { type: 'settled', id: 'a', lines: LINES, how: 'whole' },
        { type: 'note', note: 'tooShort' },
        { type: 'sent', id: 'b', speaker: 'auto' },
        { type: 'refused', id: 'b', until: 9_000, code: 'translate_voice_busy' },
        { type: 'cleared' },
    );
    assert.deepEqual(s, { ...EMPTY_TALK, pause: { until: 9_000, code: 'translate_voice_busy' } });
    // A reply that comes after the clear has no card to fill.
    assert.equal(talkReducer(s, { type: 'lines', id: 'a', lines: LINES }), s);
});

test('what the button and its line show, in order of what matters', () => {
    const view = (state: Partial<TalkState>, recorder: Parameters<typeof talkView>[0]['recorder'] = 'idle') =>
        talkView({ state: { ...EMPTY_TALK, ...state }, recorder });
    assert.deepEqual(view({}, 'unsupported'), { button: 'unavailable', status: { kind: 'note', note: 'unsupported' } });
    assert.deepEqual(view({}, 'insecure'), { button: 'unavailable', status: { kind: 'note', note: 'insecure' } });
    const streaming = [{ id: 'a', speaker: 'auto', lines: {}, status: 'streaming' }] as const;
    assert.deepEqual(view({ exchanges: streaming }, 'recording'), { button: 'listening', status: null });
    assert.deepEqual(view({}, 'starting'), { button: 'starting', status: null });
    assert.deepEqual(view({ pause: { until: 2_000, code: 'translate_voice_limit' }, note: 'tooShort' }), { button: 'paused', status: { kind: 'paused', code: 'translate_voice_limit' } });
    assert.deepEqual(view({ pause: null, note: 'tooShort' }), { button: 'hold', status: { kind: 'note', note: 'tooShort' } }, 'a pause that is over');
    assert.deepEqual(view({ note: 'denied', exchanges: streaming }), { button: 'hold', status: { kind: 'note', note: 'denied' } });
    assert.deepEqual(view({ exchanges: streaming }), { button: 'hold', status: { kind: 'translating' } });
    assert.deepEqual(view({}), { button: 'hold', status: null });
    assert.deepEqual(view({}, 'unknown'), { button: 'hold', status: null }, 'before the page knows, as the server drew it');
});
