// Turns one cached answer into what a phrase tap shows, or says why it cannot
// ship. The curated Gurmukhi, romanization, and English replace the model's
// own, so what the user tapped is what they see. The word glosses and
// pronunciation tips are the model's, and they must spell every word exactly
// as the curated text does. When the model has re-spelled the phrase (ਢੱਕ as
// "dhakk" where the entry says "dhak"), its glosses follow its own spelling,
// and a result that contradicts itself is worse than a live answer. That
// phrase is left to the live translator until a fluent reviewer settles the
// spelling.

import type { TranslationResult } from '../../lib/translate/config';
import { parseTranslationResult } from '../../lib/translate/parse';
import type { Phrase } from '../../lib/translate/phrasebook';
import { conventionIssues } from '../translate-eval/score';

export type Assembled = {
    own: TranslationResult | null;    // the model's answer as the parser reads it
    result: TranslationResult | null; // what ships; null when there are problems
    problems: string[];
};

// Letters only, lowercased: "Sat Sri Akal ji?" → sat sri akal ji.
const romanWords = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// Gurmukhi words with punctuation and dandas removed; NFC so precomposed and
// combining forms agree. Nuktas are kept: ਖ਼ and ਖ are different letters to a
// learner, and the gloss should show the one the headline does.
const gurmukhiWords = (s: string) =>
    s.normalize('NFC').replace(/[\p{P}\p{S}।॥]/gu, ' ').split(/\s+/).filter(Boolean);

// Glosses are whole units of the phrase. A pronunciation tip may also anchor
// on one sound inside a word (ਭ bh in ਭੂਆ bhua), so for tips a piece of a
// phrase word counts too; a re-spelled word ("paani" for Pani) still does not.
function strays(
    label: string,
    value: string,
    split: (s: string) => string[],
    allowed: Set<string>,
    { pieces = false } = {},
): string[] {
    const known = (word: string) => allowed.has(word) || (pieces && [...allowed].some(w => w.includes(word)));
    const extra = split(value).filter(word => !known(word));
    return extra.length ? [`${label} "${value}" uses ${extra.join(', ')}, which the phrase does not`] : [];
}

export function spellingDrift(phrase: Phrase, result: TranslationResult): string[] {
    const roman = new Set(romanWords(phrase.roman));
    const gurmukhi = new Set(gurmukhiWords(phrase.gurmukhi));
    return [
        ...result.words.flatMap((w, i) => [
            ...strays(`words[${i}].source`, w.source, romanWords, roman),
            ...strays(`words[${i}].roman`, w.roman, romanWords, roman),
            ...strays(`words[${i}].gurmukhi`, w.gurmukhi, gurmukhiWords, gurmukhi),
        ]),
        ...result.pronunciation.flatMap((p, i) => [
            ...strays(`pronunciation[${i}].roman`, p.roman, romanWords, roman, { pieces: true }),
            ...strays(`pronunciation[${i}].gurmukhi`, p.gurmukhi, gurmukhiWords, gurmukhi, { pieces: true }),
        ]),
    ];
}

export function assemble(phrase: Phrase, rawText: string): Assembled {
    const own = parseTranslationResult(rawText, 'punjabi-latin');
    if (!own) return { own: null, result: null, problems: ['the answer is not a usable result'] };

    const result: TranslationResult = {
        detectedInput: 'punjabi-latin',
        gurmukhi: phrase.gurmukhi,
        roman: phrase.roman,
        english: phrase.english,
        words: own.words,
        notes: own.notes,
        pronunciation: own.pronunciation,
    };
    if (!result.words.length) return { own, result: null, problems: ['no word glosses'] };
    const problems = [...spellingDrift(phrase, result), ...conventionIssues(result)];
    return { own, result: problems.length ? null : result, problems };
}
