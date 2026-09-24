// Client: full translator results for the curated phrasebook, generated ahead
// of time by `npm run build:phrasebook`. A phrase tap shows one of these
// instantly, with no request — and still works when Gemini is unavailable,
// which the romanized-Punjabi path otherwise has no fallback for.
//
// The file is loaded on first use as its own chunk, so it costs nothing until
// someone opens the phrasebook.

import type { TranslationResult } from './config';
import { parseTranslationResult } from './parse';
import type { Phrase } from './phrasebook';

type Generated = { results?: Record<string, unknown> };

let pending: Promise<Record<string, unknown>> | null = null;

// Called when a phrase row opens, so the chunk is usually there by the time
// "use" is tapped.
export function preloadPhraseResults(): Promise<Record<string, unknown>> {
    pending ??= import('./phrasebook-results.generated.json')
        .then(mod => (mod.default as Generated).results ?? {})
        .catch(() => {
            pending = null; // let a later tap try again
            return {};
        });
    return pending;
}

// The stored result for a phrase, re-validated through the same parser as a
// live response, or null (the caller then asks the API). A result that no
// longer carries the entry's own text is ignored too: the entry was edited
// after the last build, and its glosses may describe the old wording.
export async function loadPhraseResult(phrase: Phrase): Promise<TranslationResult | null> {
    const stored = (await preloadPhraseResults())[phrase.id];
    const result = stored ? parseTranslationResult(JSON.stringify(stored), 'punjabi-latin') : null;
    const current = result?.gurmukhi === phrase.gurmukhi && result.roman === phrase.roman && result.english === phrase.english;
    return current ? result : null;
}
