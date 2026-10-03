import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { LANGS } from '@/lib/i18n/config';
import { logRouteError, withRequestLog } from '@/lib/log';
import { SEVA_UPCOMING_TAG, eventHref, eventTag } from '@/lib/seva/config';
import { refreshAfterChange } from '@/lib/seva/refresh';
import { fetchEvent } from '@/lib/seva/server';

// POST /api/seva/refresh {id}: after someone's browser changes an event, its
// cached page (and, for a public change, the list of what's coming up) is
// built again, so the change shows at once. lib/seva/refresh.ts says what it
// believes and why anyone may call it.
const MAX_BODY_CHARS = 200;
const NO_STORE = { 'Cache-Control': 'no-store' };

async function handlePost(req: Request) {
    try {
        const raw = await req.text();
        let body: unknown = null;
        if (raw.length <= MAX_BODY_CHARS) {
            try { body = JSON.parse(raw); } catch { /* answered below */ }
        }
        const id = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as { id?: unknown }).id : undefined;
        const result = await refreshAfterChange(id, {
            fetchFresh: (eventId) => fetchEvent(eventId, { fresh: true }),
            refreshEvent: (eventId) => {
                // The next visit builds the page before answering, so the
                // person who changed it sees their change.
                revalidateTag(eventTag(eventId), { expire: 0 });
                for (const lang of LANGS) revalidatePath(`/${lang}${eventHref(eventId)}`);
            },
            // Built again before the next answer too: refreshes come only
            // after a real change, and whoever made it looks next.
            refreshUpcoming: () => revalidateTag(SEVA_UPCOMING_TAG, { expire: 0 }),
            now: Date.now,
        });
        return NextResponse.json(result.body, { status: result.status, headers: NO_STORE });
    } catch (error) {
        logRouteError(error);
        return NextResponse.json({ error: 'Something went wrong', code: 'refresh_failed' }, { status: 500, headers: NO_STORE });
    }
}

export const POST = withRequestLog('/api/seva/refresh', handlePost);
