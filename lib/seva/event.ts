// Reading Seva documents back, from the SDK in the browser or the REST API on
// the server (./rest.ts). Every document is untrusted: anything Firestore
// returns was written by someone's browser, the rules permitting, or by hand
// in the console. Nothing here throws; a document that isn't what the app
// writes is null, and the page goes on without it.

import { isCategory, isCountryCode, isEventId, isReportReason } from './config';
import { SEVA_EVENT_VERSION } from './limits';
import type { Report, SevaEvent, Signup, Volunteer } from './model';
import { isTimeZone } from './time';

// A Firestore time, however it arrives: a Timestamp from the SDK, a Date, an
// RFC 3339 string from the REST API, or milliseconds.
export function toMillis(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
        const ms = Date.parse(v);
        return Number.isFinite(ms) ? ms : null;
    }
    if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
    if (v && typeof v === 'object' && typeof (v as { toMillis?: unknown }).toMillis === 'function') {
        const ms = (v as { toMillis: () => unknown }).toMillis();
        return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
    }
    return null;
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);

// An event as the app wrote it, or null: one from before these rules (no
// version), one moderators hid (unless the reader is allowed to see it), or
// one whose essentials don't hold together.
export function parseEvent(id: string, raw: unknown, { allowHidden = false } = {}): SevaEvent | null {
    if (!isEventId(id) || !raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    if (d.v !== SEVA_EVENT_VERSION) return null;
    if (d.hidden !== false && !(allowHidden && d.hidden === true)) return null;
    const status = d.status === 'open' || d.status === 'cancelled' ? d.status : null;
    const startsAt = toMillis(d.startsAt);
    const endsAt = toMillis(d.endsAt);
    const spots = count(d.spots);
    const title = text(d.title).trim();
    if (!status || startsAt === null || endsAt === null || endsAt <= startsAt || spots === null || spots < 1 || !title) {
        return null;
    }
    return {
        id,
        title,
        category: isCategory(d.category) ? d.category : 'other',
        description: text(d.description),
        startsAt,
        endsAt,
        // The rules check only a zone name's shape, and this engine may not know
        // one a newer browser does: an unknown zone would make every date on
        // the page throw, so it's shown in UTC, which its host can correct.
        timeZone: isTimeZone(text(d.timeZone)) ? text(d.timeZone) : 'UTC',
        venue: text(d.venue),
        address: text(d.address),
        city: text(d.city),
        region: text(d.region),
        country: isCountryCode(d.country) ? d.country : '',
        organizer: text(d.organizer),
        contact: text(d.contact),
        spots,
        // A count edited by hand could stray; what's shown stays sensible.
        volunteerCount: Math.min(Math.max(count(d.volunteerCount) ?? 0, 0), spots),
        status,
        cancelNote: text(d.cancelNote),
        hidden: d.hidden === true,
        createdAt: toMillis(d.createdAt) ?? startsAt,
        updatedAt: toMillis(d.updatedAt) ?? toMillis(d.createdAt) ?? startsAt,
    };
}

export function parseVolunteer(key: string, raw: unknown): Volunteer | null {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    const name = text(d.name).trim();
    const joinedAt = toMillis(d.joinedAt);
    if (!name || joinedAt === null) return null;
    return { key, name, email: text(d.email), phone: text(d.phone), joinedAt };
}

export function parseSignup(eventId: string, raw: unknown): Signup | null {
    if (!isEventId(eventId) || !raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    const joinedAt = toMillis(d.joinedAt);
    if (!isEventId(d.volunteerId) || joinedAt === null) return null;
    return { eventId, volunteerId: d.volunteerId, joinedAt };
}

export function parseReport(id: string, raw: unknown): Report | null {
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    const createdAt = toMillis(d.createdAt);
    if (!isEventId(d.eventId) || !isReportReason(d.reason) || createdAt === null) return null;
    return { id, eventId: d.eventId, reason: d.reason, note: text(d.note), createdAt };
}

// Whether an event is over at a given moment, or has room.
export const hasEnded = (e: SevaEvent, now: number) => e.endsAt <= now;
export const isFull = (e: SevaEvent) => e.volunteerCount >= e.spots;
export const spotsLeft = (e: SevaEvent) => Math.max(e.spots - e.volunteerCount, 0);

// How full, 0–100, for the bar beside the words: rounded, but at least 1
// from the first volunteer, so the bar shows as soon as anyone joins (1 of
// 500 would round to nothing).
export const filledPercent = (e: SevaEvent) =>
    e.volunteerCount > 0 ? Math.max(1, Math.round((Math.min(e.volunteerCount, e.spots) / e.spots) * 100)) : 0;
