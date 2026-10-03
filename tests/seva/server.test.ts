import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_MS, refreshAfterChange, type RefreshDeps } from '@/lib/seva/refresh';
import { fetchEvent, fetchUpcomingEvents, sevaProject } from '@/lib/seva/server';
import { ID, event } from './helpers';

process.env.APP_LOG = 'off';

type Call = { url: string; init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } };
const realFetch = globalThis.fetch;
let calls: Call[] = [];
let answer: (url: string) => Response | Promise<Response> = () => new Response('[]');

beforeEach(() => {
    calls = [];
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'sikh-ai-test1';
    delete process.env.FIRESTORE_EMULATOR_HOST;
    globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({ url, init: init as Call['init'] });
        return answer(url);
    }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

// An event as the REST API returns it.
function restDoc(over: Record<string, unknown> = {}, updateTime = '2026-09-01T00:00:00Z') {
    const e = { ...event(), ...over };
    const s = (v: string) => ({ stringValue: v });
    const t = (ms: number) => ({ timestampValue: new Date(ms).toISOString() });
    return {
        name: `projects/sikh-ai-test1/databases/(default)/documents/seva_events/${e.id}`,
        updateTime,
        fields: {
            v: { integerValue: '1' }, title: s(e.title), category: s(e.category), description: s(e.description),
            startsAt: t(e.startsAt), endsAt: t(e.endsAt), timeZone: s(e.timeZone), venue: s(e.venue), address: s(e.address),
            city: s(e.city), region: s(e.region), country: s(e.country), organizer: s(e.organizer), contact: s(e.contact),
            spots: { integerValue: String(e.spots) }, volunteerCount: { integerValue: String(e.volunteerCount) },
            status: s(e.status), cancelNote: s(e.cancelNote), hidden: { booleanValue: e.hidden },
            createdAt: t(e.createdAt), updatedAt: t(e.updatedAt),
        },
    };
}

test('a placeholder, a demo project or none means no request at all', async () => {
    assert.equal(sevaProject({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'ci-placeholder' }), null);
    assert.equal(sevaProject({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-sikhai' }), null);
    assert.equal(sevaProject({}), null);
    assert.equal(sevaProject({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-sikhai', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }), 'demo-sikhai');
    assert.equal(sevaProject({ NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'sikh-ai-7a4b7' }), 'sikh-ai-7a4b7');
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'ci-placeholder';
    assert.deepEqual(await fetchUpcomingEvents(), { kind: 'failed' });
    assert.deepEqual(await fetchEvent(ID), { kind: 'failed' });
    assert.equal(calls.length, 0);
});

test('the upcoming list is one cached POST for the whole day, with no key, shared by every page', async () => {
    answer = () => Response.json([{ document: restDoc(), readTime: 'x' }, { document: restDoc({ id: 'Brok3nDocument000000', status: 'party' }) }]);
    const morning = await fetchUpcomingEvents(Date.UTC(2026, 9, 2, 8));
    const evening = await fetchUpcomingEvents(Date.UTC(2026, 9, 2, 20));
    assert.deepEqual(morning, { kind: 'ok', value: [event()] }, 'an unreadable document is dropped');
    const [a, b] = calls;
    assert.equal(a.url, 'https://firestore.googleapis.com/v1/projects/sikh-ai-test1/databases/(default)/documents:runQuery');
    assert.equal(a.init.method, 'POST');
    assert.equal(a.init.cache, 'force-cache');
    assert.deepEqual(a.init.next, { revalidate: 300, tags: ['seva-upcoming'] });
    assert.equal(a.init.body, b.init.body, 'the same request all day, so one cache entry');
    assert.ok(!a.url.includes('key='));
    assert.equal(new Headers(a.init.headers).get('authorization'), null);
    assert.deepEqual(evening, morning);
});

test('an event is ok, missing (404, 403, hidden or unreadable) or failed (anything else)', async () => {
    answer = () => Response.json(restDoc({}, '2026-09-01T00:00:05Z'));
    const ok = await fetchEvent(ID);
    assert.equal(ok.kind, 'ok');
    assert.equal(ok.kind === 'ok' && ok.value.updateTime, Date.parse('2026-09-01T00:00:05Z'));
    assert.deepEqual(calls[0].init.next, { revalidate: 300, tags: [`seva-event:${ID}`] });
    await fetchEvent(ID, { fresh: true });
    assert.equal(calls[1].init.cache, 'no-store');
    for (const status of [404, 403]) {
        answer = () => Response.json({ error: { code: status } }, { status });
        assert.deepEqual(await fetchEvent(ID), { kind: 'missing' }, String(status));
    }
    answer = () => Response.json(restDoc({ hidden: true }));
    assert.deepEqual(await fetchEvent(ID), { kind: 'missing' });
    for (const status of [400, 429, 500, 503]) {
        answer = () => Response.json({}, { status });
        assert.deepEqual(await fetchEvent(ID), { kind: 'failed' }, String(status));
    }
    answer = () => { throw new TypeError('fetch failed'); };
    assert.deepEqual(await fetchEvent(ID), { kind: 'failed' });
    assert.deepEqual(await fetchEvent('not-an-id'), { kind: 'missing' });
});

test('refreshing believes only a recent write by Firestore, and refreshes the list only for a public event or one it still shows', async () => {
    const done: string[] = [];
    const deps = (read: Awaited<ReturnType<RefreshDeps['fetchFresh']>>, { now = 1_000_000, listed = false } = {}): RefreshDeps => ({
        fetchFresh: async () => read,
        refreshEvent: (id) => { done.push(`event ${id}`); },
        refreshUpcoming: () => { done.push('upcoming'); },
        listed: async () => listed,
        now: () => now,
    });
    const fresh = { kind: 'ok' as const, value: { event: event(), updateTime: 1_000_000 - 1000 } };
    assert.equal((await refreshAfterChange('nope', deps(fresh))).status, 400);
    assert.equal((await refreshAfterChange(ID, deps(fresh))).status, 200);
    assert.deepEqual(done.splice(0), [`event ${ID}`, 'upcoming']);
    const stale = { kind: 'ok' as const, value: { event: event(), updateTime: 1_000_000 - RECENT_MS - 1 } };
    assert.equal((await refreshAfterChange(ID, deps(stale))).status, 409);
    assert.deepEqual(done.splice(0), []);
    assert.equal((await refreshAfterChange(ID, deps({ kind: 'missing' }))).status, 200);
    assert.deepEqual(done.splice(0), [`event ${ID}`], 'a made-up id, or an event the list has dropped: its page only');
    assert.equal((await refreshAfterChange(ID, deps({ kind: 'missing' }, { listed: true }))).status, 200);
    assert.deepEqual(done.splice(0), [`event ${ID}`, 'upcoming'], 'just hidden, and still on the board: both');
    assert.equal((await refreshAfterChange(ID, deps({ kind: 'failed' }))).status, 502);
});

test('the calendar route answers a calendar file for an event, and codes otherwise', async () => {
    const { GET } = await import('@/app/api/seva/ics/route');
    answer = () => Response.json(restDoc());
    const res = await GET(new Request(`http://local/api/seva/ics?id=${ID}&lang=pa`));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8');
    assert.match(res.headers.get('content-disposition') ?? '', /^inline; filename="seva-/);
    assert.match(res.headers.get('cache-control') ?? '', /s-maxage=300/);
    const ics = await res.text();
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /URL:https:\/\/sikhai\.vercel\.app\/pa\/seva\/Ev3ntIdAbCdEfGhIj12x/);
    assert.equal((await GET(new Request('http://local/api/seva/ics?id=x'))).status, 400);
    answer = () => new Response('{}', { status: 404 });
    assert.equal((await GET(new Request(`http://local/api/seva/ics?id=${ID}`))).status, 404);
    answer = () => new Response('{}', { status: 500 });
    const failed = await GET(new Request(`http://local/api/seva/ics?id=${ID}`));
    assert.equal(failed.status, 502);
    assert.equal(failed.headers.get('cache-control'), 'no-store');
});
