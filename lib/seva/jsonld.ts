// schema.org's reading of an event page, which is what lets a search engine
// list it among events near the searcher: what, when (with the venue's
// offset), where, who hosts it, and whether it's still on.

import type { SevaEvent } from './model';
import { toIsoWithOffset } from './time';

export function eventJsonLd(e: SevaEvent, { url, image, description, inLanguage }: {
    url: string;
    image: string;
    description: string;
    inLanguage: string;
}) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: e.title,
        description,
        url,
        image: [image],
        inLanguage,
        startDate: toIsoWithOffset(e.startsAt, e.timeZone),
        endDate: toIsoWithOffset(e.endsAt, e.timeZone),
        eventStatus: e.status === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        isAccessibleForFree: true,
        location: {
            '@type': 'Place',
            name: e.venue,
            address: {
                '@type': 'PostalAddress',
                ...(e.address ? { streetAddress: e.address } : {}),
                addressLocality: e.city,
                ...(e.region ? { addressRegion: e.region } : {}),
                addressCountry: e.country,
            },
        },
        organizer: { '@type': 'Organization', name: e.organizer, url },
    };
}

// For a <script type="application/ld+json">: escaped so no text in it can
// close the tag.
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
