// Pure rules for the translator's history list, which doubles as a cache:
// translating the same text the same way twice should not cost a second
// request.

import { TRANSLATE_RESULT_REV, type SourceHint, type TranslationResult } from './config';

export type HistoryEntry = {
    input: string;
    sourceHint: SourceHint;
    result: TranslationResult;
    rev?: number; // TRANSLATE_RESULT_REV when saved; absent on older entries
};

// "Ki haal hai?" and "ki  haal hai? " are the same request.
export function normalizeInput(input: string): string {
    return input.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function sameRequest(a: { input: string; sourceHint: SourceHint }, b: { input: string; sourceHint: SourceHint }): boolean {
    return a.sourceHint === b.sourceHint && normalizeInput(a.input) === normalizeInput(b.input);
}

// A saved result is reused only if it answers exactly this request, is a full
// Gemini result (a basic Cloud rendering is what a retry is for), and came
// from the current prompt.
export function findCachedTranslation<T extends HistoryEntry>(entries: T[], input: string, sourceHint: SourceHint): T | undefined {
    return entries.find(e =>
        sameRequest(e, { input, sourceHint }) && !e.result.fallback && e.rev === TRANSLATE_RESULT_REV);
}

// Newest first, one entry per request. A basic Cloud rendering never
// replaces a full result for the same request.
export function upsertHistory<T extends HistoryEntry>(entries: T[], entry: T, max: number): T[] {
    const existing = entries.find(e => sameRequest(e, entry));
    if (existing && entry.result.fallback && !existing.result.fallback) return entries;
    return [entry, ...entries.filter(e => !sameRequest(e, entry))].slice(0, max);
}
