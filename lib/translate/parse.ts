// Runtime validation of the model's JSON output. responseSchema constrains
// decoding, but we never trust it alone — same whitelist-and-fallback posture
// as the chat route. Returns null only when the result is unusable (the route
// maps that to a translate_failed error); malformed list entries are dropped
// rather than failing the whole translation.

import {
    isDetectedInput,
    isNoteKind,
    type DetectedInput,
    type PronunciationTip,
    type TranslationNote,
    type TranslationResult,
    type WordGloss,
} from './config';

const MAX_WORDS = 40;
const MAX_NOTES = 6;
const MAX_TIPS = 6;

function str(v: unknown): string | null {
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function toWordGloss(v: unknown): WordGloss | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const source = str(o.source);
    const gurmukhi = str(o.gurmukhi);
    const roman = str(o.roman);
    const meaning = str(o.meaning);
    return source && gurmukhi && roman && meaning
        ? { source, gurmukhi, roman, meaning }
        : null;
}

function toNote(v: unknown): TranslationNote | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const title = str(o.title);
    const body = str(o.body);
    if (!title || !body) return null;
    return { kind: isNoteKind(o.kind) ? o.kind : 'other', title, body };
}

function toTip(v: unknown): PronunciationTip | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const gurmukhi = str(o.gurmukhi);
    const roman = str(o.roman);
    const tip = str(o.tip);
    return gurmukhi && roman && tip ? { gurmukhi, roman, tip } : null;
}

function mapList<T>(v: unknown, convert: (item: unknown) => T | null, max: number): T[] {
    return (Array.isArray(v) ? v : [])
        .map(convert)
        .filter((item): item is T => item !== null)
        .slice(0, max);
}

export function parseTranslationResult(
    raw: string,
    fallbackDetected: DetectedInput,
): TranslationResult | null {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;

    // The three renditions are the product; without all of them the result is
    // unusable. Everything else degrades gracefully.
    const gurmukhi = str(d.gurmukhi);
    const roman = str(d.roman);
    const english = str(d.english);
    if (!gurmukhi || !roman || !english) return null;

    return {
        detectedInput: isDetectedInput(d.detectedInput) ? d.detectedInput : fallbackDetected,
        gurmukhi,
        roman,
        english,
        words: mapList(d.words, toWordGloss, MAX_WORDS),
        notes: mapList(d.notes, toNote, MAX_NOTES),
        pronunciation: mapList(d.pronunciation, toTip, MAX_TIPS),
    };
}
