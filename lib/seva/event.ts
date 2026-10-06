// Reading Seva documents back, from the SDK in the browser or the REST API on
// the server (./rest.ts). Every document is untrusted: anything Firestore
// returns was written by someone's browser, the rules permitting, or by hand
// in the console. Nothing here throws; a document that isn't what the app
// writes is null, and the page goes on without it.

import { fmt } from '@/lib/i18n/fmt';
import type { SevaCopy } from '@/lib/i18n/seva';
import { isCategory, isCountryCode, isEventId, isReportReason, type SignupMode } from './config';
import { SEVA_EVENT_VERSION } from './limits';
import type { EventFields, Report, SevaEvent, Signup, Volunteer } from './model';
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

// Spots as stored: null (no limit), 0 (no sign-up) or a limit. Anything else,
// a missing field included, is undefined: "no limit" is only an explicit null.
function readSpots(v: unknown): number | null | undefined {
    if (v === null) return null;
    const n = count(v);
    return n !== null && n >= 0 ? n : undefined;
}

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
    const spots = readSpots(d.spots);
    const title = text(d.title).trim();
    if (!status || startsAt === null || endsAt === null || endsAt <= startsAt || spots === undefined || !title) {
        return null;
    }
    const joined = Math.max(count(d.volunteerCount) ?? 0, 0);
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
        volunteerCount: spots === null ? joined : Math.min(joined, spots),
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

// Whether an event is over at a given moment.
export const hasEnded = (e: SevaEvent, now: number) => e.endsAt <= now;

// Who may sign up, and the room left: what the pages read instead of the
// spots themselves, which mean three things (./model.ts). Each takes just
// the two fields, so the islands can pass the event as they keep it.
type Counted = Pick<SevaEvent, 'spots' | 'volunteerCount'>;

export type Room =
    | { mode: 'none' }
    | { mode: 'unlimited'; joined: number }
    | { mode: 'limited'; joined: number; spots: number; left: number; full: boolean };

export const signupMode = ({ spots }: Pick<EventFields, 'spots'>): SignupMode =>
    spots === null ? 'unlimited' : spots === 0 ? 'none' : 'limited';

export function room({ spots, volunteerCount: joined }: Counted): Room {
    if (spots === null) return { mode: 'unlimited', joined };
    if (spots === 0) return { mode: 'none' };
    return { mode: 'limited', joined, spots, left: Math.max(spots - joined, 0), full: joined >= spots };
}

// Whether the host asked for sign-ups at all: the setting, not whether one
// can be made now (a cancelled or past event still takes them).
export const takesSignups = (e: Pick<EventFields, 'spots'>) => e.spots !== 0;

// Full only with a limit, and reached.
export const isFull = (e: Counted) => {
    const r = room(e);
    return r.mode === 'limited' && r.full;
};

// Who may sign up, and how many have, in words, as the board's cards and the
// event page's Join card both say it: "No sign-up needed", "Volunteers: 12",
// or, with a limit, "Volunteers: 3 of 20" and "Spots left: 17" (or "Full"),
// with how full, 0–100, for the bar beside them.
export type SignupWords = Pick<SevaCopy['common'], 'capacity' | 'spotsLeft' | 'full' | 'capacityNoLimit' | 'noSignup'>;

export type SignupLine =
    | { mode: 'none' | 'unlimited'; text: string }
    | { mode: 'limited'; text: string; left: string; percent: number };

export function signupLine(e: Counted, words: SignupWords): SignupLine {
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
