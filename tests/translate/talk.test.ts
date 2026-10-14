import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    EMPTY_TALK,
    MAX_EXCHANGES,
    PROMPT_DELAY_MS,
    bytesToBase64,
    clipCheck,
    micTrouble,
    pickEnglishVoice,
    pickRecordingMime,
    silentWav,
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
});

test('a clip is sent only when it holds something, and fits', () => {
    const ok = { durationMs: 2_000, bytes: 30_000 };
    assert.equal(clipCheck(ok, 200), 'ok');
    assert.equal(clipCheck({ ...ok, durationMs: MIN_CLIP_MS - 1 }, 200), 'short');
    assert.equal(clipCheck({ ...ok, durationMs: MIN_CLIP_MS }, 200), 'ok');
    assert.equal(clipCheck({ ...ok, bytes: MIN_AUDIO_BYTES - 1 }, 200), 'short', 'a header and no speech');
    assert.equal(clipCheck({ durationMs: 0, bytes: 0 }, PROMPT_DELAY_MS + 1), 'prompted', 'the permission question took the press');
    assert.equal(clipCheck({ durationMs: 0, bytes: 0 }, PROMPT_DELAY_MS), 'short');
    assert.equal(clipCheck({ ...ok, bytes: MAX_AUDIO_BYTES + 1 }, 200), 'long');
    assert.equal(clipCheck({ ...ok, bytes: MAX_AUDIO_BYTES }, 200), 'ok');
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

test('English is read by a voice on the device first', () => {
    const v = (lang: string, localService: boolean, isDefault = false) => ({ lang, localService, default: isDefault, name: `${lang}-${localService}` });
    assert.equal(pickEnglishVoice([v('pa-IN', true), v('en-US', false, true), v('en-GB', true)])?.name, 'en-GB-true');
    assert.equal(pickEnglishVoice([v('en-US', true), v('en_GB', true, true)])?.name, 'en_GB-true', 'the default among local ones');
    assert.equal(pickEnglishVoice([v('en-US', false), v('en-IN', false, true)])?.name, 'en-IN-false');
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

const run = (...events: TalkEvent[]) => events.reduce(talkReducer, EMPTY_TALK as TalkState);
const LINES = { input: 'english', gurmukhi: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', roman: 'Tusi kiven ho?', english: 'How are you?' } as const;

test('a clip sent becomes an exchange that streams, then settles', () => {
    let s = run({ type: 'sent', id: 'a', speaker: 'auto' });
    assert.deepEqual(s.exchanges, [{ id: 'a', speaker: 'auto', lines: {}, status: 'streaming' }]);
    assert.equal(s.busy, 'a');
    s = talkReducer(s, { type: 'lines', id: 'a', lines: { input: 'english' } });
    assert.deepEqual(s.exchanges[0].lines, { input: 'english' });
    s = talkReducer(s, { type: 'settled', id: 'a', lines: LINES, how: 'whole' });
    assert.deepEqual(s.exchanges[0], { id: 'a', speaker: 'auto', lines: LINES, status: 'done' });
    assert.equal(s.busy, null);
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

test('a reply cut short keeps what came; one with nothing fails; one abandoned with nothing goes', () => {
    const cut = run({ type: 'sent', id: 'a', speaker: 'en' }, { type: 'settled', id: 'a', lines: { input: 'english', gurmukhi: 'ਤੁਸੀਂ' }, how: 'cut' });
    assert.equal(cut.exchanges[0].status, 'cut');
    const nothing = run({ type: 'sent', id: 'a', speaker: 'en' }, { type: 'settled', id: 'a', lines: { input: 'english' }, how: 'whole' });
    assert.deepEqual([nothing.exchanges[0].status, nothing.exchanges[0].error], ['failed', 'translate_voice_failed']);
    const abandoned = run({ type: 'sent', id: 'a', speaker: 'en' }, { type: 'settled', id: 'a', lines: {}, how: 'aborted' });
    assert.deepEqual(abandoned.exchanges, []);
    const abandonedLate = run({ type: 'sent', id: 'a', speaker: 'en' }, { type: 'settled', id: 'a', lines: { english: 'How' }, how: 'aborted' });
    assert.equal(abandonedLate.exchanges[0].status, 'cut');
});

test('a failure keeps its card with the reason; a refusal pauses, and the pause ends', () => {
    const failed = run({ type: 'sent', id: 'a', speaker: 'auto' }, { type: 'failed', id: 'a', code: 'translate_voice_blocked' });
    assert.deepEqual([failed.exchanges[0].status, failed.exchanges[0].error, failed.busy], ['failed', 'translate_voice_blocked', null]);
    const refused = run({ type: 'sent', id: 'a', speaker: 'auto' }, { type: 'refused', id: 'a', until: 5_000, code: 'translate_voice_limit' });
    assert.deepEqual([refused.exchanges, refused.pausedUntil, refused.pauseCode, refused.busy], [[], 5_000, 'translate_voice_limit', null]);
    const over = talkReducer(refused, { type: 'pauseOver' });
    assert.deepEqual([over.pausedUntil, over.pauseCode], [0, null]);
    assert.equal(talkReducer(over, { type: 'pauseOver' }), over);
});

test('a newer clip while one streams: both cards stay, the newer is the busy one', () => {
    const s = run(
        { type: 'sent', id: 'a', speaker: 'auto' },
        { type: 'lines', id: 'a', lines: { input: 'english', gurmukhi: 'ਤੁਸੀਂ' } },
        { type: 'sent', id: 'b', speaker: 'auto' },
        { type: 'settled', id: 'a', lines: { input: 'english', gurmukhi: 'ਤੁਸੀਂ' }, how: 'aborted' },
    );
    assert.deepEqual(s.exchanges.map(e => [e.id, e.status]), [['a', 'cut'], ['b', 'streaming']]);
    assert.equal(s.busy, 'b', 'settling the older one leaves the newer busy');
});

test('the conversation keeps its last MAX_EXCHANGES exchanges', () => {
    let s: TalkState = EMPTY_TALK;
    for (let i = 0; i < MAX_EXCHANGES + 5; i++) s = talkReducer(s, { type: 'sent', id: String(i), speaker: 'auto' });
    assert.equal(s.exchanges.length, MAX_EXCHANGES);
    assert.equal(s.exchanges[0].id, '5');
});

test('what the button and its line show, in order of what matters', () => {
    const view = (state: Partial<TalkState>, recorder: Parameters<typeof talkView>[0]['recorder'] = 'idle', now = 1_000) =>
        talkView({ state: { ...EMPTY_TALK, ...state }, recorder, now });
    assert.deepEqual(view({}, 'unsupported'), { button: 'unavailable', status: { kind: 'note', note: 'unsupported' } });
    assert.deepEqual(view({}, 'insecure'), { button: 'unavailable', status: { kind: 'note', note: 'insecure' } });
    assert.deepEqual(view({ busy: 'a' }, 'recording'), { button: 'listening', status: { kind: 'listening' } });
    assert.deepEqual(view({}, 'starting'), { button: 'starting', status: null });
    assert.deepEqual(view({ pausedUntil: 2_000, pauseCode: 'translate_voice_limit', note: 'tooShort' }), { button: 'paused', status: { kind: 'paused', code: 'translate_voice_limit' } });
    assert.deepEqual(view({ pausedUntil: 1_000, note: 'tooShort' }), { button: 'hold', status: { kind: 'note', note: 'tooShort' } }, 'a pause that is over');
    assert.deepEqual(view({ note: 'denied', busy: 'a' }), { button: 'hold', status: { kind: 'note', note: 'denied' } });
    assert.deepEqual(view({ busy: 'a' }), { button: 'hold', status: { kind: 'translating' } });
    assert.deepEqual(view({}), { button: 'hold', status: null });
    assert.deepEqual(view({}, 'unknown'), { button: 'hold', status: null }, 'before the page knows, as the server drew it');
});
