// Client-safe translator configuration: IDs, whitelist guards, size caps,
// and the shape of the structured translation result. Display strings live
// in the i18n dictionaries (lib/i18n/dictionaries/*) keyed by these IDs;
// system-prompt text is server-only in lib/translate/prompts.ts.

export const DETECTED_INPUTS = ['english', 'punjabi-gurmukhi', 'punjabi-latin'] as const;
export type DetectedInput = (typeof DETECTED_INPUTS)[number];

// What the user claims the input is. 'auto' (the default chip) lets the
// server heuristic and the model decide; explicit values override.
export const SOURCE_HINTS = ['auto', ...DETECTED_INPUTS] as const;
export type SourceHint = (typeof SOURCE_HINTS)[number];

export const NOTE_KINDS = ['idiom', 'grammar', 'honorific', 'culture', 'false-friend', 'other'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export type WordGloss = {
    source: string;   // the unit exactly as it appears in the user's input
    gurmukhi: string;
    roman: string;
    meaning: string;  // a few words of English, not a sentence
};

export type TranslationNote = {
    kind: NoteKind;
    title: string;
    body: string;
};

export type PronunciationTip = {
    gurmukhi: string; // anchor word taken from the translation
    roman: string;
    tip: string;
};

export type TranslationResult = {
    detectedInput: DetectedInput; // the model's conclusion (echoes an explicit hint)
    gurmukhi: string;             // full text in Gurmukhi script
    roman: string;                // full text in learner romanization
    english: string;              // full text in English
    words: WordGloss[];
    notes: TranslationNote[];          // empty when nothing is genuinely tricky
    pronunciation: PronunciationTip[]; // empty when nothing is hard to say
};

// Size cap shared by the API route (authoritative) and the client (courtesy
// pre-check before sending). Deliberately lower than the chat cap: this is a
// phrase/paragraph tool, and the cap also bounds the structured output the
// word-by-word gloss implies.
export const MAX_TRANSLATE_CHARS = 1000;

export const isDetectedInput = (v: unknown): v is DetectedInput =>
    DETECTED_INPUTS.includes(v as DetectedInput);
export const isSourceHint = (v: unknown): v is SourceHint =>
    SOURCE_HINTS.includes(v as SourceHint);
export const isNoteKind = (v: unknown): v is NoteKind =>
    NOTE_KINDS.includes(v as NoteKind);
