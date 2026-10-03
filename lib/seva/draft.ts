// The hosting form's work in progress, kept for the tab (sessionStorage), so
// it survives the sign-in popup, a reload or a change of language, which
// reloads the page. Versioned, and thrown away after a day or once posted.

import type { EventFields } from './model';
import { shiftLocalDays, utcToZoned } from './time';
import type { EventDraft } from './validate';

const PREFIX = 'sikhai.seva.draft.v1:';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const draftKey = (route: string) => `${PREFIX}${route}`;

export function readDraft(route: string, now = Date.now()): EventDraft | null {
    try {
        const raw = sessionStorage.getItem(draftKey(route));
        if (!raw) return null;
        const saved = JSON.parse(raw) as { at?: unknown; draft?: unknown };
        if (typeof saved.at !== 'number' || now - saved.at > MAX_AGE_MS || !saved.draft || typeof saved.draft !== 'object') return null;
        return parseDraft(saved.draft as Record<string, unknown>);
    } catch {
        return null;
    }
}

export function writeDraft(route: string, draft: EventDraft, now = Date.now()) {
    try {
        sessionStorage.setItem(draftKey(route), JSON.stringify({ at: now, draft }));
    } catch { /* storage blocked or full: the form still works */ }
}

export function clearDraft(route: string) {
    try {
        sessionStorage.removeItem(draftKey(route));
    } catch { /* storage blocked */ }
}

export const EMPTY_DRAFT: EventDraft = {
    title: '', category: '', description: '', date: '', startTime: '', endTime: '', multiDay: false, endDate: '',
    timeZone: '', venue: '', address: '', city: '', region: '', country: '', spots: '', organizer: '', contact: '',
};

// Only the form's own fields, each as the form holds it.
export function parseDraft(d: Record<string, unknown>): EventDraft {
    const out = { ...EMPTY_DRAFT };
    for (const key of Object.keys(EMPTY_DRAFT) as (keyof EventDraft)[]) {
        const v = d[key];
        if (key === 'multiDay') out.multiDay = v === true;
        else if (typeof v === 'string') (out as Record<string, unknown>)[key] = v.slice(0, 2000);
    }
    return out;
}

// An event, back in the form's terms: the venue's dates and clock times.
export function draftFromEvent(e: EventFields): EventDraft {
    const start = utcToZoned(e.startsAt, e.timeZone);
    const end = utcToZoned(e.endsAt, e.timeZone);
    const multiDay = end.date !== start.date;
    return {
        title: e.title, category: e.category, description: e.description,
        date: start.date, startTime: start.time, endTime: end.time, multiDay, endDate: multiDay ? end.date : '',
        timeZone: e.timeZone, venue: e.venue, address: e.address, city: e.city, region: e.region, country: e.country,
        spots: String(e.spots), organizer: e.organizer, contact: e.contact,
    };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// "Post again": the same event a week later, at the same clock time there,
// whatever the clocks did meanwhile; or, for one from weeks ago, as many weeks
// on as it takes to be still to come.
export function postAgainDraft(e: EventFields, now: number): EventDraft {
    const days = 7 * Math.max(1, Math.floor((now - e.startsAt) / WEEK_MS) + 1);
    return draftFromEvent({
        ...e,
        startsAt: shiftLocalDays(e.startsAt, e.timeZone, days),
        endsAt: shiftLocalDays(e.endsAt, e.timeZone, days),
    });
}
