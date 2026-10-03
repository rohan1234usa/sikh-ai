import { NextResponse } from 'next/server';
import { getSevaCopy } from '@/lib/i18n/seva';
import { parseLang } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import { localePath } from '@/lib/i18n/paths';
import { withRequestLog } from '@/lib/log';
import { SITE_URL } from '@/lib/metadata';
import { eventHref, isEventId } from '@/lib/seva/config';
import { countryName } from '@/lib/seva/countries';
import { buildIcs } from '@/lib/seva/ics';
import { placeLine } from '@/lib/seva/links';
import { fetchEvent } from '@/lib/seva/server';

// GET /api/seva/ics?id=…&lang=…: an event as a calendar file, for "Add to
// calendar" (Apple Calendar, Outlook and the rest; Google Calendar has its
// own link). The id is in the query, not the path: the language rewrite
// (lib/i18n/routing.ts) would send a dynamic /api/seva/{id}/… to /en/api/…,
// which doesn't exist. It's shown inline rather than downloaded, so a phone
// offers to add it. Cached at the CDN as long as the event's page is.
const ICS_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';
const NO_STORE = { 'Cache-Control': 'no-store' };

async function handleGet(request: Request) {
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    const lang = parseLang(params.get('lang'));
    if (!isEventId(id)) {
        return NextResponse.json({ error: 'Invalid event', code: 'invalid_event' }, { status: 400, headers: NO_STORE });
    }
    const read = await fetchEvent(id);
    if (read.kind === 'missing') {
        return NextResponse.json({ error: 'No such event', code: 'event_not_found' }, { status: 404, headers: NO_STORE });
    }
    if (read.kind === 'failed') {
        return NextResponse.json({ error: 'Could not reach Firestore', code: 'source_error' }, { status: 502, headers: NO_STORE });
    }
    const { event } = read.value;
    const copy = getSevaCopy(lang);
    const url = `${SITE_URL}${localePath(lang, eventHref(id))}`;
    const details = fmt(copy.calendar.details, { name: event.organizer, url });
    const ics = buildIcs(event, {
        url,
        description: event.description ? `${event.description}\n\n${details}` : details,
        location: placeLine(event, countryName(event.country, lang)),
    });
    return new Response(ics, {
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `inline; filename="seva-${id}.ics"`,
            'Cache-Control': ICS_CACHE,
        },
    });
}

export const GET = withRequestLog('/api/seva/ics', handleGet);
