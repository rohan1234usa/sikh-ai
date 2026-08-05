// Pure Gurmukhi text utilities for Shabad matching. No imports, no network —
// everything here is deterministic and replayable by scripts/identify-eval.
//
// Matching a noisy transcription against scripture needs two things the raw
// text does not give: a canonical form (so punctuation and orthographic
// variants stop counting as differences) and a first-letter index (the
// traditional way Gurbani is looked up, and the channel that survives the most
// transcription error — only the first consonant of each word has to be right).

// Larivaar renderings mark word boundaries with a zero-width space instead of
// a gap, so it has to become a break — dropping it would fuse the whole line
// into one token. The joiners and the BOM carry no boundary and just go.
const ZERO_WIDTH_BREAK = /​/g;
const ZERO_WIDTH_JOIN = /[‌‍﻿]/g;

// Punctuation, symbols, and digits all become word breaks: dandas (॥ ।, which
// live in the Devanagari block), verse numbers in Gurmukhi digits (੧੨੩), and
// any Latin punctuation a transcript picked up.
const PUNCT_NUM = /[\p{P}\p{S}।॥੦-੯0-9]/gu;

// Marks that carry real meaning but vary the most between a sung/heard
// rendering and the written canon: nukta (਼), bindi (ਂ), adak bindi (ਁ),
// tippi (ੰ), addak (ੱ), udaat (ੑ), yakash (ੵ). Nasalisation and gemination are
// exactly what a listener mishears, so folding them costs little and buys a
// lot. NFC leaves Gurmukhi nukta letters decomposed (they are composition
// exclusions), so stripping U+0A3C also folds ਸ਼→ਸ, ਖ਼→ਖ, ਗ਼→ਗ, ਜ਼→ਜ, ਫ਼→ਫ, ਲ਼→ਲ.
const FOLD_MARKS = /[਼ਁਂੰੱੑੵ]/g;

// Dependent vowel signs plus virama. Removing them leaves the consonant
// skeleton, which survives sung vowel elongation and collapses the
// sihari-vs-subjoined spellings of the same word (ਸਿਰੀ / ਸ੍ਰੀ → ਸਰ).
const VOWEL_SIGNS = /[ਾ-ੂੇੈੋੌ੍]/g;

const GURMUKHI_LETTER = /[ਅ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ਫ਼ੲ-ੴ]/;

// Canonical display form: one line, plain words, no marks of punctuation.
export function normalizeLine(input: string): string {
    return input
        .normalize('NFC')
        .replace(ZERO_WIDTH_JOIN, '')
        .replace(ZERO_WIDTH_BREAK, ' ')
        .replace(PUNCT_NUM, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function tokens(input: string): string[] {
    const normalized = normalizeLine(input);
    return normalized === '' ? [] : normalized.split(' ');
}

// Light fold — still recognisably the same word, just without the marks a
// listener is most likely to get wrong.
export function foldToken(token: string): string {
    return token.replace(FOLD_MARKS, '');
}

// Heavy fold — consonants only. Collides more (ਮਨੁ / ਮਨਿ / ਮਨਾ all become ਮਨ),
// which is why it carries the smallest weight in the score.
export function skeletonToken(token: string): string {
    return foldToken(token).replace(VOWEL_SIGNS, '');
}

// The first letter of every word, joined — the shape Gurbani search engines
// index (and what GurbaniNow returns as `firstletters`). Because Unicode
// stores a sihari after its consonant even though it renders before it, the
// first codepoint of a word is always its base letter; independent vowels
// (ਅ ਇ ਉ) and ੴ are single codepoints and count as themselves.
//
// Always compute this on BOTH sides of a comparison rather than mixing it with
// a source's own field — self-consistency matters more than agreeing with
// someone else's folding rules.
export function firstLetters(input: string): string {
    let out = '';
    for (const token of tokens(input)) {
        const first = [...skeletonToken(token)][0];
        if (first && GURMUKHI_LETTER.test(first)) out += first;
    }
    return out;
}

// Share of letter characters that are Gurmukhi. Used to reject transcript
// lines that came back in Latin or Devanagari despite the instructions.
export function gurmukhiLetterShare(input: string): number {
    let letters = 0;
    let gurmukhi = 0;
    for (const ch of input) {
        if (!/\p{L}/u.test(ch)) continue;
        letters++;
        if (GURMUKHI_LETTER.test(ch)) gurmukhi++;
    }
    return letters === 0 ? 0 : gurmukhi / letters;
}
