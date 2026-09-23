// SERVER-ONLY: checks every Gurbani line a chat reply quotes against
// GurbaniNow, and reports what the source actually says.
//
// For each quote: the page the reply cites is read first — a match there costs
// no search at all. Otherwise up to three first-letter/word searches look for
// a real line containing every word of the quote. What comes back:
//   verified   — found; the card shows the source's own spelling
//   wrong-ang  — found, but not on the Ang the reply cited
//   close      — the source answered every lookup; no real line contains the
//                quote, but one clearly resembles it
//   unverified — the source answered every lookup and nothing matched
// When the source can't be reached, or the per-reply budget runs out, a quote
// gets no card at all: silence is never turned into an accusation.

import { MAX_CITATIONS, SGGS_SOURCE_ID, type Citation, type CitationLine } from './citations';
import { extractQuotes, isPunjabiReply } from './extract';
import { gurbaniNow, SEARCH_TYPES, type GurbaniClient, type GurbaniLine, type SearchType } from './gurbaninow';
import { closeness, compare, containedRun, isClose, lineKeys, peel, toSearchLetters, type Comparison, type LineKeys } from './score';

const MAX_OUTBOUND = 12; // GurbaniNow calls per reply
const CONCURRENCY = 3;
const MAX_PEEL_DEPTH = 2;

type Session = {
    ang(n: number): Promise<GurbaniLine[] | null>;
    search(query: string, type: SearchType, results: number): Promise<GurbaniLine[] | null>;
};

// One reply's view of the client: Ang pages memoized (two quotes citing Ang 3
// share a fetch), every call counted against the budget.
function session(client: GurbaniClient, maxOutbound: number, signal?: AbortSignal): Session {
    let calls = 0;
    const take = () => {
        if (signal?.aborted || calls >= maxOutbound) return false;
        calls++;
        return true;
    };
    const pages = new Map<number, Promise<GurbaniLine[] | null>>();
    return {
        ang(n) {
            let page = pages.get(n);
            if (!page) {
                if (!take()) return Promise.resolve(null);
                page = client.fetchAng(n, signal);
                pages.set(n, page);
            }
            return page;
        },
        search(query, type, results) {
            return take() ? client.searchLines(query, type, results, signal) : Promise.resolve(null);
        },
    };
}

type Plan = { query: string; type: SearchType; results: number };

function planSearches(keys: LineKeys): Plan[] {
    const letters = toSearchLetters(keys.first);
    if (!letters) return [];
    const plans: Plan[] = [{ query: letters.slice(0, 12), type: SEARCH_TYPES.firstLettersAnywhere, results: 30 }];
    if (letters.length >= 7) {
        // The head catches a quote that runs two lines together; the tail
        // catches a wrong first word.
        plans.push({ query: letters.slice(0, 4), type: SEARCH_TYPES.firstLettersStart, results: 30 });
        plans.push({ query: letters.slice(-5), type: SEARCH_TYPES.firstLettersAnywhere, results: 30 });
    } else {
        // Short quotes match too many lines by first letters alone; two whole
        // words narrow it (all words must appear).
        // Folded: the query goes to GurbaniNow, which spells the subjoined
        // letters its own way (see foldSubjoined in ./score).
        const longest = [...new Set(keys.folded)].sort((a, b) => [...b].length - [...a].length).slice(0, 2);
        if (longest.length === 2) plans.push({ query: longest.join(' '), type: SEARCH_TYPES.allWords, results: 20 });
    }
    return plans;
}

function toCitationLine(line: GurbaniLine): CitationLine {
    return {
        gurmukhi: line.gurmukhi,
        translation: line.translation,
        ang: line.ang,
        lineNo: line.lineNo,
        shabadId: line.shabadId,
        writer: line.writer,
        writerGurmukhi: line.writerGurmukhi,
        raag: line.raag,
        raagGurmukhi: line.raagGurmukhi,
        source: line.source,
    };
}

type QuoteInput = {
    text: string;
    hasDanda: boolean;
    citedAng?: number;   // the Ang the reply gave
    nearAng?: number;    // for the second half of a peeled quote: where the first half was
};

async function verifyQuote(q: QuoteInput, s: Session, depth = 0): Promise<Citation[]> {
    const keys = lineKeys(q.text);
    let incomplete = false;
    let citedPageLoaded = false;
    const close: { line: GurbaniLine; cmp: Comparison }[] = [];

    const verdict = (line: GurbaniLine, exact: boolean): Citation => {
        const elsewhere = q.citedAng !== undefined
            && citedPageLoaded
            && line.source.id === SGGS_SOURCE_ID
            && line.ang !== null
            && Math.abs(line.ang - q.citedAng) > 1; // ±1: citing where a shabad starts is fine
        return {
            quote: q.text,
            status: elsewhere ? 'wrong-ang' : 'verified',
            exact,
            ...(q.citedAng !== undefined ? { citedAng: q.citedAng } : {}),
            line: toCitationLine(line),
        };
    };

    // Returns citations once a line contains (or, peeled, starts or ends) the
    // quote; otherwise records "close" candidates and returns null.
    const scan = async (lines: GurbaniLine[]): Promise<Citation[] | null> => {
        const candidates = lines.filter(line => !line.isHeader).map(line => ({ line, lk: lineKeys(line.gurmukhi) }));

        // One line holding the whole quote is the answer, wherever it sits in
        // the results — a shorter line that merely starts the quote must not
        // win just by being ranked higher.
        for (const { line, lk } of candidates) {
            const cmp = compare(keys, lk);
            if (cmp.contained) return [verdict(line, cmp.exact)];
            if (q.hasDanda && isClose(cmp)) close.push({ line, cmp });
        }

        if (depth >= MAX_PEEL_DEPTH) return null;
        for (const { line, lk } of candidates) {
            const rest = peel(keys, lk);
            if (!rest) continue;
            const found = verdict(line, containedRun(lk.folded, keys.folded));
            const restKeys = lineKeys(rest.join(' '));
            if (restKeys.raw.length < 3 || restKeys.letters < 7) return [found];
            return [found, ...await verifyQuote(
                { text: rest.join(' '), hasDanda: q.hasDanda, nearAng: line.ang ?? undefined },
                s,
                depth + 1,
            )];
        }
        return null;
    };

    const hint = q.citedAng ?? q.nearAng;
    if (hint !== undefined) {
        const page = await s.ang(hint);
        if (page === null) incomplete = true;
        else {
            citedPageLoaded = q.citedAng !== undefined;
            const hit = await scan(page);
            if (hit) return hit;
        }
    }

    for (const plan of planSearches(keys)) {
        const results = await s.search(plan.query, plan.type, plan.results);
        if (results === null) {
            incomplete = true;
            continue;
        }
        const hit = await scan(results);
        if (hit) return hit;
    }

    // Nothing contains the quote. Without a danda the reply never claimed it
    // was scripture, so there is nothing to flag. With a lookup unanswered,
    // the line that does contain it may be the one we missed: "close" is an
    // accusation too, so it needs every answer, just as "unverified" does.
    if (!q.hasDanda || incomplete) return [];
    const cited = q.citedAng !== undefined ? { citedAng: q.citedAng } : {};
    if (close.length > 0) {
        close.sort((a, b) =>
            closeness(b.cmp) - closeness(a.cmp)
            || Number(b.line.ang === hint) - Number(a.line.ang === hint)
            || Number(b.line.source.id === SGGS_SOURCE_ID) - Number(a.line.source.id === SGGS_SOURCE_ID)
            || (a.line.ang ?? Infinity) - (b.line.ang ?? Infinity));
        return [{ quote: q.text, status: 'close', ...cited, line: toCitationLine(close[0].line) }];
    }
    return [{ quote: q.text, status: 'unverified', ...cited }];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
}

export async function verifyReply(
    text: string,
    opts: { client?: GurbaniClient; signal?: AbortSignal; maxOutbound?: number; maxCitations?: number } = {},
): Promise<Citation[]> {
    // The chat shows at most MAX_CITATIONS cards, so it checks that many
    // quotes; npm run eval:chat lifts both limits to score every quote.
    const limit = opts.maxCitations ?? MAX_CITATIONS;
    const quotes = extractQuotes(text, { punjabiReply: isPunjabiReply(text), limit });
    if (quotes.length === 0) return [];
    const s = session(opts.client ?? gurbaniNow, opts.maxOutbound ?? MAX_OUTBOUND, opts.signal);
    const perQuote = await mapLimit(quotes, CONCURRENCY, q =>
        verifyQuote({ text: q.quote, hasDanda: q.hasDanda, citedAng: q.angHint }, s));

    // Document order; one card per source line.
    const seen = new Set<string>();
    const out: Citation[] = [];
    for (const citation of perQuote.flat()) {
        const key = citation.line ? `${citation.line.ang}:${citation.line.gurmukhi}` : `quote:${citation.quote}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(citation);
        if (out.length === limit) break;
    }
    return out;
}
