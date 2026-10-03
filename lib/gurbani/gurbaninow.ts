// SERVER-ONLY: GurbaniNow client for checking quoted lines, and the fetches
// behind the Hukamnama page and the Ang reader. Same posture as
// lib/translate/cloud.ts: never throws, and times out fast. The quote checker
// also meters itself.
//
// The difference between null and [] is load-bearing. [] means the source
// answered and nothing matched — evidence a line is not in Gurbani. null
// means the source did not answer, which is no evidence at all, and must
// never turn into an "unverified" verdict.
//
// Ang text never changes, so responses are cached for a month in the host's
// data cache (the `next` option; ignored outside Next, e.g. in tests).

import { MAX_ANG, SGGS_SOURCE_ID } from './citations';
import { assignAngs, isGurbaniId, lineKind, type Shabad, type ShabadLine } from './shabad';
import { describeError, logEvent } from '../log';

const BASE = 'https://api.gurbaninow.com/v2';
const TIMEOUT_MS = 3500;
const REVALIDATE_SECONDS = 30 * 24 * 60 * 60;
// Today's Hukamnama changes once a day; ten minutes keeps a new one late by
// at most that.
const HUKAMNAMA_REVALIDATE_SECONDS = 10 * 60;
// Best-effort ceilings per warm instance, each charged before its request, so
// a loop on a failing source cannot hammer a free public API. The quote
// checker and Shabad Search count separately: a busy day of searches must
// not switch off quote checking, nor the reverse. A search makes at most four
// calls, and the CDN answers repeated searches without any.
export const QUOTE_CHECK_DAILY_CEILING = 3000;
export const VERSE_SEARCH_DAILY_CEILING = 5000;
const HEADER_LINE_TYPE = 2; // "ਸਿਰੀਰਾਗੁ ਮਹਲਾ ੩ ॥" and the like

// GurbaniNow's search types. phrase matches the words exactly as written, in
// order; allWords wants every word, in any order, each anywhere in a word.
export const SEARCH_TYPES = { firstLettersStart: 0, firstLettersAnywhere: 1, phrase: 2, allWords: 4 } as const;
export type SearchType = (typeof SEARCH_TYPES)[keyof typeof SEARCH_TYPES];

export type GurbaniLine = {
    id: string;
    shabadId: string;
    gurmukhi: string;
    translation: string;
    transliteration: string; // GurbaniNow's romanization, '' when it gives none
    writer: string;
    writerGurmukhi: string;
    raag: string;
    raagGurmukhi: string;
    source: { id: number; name: string; nameGurmukhi: string };
    ang: number | null;
    lineNo: number | null;
    isHeader: boolean;
};

export type GurbaniClient = {
    fetchAng(ang: number, signal?: AbortSignal): Promise<GurbaniLine[] | null>;
    searchLines(query: string, searchtype: SearchType, results: number, signal?: AbortSignal): Promise<GurbaniLine[] | null>;
};

type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (v && typeof v === 'object' ? v as Json : {});
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
// Ids are strings upstream; one sent as a number would otherwise be lost.
const idText = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? String(v) : text(v));

function toSource(v: unknown): GurbaniLine['source'] {
    const s = obj(v);
    return { id: num(s.id) ?? 0, name: text(s.english), nameGurmukhi: text(s.unicode) };
}

// The text fields a line has wherever it comes from: an Ang, a search, or a
// whole shabad.
function lineText(v: Json) {
    const english = obj(v.translation).english;
    const roman = obj(v.transliteration).english;
    return {
        gurmukhi: text(obj(v.gurmukhi).unicode) || text(v.gurmukhi),
        translation: text(english) || text(obj(english).default),
        transliteration: text(roman) || text(obj(roman).text),
    };
}

function toLine(raw: unknown, source?: GurbaniLine['source']): GurbaniLine | null {
    const v = obj(raw);
    const { gurmukhi, translation, transliteration } = lineText(v);
    const id = idText(v.id);
    if (!gurmukhi || !id) return null;
    const writer = obj(v.writer);
    const raag = obj(v.raag);
    return {
        id,
        shabadId: idText(v.shabadid),
        gurmukhi,
        translation,
        transliteration,
        writer: text(writer.english),
        writerGurmukhi: text(writer.unicode),
        raag: text(raag.english),
        raagGurmukhi: text(raag.unicode),
        source: source ?? toSource(v.source),
        ang: num(v.pageno),
        lineNo: num(v.lineno),
        isHeader: v.type === HEADER_LINE_TYPE,
    };
}

// An Ang page carries its source once, at the top; its lines don't.
export function parseAngPayload(data: unknown): GurbaniLine[] | null {
    const d = obj(data);
    if (d.error === true || !Array.isArray(d.page)) return null;
    const source = toSource(d.source);
    const lines = d.page.map(item => toLine(obj(item).line, source)).filter((l): l is GurbaniLine => l !== null);
    return lines.length > 0 ? lines : null;
}

// Search results carry their own source each. Only a shape we recognise may
// answer "nothing matched" ([]); anything else is no answer at all (null), or
// a correct quote would earn a card saying it could not be found. The live
// endpoint says it as { count: 0, shabads: [], error: false }; of the worded
// errors, only its "Nothing Found!" means that — any other is a failure.
export function parseSearchPayload(data: unknown): GurbaniLine[] | null {
    const d = obj(data);
    if (d.error === true) return null;
    if (Array.isArray(d.shabads)) {
        return d.shabads.map(item => toLine(obj(item).shabad)).filter((l): l is GurbaniLine => l !== null);
    }
    return typeof d.error === 'string' && /^nothing found/i.test(d.error.trim()) ? [] : null;
}

// A whole shabad. Its writer, raag, source, first Ang and neighbours come
// once, in shabadinfo; each line brings only its text, its kind and its place
// on the page, from which its Ang follows (assignAngs). null for anything
// that is not a usable shabad.
export function parseShabadPayload(data: unknown): Shabad | null {
    const d = obj(data);
    const info = obj(d.shabadinfo);
    const id = idText(info.shabadid);
    if (d.error || !isGurbaniId(id) || !Array.isArray(d.shabad)) return null;
    const raw = d.shabad.map(item => obj(obj(item).line));
    const lineNos = raw.map(v => num(v.linenum) ?? num(v.lineno));
    const start = num(info.pageno);
    const angs = assignAngs(start, lineNos);
    const lines: ShabadLine[] = [];
    raw.forEach((v, i) => {
        const { gurmukhi, translation, transliteration } = lineText(v);
        const lineId = idText(v.id);
        if (!gurmukhi || !lineId) return;
        lines.push({ id: lineId, kind: lineKind(v.type), gurmukhi, transliteration, translation, ang: angs[i], lineNo: lineNos[i] });
    });
    if (lines.length === 0) return null;
    const writer = obj(info.writer);
    const raag = obj(info.raag);
    const navigation = obj(info.navigation);
    const neighbour = (v: unknown): string | null => {
        const next = idText(obj(v).id);
        return isGurbaniId(next) ? next : null;
    };
    return {
        id,
        source: toSource(info.source),
        writer: text(writer.english),
        writerGurmukhi: text(writer.unicode),
        raag: text(raag.english),
        raagGurmukhi: text(raag.unicode),
        ang: start,
        angEnd: angs.at(-1) ?? start,
        previousId: neighbour(navigation.previous),
        nextId: neighbour(navigation.next),
        lines,
    };
}

// A day's allowance of calls. take() spends one, or says there is none left;
// the count starts again with each new UTC date.
export type Meter = { take(): boolean; remaining(): number };

export function dailyMeter(ceiling: number, today = () => new Date().toISOString().slice(0, 10)): Meter {
    let day = '';
    let used = 0;
    const roll = () => {
        const now = today();
        if (now !== day) {
            day = now;
            used = 0;
        }
    };
    return {
        take() {
            roll();
            if (used >= ceiling) return false;
            used++;
            return true;
        },
        remaining() {
            roll();
            return Math.max(0, ceiling - used);
        },
    };
}

export const meters = {
    quoteCheck: dailyMeter(QUOTE_CHECK_DAILY_CEILING),
    verseSearch: dailyMeter(VERSE_SEARCH_DAILY_CEILING),
} as const;

// One GET, kept in the host's data cache for `revalidate` seconds. That cache
// stores only 200 responses, so an HTTP error or a timeout is never kept. A
// 200 whose body is unusable is kept, like any other 200.
async function request(url: string, revalidate: number, signal?: AbortSignal): Promise<unknown | null> {
    try {
        const timeout = AbortSignal.timeout(TIMEOUT_MS);
        const res = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
            next: { revalidate, tags: ['gurbaninow'] },
        });
        if (!res.ok) {
            logEvent('upstream_error', { upstream: 'gurbaninow', status: res.status }, 'warn');
            return null;
        }
        return await res.json();
    } catch (error) {
        // Timed out or unreachable; a caller that gave up (the visitor left)
        // is no news.
        if (!signal?.aborted) logEvent('upstream_error', { upstream: 'gurbaninow', error: describeError(error) }, 'warn');
        return null;
    }
}

// A client whose calls spend `meter`, its searches limited to one `source`
// when given (Sri Guru Granth Sahib Ji is 1; the letter codes in GurbaniNow's
// README return nothing).
export function gurbaniNowClient({ meter, source }: { meter: Meter; source?: number }): GurbaniClient {
    const getJson = (url: string, signal?: AbortSignal): Promise<unknown | null> =>
        meter.take() ? request(url, REVALIDATE_SECONDS, signal) : Promise.resolve(null);
    return {
        async fetchAng(ang, signal) {
            if (!Number.isInteger(ang) || ang < 1 || ang > MAX_ANG) return null;
            const data = await getJson(`${BASE}/ang/${ang}`, signal);
            return data === null ? null : parseAngPayload(data);
        },
        async searchLines(query, searchtype, results, signal) {
            // Only Gurmukhi reaches the upstream URL: no Latin, and none of
            // the _ and % its first-letter search reads as wildcards.
            const clean = query.replace(/[^਀-੿ ]/g, '').replace(/ +/g, ' ').trim();
            if (!clean) return [];
            const filter = source === undefined ? '' : `&source=${source}`;
            const url = `${BASE}/search/${encodeURIComponent(clean)}?searchtype=${searchtype}&results=${results}${filter}`;
            const data = await getJson(url, signal);
            return data === null ? null : parseSearchPayload(data);
        },
    };
}

// The chat's quote checker, which reads every source.
export const gurbaniNow = gurbaniNowClient({ meter: meters.quoteCheck });

// Shabad Search: Sri Guru Granth Sahib Ji only, on its own daily count.
export const verseSearchClient = gurbaniNowClient({ meter: meters.verseSearch, source: SGGS_SOURCE_ID });

// What the site's pages read: the raw payloads /api/shabad (the Ang reader
// and the chat's links to an Ang), /api/hukamnama and the Hukamnama page
// parse, and the shabad page's shabad. They skip the daily meters. Each view
// makes at most one call and the data cache answers repeats, so there is no
// loop to guard against. A meter is charged before the cache is consulted,
// so it would count those cache hits too, and a busy day of page views could
// switch off quote checking. null means no usable answer.

export async function fetchAngPayload(ang: number): Promise<unknown | null> {
    if (!Number.isInteger(ang) || ang < 1 || ang > MAX_ANG) return null;
    const data = await request(`${BASE}/ang/${ang}`, REVALIDATE_SECONDS);
    return data !== null && parseAngPayload(data) ? data : null;
}

// One whole shabad, for its page. GurbaniNow answers an id it doesn't know
// with the same HTTP 500 as a fault, so the two can't be told apart: both are
// null, and the page reports an outage rather than caching a verdict.
export async function fetchShabad(id: string): Promise<Shabad | null> {
    if (!isGurbaniId(id)) return null;
    const data = await request(`${BASE}/shabad/${id}`, REVALIDATE_SECONDS);
    const shabad = data === null ? null : parseShabadPayload(data);
    return shabad?.id === id ? shabad : null;
}

export async function fetchHukamnamaPayload(): Promise<unknown | null> {
    const data = await request(`${BASE}/hukamnama/today`, HUKAMNAMA_REVALIDATE_SECONDS);
    const lines = obj(data).hukamnama;
    return Array.isArray(lines) && lines.length > 0 ? data : null;
}
