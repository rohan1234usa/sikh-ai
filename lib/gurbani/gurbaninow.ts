// SERVER-ONLY: GurbaniNow client for checking quoted lines. Same posture as
// lib/translate/cloud.ts: never throws, times out fast, meters itself.
//
// The difference between null and [] is load-bearing. [] means the source
// answered and nothing matched — evidence a line is not in Gurbani. null
// means the source did not answer, which is no evidence at all, and must
// never turn into an "unverified" verdict.
//
// Ang text never changes, so responses are cached for a month in the host's
// data cache (the `next` option; ignored outside Next, e.g. in tests).

import { MAX_ANG } from './citations';

const BASE = 'https://api.gurbaninow.com/v2';
const TIMEOUT_MS = 3500;
const REVALIDATE_SECONDS = 30 * 24 * 60 * 60;
// Best-effort ceiling per warm instance, charged before the request, so a
// loop on a failing source cannot hammer a free public API.
const DAILY_CALL_CEILING = 3000;
const HEADER_LINE_TYPE = 2; // "ਸਿਰੀਰਾਗੁ ਮਹਲਾ ੩ ॥" and the like

export const SEARCH_TYPES = { firstLettersStart: 0, firstLettersAnywhere: 1, allWords: 4 } as const;
export type SearchType = (typeof SEARCH_TYPES)[keyof typeof SEARCH_TYPES];

export type GurbaniLine = {
    id: string;
    shabadId: string;
    gurmukhi: string;
    translation: string;
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

function toSource(v: unknown): GurbaniLine['source'] {
    const s = obj(v);
    return { id: num(s.id) ?? 0, name: text(s.english), nameGurmukhi: text(s.unicode) };
}

function toLine(raw: unknown, source?: GurbaniLine['source']): GurbaniLine | null {
    const v = obj(raw);
    const gurmukhi = text(obj(v.gurmukhi).unicode) || text(v.gurmukhi);
    const id = text(v.id);
    if (!gurmukhi || !id) return null;
    const english = obj(v.translation).english;
    const writer = obj(v.writer);
    const raag = obj(v.raag);
    return {
        id,
        shabadId: text(v.shabadid),
        gurmukhi,
        translation: text(english) || text(obj(english).default),
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

let counterDate = '';
let callsToday = 0;

function overBudget(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== counterDate) {
        counterDate = today;
        callsToday = 0;
    }
    if (callsToday >= DAILY_CALL_CEILING) return true;
    callsToday++;
    return false;
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
    if (overBudget()) return null;
    try {
        const timeout = AbortSignal.timeout(TIMEOUT_MS);
        const res = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
            next: { revalidate: REVALIDATE_SECONDS, tags: ['gurbaninow'] },
        });
        if (!res.ok) {
            console.error(`GurbaniNow: HTTP ${res.status}`);
            return null;
        }
        return await res.json();
    } catch {
        return null; // timed out, aborted, or unreachable
    }
}

export const gurbaniNow: GurbaniClient = {
    async fetchAng(ang, signal) {
        if (!Number.isInteger(ang) || ang < 1 || ang > MAX_ANG) return null;
        const data = await getJson(`${BASE}/ang/${ang}`, signal);
        return data === null ? null : parseAngPayload(data);
    },
    async searchLines(query, searchtype, results, signal) {
        // Only Gurmukhi reaches the upstream URL.
        const clean = query.replace(/[^਀-੿ ]/g, '').trim();
        if (!clean) return [];
        const url = `${BASE}/search/${encodeURIComponent(clean)}?searchtype=${searchtype}&results=${results}`;
        const data = await getJson(url, signal);
        return data === null ? null : parseSearchPayload(data);
    },
};
