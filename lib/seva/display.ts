// An event as people read it, in one language: when (at the venue), where,
// and who may join and how many have. Built on the server and handed to the
// page as text (./time.ts says why).

import type { Lang } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import { countryName } from './countries';
import { room } from './event';
import { placeLine } from './links';
import type { SevaEvent } from './model';
import { formatDate, formatTimes, formatWhen, toIsoWithOffset, zoneName } from './time';

// Who may sign up, and how many have, in words: "No sign-up needed",
// "Volunteers: 12", or, with a limit, "Volunteers: 3 of 20" and "Spots left:
// 17" (or "Full"), with how full, 0–100, for the bar beside the words.
export type SignupLine =
    | { mode: 'none' | 'unlimited'; text: string }
    | { mode: 'limited'; text: string; left: string; percent: number };

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
    signup: SignupLine;
};

export function signupLine(e: Pick<SevaEvent, 'spots' | 'volunteerCount'>, words: SevaCopy['common']): SignupLine {
    const r = room(e);
    if (r.mode === 'none') return { mode: 'none', text: words.noSignup };
    if (r.mode === 'unlimited') return { mode: 'unlimited', text: fmt(words.capacityNoLimit, { count: r.joined }) };
    return {
        mode: 'limited',
        text: fmt(words.capacity, { count: r.joined, spots: r.spots }),
        left: r.full ? words.full : fmt(words.spotsLeft, { n: r.left }),
        percent: Math.round((Math.min(r.joined, r.spots) / r.spots) * 100),
    };
}

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
