// Client-safe: what someone typed into Shabad Search, sorted into something
// searchable. It runs in the browser, to open an Ang or say what's wrong
// without a round trip, and again in /api/shabad/search, which never trusts
// the browser's answer.
//
//   10, ੧੦, "ang 10"           an Ang
//   ਸੋ ਪੁਰਖੁ ਨਿਰੰਜਨੁ             Gurmukhi words
//   ਸਪਨਹ, ਸ ਪ ਨ ਹ              Gurmukhi first letters, one per word
//   so purakh niranjan         romanized words
//   spnh, s p n h              romanized first letters
//
// Gurmukhi wins over English letters when a query has both, as text pasted
// with its transliteration does.

import { MAX_ANG } from './citations';
import { skeletonToken, tokens } from './gurmukhi';
import { romanTokens } from './roman';
import { lineKeys, toSearchLetters } from './score';
import { isGurbaniId } from './shabad';

export const MAX_QUERY_CHARS = 200;
// Fewer first letters than this match far too many lines to be a search.
const MIN_LETTERS = 3;
// More than enough to pick out a line; the rest only cost lookups.
const MAX_LETTERS = 24;
const MAX_WORDS = 20;
// Romanized words are searched by their first letters, so they need as many
// words as a first-letter search needs letters, and enough letters to tell
// the right line from others with the same first letters.
const MIN_ROMAN_WORDS = 3;
const MIN_ROMAN_CHARS = 8;

export type SearchAs = 'words' | 'letters';
export const parseSearchAs = (value: unknown): SearchAs | undefined =>
    value === 'words' || value === 'letters' ? value : undefined;

export type InvalidReason = 'empty' | 'too-long' | 'too-short' | 'ang-range' | 'no-letters' | 'english' | 'unsupported-script';

// `alternatives` are the other readings worth offering ("search the words
// instead"); each is an `as` to classify the same text with.
export type ShabadQuery =
    | { kind: 'ang'; ang: number }
    | { kind: 'gurmukhi'; words: string[]; alternatives: SearchAs[] }
    | { kind: 'gurmukhi-letters'; letters: string; alternatives: SearchAs[] }
    | { kind: 'roman'; words: string[]; alternatives: SearchAs[] }
    | { kind: 'roman-letters'; letters: string; alternatives: SearchAs[] }
    | { kind: 'invalid'; reason: InvalidReason; alternatives: SearchAs[] };

export type SearchableQuery = Extract<ShabadQuery, { kind: 'gurmukhi' | 'gurmukhi-letters' | 'roman' | 'roman-letters' }>;
export type SearchKind = SearchableQuery['kind'];

export const isSearchable = (query: ShabadQuery): query is SearchableQuery =>
    query.kind !== 'ang' && query.kind !== 'invalid';

export const alternativesOf = (query: ShabadQuery): SearchAs[] => ('alternatives' in query ? query.alternatives : []);

// How a found line matched what was typed, best first: word for word as
// GurbaniNow spells it; every word, spelled a little differently; most of
// the words; its first letters; or its transliteration.
export type MatchKind = 'exact' | 'contained' | 'close' | 'letters' | 'roman';

// One line found, standing for its shabad.
export type VerseHit = {
    lineId: string;
    shabadId: string;
    gurmukhi: string;
    transliteration: string;
    translation: string;
    ang: number | null;
    lineNo: number | null;
    writer: string;
    writerGurmukhi: string;
    raag: string;
    raagGurmukhi: string;
    match: MatchKind;
    sameLineIn: number; // other shabads found with this same line
};

// What /api/shabad/search answers.
export type VerseSearchResponse = {
    kind: SearchKind;
    hits: VerseHit[];
    complete: boolean;       // every lookup answered: no hits means nothing matched
    truncated: boolean;      // more matched than shown; more words would narrow it
    alternatives: SearchAs[]; // other readings of the same text worth offering
};

// One spelling of a query, for the address and the CDN's cache key: NFC,
// invisible characters gone (a zero-width space breaks words in larivaar
// text), spaces collapsed, English letters lowercased.
export function canonicalQuery(input: string): string {
    return input
        .normalize('NFC')
        .replace(/[‌‍﻿]/g, '')
        .replace(/​/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

const ANG = /^(?:ang|ank|page|panna|ਅੰਗ|ਪੰਨਾ)?\s*[:#.]?\s*([0-9]{1,6}|[੦-੯]{1,6})$/u;
const GURMUKHI_LETTER = /[ਅ-ਹਖ਼-ਫ਼ੲ-ੴ]/;
// A dependent vowel sign or the virama: what makes a token a written word
// rather than a run of first letters. Tippi, bindi, addak and nukta alone
// don't.
const VOWEL_SIGN = /[ਾ-੍]/;

// Words of English that never turn up in GurbaniNow's transliteration (a
// test holds the list to that). Two of them make a question in English,
// which nothing here can search for.
const ENGLISH_ONLY = new Set([
    'of', 'and', 'what', 'does', 'who', 'how', 'why', 'where', 'which', 'this', 'that', 'with', 'from', 'about',
    'mean', 'meaning', 'means', 'you', 'your', 'for', 'will', 'would', 'should', 'could', 'have', 'please',
    'tell', 'explain', 'translate', 'translation', 'verse', 'line',
]);
export const ENGLISH_ONLY_WORDS: ReadonlySet<string> = ENGLISH_ONLY;

const invalid = (reason: InvalidReason, alternatives: SearchAs[] = []): ShabadQuery => ({ kind: 'invalid', reason, alternatives });
const letterCount = (text: string) => [...text].length;

export function classifyQuery(input: string, as?: SearchAs): ShabadQuery {
    if (input.length > MAX_QUERY_CHARS) return invalid('too-long');
    const text = canonicalQuery(input);
    if (!text) return invalid('empty');

    const ang = ANG.exec(text);
    if (ang) {
        const digits = ang[1].replace(/[੦-੯]/g, d => String(d.charCodeAt(0) - 0x0A66));
        const n = Number(digits);
        return n >= 1 && n <= MAX_ANG ? { kind: 'ang', ang: n } : invalid('ang-range');
    }

    // Gurmukhi first; the English letters only when the Gurmukhi can't be
    // searched, and then the Gurmukhi's reason when neither can.
    const gurmukhi = classifyGurmukhi(text, as);
    if (gurmukhi && isSearchable(gurmukhi)) return gurmukhi;
    const roman = classifyRoman(text, as);
    if (roman) return roman;
    if (gurmukhi) return gurmukhi;

    const letters = [...text].filter(ch => /\p{L}/u.test(ch));
    if (letters.length === 0) return invalid('no-letters');
    const known = letters.filter(ch => GURMUKHI_LETTER.test(ch) || /[a-z]/.test(ch)).length;
    return known === 0 ? invalid('unsupported-script') : invalid('too-short', shortAlternatives(text));
}

function gurmukhiWords(text: string): string[] {
    return tokens(text)
        .map(token => token.replace(/[^਀-੿]/g, ''))
        .filter(token => GURMUKHI_LETTER.test(token))
        .slice(0, MAX_WORDS);
}

// null when the text has no Gurmukhi to go by.
function classifyGurmukhi(text: string, as?: SearchAs): ShabadQuery | null {
    const words = gurmukhiWords(text);
    if (words.length === 0) return null;
    const unmarked = words.every(word => !VOWEL_SIGN.test(word));
    const skeletons = words.map(skeletonToken);
    const typedLetters = [...toSearchLetters(skeletons.join(''))].slice(0, MAX_LETTERS).join('');
    const loose = lineKeys(words.join(' ')).letters;

    if (as === 'letters') {
        return letterCount(typedLetters) >= MIN_LETTERS ? { kind: 'gurmukhi-letters', letters: typedLetters, alternatives: [] } : invalid('too-short');
    }
    if (as === 'words') {
        return loose >= MIN_LETTERS ? { kind: 'gurmukhi', words, alternatives: unmarked ? ['letters'] : [] } : invalid('too-short');
    }

    // ਸ ਪ ਨ ਹ: a letter per word, spaced out.
    if (unmarked && words.length >= MIN_LETTERS && skeletons.every(s => letterCount(s) === 1)) {
        return { kind: 'gurmukhi-letters', letters: typedLetters, alternatives: [] };
    }
    // ਸਪਨਹ: no vowel signs, so first letters. A word written without any
    // (ਕਰਮ, ਨਦਰ) reads the same way, so the words are offered too.
    if (words.length === 1 && unmarked && letterCount(skeletons[0]) >= MIN_LETTERS) {
        return { kind: 'gurmukhi-letters', letters: typedLetters, alternatives: ['words'] };
    }
    if (words.length >= 2 && loose >= MIN_LETTERS + 1) {
        return { kind: 'gurmukhi', words, alternatives: unmarked ? ['letters'] : [] };
    }
    // One written word is in too many lines to find one; searched for anyway
    // when asked.
    return invalid('too-short', loose >= MIN_LETTERS ? ['words'] : []);
}

// After collapsing the digraphs (kh, chh, tth, …), three consonants in a row
// mean letters, not a word: "spnh", "tttpa".
const DIGRAPHS = /chh|tth|ddh|kh|gh|ch|jh|th|dh|ph|bh|sh|rh/g;
const looksLikeLetters = (word: string) => !/[aeiou]/.test(word) || /[^aeiou]{3,}/.test(word.replace(DIGRAPHS, 'X'));

function classifyRoman(text: string, as?: SearchAs): ShabadQuery | null {
    const words = romanTokens(text).slice(0, MAX_WORDS);
    if (words.length === 0) return null;
    if (words.filter(word => ENGLISH_ONLY.has(word)).length >= 2) return invalid('english');

    const joined = words.join('').slice(0, MAX_LETTERS);
    if (as === 'letters') {
        return joined.length >= MIN_LETTERS && /^[a-z]+$/.test(joined) ? { kind: 'roman-letters', letters: joined, alternatives: [] } : null;
    }
    if (words.length >= MIN_LETTERS && words.every(word => word.length === 1)) {
        return { kind: 'roman-letters', letters: joined, alternatives: [] };
    }
    if (words.length === 1 && words[0].length >= MIN_LETTERS && words[0].length <= MAX_LETTERS && looksLikeLetters(words[0])) {
        return { kind: 'roman-letters', letters: words[0], alternatives: [] };
    }
    if (words.length >= MIN_ROMAN_WORDS && words.join('').length >= MIN_ROMAN_CHARS) {
        return { kind: 'roman', words, alternatives: [] };
    }
    return null;
}

// A short single romanized word might be someone's first letters ("sapn").
function shortAlternatives(text: string): SearchAs[] {
    const words = romanTokens(text);
    return words.length === 1 && words[0].length >= MIN_LETTERS && words[0].length <= 6 ? ['letters'] : [];
}

// Searches shown to try under the box: ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ (Japji, Ang 1) in its
// words and by its first letters, and So Purakh (Ang 10) in English letters.
// A test holds each to the recorded source.
export const SEARCH_EXAMPLES = {
    words: 'ਆਦਿ ਸਚੁ ਜੁਗਾਦਿ ਸਚੁ',
    letters: 'ਅਸਜਸ',
    roman: 'so purakh niranjan',
} as const;

const KINDS: readonly SearchKind[] = ['gurmukhi', 'gurmukhi-letters', 'roman', 'roman-letters'];
const MATCHES: readonly MatchKind[] = ['exact', 'contained', 'close', 'letters', 'roman'];
const MAX_SHOWN = 50;

// An answer from /api/shabad/search, read as untrusted: the shape checked,
// every hit's ids ones we'd link to, anything else dropped. null when it
// isn't an answer at all.
export function sanitizeVerseSearch(raw: unknown): VerseSearchResponse | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (!KINDS.includes(r.kind as SearchKind) || !Array.isArray(r.hits)) return null;
    if (typeof r.complete !== 'boolean' || typeof r.truncated !== 'boolean') return null;
    const str = (v: unknown) => (typeof v === 'string' ? v : '');
    const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
    const hits: VerseHit[] = [];
    for (const item of r.hits.slice(0, MAX_SHOWN)) {
        if (!item || typeof item !== 'object') continue;
        const h = item as Record<string, unknown>;
        const lineId = str(h.lineId);
        const shabadId = str(h.shabadId);
        const gurmukhi = str(h.gurmukhi);
        if (!isGurbaniId(lineId) || !isGurbaniId(shabadId) || !gurmukhi) continue;
        hits.push({
            lineId,
            shabadId,
            gurmukhi,
            transliteration: str(h.transliteration),
            translation: str(h.translation),
            ang: int(h.ang),
            lineNo: int(h.lineNo),
            writer: str(h.writer),
            writerGurmukhi: str(h.writerGurmukhi),
            raag: str(h.raag),
            raagGurmukhi: str(h.raagGurmukhi),
            match: MATCHES.includes(h.match as MatchKind) ? h.match as MatchKind : 'letters',
            sameLineIn: int(h.sameLineIn) ?? 0,
        });
    }
    const alternatives = Array.isArray(r.alternatives)
        ? [...new Set(r.alternatives.map(parseSearchAs).filter((as): as is SearchAs => as !== undefined))]
        : [];
    return { kind: r.kind as SearchKind, hits, complete: r.complete, truncated: r.truncated, alternatives };
}
