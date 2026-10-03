// SERVER-ONLY: reading public events for the pages, through Firestore's REST
// API. The board, the home page's strip, the sitemap and each event's page
// are built here and cached, so a visitor's browser never talks to Firebase
// to see them, and Firestore's reads don't grow with visits.
//
// The requests carry no key and no sign-in, so the rules treat the server as
// any visitor: it sees visible events and nothing private. (Firestore's App
// Check, if it's ever enforced, would refuse them.)
//
// Same posture as lib/gurbani/gurbaninow.ts: never throws, times out fast,
// and says whether the source answered. `missing` is an answer (no such
// event, or not one the public may see); `failed` is no answer, and the pages
// keep what they had rather than show nothing.

import { describeError, logEvent } from '@/lib/log';
import { SEVA_REVALIDATE_SECONDS, SEVA_UPCOMING_TAG, eventTag, isEventId } from './config';
import { parseEvent } from './event';
import type { SevaEvent } from './model';
import { decodeDocument, decodeQueryResponse, documentsBase, startOfUtcDay, upcomingQuery } from './rest';

const TIMEOUT_MS = 3500;

export type Read<T> = { kind: 'ok'; value: T } | { kind: 'missing' } | { kind: 'failed' };
const FAILED = { kind: 'failed' } as const;
const MISSING = { kind: 'missing' } as const;

// The project to read, or null when there's none to reach: CI builds with a
// placeholder and no network, and a demo- project lives only in the emulator
// (FIRESTORE_EMULATOR_HOST, for local testing).
export function sevaProject(env: Record<string, string | undefined> = process.env): string | null {
    const id = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
    if (env.FIRESTORE_EMULATOR_HOST) return id || null;
    if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id) || id.includes('placeholder') || id.startsWith('demo-')) return null;
    return id;
}

function logFailure(op: string, detail: { status?: number; error?: string }) {
    // A query Firestore can't answer for want of an index is a deploy step
    // missed (firestore.indexes.json), not a passing outage.
    logEvent('upstream_error', { upstream: 'firestore', op, ...detail }, detail.status === 400 ? 'error' : 'warn');
}

// Everything not over by the start of today (UTC), visible and open, a page
// at most; the caller keeps what's still to come. One request for the whole
// day, kept for SEVA_REVALIDATE_SECONDS in the data cache, and shared by every
// page that shows the list, in every language.
export async function fetchUpcomingEvents(now = Date.now()): Promise<Read<SevaEvent[]>> {
    const project = sevaProject();
    if (!project) return FAILED;
    try {
        const res = await fetch(`${documentsBase(project)}:runQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(upcomingQuery(startOfUtcDay(now))),
            cache: 'force-cache',
            next: { revalidate: SEVA_REVALIDATE_SECONDS, tags: [SEVA_UPCOMING_TAG] },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
            logFailure('upcoming', { status: res.status });
            return FAILED;
        }
        const docs = decodeQueryResponse(await res.json());
        if (!docs) {
            logFailure('upcoming', { error: 'unusable answer' });
            return FAILED;
        }
        const events = docs.flatMap((d) => parseEvent(d.id, d.data) ?? []);
        if (events.length < docs.length) logEvent('seva_unreadable', { op: 'upcoming', dropped: docs.length - events.length }, 'warn');
        return { kind: 'ok', value: events };
    } catch (error) {
        logFailure('upcoming', { error: describeError(error) });
        return FAILED;
    }
}

export type FetchedEvent = { event: SevaEvent; updateTime: number | null };

// One event, cached with its page; `fresh` asks Firestore itself (the
// refresh route, which needs to know what just changed). A hidden event reads
// as refused, and one from before the overhaul as unreadable: both missing.
export async function fetchEvent(id: string, { fresh = false } = {}): Promise<Read<FetchedEvent>> {
    if (!isEventId(id)) return MISSING;
    const project = sevaProject();
    if (!project) return FAILED;
    try {
        const res = await fetch(`${documentsBase(project)}/seva_events/${id}`, {
            headers: { Accept: 'application/json' },
            ...(fresh
                ? { cache: 'no-store' as const }
                : { next: { revalidate: SEVA_REVALIDATE_SECONDS, tags: [eventTag(id)] } }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 404 || res.status === 403) return MISSING;
        if (!res.ok) {
            logFailure('event', { status: res.status });
            return FAILED;
        }
        const doc = decodeDocument(await res.json());
        const event = doc ? parseEvent(id, doc.data) : null;
        return event ? { kind: 'ok', value: { event, updateTime: doc?.updateTime ?? null } } : MISSING;
    } catch (error) {
        logFailure('event', { error: describeError(error) });
        return FAILED;
    }
}

// The moment a page is built, which it shows events as of: server components
// read the clock through this (React keeps render itself pure), and the
// browser keeps a cached page current (app/components/seva/hooks.ts).
export const renderTime = () => Date.now();

// While `next build` prerenders pages, a failed read is shown as such (CI has
// no network); afterwards it's thrown, so the page that was there stays.
export const isBuilding = () => process.env.NEXT_PHASE === 'phase-production-build';
