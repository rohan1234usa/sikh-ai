// Pure scoring of a quoted line against a line of Gurbani. The question is not
// "how similar" but "is this the same line": a quote counts as verified only
// when every word of it appears, in order, in one real line.

import { firstLetters, skeletonToken, tokens } from './gurmukhi';
import { longestCommonSubstring } from './similarity';

// Independent long vowels fold to their short forms, so a slip such as
// ਪਸਾਊ for ਪਸਾਉ still matches; the skeleton has already dropped vowel signs.
const LONG_TO_SHORT: Record<string, string> = {
    'ਆ': 'ਅ', // ਆ → ਅ
    'ਈ': 'ਇ', // ਈ → ਇ
    'ਊ': 'ਉ', // ਊ → ਉ
    'ਐ': 'ਏ', // ਐ → ਏ
    'ਔ': 'ਓ', // ਔ → ਓ
};

export function looseKey(token: string): string {
    return skeletonToken(token).replace(/[ਆਈਊਐਔ]/g, ch => LONG_TO_SHORT[ch]);
}

// GurbaniNow's first-letter index files a vowel-initial word under its
// carrier letter: ਅ ਆ ਐ ਔ under ਅ, ਇ ਈ ਏ under ੲ, ਉ ਊ ਓ under ੳ. A query
// spelled with the vowel itself finds nothing. Used for queries only.
const CARRIER: Record<string, string> = {
    'ਆ': 'ਅ', 'ਐ': 'ਅ', 'ਔ': 'ਅ',
    'ਇ': 'ੲ', 'ਈ': 'ੲ', 'ਏ': 'ੲ',
    'ਉ': 'ੳ', 'ਊ': 'ੳ', 'ਓ': 'ੳ',
};

export function toSearchLetters(letters: string): string {
    return [...letters].map(ch => CARRIER[ch] ?? ch).join('');
}

export type LineKeys = {
    raw: string[];   // Gurmukhi words, NFC, punctuation and verse numbers gone
    loose: string[]; // the same words as loose keys
    first: string;   // first letters, one per word
    letters: number; // total letters across the loose keys
};

const HAS_GURMUKHI = /[਀-੿]/;

export function lineKeys(text: string): LineKeys {
    const raw = tokens(text).filter(token => HAS_GURMUKHI.test(token));
    const loose = raw.map(looseKey);
    return {
        raw,
        loose,
        first: firstLetters(raw.join(' ')),
        letters: loose.reduce((n, key) => n + [...key].length, 0),
    };
}

// Does `needle` occur in `hay` as a run of whole words? Spacing inside the run
// is ignored (ਸਤਿਨਾਮੁ matches ਸਤਿ ਨਾਮੁ), but the run has to start and end on
// the haystack's word boundaries, so a truncated last word does not count.
export function containedRun(needle: string[], hay: string[]): boolean {
    const target = needle.join('');
    if (!target) return false;
    for (let i = 0; i < hay.length; i++) {
        let acc = '';
        for (let j = i; j < hay.length; j++) {
            acc += hay[j];
            if (!target.startsWith(acc)) break;
            if (acc.length === target.length) return true;
        }
    }
    return false;
}

// When a reply runs two verse lines together with no ॥ between them, each
// real line is a prefix or suffix of the quote. Returns the words left over
// once `line` is taken off either end, or null when it is neither.
export function peel(quote: LineKeys, line: LineKeys): string[] | null {
    if (line.raw.length < 3 || line.letters < 7 || line.letters >= quote.letters) return null;
    const target = line.loose.join('');
    let acc = '';
    for (let k = 0; k < quote.loose.length; k++) {
        acc += quote.loose[k];
        if (acc === target) return quote.raw.slice(k + 1);
        if (!target.startsWith(acc)) break;
    }
    acc = '';
    for (let k = quote.loose.length - 1; k >= 0; k--) {
        acc = quote.loose[k] + acc;
        if (acc === target) return quote.raw.slice(0, k);
        if (!target.endsWith(acc)) break;
    }
    return null;
}

// Longest common subsequence of words, each match weighted by its length in
// letters — so ਕਾ, ਹੀ and ਜੀ, which collide everywhere, count for little.
function weightedLcs(a: string[], b: string[]): number {
    let previous = new Array<number>(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
        const current = new Array<number>(b.length + 1).fill(0);
        for (let j = 1; j <= b.length; j++) {
            current[j] = a[i - 1] === b[j - 1]
                ? previous[j - 1] + [...a[i - 1]].length
                : Math.max(previous[j], current[j - 1]);
        }
        previous = current;
    }
    return previous[b.length];
}

export type Comparison = {
    contained: boolean; // every word of the quote, in order, inside the line
    exact: boolean;     // …and spelled exactly as the source spells it
    matched: number;    // letters shared in order
    lettersQ: number;
    lettersV: number;
    orderRun: number;   // longest run of shared first letters
    firstQ: number;     // first letters in the quote
};

export function compare(quote: LineKeys, line: LineKeys): Comparison {
    const contained = containedRun(quote.loose, line.loose);
    return {
        contained,
        exact: contained && containedRun(quote.raw, line.raw),
        matched: weightedLcs(quote.loose, line.loose),
        lettersQ: quote.letters,
        lettersV: line.letters,
        orderRun: longestCommonSubstring(quote.first, line.first),
        firstQ: quote.first.length,
    };
}

// "Close": clearly the same line, but the reply's wording differs from the
// source. Written with integers because the altered line from the model
// comparison (ਤੈਡਾ ਕੀਤਾ ਮੀਠਾ ਲਾਗੈ) sits exactly on 0.5.
//   coverage ≥ 0.75, or coverage ≥ 0.5 with dice ≥ 0.5 and order ≥ 0.8
export function isClose(c: Comparison): boolean {
    if (c.contained || c.matched < 4) return false;
    if (4 * c.matched >= 3 * c.lettersQ) return true;
    return 2 * c.matched >= c.lettersQ
        && 4 * c.matched >= c.lettersQ + c.lettersV
        && 5 * c.orderRun >= 4 * c.firstQ;
}

// Orders "close" candidates: more of the quote covered, then first-letter
// order, then the tighter line.
export function closeness(c: Comparison): number {
    return c.matched / Math.max(1, c.lettersQ)
        + 0.1 * (c.orderRun / Math.max(1, c.firstQ))
        - 0.001 * c.lettersV;
}
