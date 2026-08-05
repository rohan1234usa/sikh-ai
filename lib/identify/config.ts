// Client-safe configuration for Shabad identification: IDs, whitelist guards,
// recording/upload caps, and the shape of the result the API returns. Display
// strings live in the i18n dictionaries (lib/i18n/dictionaries/*) keyed by
// these IDs; prompt text is server-only in lib/identify/prompts.ts.

// How the request ended. Only transport and validation problems are errors —
// "we listened and it wasn't Gurbani" is a successful negative finding, so it
// travels as a 200 with a status the UI can speak to.
export const IDENTIFY_STATUSES = [
    'matched',            // at least one candidate cleared the score floor
    'no_match',           // transcribed fine, nothing in Gurbani scored well enough
    'no_speech',          // silence, music with no voice, or an empty transcript
    'not_gurbani',        // speech, but not Punjabi scripture (English chatter etc.)
    'search_unavailable', // transcription succeeded, the Gurbani source did not answer
] as const;
export type IdentifyStatus = (typeof IDENTIFY_STATUSES)[number];

// One scale reused for line-level transcription quality and match confidence.
export const LEVELS = ['high', 'medium', 'low'] as const;
export type Level = (typeof LEVELS)[number];

// What the cleanup model thinks the clip contains. Drives the early exits.
export const AUDIO_KINDS = ['gurbani', 'other-speech', 'no-vocals', 'unclear'] as const;
export type AudioKind = (typeof AUDIO_KINDS)[number];

export type HeardLine = {
    gurmukhi: string;
    roman: string;      // '' when the cleanup pass was skipped — the UI omits the row
    confidence: Level;
};

export type Transcription = {
    lines: HeardLine[];
    overall: Level;
};

// A verse of the matched Shabad, copied verbatim from the Gurbani source.
export type MatchVerse = {
    gurmukhi: string;
    transliteration: string;
    translation: string;
};

export type ShabadMatch = {
    shabadId: string;
    score: number;        // 0..1, two decimals; ordering + debugging, never displayed raw
    confidence: Level;
    // Set when this line also appears, near-identically, in other Shabads — a
    // refrain the audio alone cannot disambiguate. The UI says so rather than
    // pretending to have picked one.
    ambiguous: boolean;
    matchedLines: number; // how many distinct heard lines corroborate this Shabad
    verse: MatchVerse;    // the best-matching line
    ang: number | null;   // null hides the Ang deep links on the card
    lineNo: number | null;
    source: string;
    writer: string;
    raag: string;
    // Whole-Shabad text, attached to the top match when the verification fetch
    // succeeded. Optional so results already in localStorage keep deserializing.
    fullShabad?: MatchVerse[];
};

export type IdentifyResult = {
    status: IdentifyStatus;
    heard: Transcription | null; // null only when there was nothing to hear
    matches: ShabadMatch[];      // empty unless status === 'matched'
};

// --- Recording and upload caps -------------------------------------------
// Shared by the recorder (enforcement at the source) and the API route
// (authoritative — a hand-rolled request never reaches the model unchecked).

// Long enough for two or three tuks, short enough that a mis-tap costs little.
export const MAX_RECORD_MS = 20_000;
// Below this a clip is almost always an accidental tap; one line of kirtan
// rarely fits in less.
export const MIN_RECORD_MS = 3_000;
// 20s of Opus is ~40 KB; the cap is generous headroom for browsers that record
// at a much higher bitrate, and still far under Vercel's 4.5 MB body limit.
export const MAX_AUDIO_BYTES = 4_000_000;

// What the recorder may produce across browsers (Chrome/Firefox: webm/opus,
// Safari: mp4/aac) plus the plain formats a scripted client might send. The
// transcription API accepts all of them, so no client-side re-encoding is
// needed — the container travels as recorded.
export const ALLOWED_AUDIO_MIME = [
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-m4a',
    'audio/aac',
    'audio/flac',
] as const;

// Browsers append codec parameters ("audio/webm;codecs=opus"); compare on the
// bare type.
export function isAllowedAudioMime(mime: unknown): boolean {
    if (typeof mime !== 'string') return false;
    const base = mime.split(';')[0].trim().toLowerCase();
    return (ALLOWED_AUDIO_MIME as readonly string[]).includes(base);
}

// Four is what fits on a phone screen without scrolling past the top result,
// and past that the tail is noise anyway.
export const MAX_MATCHES = 4;

export const isIdentifyStatus = (v: unknown): v is IdentifyStatus =>
    IDENTIFY_STATUSES.includes(v as IdentifyStatus);
export const isLevel = (v: unknown): v is Level =>
    LEVELS.includes(v as Level);
export const isAudioKind = (v: unknown): v is AudioKind =>
    AUDIO_KINDS.includes(v as AudioKind);
