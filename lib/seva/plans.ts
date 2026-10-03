// Pure: the Firestore writes for each Seva change, as plain operations the
// browser carries out in one batch each (./client.ts). tests/rules replays
// these same plans on the emulator, so the rules are held to what the app
// really writes.
//
// The rules check each batch as a whole (getAfter sees all of it), so a plan
// is all or nothing: an event and its host's note; a sign-up, the
// volunteer's note and one more on the count. No plan writes a document
// twice, and the order is for readers: the public document, then the
// private ones, then the count.
//
// Firestore's own values, the server's clock and an increment, come in as
// `Sentinels`, so this file never imports the SDK: the browser passes
// serverTimestamp() and increment(), the tests pass markers.

import { chunk, type DocPath, type Op } from '@/lib/firebase/ops';
import type { EventStatus } from './config';
import { SEVA_ADMIN_BATCH, SEVA_EVENT_VERSION } from './limits';
import type { EventFields, EventPatch, ReportFields, SevaEvent, VolunteerFields } from './model';

export type Sentinels = { now: unknown; inc: (n: number) => unknown };

export const eventPath = (eventId: string): DocPath => ['seva_events', eventId];
export const volunteerPath = (eventId: string, key: string): DocPath => [...eventPath(eventId), 'volunteers', key];
export const signupPath = (uid: string, eventId: string): DocPath => ['users', uid, 'seva_signups', eventId];
export const hostingPath = (uid: string, eventId: string): DocPath => ['users', uid, 'seva_hosting', eventId];
export const reportId = (eventId: string, uid: string) => `${eventId}_${uid}`;
export const reportPath = (eventId: string, uid: string): DocPath => ['seva_reports', reportId(eventId, uid)];
export const adminPath = (uid: string): DocPath => ['admins', uid];

const FIELD_KEYS = [
    'title', 'category', 'description', 'startsAt', 'endsAt', 'timeZone', 'venue', 'address',
    'city', 'region', 'country', 'organizer', 'contact', 'spots',
] as const satisfies readonly (keyof EventFields)[];

const TIMES = new Set(['startsAt', 'endsAt']);

// A field as stored: times as Dates, which the SDK writes as timestamps.
const stored = (key: string, value: unknown) => (TIMES.has(key) && typeof value === 'number' ? new Date(value) : value);

export function planCreateEvent(uid: string, eventId: string, f: EventFields, s: Sentinels): Op[] {
    const fields = Object.fromEntries(FIELD_KEYS.map((k) => [k, stored(k, f[k])]));
    return [
        {
            type: 'set',
            path: eventPath(eventId),
            data: {
                v: SEVA_EVENT_VERSION,
                ...fields,
                volunteerCount: 0,
                status: 'open',
                cancelNote: '',
                hidden: false,
                createdAt: s.now,
                updatedAt: s.now,
            },
        },
        { type: 'set', path: hostingPath(uid, eventId), data: { createdAt: s.now } },
    ];
}

// What the form changed, and only that: a save with no change writes nothing,
// and doesn't tell volunteers the event "changed since you joined".
export function eventPatch(before: SevaEvent, next: EventFields): EventPatch {
    const patch: Record<string, unknown> = {};
    for (const k of FIELD_KEYS) if (next[k] !== before[k]) patch[k] = next[k];
    return patch as EventPatch;
}

export function planUpdateEvent(eventId: string, patch: EventPatch, s: Sentinels): Op[] {
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return [];
    return [{
        type: 'update',
        path: eventPath(eventId),
        data: { ...Object.fromEntries(entries.map(([k, v]) => [k, stored(k, v)])), updatedAt: s.now },
    }];
}

// Cancelling, with a word to volunteers, or reopening.
export function planSetStatus(eventId: string, status: EventStatus, cancelNote: string, s: Sentinels): Op[] {
    return planUpdateEvent(eventId, { status, cancelNote: status === 'cancelled' ? cancelNote : '' }, s);
}

// A new sign-up under a fresh random key, the volunteer's note of it, and one
// more on the count.
export function planJoin(uid: string, eventId: string, key: string, v: VolunteerFields, s: Sentinels): Op[] {
    return [
        { type: 'set', path: volunteerPath(eventId, key), data: { name: v.name, email: v.email, phone: v.phone, joinedAt: s.now } },
        { type: 'set', path: signupPath(uid, eventId), data: { volunteerId: key, joinedAt: s.now } },
        { type: 'update', path: eventPath(eventId), data: { volunteerCount: s.inc(1) } },
    ];
}

export function planUpdateSignup(eventId: string, key: string, v: VolunteerFields): Op[] {
    return [{ type: 'update', path: volunteerPath(eventId, key), data: { name: v.name, email: v.email, phone: v.phone } }];
}

export function planLeave(uid: string, eventId: string, key: string, s: Sentinels): Op[] {
    return [
        { type: 'delete', path: volunteerPath(eventId, key) },
        { type: 'delete', path: signupPath(uid, eventId) },
        { type: 'update', path: eventPath(eventId), data: { volunteerCount: s.inc(-1) } },
    ];
}

// A sign-up for an event that's gone: there's no count left to take one off.
export function planForget(uid: string, eventId: string, key: string): Op[] {
    return [
        { type: 'delete', path: volunteerPath(eventId, key) },
        { type: 'delete', path: signupPath(uid, eventId) },
    ];
}

export function planForgetHosted(uid: string, eventId: string): Op[] {
    return [{ type: 'delete', path: hostingPath(uid, eventId) }];
}

export function planReport(uid: string, eventId: string, r: ReportFields, s: Sentinels): Op[] {
    return [{ type: 'set', path: reportPath(eventId, uid), data: { eventId, reason: r.reason, note: r.note, createdAt: s.now } }];
}

// Moderators change one thing: whether the public sees the event.
export function planSetHidden(eventId: string, hidden: boolean): Op[] {
    return [{ type: 'update', path: eventPath(eventId), data: { hidden } }];
}

export function planDismissReports(reportIds: string[]): Op[][] {
    return chunk(reportIds.map((id): Op => ({ type: 'delete', path: ['seva_reports', id] })), SEVA_ADMIN_BATCH);
}
