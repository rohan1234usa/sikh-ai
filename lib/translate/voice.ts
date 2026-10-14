// Client-safe rules for Talk (/translate/talk, #37): the contract between the
// page, which records a clip and reads a translation aloud, and the two routes
// it calls. /api/translate/voice hears the clip and streams the live
// translator's four lines (./live.ts reads them); /api/translate/speak turns
// a line into speech. The prompt is server-only, in ./prompts.ts; the page's
// own state is in ./talk.ts.

import type { DetectedInput } from './config';
import { detectScript } from './detect';
import type { LiveField, LiveInput, LiveLines } from './live';

// A clip is at most this long: the page stops recording here, so a
// microphone left on by mistake doesn't keep listening. Fifteen seconds is a
// few sentences, a conversation's turn.
export const MAX_CLIP_MS = 15_000;
// Shorter is a tap on the button, not something said.
export const MIN_CLIP_MS = 500;

// Fifteen seconds of what any browser records (Opus or AAC, at most about
// 128 kbit/s) is under 300 KB, so 1 MiB is room to spare, and far under
// Vercel's 4.5 MB body cap once base64 adds a third.
export const MAX_AUDIO_BYTES = 1_048_576;
// A WebM or Ogg header alone is a few hundred bytes: under a kilobyte holds
// no speech.
export const MIN_AUDIO_BYTES = 1_000;
// The longest base64 a clip of MAX_AUDIO_BYTES can be.
export const MAX_AUDIO_BASE64_CHARS = 4 * Math.ceil(MAX_AUDIO_BYTES / 3);

// Who is speaking, from the chips under the thread: Auto lets Gemini decide.
export const SPEAKERS = ['auto', 'pa', 'en'] as const;
export type Speaker = (typeof SPEAKERS)[number];
export const isSpeaker = (v: unknown): v is Speaker => SPEAKERS.includes(v as Speaker);

// What the page asks MediaRecorder for, best first: Chrome, Edge and
// Firefox record Opus in WebM, older Firefox in Ogg, Safari AAC in MP4. ''
// lets the browser choose when it takes none of them.
export const RECORDING_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', ''] as const;

// A media type without its parameters, lower-cased:
// 'audio/webm;codecs=opus' is 'audio/webm'.
export function baseMime(type: string): string {
    return type.split(';')[0].trim().toLowerCase();
}

// The containers browsers record in, and what Gemini is told each is. All of
// them are on Gemini's list of audio it hears
// (ai.google.dev/gemini-api/docs/audio, checked 2026-10-13).
const AUDIO_MIMES: Readonly<Record<string, string>> = {
    'audio/webm': 'audio/webm',
    'audio/ogg': 'audio/ogg',
    'audio/opus': 'audio/opus',
    'audio/mp4': 'audio/mp4',
    'audio/m4a': 'audio/m4a',
    'audio/x-m4a': 'audio/m4a',
    'audio/aac': 'audio/aac',
    'audio/mpeg': 'audio/mpeg',
    'audio/wav': 'audio/wav',
    'audio/flac': 'audio/flac',
};

// The type to send Gemini for a clip the page says it recorded as `header`,
// or null when it isn't audio Gemini hears.
export function audioMimeFor(header: unknown): string | null {
    if (typeof header !== 'string') return null;
    return AUDIO_MIMES[baseMime(header)] ?? null;
}

// Standard base64, as the page sends it: padded, never base64url.
export function isBase64(s: string): boolean {
    return s.length > 0 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

// How many bytes a base64 string holds, without decoding it.
export function base64Bytes(s: string): number {
    return (s.length / 4) * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);
}

// What the INPUT line should say for a chip: a chip for Punjabi or English
// is the page's word, Auto waits for Gemini's.
export function expectedInput(speaker: Speaker): DetectedInput | undefined {
    return speaker === 'pa' ? 'punjabi-gurmukhi' : speaker === 'en' ? 'english' : undefined;
}

// Which of the four lines are what was heard, and which the translation.
// Punjabi speech: Gurmukhi and the romanization are what was said, English
// the translation; English speech the other way round. Nothing when the clip
// held no speech, or before the INPUT line has said which.
export type VoiceRoles = { from: 'pa' | 'en'; heard: readonly LiveField[]; said: readonly LiveField[] };

export function voiceRoles(input: LiveInput | undefined): VoiceRoles | null {
    if (input === 'english') return { from: 'en', heard: ['english'], said: ['gurmukhi', 'roman'] };
    if (input === 'punjabi-gurmukhi' || input === 'punjabi-latin') return { from: 'pa', heard: ['gurmukhi', 'roman'], said: ['english'] };
    return null;
}

// What /api/translate/speak reads aloud: Punjabi in Gurmukhi (a pa-IN voice
// reads the script, not the romanization), or English.
export const SPEAK_LANGS = ['pa', 'en'] as const;
export type SpeakLang = (typeof SPEAK_LANGS)[number];
export const isSpeakLang = (v: unknown): v is SpeakLang => SPEAK_LANGS.includes(v as SpeakLang);

// The most a line read aloud may be. Cloud Text-to-Speech takes 5,000 bytes
// a request, and each Gurmukhi letter is 3 in UTF-8; a fifteen-second clip's
// translation is half this.
export const MAX_SPEAK_CHARS = 400;

// Whether a text can be read in a language: a Punjabi voice reads Gurmukhi
// only, and would make nonsense of romanized text bought for nothing.
export function speakable(text: string, lang: SpeakLang): boolean {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_SPEAK_CHARS) return false;
    return lang === 'en' || detectScript(trimmed) === 'gurmukhi';
}

// At most `max` UTF-16 units, never half a surrogate pair (as
// lib/learn/tutor.ts caps the tutor's text).
export function capText(text: string, max = MAX_SPEAK_CHARS): string {
    const trimmed = text.trim();
    if (trimmed.length <= max) return trimmed;
    const last = trimmed.charCodeAt(max - 1);
    return trimmed.slice(0, last >= 0xd800 && last <= 0xdbff ? max - 1 : max).trimEnd();
}

// The translation to read aloud, once its line is whole: for English speech
// the Gurmukhi line, whole as soon as the ROMAN line has started (the reply
// keeps this order), so speech starts before the rest has streamed; for
// Punjabi speech the English line, the last, whole only when the reply is.
// null while it isn't whole yet, or when there's nothing to read.
export type SpeechPlan = { text: string; lang: SpeakLang };

export function speechReady(lines: LiveLines, speaker: Speaker, done: boolean): SpeechPlan | null {
    const roles = voiceRoles(lines.input ?? expectedInput(speaker));
    if (!roles) return null;
    if (roles.from === 'en') {
        if (!done && lines.roman === undefined) return null;
        const text = capText(lines.gurmukhi ?? '');
        return text ? { text, lang: 'pa' } : null;
    }
    if (!done) return null;
    const text = capText(lines.english ?? '');
    return text ? { text, lang: 'en' } : null;
}
