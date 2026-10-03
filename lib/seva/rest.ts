// Firestore's REST API, as the server reads public events with it
// (./server.ts): the address, the query for what's coming up, and the typed
// values it answers with, turned into plain ones. Pure, so it's tested
// without a network.

import { SEVA_PAGE_MAX } from './limits';

// Production, or the emulator when FIRESTORE_EMULATOR_HOST says where it is
// (the variable Firebase's own tools use).
export function documentsBase(projectId: string, emulatorHost = process.env.FIRESTORE_EMULATOR_HOST): string {
    const origin = emulatorHost ? `http://${emulatorHost}` : 'https://firestore.googleapis.com';
    return `${origin}/v1/projects/${projectId}/databases/(default)/documents`;
}

// The events the board shows, a page at most: visible, still on, and not over
// by the start of today (UTC). Rounding to the day keeps the request the same
// all day, so every page that shows the list shares one cached answer; the
// few that ended earlier today are dropped when it's shown. The rules accept
// only a query that asks for visible events, with a limit.
export function upcomingQuery(sinceMs: number, limit = SEVA_PAGE_MAX) {
    return {
        structuredQuery: {
            from: [{ collectionId: 'seva_events' }],
            where: {
                compositeFilter: {
                    op: 'AND',
                    filters: [
                        { fieldFilter: { field: { fieldPath: 'hidden' }, op: 'EQUAL', value: { booleanValue: false } } },
                        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'open' } } },
                        {
                            fieldFilter: {
                                field: { fieldPath: 'endsAt' },
                                op: 'GREATER_THAN_OR_EQUAL',
                                value: { timestampValue: new Date(sinceMs).toISOString() },
                            },
                        },
                    ],
                },
            },
            orderBy: [{ field: { fieldPath: 'endsAt' }, direction: 'ASCENDING' }],
            limit,
        },
    };
}

export const startOfUtcDay = (ms: number) => ms - (((ms % 86_400_000) + 86_400_000) % 86_400_000);

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

// One REST value as a plain one: a timestamp as its RFC 3339 string (which
// ./event.ts reads), an integer as a number when it's a safe one. Bytes,
// references and points aren't used, and become undefined.
export function decodeValue(v: unknown): unknown {
    if (!isObject(v)) return undefined;
    if ('nullValue' in v) return null;
    if ('booleanValue' in v) return v.booleanValue === true;
    if ('stringValue' in v) return typeof v.stringValue === 'string' ? v.stringValue : undefined;
    if ('integerValue' in v) {
        const n = Number(v.integerValue);
        return Number.isSafeInteger(n) ? n : undefined;
    }
    if ('doubleValue' in v) return typeof v.doubleValue === 'number' && Number.isFinite(v.doubleValue) ? v.doubleValue : undefined;
    if ('timestampValue' in v) return typeof v.timestampValue === 'string' ? v.timestampValue : undefined;
    if ('arrayValue' in v) {
        const values = isObject(v.arrayValue) && Array.isArray(v.arrayValue.values) ? v.arrayValue.values : [];
        return values.map(decodeValue);
    }
    if ('mapValue' in v) return decodeFields(isObject(v.mapValue) ? v.mapValue.fields : undefined);
    return undefined;
}

export function decodeFields(fields: unknown): Json {
    if (!isObject(fields)) return {};
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decodeValue(v)]));
}

// A REST document: its id (the last part of its name), its fields, and when
// Firestore last wrote it, whoever wrote it.
export function decodeDocument(doc: unknown): { id: string; data: Json; updateTime: number | null } | null {
    if (!isObject(doc) || typeof doc.name !== 'string') return null;
    const id = doc.name.split('/').pop() ?? '';
    const updateTime = typeof doc.updateTime === 'string' ? Date.parse(doc.updateTime) : NaN;
    return { id, data: decodeFields(doc.fields), updateTime: Number.isFinite(updateTime) ? updateTime : null };
}

// A runQuery answer: an array with an element per document, plus one with
// only a readTime when nothing matched. Null when it isn't that.
export function decodeQueryResponse(body: unknown): { id: string; data: Json }[] | null {
    if (!Array.isArray(body)) return null;
    if (body.some((item) => isObject(item) && 'error' in item)) return null;
    return body.flatMap((item) => {
        const doc = isObject(item) ? decodeDocument(item.document) : null;
        return doc ? [doc] : [];
    });
}
