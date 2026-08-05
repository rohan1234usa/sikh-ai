// Runtime validation of the cleanup model's JSON, plus the fallback that keeps
// identification working when that model is unavailable. responseSchema
// constrains decoding, but we never trust it alone — same whitelist-and-
// fallback posture as lib/translate/parse.ts.
//
// Pure: no network, no environment. scripts/identify-eval replays both paths.

import {
    isAudioKind,
    isLevel,
    type AudioKind,
    type HeardLine,
    type Level,
    type Transcription,
} from './config';
import { gurmukhiLetterShare, normalizeLine } from './gurmukhi';
import type { ScribeWord } from './scribe';

export type Cleanup = {
    kind: AudioKind;
    heard: Transcription;
    // The model's recognition guess. Server-side only: it seeds a search query
    // and is never serialized into the response.
    guessedFirstLine: string;
    guessConfidence: Level | 'none';
};

const MAX_LINES = 8;
const MAX_LINE_CHARS = 160;
const MAX_GUESS_CHARS = 120;
// Below this share of Gurmukhi letters a "line" is Latin or Devanagari text
// the model emitted despite instructions — it would only pollute the queries.
const MIN_GURMUKHI_SHARE = 0.5;

function gurmukhiText(v: unknown, maxChars: number): string {
    if (typeof v !== 'string') return '';
    const line = normalizeLine(v).slice(0, maxChars);
    if (!line) return '';
    return gurmukhiLetterShare(line) >= MIN_GURMUKHI_SHARE ? line : '';
}

function toHeardLine(v: unknown): HeardLine | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const gurmukhi = gurmukhiText(o.gurmukhi, MAX_LINE_CHARS);
    if (!gurmukhi) return null;
    return {
        gurmukhi,
        // Roman is display-only, so a missing or odd value degrades to no row
        // rather than failing the line.
        roman: typeof o.roman === 'string' ? o.roman.trim().slice(0, MAX_LINE_CHARS) : '',
        confidence: isLevel(o.confidence) ? o.confidence : 'low',
    };
}

// Two heard lines are "the same" when their normalized text matches — kirtan
// repeats a tuk many times and the model sometimes lists the repeats.
function dedupe(lines: HeardLine[]): HeardLine[] {
    const seen = new Set<string>();
    const out: HeardLine[] = [];
    for (const line of lines) {
        if (seen.has(line.gurmukhi)) continue;
        seen.add(line.gurmukhi);
        out.push(line);
    }
    return out;
}

export function parseCleanup(raw: string): Cleanup | null {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;

    const lines = dedupe(
        (Array.isArray(d.lines) ? d.lines : [])
            .map(toHeardLine)
            .filter((line): line is HeardLine => line !== null),
    ).slice(0, MAX_LINES);

    const kind = isAudioKind(d.kind) ? d.kind : 'unclear';
    // A "gurbani" verdict with nothing usable left after validation is not a
    // usable result; downgrade it so the route takes the no-speech exit rather
    // than searching on nothing.
    const effectiveKind: AudioKind = kind === 'gurbani' && lines.length === 0 ? 'unclear' : kind;

    return {
        kind: effectiveKind,
        heard: {
            lines,
            overall: isLevel(d.overall) ? d.overall : 'low',
        },
        guessedFirstLine: gurmukhiText(d.guessedFirstLine, MAX_GUESS_CHARS),
        guessConfidence: isLevel(d.guessConfidence) ? d.guessConfidence : 'none',
    };
}

// Gap in seconds between two words that reads as a line break. Kirtan pauses
// at the end of a tuk far longer than between words inside one; 1.2s is
// comfortably past normal word spacing without splitting on a held note.
const LINE_GAP_SECONDS = 1.2;

// Fallback when the cleanup pass is unavailable (quota, outage). Scribe's raw
// text is colloquial rather than canonical, so matching from here is weaker —
// but a weaker match beats none, and the user still sees what was heard.
//
// Confidence is 'low' throughout on purpose: nothing has verified this text.
export function transcriptionFromScribe(text: string, words: ScribeWord[]): Transcription {
    const lines: HeardLine[] = [];

    if (words.length > 0) {
        let current: string[] = [];
        let previousEnd = words[0].start;
        for (const word of words) {
            if (current.length > 0 && word.start - previousEnd >= LINE_GAP_SECONDS) {
                lines.push({ gurmukhi: current.join(' '), roman: '', confidence: 'low' });
                current = [];
            }
            current.push(word.text);
            previousEnd = word.end;
        }
        if (current.length > 0) {
            lines.push({ gurmukhi: current.join(' '), roman: '', confidence: 'low' });
        }
    } else if (text.trim()) {
        lines.push({ gurmukhi: text, roman: '', confidence: 'low' });
    }

    const cleaned = dedupe(
        lines
            .map(line => ({ ...line, gurmukhi: gurmukhiText(line.gurmukhi, MAX_LINE_CHARS) }))
            .filter(line => line.gurmukhi !== ''),
    ).slice(0, MAX_LINES);

    return { lines: cleaned, overall: 'low' };
}
