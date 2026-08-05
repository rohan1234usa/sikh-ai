// SERVER-ONLY: GurbaniNow client for Shabad identification. Same never-throw,
// fast-timeout posture as lib/translate/cloud.ts — this sits on a user request
// path where a hanging dependency is worse than a missing one.
//
// Separate from lib/gurbani/verse.ts: that helper normalizes an Ang listing
// down to gurmukhi + translation, while matching needs the fields it drops
// (shabad id, first letters, writer, raag, Ang, line number).
//
// The distinction between [] and null is load-bearing. An empty array means
// "the source answered and nothing matched" — an ordinary outcome for a
// deliberately redundant query plan. null means the source did not answer, and
// only that turns into an error for the user.

import type { MatchVerse } from './config';

const BASE = 'https://api.gurbaninow.com/v2';
// Six of these run in parallel, so the budget is per call, not cumulative.
// A search that has not answered in four seconds is one the other five will
// have covered.
const SEARCH_TIMEOUT_MS = 4000;
const SHABAD_TIMEOUT_MS = 3500;

export type GurbaniVerse = {
    verseId: string;      // unique per line; used to dedupe across queries
    shabadId: string;
    gurmukhi: string;
    transliteration: string;
    translation: string;
    source: string;
    writer: string;
    raag: string;
    ang: number | null;
    lineNo: number | null;
};

function text(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

function num(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// GurbaniNow nests the same content differently across endpoints and has been
// known to return a bare string where an object is documented, so every field
// is reached defensively and a missing one degrades to '' rather than throwing.
function pick(container: unknown, ...keys: string[]): unknown {
    let current = container;
    for (const key of keys) {
        if (!current || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

function unicodeOf(v: unknown): string {
    if (typeof v === 'string') return v.trim();
    return text(pick(v, 'unicode'));
}

function englishOf(v: unknown): string {
    if (typeof v === 'string') return v.trim();
    const direct = text(pick(v, 'english'));
    if (direct) return direct;
    return text(pick(v, 'english', 'default')) || text(pick(v, 'default'));
}

function toVerse(raw: unknown, index: number): GurbaniVerse | null {
    // Search results wrap each verse in { shabad: {...} }; shabad listings wrap
    // it in { line: {...} }.
    const v = (pick(raw, 'shabad') ?? pick(raw, 'line') ?? raw) as Record<string, unknown> | undefined;
    if (!v || typeof v !== 'object') return null;

    const gurmukhi = unicodeOf(v.gurmukhi);
    if (!gurmukhi) return null;

    const shabadId = text(v.shabadid) || text(v.shabadId);
    return {
        verseId: text(v.id) || `${shabadId}:${index}`,
        shabadId,
        gurmukhi,
        transliteration: text(pick(v, 'transliteration', 'english', 'text')),
        translation: englishOf(v.translation),
        source: text(pick(v, 'source', 'english')),
        writer: text(pick(v, 'writer', 'english')),
        raag: text(pick(v, 'raag', 'english')),
        ang: num(v.pageno),
        lineNo: num(v.lineno) ?? num(v.linenum),
    };
}

async function getJson(url: string, timeoutMs: number): Promise<unknown | null> {
    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(timeoutMs),
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
            console.error(`Identify Error: GurbaniNow HTTP ${res.status}`);
            return null;
        }
        return await res.json();
    } catch (error) {
        console.error('Identify Error: GurbaniNow request failed', error instanceof Error ? error.message : error);
        return null;
    }
}

// [] = answered, nothing matched. null = did not answer.
export async function searchGurbani(
    query: string,
    searchtype: number,
    results: number,
): Promise<GurbaniVerse[] | null> {
    const url = `${BASE}/search/${encodeURIComponent(query)}?searchtype=${searchtype}&results=${results}`;
    const data = await getJson(url, SEARCH_TIMEOUT_MS);
    if (data === null) return null;

    const shabads = pick(data, 'shabads');
    if (!Array.isArray(shabads)) return [];
    return shabads
        .map((item, i) => toVerse(item, i))
        .filter((verse): verse is GurbaniVerse => verse !== null && verse.shabadId !== '');
}

export type FullShabad = {
    lines: MatchVerse[];   // display text, header lines included
    verses: GurbaniVerse[]; // scoreable lines only (headers dropped)
    ang: number | null;
};

// type 2 marks a structural header ("ਸਿਰੀਰਾਗੁ ਮਹਲਾ ੩ ॥") — worth showing to a
// reader, but it would match every shabad in that raag, so it never scores.
const HEADER_LINE_TYPE = 2;

export async function fetchShabad(shabadId: string): Promise<FullShabad | null> {
    const data = await getJson(`${BASE}/shabad/${encodeURIComponent(shabadId)}`, SHABAD_TIMEOUT_MS);
    if (data === null) return null;

    const entries = pick(data, 'shabad');
    if (!Array.isArray(entries)) return null;

    const lines: MatchVerse[] = [];
    const verses: GurbaniVerse[] = [];
    entries.forEach((entry, index) => {
        const verse = toVerse(entry, index);
        if (!verse) return;
        lines.push({
            gurmukhi: verse.gurmukhi,
            transliteration: verse.transliteration,
            translation: verse.translation,
        });
        if (pick(entry, 'line', 'type') !== HEADER_LINE_TYPE) {
            verses.push({ ...verse, shabadId: verse.shabadId || shabadId });
        }
    });

    if (lines.length === 0) return null;
    return { lines, verses, ang: num(pick(data, 'shabadinfo', 'pageno')) };
}
