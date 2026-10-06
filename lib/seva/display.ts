// An event as people read it, in one language: when (at the venue), where,
// and who may join and how many have. Built on the server and handed to the
// page as text (./time.ts says why).

import type { Lang } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import { countryName } from './countries';
import { signupLine, type SignupLine } from './event';
import { placeLine } from './links';
import type { SevaEvent } from './model';
import { formatDate, formatTimes, formatWhen, toIsoWithOffset, zoneName } from './time';

export type EventDisplay = {
    // "Saturday, October 10, 2026, 6:00 PM to 9:00 PM (Pacific Time)"
    when: string;
    // "6:00 PM to 9:00 PM (Pacific Time)", under a heading that names the day.
    times: string;
    // "Saturday, October 10, 2026"
    date: string;
    startIso: string;
    endIso: string;
    country: string;
    // "Gurdwara Sahib Fremont, Fremont, United States"
    placeShort: string;
    // The venue, street, city, region and country, for maps and calendars.
    placeFull: string;
    // Who may sign up, and how many have (./event.ts).
    signup: SignupLine;
};

export function describeEvent(e: SevaEvent, lang: Lang, copy: SevaCopy): EventDisplay {
    const words = copy.common.when;
    const country = e.country ? countryName(e.country, lang) : '';
    return {
        when: formatWhen(e, lang, words),
        times: fmt(words.withZone, { when: formatTimes(e, lang, words), zone: zoneName(e.startsAt, e.timeZone, lang) }),
        date: formatDate(e.startsAt, e.timeZone, lang),
        startIso: toIsoWithOffset(e.startsAt, e.timeZone),
        endIso: toIsoWithOffset(e.endsAt, e.timeZone),
        country,
        placeShort: [e.venue, e.city, country].map((s) => s.trim()).filter(Boolean).join(', '),
        placeFull: placeLine(e, country),
        signup: signupLine(e, copy.common),
    };
}
