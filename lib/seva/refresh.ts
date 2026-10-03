// SERVER-ONLY: what POST /api/seva/refresh does once someone's browser has
// changed an event (posted, edited, cancelled, joined, left, hidden). Pages
// are cached for minutes; this lets the change show straight away.
//
// The route has no way to know who's asking, so it believes only Firestore:
// it re-reads the event, uncached, and acts only if Firestore itself last
// wrote it moments ago, or it's no longer public. Anyone can call it, but it
// only ever does what a real, recent change would have done, and the
// firewall limits how often (20 a minute per address). The board's list is
// refreshed for a change to a public event, or for one no longer public that
// the list still shows (just hidden): a stream of made-up ids costs one read
// each and refreshes nothing shared, and nor does a hidden event once the
// list has dropped it.

import { isEventId } from './config';
import type { FetchedEvent, Read } from './server';

export const RECENT_MS = 2 * 60 * 1000;

export type RefreshDeps = {
    fetchFresh: (id: string) => Promise<Read<FetchedEvent>>;
    // The event's own page, in every language; and the shared list.
    refreshEvent: (id: string) => void;
    refreshUpcoming: () => void;
    // Whether the shared list, as cached, shows the event.
    listed: (id: string) => Promise<boolean>;
    now: () => number;
};

export type RefreshResult =
    | { status: 200; body: { ok: true } }
    | { status: 400; body: { error: string; code: 'invalid_event' } }
    | { status: 409; body: { error: string; code: 'not_recent' } }
    | { status: 502; body: { error: string; code: 'source_error' } };

export async function refreshAfterChange(id: unknown, deps: RefreshDeps): Promise<RefreshResult> {
    if (!isEventId(id)) return { status: 400, body: { error: 'Invalid event', code: 'invalid_event' } };
    const read = await deps.fetchFresh(id);
    if (read.kind === 'failed') return { status: 502, body: { error: 'Could not reach Firestore', code: 'source_error' } };
    if (read.kind === 'missing') {
        // Hidden, or gone: its page shouldn't keep showing it, nor should the
        // board or the home page.
        deps.refreshEvent(id);
        if (await deps.listed(id)) deps.refreshUpcoming();
        return { status: 200, body: { ok: true } };
    }
    const { updateTime } = read.value;
    if (updateTime === null || Math.abs(deps.now() - updateTime) > RECENT_MS) {
        return { status: 409, body: { error: 'Nothing changed just now', code: 'not_recent' } };
    }
    deps.refreshEvent(id);
    deps.refreshUpcoming();
    return { status: 200, body: { ok: true } };
}
