// Client-safe rules for the live translator: the lines shown under the text
// box while someone types (POST /api/translate/live). The prompt that asks
// for them is server-only, in ./prompts.ts; the full result, with its
// learning aids, still comes from the Translate button.

import { isDetectedInput, type DetectedInput } from './config';

// Live lines start once the text has two words or eight characters, so the
// first keystrokes of a sentence don't each cost a call. A single short word
// is a lookup, and the Translate button's word-by-word result suits it
// better.
export const MIN_LIVE_WORDS = 2;
export const MIN_LIVE_CHARS = 8;

// A few sentences, which is what a conversation turn needs. Past this the
// lines stop and the Translate button takes over: three renditions of a
// longer text take too long to arrive to feel live.
export const MAX_LIVE_CHARS = 300;

// How long typing must pause before the text is sent. Every change aborts
// the call in flight, so a faster typist makes fewer calls, not more.
export const LIVE_PAUSE_MS = 600;

// At most this many calls in any minute from one page. With the firewall's
// 20 posts a minute for each address, across every /api/ route (README,
// Running in production, step 3), that leaves room for the Translate
// button. The server's own allowance (lib/api/allowance.ts) is a little
// higher, so it only refuses a page that ignores this.
export const LIVE_CALLS_PER_MINUTE = 10;

// When a refusal (a 429) carries no Retry-After, live lines pause this long.
export const LIVE_PAUSE_AFTER_REFUSAL_MS = 60_000;

export type LiveField = 'gurmukhi' | 'roman' | 'english';
export const LIVE_FIELDS: readonly LiveField[] = ['gurmukhi', 'roman', 'english'];

// What the stream has said so far. A field is missing until its line starts.
export type LiveLines = { input?: DetectedInput } & Partial<Record<LiveField, string>>;

// The labels the model starts each line with, in the order it writes them.
// The prompt (./prompts.ts) names the same four.
export const LIVE_LABELS = { input: 'INPUT', gurmukhi: 'GURMUKHI', roman: 'ROMAN', english: 'ENGLISH' } as const;

const BY_LABEL = new Map<string, keyof typeof LIVE_LABELS>(
    Object.entries(LIVE_LABELS).map(([field, label]) => [label, field as keyof typeof LIVE_LABELS]),
);

// "GURMUKHI: ...", forgiving of the markdown a model sometimes adds anyway
// ("**Gurmukhi:** ...", "- ROMAN: ...").
const LABELLED = /^[\s*_>#-]*([A-Za-z]+)[\s*_]*:[\s*_]*(.*)$/;

// Could this unfinished last line still become a label? "ENG" could, so it
// waits for more text rather than being read as part of the line before it.
function maybeLabel(line: string): boolean {
    const bare = line.replace(/^[\s*_>#-]*/, '').toUpperCase();
    if (bare === '') return true;
    return Object.values(LIVE_LABELS).some(label => label.startsWith(bare) || bare.startsWith(label));
}

// Reads the stream so far, or all of it once `done`, into its fields. Text
// before the first label is dropped; a line with no label carries on the
// field before it, joined with a space, since the prompt asks for one line
// each.
export function parseLiveLines(raw: string, done = false): LiveLines {
    const out: LiveLines = {};
    let current: keyof typeof LIVE_LABELS | null = null;
    const lines = raw.split('\n');
    lines.forEach((line, i) => {
        const unfinished = !done && i === lines.length - 1;
        const match = LABELLED.exec(line);
        const field = match ? BY_LABEL.get(match[1].toUpperCase()) : undefined;
        if (field) {
            current = field;
            const value = match![2].trim();
            if (field === 'input') {
                const input = value.replace(/["'`*_.]/g, '').trim().toLowerCase();
                if (isDetectedInput(input)) out.input = input;
            } else {
                out[field] = value;
            }
            return;
        }
        if (unfinished && maybeLabel(line)) return;
        const more = line.trim();
        if (!more || current === null || current === 'input') return;
        out[current] = out[current] ? `${out[current]} ${more}` : more;
    });
    return out;
}

// The lines worth showing for an input: the translation, never the input
// echoed back. All three while the stream hasn't said what the input is.
export function liveFieldsFor(input: DetectedInput | undefined): readonly LiveField[] {
    switch (input) {
        case 'english': return ['gurmukhi', 'roman'];
        case 'punjabi-latin': return ['gurmukhi', 'english'];
        case 'punjabi-gurmukhi': return ['roman', 'english'];
        default: return LIVE_FIELDS;
    }
}

// Whether a text is worth a live call: long enough to mean something, and
// short enough to come back quickly.
export function liveEligible(text: string): 'short' | 'ok' | 'long' {
    const trimmed = text.trim();
    if (trimmed.length > MAX_LIVE_CHARS) return 'long';
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    return words >= MIN_LIVE_WORDS || trimmed.length >= MIN_LIVE_CHARS ? 'ok' : 'short';
}
