// Client-safe rules for the Talk page (/translate/talk, #37): what a press
// of the button may record, what the conversation holds, and what the page
// shows. The hooks in app/components/translate (useRecorder,
// useVoiceTranslate, useSpeaker) and TalkScreen do the browser's part; the
// contract with the routes is ./voice.ts.

import { LIVE_FIELDS, type LiveLines } from './live';
import { MAX_AUDIO_BYTES, MIN_AUDIO_BYTES, MIN_CLIP_MS, RECORDING_MIMES, type Speaker } from './voice';

// ── Recording ───────────────────────────────────────────────────────────────

// Why the microphone can't be used: the visitor said no, there is none, an
// app holds it, the browser can't record (or the page isn't https), or
// something else went wrong.
export type MicTrouble = 'denied' | 'unavailable' | 'busy' | 'unsupported' | 'insecure' | 'failed';

// The first type MediaRecorder takes, from RECORDING_MIMES; '' lets the
// browser choose, as when it can't say (an old Safari has no isTypeSupported).
export function pickRecordingMime(isTypeSupported: ((type: string) => boolean) | undefined): string {
    for (const type of RECORDING_MIMES) {
        if (type === '') return '';
        try {
            if (isTypeSupported?.(type)) return type;
        } catch {
            return '';
        }
    }
    return '';
}

// What getUserMedia's or MediaRecorder's error means for the visitor.
export function micTrouble(error: unknown): MicTrouble {
    const name = typeof (error as { name?: unknown } | null)?.name === 'string' ? (error as { name: string }).name : '';
    switch (name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
        case 'SecurityError':
            return 'denied';
        case 'NotFoundError':
        case 'DevicesNotFoundError':
        case 'OverconstrainedError':
            return 'unavailable';
        case 'NotReadableError':
        case 'TrackStartError':
        case 'AbortError':
            return 'busy';
        case 'NotSupportedError':
            return 'unsupported';
        default:
            return 'failed';
    }
}

// A press that took longer than this to start recording had the browser's
// "allow the microphone?" question in it, which takes the press away.
export const PROMPT_DELAY_MS = 1_500;

// Whether a finished clip is worth sending: too short (a tap, or a press the
// permission question cut off), too big, or fine.
export type ClipCheck = 'ok' | 'short' | 'prompted' | 'long';

export function clipCheck(clip: { durationMs: number; bytes: number }, startDelayMs: number): ClipCheck {
    if (clip.bytes > MAX_AUDIO_BYTES) return 'long';
    if (clip.durationMs < MIN_CLIP_MS || clip.bytes < MIN_AUDIO_BYTES) return startDelayMs > PROMPT_DELAY_MS ? 'prompted' : 'short';
    return 'ok';
}

// Base64 for a clip's bytes, in slices, since one call with a few hundred
// thousand arguments is past what some browsers take.
export function bytesToBase64(bytes: Uint8Array): string {
    const SLICE = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += SLICE) binary += String.fromCharCode(...bytes.subarray(i, i + SLICE));
    return btoa(binary);
}

// A moment of silence as a WAV file: played inside the press, it lets the
// page play the translation once it comes (iOS plays an <audio> element
// only after one play() in a gesture). 8 kHz, 8-bit, mono, where silence is
// the midpoint, 128.
export function silentWav(ms = 50, sampleRate = 8_000): Uint8Array<ArrayBuffer> {
    const samples = Math.round((sampleRate * ms) / 1000);
    const bytes = new Uint8Array(44 + samples);
    const view = new DataView(bytes.buffer);
    const ascii = (at: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); };
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);       // the fmt chunk's size
    view.setUint16(20, 1, true);        // PCM
    view.setUint16(22, 1, true);        // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true); // bytes a second: one a sample
    view.setUint16(32, 1, true);        // bytes a frame
    view.setUint16(34, 8, true);        // bits a sample
    ascii(36, 'data');
    view.setUint32(40, samples, true);
    bytes.fill(128, 44);
    return bytes;
}

// The device's English voice for speechSynthesis: one on the device first
// (it works offline and starts at once), then the device's default, then any.
export function pickEnglishVoice<V extends { lang: string; localService: boolean; default: boolean }>(voices: readonly V[]): V | null {
    const english = voices.filter(v => /^en(?:[-_]|$)/i.test(v.lang));
    return english.find(v => v.localService && v.default)
        ?? english.find(v => v.localService)
        ?? english.find(v => v.default)
        ?? english[0]
        ?? null;
}

// ── The conversation ────────────────────────────────────────────────────────

// The voice route's error codes (app/api/translate/voice), each worded in
// the dictionaries' errors.
export const VOICE_ERROR_CODES = [
    'translate_voice_empty', 'translate_voice_too_long', 'translate_voice_bad_audio', 'translate_voice_failed',
    'translate_voice_busy', 'translate_voice_limit', 'translate_voice_blocked',
] as const;
export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[number];

// The code a failed call answered with, or what its status means: the
// firewall's 429 and a 503 have no code of the route's.
export function voiceErrorCode(status: number, body: unknown): VoiceErrorCode {
    const code = (body as { code?: unknown } | null)?.code;
    if (VOICE_ERROR_CODES.includes(code as VoiceErrorCode)) return code as VoiceErrorCode;
    if (status === 429 || status === 503) return 'translate_voice_busy';
    if (status === 413) return 'translate_voice_too_long';
    return 'translate_voice_failed';
}

// The read-aloud route's codes the page shows (app/api/translate/speak),
// each worded in the dictionaries' errors.
export const SPEAK_ERROR_CODES = ['speak_unavailable', 'speak_failed', 'speak_busy', 'speak_limit'] as const;
export type SpeakErrorCode = (typeof SPEAK_ERROR_CODES)[number];

export function speakErrorCode(status: number, body: unknown): SpeakErrorCode {
    const code = (body as { code?: unknown } | null)?.code;
    if (SPEAK_ERROR_CODES.includes(code as SpeakErrorCode)) return code as SpeakErrorCode;
    if (status === 429) return 'speak_busy';
    if (status === 503) return 'speak_unavailable';
    return 'speak_failed';
}

// What the page says beside the button until the next press.
export type TalkNote = MicTrouble | 'tooShort' | 'tooLong' | 'micReady' | 'interrupted' | 'nothingHeard';

// One clip and its reply. Nothing here outlives the page.
export type Exchange = {
    id: string;
    speaker: Speaker;            // the chip when it was recorded
    lines: LiveLines;            // the reply so far
    status: 'streaming' | 'done' | 'cut' | 'failed';
    error?: VoiceErrorCode;      // why it failed
};

export type TalkState = {
    exchanges: readonly Exchange[]; // oldest first
    busy: string | null;            // the exchange whose reply is coming
    pausedUntil: number;            // no clips before this (epoch ms), after a 429; 0 once over
    pauseCode: VoiceErrorCode | null;
    note: TalkNote | null;
};

export const EMPTY_TALK: TalkState = Object.freeze({ exchanges: Object.freeze([]), busy: null, pausedUntil: 0, pauseCode: null, note: null });

// A long conversation keeps its last 50 exchanges.
export const MAX_EXCHANGES = 50;

export type TalkEvent =
    | { type: 'pressed' }
    | { type: 'note'; note: TalkNote }
    | { type: 'sent'; id: string; speaker: Speaker }
    | { type: 'lines'; id: string; lines: LiveLines }
    // The reply ended: whole, cut short (an error mid-stream), or abandoned
    // for a newer clip or a page left behind.
    | { type: 'settled'; id: string; lines: LiveLines; how: 'whole' | 'cut' | 'aborted' }
    | { type: 'failed'; id: string; code: VoiceErrorCode }
    | { type: 'refused'; id: string; until: number; code: VoiceErrorCode }
    | { type: 'pauseOver' }
    // A new conversation: the thread empties, and a pause still holds.
    | { type: 'cleared' };

const anything = (lines: LiveLines) => LIVE_FIELDS.some(f => lines[f]);

function replace(state: TalkState, id: string, change: (e: Exchange) => Exchange | null): TalkState {
    const exchanges: Exchange[] = [];
    for (const e of state.exchanges) {
        if (e.id !== id) exchanges.push(e);
        else {
            const next = change(e);
            if (next) exchanges.push(next);
        }
    }
    return { ...state, exchanges, busy: state.busy === id ? null : state.busy };
}

export function talkReducer(state: TalkState, event: TalkEvent): TalkState {
    switch (event.type) {
        case 'pressed':
            return state.note === null ? state : { ...state, note: null };
        case 'note':
            return { ...state, note: event.note };
        case 'sent': {
            const exchanges = [...state.exchanges, { id: event.id, speaker: event.speaker, lines: {}, status: 'streaming' as const }];
            return { ...state, exchanges: exchanges.slice(-MAX_EXCHANGES), busy: event.id, note: null };
        }
        case 'lines': {
            // A late piece for a reply already settled or gone changes nothing.
            const current = state.exchanges.find(e => e.id === event.id);
            if (current?.status !== 'streaming') return state;
            return { ...state, exchanges: state.exchanges.map(e => (e === current ? { ...e, lines: event.lines } : e)) };
        }
        case 'settled': {
            const current = state.exchanges.find(e => e.id === event.id);
            if (current?.status !== 'streaming') return state;
            const { lines, how } = event;
            if (how === 'whole' && lines.input === 'none') {
                return { ...replace(state, event.id, () => null), note: 'nothingHeard' };
            }
            return replace(state, event.id, e => {
                if (anything(lines)) return { ...e, lines, status: how === 'whole' ? 'done' : 'cut' };
                // Abandoned before a word came: nothing to keep.
                if (how === 'aborted') return null;
                return { ...e, lines, status: 'failed', error: 'translate_voice_failed' };
            });
        }
        case 'failed': {
            const current = state.exchanges.find(e => e.id === event.id);
            if (current?.status !== 'streaming') return state;
            return replace(state, event.id, e => ({ ...e, status: 'failed', error: event.code }));
        }
        case 'refused':
            // Not heard at all: the card goes, and the pause says why.
            return { ...replace(state, event.id, () => null), pausedUntil: event.until, pauseCode: event.code };
        case 'pauseOver':
            return state.pausedUntil === 0 && state.pauseCode === null ? state : { ...state, pausedUntil: 0, pauseCode: null };
        case 'cleared':
            return { ...EMPTY_TALK, pausedUntil: state.pausedUntil, pauseCode: state.pauseCode };
    }
}

// ── What the page shows ─────────────────────────────────────────────────────

export type RecorderStatus = 'unknown' | 'unsupported' | 'insecure' | 'idle' | 'starting' | 'recording';

export type TalkView = {
    // The button: ready to hold, getting the microphone, listening, waiting
    // out a refusal, or unable to record at all.
    button: 'hold' | 'starting' | 'listening' | 'paused' | 'unavailable';
    // The line beside it.
    status:
        | { kind: 'note'; note: TalkNote }
        | { kind: 'paused'; code: VoiceErrorCode }
        | { kind: 'listening' }
        | { kind: 'translating' }
        | null;
};

// A pause holds until pauseOver clears it (TalkScreen sets a timer for its
// end), so drawing the page never reads the clock.
export function talkView({ state, recorder }: { state: TalkState; recorder: RecorderStatus }): TalkView {
    if (recorder === 'unsupported' || recorder === 'insecure') return { button: 'unavailable', status: { kind: 'note', note: recorder } };
    if (recorder === 'recording') return { button: 'listening', status: { kind: 'listening' } };
    if (recorder === 'starting') return { button: 'starting', status: null };
    if (state.pausedUntil > 0) return { button: 'paused', status: { kind: 'paused', code: state.pauseCode ?? 'translate_voice_busy' } };
    if (state.note) return { button: 'hold', status: { kind: 'note', note: state.note } };
    if (state.busy) return { button: 'hold', status: { kind: 'translating' } };
    return { button: 'hold', status: null };
}
