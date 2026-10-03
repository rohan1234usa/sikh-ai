// The verse search behind Shabad Search. For a classified query
// (./query.ts) it plans at most four GurbaniNow lookups in two waves, runs
// the second only when the first didn't settle it, and ranks the lines that
// come back: one hit per shabad, the best match first.
//
// It has no client of its own: /api/shabad/search passes the live one (Sri
// Guru Granth Sahib Ji only, on its own daily allowance), the tests a
// recording. Like the quote checker (./verify.ts), it never turns silence
// into an answer: null when the source answered nothing, and `complete:
// false` when some lookup went unanswered, so "nothing matched" is only
// ever said when every lookup was answered.

import { SGGS_SOURCE_ID } from './citations';
import { SEARCH_TYPES, type GurbaniClient, type GurbaniLine, type SearchType } from './gurbaninow';
import { firstLetters } from './gurmukhi';
import type { MatchKind, SearchableQuery, VerseHit } from './query';
import {
    acceptsRoman, alignRoman, letterInitials, romanWindows, TUNING, wordInitials, type Alt, type RomanMatch, type Tuning, type Variant,
} from './roman';
import { closeness, compare, isClose, lineKeys, looseKey, toSearchLetters, type LineKeys } from './score';
import { isGurbaniId } from './shabad';

export const MAX_SEARCH_CALLS = 4;
export const MAX_HITS = 20;
// A line repeated across shabads (the Mool Mantar is in 42) shows this many
// times, and says how many more there are.
const MAX_SAME_LINE = 3;
// GurbaniNow's first-letter search reads 12 letters at most usefully; more
// only narrow what is already narrow.
const MAX_QUERY_LETTERS = 12;
const PHRASE_WORDS = 10;

export type Lookup = { query: string; type: SearchType; results: number };

export type VerseSearch = {
    hits: VerseHit[];
    complete: boolean;  // every lookup made was answered, and none was skipped for want of budget
    truncated: boolean; // more lines matched than were read or shown: more words would narrow it
    calls: number;
};

// "॥੧॥ ਰਹਾਉ ॥" closes a refrain, and GurbaniNow's index keeps the verse
// number between the line and ਰਹਾਉ, so neither its words nor its first
// letters match across it. Lookups leave a closing ਰਹਾਉ out; the ranking,
// which reads the whole line, keeps it.
const RAHAO = looseKey('ਰਹਾਉ');
const ROMAN_RAHAO = /^rah?a{0,2}(?:o|u|au|ao|aau|aao)$/;
const withoutRahao = <T>(words: T[], isRahao: (word: T) => boolean): T[] => {
    let end = words.length;
    while (end > 1 && isRahao(words[end - 1])) end--;
    return words.slice(0, end);
};

const anywhere = (letters: string, results = 30): Lookup => ({ query: letters, type: SEARCH_TYPES.firstLettersAnywhere, results });
const start = (letters: string, results = 30): Lookup => ({ query: letters, type: SEARCH_TYPES.firstLettersStart, results });
const take = (letters: string, from: number, count?: number) => [...letters].slice(from, count === undefined ? undefined : from + count).join('');
const count = (letters: string) => [...letters].length;

// The two longest different words, for the all-words lookup: long words are
// rare, so two of them pick out few lines.
function longestTwo(keys: LineKeys): string {
    return [...new Set(keys.folded)].sort((a, b) => count(b) - count(a)).slice(0, 2).join(' ');
}

// Where Latin letters are ambiguous, the likeliest spellings of the least
// ambiguous stretch are looked up first; a second stretch, when the query is
// long, guards against one mistyped word.
function romanLookups(positions: Alt[][]): Lookup[][] {
    const windows = romanWindows(positions);
    if (windows.length === 0 || windows[0].variants.length === 0) return [];
    const [first, second] = windows;
    const lookup = (v: Variant, w = first) => (w.size >= 4 ? anywhere(v.letters) : start(v.letters, 50));
    const order = dedupe([
        first.variants[0] && lookup(first.variants[0]),
        first.variants[1] && lookup(first.variants[1]),
        second?.variants[0] && lookup(second.variants[0], second),
        first.variants[2] && lookup(first.variants[2]),
        second?.variants[1] && lookup(second.variants[1], second),
        first.variants[3] && lookup(first.variants[3]),
    ].filter((l): l is Lookup => Boolean(l)));
    const waves = [order.slice(0, 2), order.slice(2, 4)];
    // Three letters are looked up from the start of a line first, then
    // anywhere in one, for words typed from its middle.
    if (positions.length === 3) waves[1] = [anywhere(first.variants[0].letters, 50), ...order.slice(2)].slice(0, 2);
    return waves.filter(wave => wave.length > 0);
}

function dedupe(lookups: Lookup[]): Lookup[] {
    const seen = new Set<string>();
    return lookups.filter(l => {
        const key = `${l.type}:${l.query}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// The lookups for a query, in waves. Pure, so the tests and the eval's
// --dry-run can read it.
export function planSearch(query: SearchableQuery): Lookup[][] {
    switch (query.kind) {
        case 'gurmukhi': {
            const keys = lineKeys(withoutRahao(query.words, word => looseKey(word) === RAHAO).join(' '));
            const letters = toSearchLetters(keys.first);
            const n = count(letters);
            const phrase: Lookup = { query: keys.folded.slice(0, PHRASE_WORDS).join(' '), type: SEARCH_TYPES.phrase, results: 30 };
            const allWords: Lookup = { query: longestTwo(keys), type: SEARCH_TYPES.allWords, results: 30 };
            const first = n >= 4 ? anywhere(take(letters, 0, MAX_QUERY_LETTERS)) : n === 3 ? start(letters, 50) : allWords;
            const second = [
                ...(first === allWords ? [] : [allWords]),
                ...(n >= 7 ? [anywhere(take(letters, n - 5))] : n >= 5 ? [start(take(letters, 0, 4))] : []),
            ];
            return [dedupe([phrase, first]), dedupe(second)].filter(wave => wave.length > 0);
        }
        case 'gurmukhi-letters': {
            const letters = query.letters;
            const n = count(letters);
            if (n <= 3) return [[start(letters, 50)]];
            if (n === 4) return [[start(letters), anywhere(letters)]];
            const first = [anywhere(take(letters, 0, MAX_QUERY_LETTERS))];
            // A mistyped letter breaks the run; its two ends still find the line.
            return n >= 6 ? [first, [start(take(letters, 0, 4)), anywhere(take(letters, n - 5))]] : [first];
        }
        case 'roman':
            return romanLookups(withoutRahao(query.words, word => ROMAN_RAHAO.test(word)).map(wordInitials));
        case 'roman-letters':
            return romanLookups([...query.letters].map(letterInitials));
    }
}

// --- Ranking ----------------------------------------------------------------

type Ranked = { line: GurbaniLine; match: MatchKind; tier: number; score: number; whole: number };

// Each candidate line scored against the query, or null when it doesn't
// match closely enough to show.
function scorer(query: SearchableQuery, tuning: Tuning): (line: GurbaniLine) => Ranked | null {
    const lineLetters = (line: GurbaniLine) => toSearchLetters(firstLetters(line.gurmukhi));
    switch (query.kind) {
        case 'gurmukhi': {
            const keys = lineKeys(query.words.join(' '));
            return (line) => {
                const cmp = compare(keys, lineKeys(line.gurmukhi));
                const whole = cmp.lettersQ / Math.max(1, cmp.lettersV);
                const score = closeness(cmp);
                if (cmp.exact) return { line, match: 'exact', tier: 4, score, whole };
                if (cmp.contained) return { line, match: 'contained', tier: 3, score, whole };
                if (isClose(cmp)) return { line, match: 'close', tier: 2, score, whole };
                // The first letters agree, in order, though the words don't.
                const run = Math.max(3, cmp.firstQ - 1);
                return cmp.orderRun >= run ? { line, match: 'letters', tier: 1, score: cmp.orderRun / Math.max(1, cmp.firstQ), whole } : null;
            };
        }
        case 'gurmukhi-letters': {
            const typed = query.letters;
            return (line) => {
                const letters = lineLetters(line);
                const whole = count(typed) / Math.max(1, count(letters));
                if (letters.startsWith(typed)) return { line, match: 'letters', tier: 1, score: 1, whole };
                if (letters.includes(typed)) return { line, match: 'letters', tier: 1, score: 0.8, whole };
                return count(typed) >= 6 && nearRun(typed, letters) ? { line, match: 'letters', tier: 1, score: 0.6, whole } : null;
            };
        }
        case 'roman': {
            return (line) => {
                if (!line.transliteration) return null;
                const m: RomanMatch = alignRoman(query.words, line.transliteration);
                return acceptsRoman(m, query.words.length, tuning)
                    ? { line, match: 'roman', tier: 1, score: m.coverage, whole: m.precision }
                    : null;
            };
        }
        case 'roman-letters': {
            const positions = [...query.letters].map(letterInitials);
            return (line) => {
                const found = bestLetterRun(positions, lineLetters(line));
                return found ? { line, match: 'letters', tier: 1, score: found.score, whole: positions.length / Math.max(1, count(lineLetters(line))) } : null;
            };
        }
    }
}

// Every typed letter but one, in a row: a single typo.
function nearRun(typed: string, letters: string): boolean {
    const t = [...typed];
    const l = [...letters];
    for (let offset = 0; offset + t.length <= l.length; offset++) {
        let misses = 0;
        for (let i = 0; i < t.length && misses <= 1; i++) if (t[i] !== l[offset + i]) misses++;
        if (misses <= 1) return true;
    }
    return false;
}

// Where a run of romanized first letters sits in a line's own: each letter
// must be one its guesses allow, with one miss forgiven in six or more. The
// likelier the guesses that fit, and the nearer the start, the better.
function bestLetterRun(positions: Alt[][], letters: string): { score: number } | null {
    const l = [...letters];
    let best: number | null = null;
    for (let offset = 0; offset + positions.length <= l.length; offset++) {
        let misses = 0;
        let p = 1;
        for (let i = 0; i < positions.length; i++) {
            const alt = positions[i].find(a => a.letter === l[offset + i]);
            if (alt) p *= alt.p;
            else misses++;
        }
        if (misses > (positions.length >= 6 ? 1 : 0)) continue;
        const score = p * (offset === 0 ? 1 : 0.8) * (misses ? 0.5 : 1);
        if (best === null || score > best) best = score;
    }
    return best === null ? null : { score: best };
}

const band = (score: number) => Math.round(score * 20);

// Best first, and always in the same order: the CDN keeps one answer per
// query, and the tests compare whole lists.
function byRank(a: Ranked, b: Ranked): number {
    return b.tier - a.tier
        || band(b.score) - band(a.score)
        || Number(b.whole >= 0.9) - Number(a.whole >= 0.9)
        || (a.line.ang ?? Infinity) - (b.line.ang ?? Infinity)
        || (a.line.lineNo ?? Infinity) - (b.line.lineNo ?? Infinity)
        || a.line.id.localeCompare(b.line.id);
}

const sameLineKey = (line: GurbaniLine) => lineKeys(line.gurmukhi).raw.map(looseKey).join(' ');

// One hit per shabad, its best line; a line repeated in other shabads
// appears at most MAX_SAME_LINE times, each saying how many others there are.
export function rankLines(query: SearchableQuery, lines: GurbaniLine[], opts: { maxHits?: number; tuning?: Tuning } = {}): { hits: VerseHit[]; more: boolean } {
    const score = scorer(query, opts.tuning ?? TUNING);
    const unique = new Map<string, GurbaniLine>();
    for (const line of lines) {
        if (line.isHeader || line.source.id !== SGGS_SOURCE_ID || !isGurbaniId(line.id) || !isGurbaniId(line.shabadId)) continue;
        if (!unique.has(line.id)) unique.set(line.id, line);
    }
    let ranked = [...unique.values()].map(score).filter((r): r is Ranked => r !== null);
    // Lines that match only by first letters are noise once any line matches
    // by its words.
    if (ranked.some(r => r.tier >= 2)) ranked = ranked.filter(r => r.tier >= 2);
    ranked.sort(byRank);

    const shabads = new Set<string>();
    const perShabad: Ranked[] = [];
    for (const r of ranked) {
        if (shabads.has(r.line.shabadId)) continue;
        shabads.add(r.line.shabadId);
        perShabad.push(r);
    }
    const shabadsWith = new Map<string, number>();
    for (const r of perShabad) shabadsWith.set(sameLineKey(r.line), (shabadsWith.get(sameLineKey(r.line)) ?? 0) + 1);
    const shown = new Map<string, number>();
    const hits: VerseHit[] = [];
    for (const r of perShabad) {
        const key = sameLineKey(r.line);
        const already = shown.get(key) ?? 0;
        if (already >= MAX_SAME_LINE) continue;
        shown.set(key, already + 1);
        hits.push(toHit(r.line, r.match, (shabadsWith.get(key) ?? 1) - 1));
    }
    const max = opts.maxHits ?? MAX_HITS;
    return { hits: hits.slice(0, max), more: hits.length > max };
}

function toHit(line: GurbaniLine, match: MatchKind, sameLineIn: number): VerseHit {
    return {
        lineId: line.id,
        shabadId: line.shabadId,
        gurmukhi: line.gurmukhi,
        transliteration: line.transliteration,
        translation: line.translation,
        ang: line.ang,
        lineNo: line.lineNo,
        writer: line.writer,
        writerGurmukhi: line.writerGurmukhi,
        raag: line.raag,
        raagGurmukhi: line.raagGurmukhi,
        match,
        sameLineIn,
    };
}

// Whether what has been found so far settles the search: the second wave
// only runs when it hasn't.
function settled(query: SearchableQuery, hits: VerseHit[], lines: GurbaniLine[], tuning: Tuning): boolean {
    switch (query.kind) {
        case 'gurmukhi':
            return hits.some(h => h.match === 'exact' || h.match === 'contained');
        case 'gurmukhi-letters':
            return lines.some(line => toSearchLetters(firstLetters(line.gurmukhi)).includes(query.letters));
        case 'roman':
            return lines.some(line => line.transliteration && alignRoman(query.words, line.transliteration).coverage >= tuning.satisfied);
        case 'roman-letters': {
            const positions = [...query.letters].map(letterInitials);
            return lines.some(line => {
                const letters = [...toSearchLetters(firstLetters(line.gurmukhi))];
                for (let offset = 0; offset + positions.length <= letters.length; offset++) {
                    if (positions.every((alts, i) => alts.some(a => a.letter === letters[offset + i]))) return true;
                }
                return false;
            });
        }
    }
}

export async function searchVerses(query: SearchableQuery, opts: {
    client: GurbaniClient;
    signal?: AbortSignal;
    maxCalls?: number;
    maxHits?: number;
    tuning?: Tuning;
}): Promise<VerseSearch | null> {
    const tuning = opts.tuning ?? TUNING;
    const budget = opts.maxCalls ?? MAX_SEARCH_CALLS;
    const pool: GurbaniLine[] = [];
    let calls = 0;
    let answered = 0;
    let complete = true;
    let truncated = false;

    for (const wave of planSearch(query)) {
        if (opts.signal?.aborted || calls >= budget) {
            complete = false;
            break;
        }
        const lookups = wave.slice(0, budget - calls);
        if (lookups.length < wave.length) complete = false;
        calls += lookups.length;
        const answers = await Promise.all(lookups.map(l => opts.client.searchLines(l.query, l.type, l.results, opts.signal)));
        answers.forEach((lines, i) => {
            if (lines === null) {
                complete = false;
                return;
            }
            answered++;
            if (lines.length >= lookups[i].results) truncated = true;
            pool.push(...lines);
        });
        // Nothing answered: the source is down, and more lookups would only
        // add to its load.
        if (answered === 0) break;
        if (settled(query, rankLines(query, pool, { tuning }).hits, pool, tuning)) break;
    }

    if (answered === 0) return null;
    const { hits, more } = rankLines(query, pool, { maxHits: opts.maxHits, tuning });
    return { hits, complete, truncated: truncated || more, calls };
}
