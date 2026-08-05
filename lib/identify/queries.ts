// Pure: turns a heard transcription into a small set of Gurbani searches.
// No network — scripts/identify-eval replays this against captured responses.
//
// The premise is redundancy over precision. Any single query can miss: a first
// letter mid-line comes out wrong and a contiguous search finds nothing. So we
// fire a handful of deliberately different shots — different lines, different
// windows of the same line, whole words instead of first letters — and let the
// scoring stage sort out what actually matches. One good hit is enough.

import type { HeardLine, Level } from './config';
import { firstLetters, tokens } from './gurmukhi';

// GurbaniNow search modes. 0 and 1 index first letters and accept Unicode
// Gurmukhi; 4 matches whole words. Mode 2 (full line) only accepts the legacy
// ASCII font encoding, so it is deliberately unused.
export const SEARCH_TYPES = {
    firstLettersStart: 0,
    firstLettersAnywhere: 1,
    allWords: 4,
} as const;

export type SearchQuery = {
    text: string;
    searchtype: number;
    results: number;
    // Why this query exists — surfaced by the eval harness when tuning.
    label: string;
};

// Cap on outbound searches per identification. Every extra query is latency
// the user waits through, and past this the marginal recall is near zero.
export const MAX_QUERIES = 6;

// A first-letter run shorter than this matches hundreds of lines, and the
// result cap then truncates them arbitrarily — pure noise. Anchored searches
// (mode 0, matching from the start of a line) are selective enough at three.
const MIN_ANYWHERE_LETTERS = 4;
const MIN_ANCHORED_LETTERS = 3;

const CONFIDENCE_RANK: Record<Level, number> = { high: 0, medium: 1, low: 2 };

// Best evidence first: a line the model was confident about, and among equals
// the longest, since more letters means a more selective query.
function rankLines(lines: HeardLine[]): HeardLine[] {
    return [...lines].sort((a, b) => {
        const byConfidence = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
        if (byConfidence !== 0) return byConfidence;
        return firstLetters(b.gurmukhi).length - firstLetters(a.gurmukhi).length;
    });
}

// Three consecutive words with the most letters between them — a proxy for
// the most distinctive phrase in the line. Common short words (ਦੇ, ਨੇ, ਹੈ)
// naturally lose to longer content words.
function longestWordWindow(line: string, size = 3): string {
    const words = tokens(line);
    if (words.length <= size) return words.join(' ');
    let best = '';
    let bestLength = -1;
    for (let i = 0; i + size <= words.length; i++) {
        const window = words.slice(i, i + size);
        const length = window.reduce((sum, w) => sum + w.length, 0);
        if (length > bestLength) {
            bestLength = length;
            best = window.join(' ');
        }
    }
    return best;
}

export function planQueries(lines: HeardLine[], guessedFirstLine = ''): SearchQuery[] {
    const ranked = rankLines(lines);
    const candidates: SearchQuery[] = [];

    const anywhere = (text: string, label: string): SearchQuery => ({
        text,
        searchtype: SEARCH_TYPES.firstLettersAnywhere,
        results: 20,
        label,
    });

    const first = ranked[0] ? firstLetters(ranked[0].gurmukhi) : '';
    const second = ranked[1] ? firstLetters(ranked[1].gurmukhi) : '';
    const guess = firstLetters(guessedFirstLine);

    // 1-2. The two best heard lines, whole. Matching "anywhere" rather than
    // from the start matters because a recording usually begins mid-line.
    if (first.length >= MIN_ANYWHERE_LETTERS) candidates.push(anywhere(first, 'line1'));
    if (second.length >= MIN_ANYWHERE_LETTERS) candidates.push(anywhere(second, 'line2'));

    // 3. The recognition guess. Famous lines open their compositions, so this
    // one is anchored. Its results are candidates to be scored like any other
    // — the guess itself is never an answer.
    if (guess.length >= MIN_ANCHORED_LETTERS) {
        candidates.push({
            text: guess.slice(0, 8),
            searchtype: SEARCH_TYPES.firstLettersStart,
            results: 10,
            label: 'guess',
        });
    }

    // 4 & 6. Head and tail windows of the best line. A contiguous search dies
    // on a single wrong letter, so these give the front half and the back half
    // an independent chance to land.
    if (first.length >= 8) {
        candidates.push(anywhere(first.slice(0, 5), 'line1-head'));
    }

    // 5. Whole words instead of first letters — precise where the first-letter
    // index is noisy, e.g. when the model corrected spellings well.
    if (ranked[0]) {
        const window = longestWordWindow(ranked[0].gurmukhi);
        if (window) {
            candidates.push({
                text: window,
                searchtype: SEARCH_TYPES.allWords,
                results: 10,
                label: 'line1-words',
            });
        }
    }

    if (first.length >= 8) {
        candidates.push(anywhere(first.slice(-5), 'line1-tail'));
    }

    // A third line backfills whatever slots the checks above left empty.
    const third = ranked[2] ? firstLetters(ranked[2].gurmukhi) : '';
    if (third.length >= MIN_ANYWHERE_LETTERS) candidates.push(anywhere(third, 'line3'));

    const seen = new Set<string>();
    const plan: SearchQuery[] = [];
    for (const query of candidates) {
        const key = `${query.searchtype}:${query.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        plan.push(query);
        if (plan.length >= MAX_QUERIES) break;
    }
    return plan;
}
