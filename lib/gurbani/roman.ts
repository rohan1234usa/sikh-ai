// Client-safe: Gurbani typed in English letters ("so purakh niranjan", or
// just the first letters, "spnh"). GurbaniNow has no romanized search, so
// Shabad Search does it in two steps:
//   1. guess the Gurmukhi first letter of each word, the likelier guesses
//      first where English letters are ambiguous (t is ਤ, sometimes ਟ), and
//      ask GurbaniNow's first-letter search for those;
//   2. keep the lines whose own transliteration reads like what was typed
//      (alignRoman), so a lucky first-letter match never passes for a find.
// Nothing here talks to the network; the plan and the lookups are
// ./search.ts's.

import { editSimilarity } from './similarity';

// --- Words ------------------------------------------------------------------

// ੴ is one Gurmukhi word, written as two: GurbaniNow's "ik oankaar", or a
// reader's "ik onkar", "ek omkar", "1 onkar". Both sides become one word.
const IK = /^(?:ik|ikk|ek|eik|1)$/;
const ONKAR = /^o+a?[nm]g?kaa?r$/;
const IKONKAR = /^(?:ik|ikk|ek|eik|1)o+a?[nm]g?kaa?r$/;
export const IK_ONKAR = 'ikonkar';

// Words readers run together that Gurbani writes apart, and words they split
// that Gurbani writes as one (ਰਾਮਦਾਸ, ਵਾਹਿਗੁਰੂ, ਪਾਰਬ੍ਰਹਮ). Either throws
// the first letters off by one, and a first-letter lookup needs them in
// step.
const SPLITS: Record<string, string[]> = {
    satnam: ['sat', 'nam'],
    satnaam: ['sat', 'naam'],
    gurprasad: ['gur', 'prasad'],
    gurparsad: ['gur', 'parsad'],
    gurprasaad: ['gur', 'prasaad'],
    akalpurakh: ['akal', 'purakh'],
};
const JOINS: [RegExp, RegExp][] = [
    [/^raa?m$/, /^daa?s$/],
    [/^(?:w|v)aa?he?$/, /^guru?$/],
    [/^paa?r$/, /^bra?h?a?m$/],
    [/^gurr?$/, /^dev$/],
    [/^sat$/, /^guru?$/],
    [/^nir$/, /^(?:bhau|bhao|vair|vaair|wair)$/],
];

// Lowercase English letters, accents and other marks gone (so "nirañjan"
// reads as "niranjan"), split into words, with ੴ joined and the common
// run-together words split. Digits survive only as the 1 of "1 onkar".
export function romanTokens(text: string): string[] {
    const raw = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const out: string[] = [];
    for (let i = 0; i < raw.length; i++) {
        const word = raw[i];
        const next = raw[i + 1];
        if (IK.test(word) && next !== undefined && ONKAR.test(next)) {
            out.push(IK_ONKAR);
            i++;
        } else if (next !== undefined && JOINS.some(([a, b]) => a.test(word) && b.test(next))) {
            out.push(word + next);
            i++;
        } else if (IKONKAR.test(word)) out.push(IK_ONKAR);
        else if (SPLITS[word]) out.push(...SPLITS[word]);
        else if (/[a-z]/.test(word)) out.push(word.replace(/[0-9]/g, ''));
    }
    return out;
}

// --- First letters ----------------------------------------------------------

export type Alt = { letter: string; p: number };
const one = (letter: string): Alt[] => [{ letter, p: 1 }];

// How a romanized word's start may be written in Gurmukhi, with how likely
// each is. The longest matching start wins (chh before ch before c).
// GurbaniNow's own transliteration doubles the retroflex letters (ਟ tt, ਠ
// tth, ਡ dd, ਢ ddh or dt); readers mostly don't, so a plain t or th
// keeps the retroflex letter as a second guess. Words starting with a vowel
// are filed under the carrier letters GurbaniNow's index uses: ਅ for ਅ ਆ ਐ
// ਔ, ੲ for ਇ ਈ ਏ, ੳ for ਉ ਊ ਓ (see toSearchLetters in ./score). ਣ, ੜ and ਙ
// never start a word, and the index files ਸ਼ under ਸ, ਖ਼ under ਖ, and so on.
export const WORD_STARTS: readonly [string, Alt[]][] = [
    ['chh', one('ਛ')],
    ['ch', [{ letter: 'ਚ', p: 0.85 }, { letter: 'ਛ', p: 0.15 }]],
    ['tth', one('ਠ')],
    ['th', [{ letter: 'ਤ', p: 0.45 }, { letter: 'ਠ', p: 0.3 }, { letter: 'ਥ', p: 0.25 }]],
    ['tt', [{ letter: 'ਟ', p: 0.8 }, { letter: 'ਤ', p: 0.2 }]],
    ['t', [{ letter: 'ਤ', p: 0.85 }, { letter: 'ਟ', p: 0.15 }]],
    ['ddh', one('ਢ')],
    ['dt', one('ਢ')],
    ['dh', [{ letter: 'ਧ', p: 0.85 }, { letter: 'ਢ', p: 0.1 }, { letter: 'ਦ', p: 0.05 }]],
    ['dd', one('ਡ')],
    ['d', [{ letter: 'ਦ', p: 0.85 }, { letter: 'ਡ', p: 0.1 }, { letter: 'ਧ', p: 0.05 }]],
    ['kh', one('ਖ')],
    ['k', [{ letter: 'ਕ', p: 0.95 }, { letter: 'ਖ', p: 0.05 }]],
    ['gh', one('ਘ')],
    ['g', [{ letter: 'ਗ', p: 0.95 }, { letter: 'ਘ', p: 0.05 }]],
    ['jh', one('ਝ')],
    ['j', [{ letter: 'ਜ', p: 0.95 }, { letter: 'ਝ', p: 0.05 }]],
    ['ph', one('ਫ')],
    ['f', one('ਫ')],
    ['p', one('ਪ')],
    ['bh', one('ਭ')],
    ['b', [{ letter: 'ਬ', p: 0.9 }, { letter: 'ਭ', p: 0.1 }]],
    ['sh', one('ਸ')],
    ['s', one('ਸ')],
    ['rh', one('ਰ')],
    ['r', one('ਰ')],
    ['v', one('ਵ')],
    ['w', one('ਵ')],
    ['n', one('ਨ')],
    ['m', one('ਮ')],
    ['l', one('ਲ')],
    ['h', one('ਹ')],
    ['y', one('ਯ')],
    ['x', one('ਖ')],
    ['z', one('ਜ')],
    ['q', one('ਕ')],
    ['c', one('ਕ')],
    ['aoo', one('ੳ')],
    ['aou', one('ੳ')],
    ['au', [{ letter: 'ਅ', p: 0.7 }, { letter: 'ੳ', p: 0.3 }]],
    ['a', one('ਅ')],
    ['ee', one('ੲ')],
    ['ei', one('ੲ')],
    ['e', [{ letter: 'ੲ', p: 0.8 }, { letter: 'ਅ', p: 0.2 }]],
    ['i', one('ੲ')],
    ['oo', one('ੳ')],
    ['ou', one('ੳ')],
    ['o', [{ letter: 'ੳ', p: 0.8 }, { letter: 'ਅ', p: 0.2 }]],
    ['u', one('ੳ')],
];
const BY_LENGTH = [...WORD_STARTS].sort((a, b) => b[0].length - a[0].length);

// The Gurmukhi letters a romanized word may start with, likeliest first.
export function wordInitials(word: string): Alt[] {
    if (word === IK_ONKAR) return one('ੴ');
    return BY_LENGTH.find(([start]) => word.startsWith(start))?.[1] ?? [];
}

// One English letter standing for a whole word ("spnh"). Without the rest
// of the word there are no digraphs to go by, so the guesses follow how
// often each letter starts a word of Sri Guru Granth Sahib Ji, counted over
// the recorded lines (ਤ 100, ਠ 6, ਥ 5; ਦ 56, ਧ 31; ਬ 59, ਭ 55, …).
export const LETTER_STARTS: Readonly<Record<string, Alt[]>> = {
    t: [{ letter: 'ਤ', p: 0.82 }, { letter: 'ਠ', p: 0.08 }, { letter: 'ਥ', p: 0.06 }, { letter: 'ਟ', p: 0.04 }],
    d: [{ letter: 'ਦ', p: 0.62 }, { letter: 'ਧ', p: 0.34 }, { letter: 'ਢ', p: 0.02 }, { letter: 'ਡ', p: 0.02 }],
    k: [{ letter: 'ਕ', p: 0.92 }, { letter: 'ਖ', p: 0.08 }],
    g: [{ letter: 'ਗ', p: 0.9 }, { letter: 'ਘ', p: 0.1 }],
    c: [{ letter: 'ਚ', p: 0.85 }, { letter: 'ਛ', p: 0.15 }],
    j: [{ letter: 'ਜ', p: 0.96 }, { letter: 'ਝ', p: 0.04 }],
    p: [{ letter: 'ਪ', p: 0.96 }, { letter: 'ਫ', p: 0.04 }],
    b: [{ letter: 'ਬ', p: 0.52 }, { letter: 'ਭ', p: 0.48 }],
    e: [{ letter: 'ੲ', p: 0.8 }, { letter: 'ਅ', p: 0.2 }],
    o: [{ letter: 'ੳ', p: 0.8 }, { letter: 'ਅ', p: 0.2 }],
    s: one('ਸ'), h: one('ਹ'), n: one('ਨ'), m: one('ਮ'), l: one('ਲ'), r: one('ਰ'),
    v: one('ਵ'), w: one('ਵ'), y: one('ਯ'), f: one('ਫ'), z: one('ਜ'), q: one('ਕ'), x: one('ਖ'),
    a: one('ਅ'), i: one('ੲ'), u: one('ੳ'),
};

export function letterInitials(letter: string): Alt[] {
    return LETTER_STARTS[letter] ?? [];
}

export type Variant = { letters: string; p: number };

// The likeliest spellings in Gurmukhi first letters of a run of positions
// (words or letters), each with its probability. Spellings far less likely
// than the best (under `ratio` of it) are dropped: each costs a lookup.
// Ties go to the earlier alternatives, so the order never varies.
export function variants(positions: Alt[][], limit: number, ratio = 0.1): Variant[] {
    if (positions.length === 0 || positions.some(alts => alts.length === 0)) return [];
    let all: { letters: string; p: number; order: number[] }[] = [{ letters: '', p: 1, order: [] }];
    for (const alts of positions) {
        all = all.flatMap(v => alts.map((alt, i) => ({ letters: v.letters + alt.letter, p: v.p * alt.p, order: [...v.order, i] })));
    }
    all.sort((a, b) => b.p - a.p || compareOrder(a.order, b.order));
    const best = all[0].p;
    return all.filter(v => v.p >= best * ratio).slice(0, limit).map(({ letters, p }) => ({ letters, p }));
}

function compareOrder(a: number[], b: number[]): number {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
}

// Which stretch of the words to look up. Five first letters in a row are
// selective enough to find a line; fewer guesses mean fewer lookups. So the
// window is the run of up to five positions whose two likeliest spellings
// cover the most probability; the leftmost wins a tie. A long query gets a
// second window at least two positions away, in case a word in the first
// was misspelled or split.
export type RomanWindow = { start: number; size: number; variants: Variant[] };

export function romanWindows(positions: Alt[][], maxSize = 5): RomanWindow[] {
    const size = Math.min(positions.length, maxSize);
    if (size === 0) return [];
    const windows: RomanWindow[] = [];
    for (let start = 0; start + size <= positions.length; start++) {
        windows.push({ start, size, variants: variants(positions.slice(start, start + size), 4) });
    }
    const mass = (w: RomanWindow) => w.variants.slice(0, 2).reduce((sum, v) => sum + v.p, 0);
    const pick = (from: RomanWindow[]) => from.reduce<RomanWindow | null>((best, w) => (!best || mass(w) > mass(best) ? w : best), null);
    const first = pick(windows);
    if (!first) return [];
    const second = positions.length >= 7 ? pick(windows.filter(w => Math.abs(w.start - first.start) >= 2)) : null;
    return second ? [first, second] : [first];
}

// --- Matching a transliteration --------------------------------------------

// One spelling per sound, so "tthaakur" and "thakur", "vaahiguroo" and
// "waheguru" come close: doubled letters single (aa, tt, rr), ee → i,
// oo → u, ph → f, sh → s, w → v, and a final ng → n.
export function romanKey(word: string): string {
    return word.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z]/g, '')
        .replace(/ph/g, 'f').replace(/sh/g, 's').replace(/w/g, 'v').replace(/z/g, 'j').replace(/q/g, 'k')
        .replace(/c(?!h)/g, 'k').replace(/x/g, 'kh').replace(/y/g, 'i')
        .replace(/ee/g, 'i').replace(/oo/g, 'u')
        .replace(/([a-z])\1+/g, '$1')
        .replace(/ng$/, 'n');
}

// The consonants alone: "karataa" and "karta" are both krt.
export const romanSkeleton = (key: string): string => key.replace(/[aeiou]/g, '');

export type Tuning = {
    strongWord: number;       // a word this similar counts as found
    minCoverage: number;      // share of the typed words (by consonants) a line must account for
    minCoverageShort: number; // the same for a three-word query, whose lookups return more strangers
    minStrong: number;        // words that must be found outright
    satisfied: number;        // a line this good ends the search early
};

export const TUNING: Tuning = {
    strongWord: 0.85,
    minCoverage: 0.65,
    minCoverageShort: 0.8,
    minStrong: 2,
    satisfied: 0.85,
};

type Word = { key: string; skeleton: string; weight: number };

const toWord = (token: string): Word => {
    const key = romanKey(token);
    const skeleton = romanSkeleton(key);
    // Consonants carry a word, as in ./score's weighting: ਕਾ, ਹੀ and ਜੀ
    // collide everywhere and count for little.
    return { key, skeleton, weight: Math.max(1, skeleton.length) };
};

// How alike two words are, from 0 to 1. A short word (two letters or fewer)
// is mostly vowels, so it has to match exactly: "so" is not "se".
export function wordSimilarity(a: string, b: string): number {
    const x = toWord(a);
    const y = toWord(b);
    return similarity(x, y);
}

function similarity(x: Word, y: Word): number {
    if (x.key === y.key) return 1;
    if (Math.min(x.key.length, y.key.length) <= 2) return 0;
    const skeleton = x.skeleton === y.skeleton && x.skeleton.length >= 2 ? 0.9 : 0;
    const edit = editSimilarity(x.key, y.key);
    return Math.max(skeleton, edit >= 0.6 ? edit : 0);
}

export type RomanMatch = {
    coverage: number;  // the share of the typed words the line accounts for, by consonants
    precision: number; // the share of the line the typed words account for
    strong: number;    // typed words found outright
};

type Cell = { score: number; line: number; strong: number };

// Lines up the typed words with a line's transliteration, in order, letting
// a word skip, and one word stand for two run together or apart ("satnam"
// for "sat naam"), and scores the best alignment.
export function alignRoman(typed: string[], transliteration: string): RomanMatch {
    const u = typed.map(toWord);
    const g = romanTokens(transliteration).map(toWord);
    const typedWeight = u.reduce((sum, w) => sum + w.weight, 0);
    const lineWeight = g.reduce((sum, w) => sum + w.weight, 0);
    if (u.length === 0 || g.length === 0) return { coverage: 0, precision: 0, strong: 0 };

    const join = (a: Word, b: Word) => toWord(a.key + b.key);
    const strongWord = TUNING.strongWord;
    const dp: Cell[][] = Array.from({ length: u.length + 1 }, () => Array.from({ length: g.length + 1 }, () => ({ score: 0, line: 0, strong: 0 })));
    const better = (a: Cell, b: Cell) => (b.score > a.score ? b : a);
    for (let i = 1; i <= u.length; i++) {
        for (let j = 1; j <= g.length; j++) {
            let cell = better(dp[i - 1][j], dp[i][j - 1]);
            const add = (from: Cell, sim: number, typedW: number, lineW: number, words: number) => {
                if (sim <= 0) return;
                cell = better(cell, { score: from.score + typedW * sim, line: from.line + lineW * sim, strong: from.strong + (sim >= strongWord ? words : 0) });
            };
            add(dp[i - 1][j - 1], similarity(u[i - 1], g[j - 1]), u[i - 1].weight, g[j - 1].weight, 1);
            if (j >= 2) add(dp[i - 1][j - 2], similarity(u[i - 1], join(g[j - 2], g[j - 1])), u[i - 1].weight, g[j - 2].weight + g[j - 1].weight, 1);
            if (i >= 2) add(dp[i - 2][j - 1], similarity(join(u[i - 2], u[i - 1]), g[j - 1]), u[i - 2].weight + u[i - 1].weight, g[j - 1].weight, 2);
            dp[i][j] = cell;
        }
    }
    const best = dp[u.length][g.length];
    return { coverage: best.score / typedWeight, precision: best.line / lineWeight, strong: best.strong };
}

// Whether a line found by its first letters is what was typed.
export function acceptsRoman(match: RomanMatch, words: number, tuning: Tuning = TUNING): boolean {
    const coverage = words <= 3 ? tuning.minCoverageShort : tuning.minCoverage;
    return match.coverage >= coverage && match.strong >= Math.min(tuning.minStrong, words);
}
