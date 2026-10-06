// What Seva keeps, as the app sees it. Times are milliseconds since the epoch
// here; Firestore stores them as timestamps (./plans.ts writes Dates, which
// the SDK turns into timestamps, and ./event.ts reads any form back).
//
//   seva_events/{eventId}                    an event: public, unless hidden
//   seva_events/{eventId}/volunteers/{key}   a sign-up: its host and its
//                                            volunteer read it; the key is
//                                            random, not an account ID
//   users/{uid}/seva_signups/{eventId}       a volunteer's note of a sign-up
//   users/{uid}/seva_hosting/{eventId}       a host's note of their event
//   seva_reports/{eventId}_{uid}             a report, for admins
//   admins/{uid}                             who moderates (made by hand)

import type { EventStatus, ReportReason, SevaCategory } from './config';

// What the host fills in.
export type EventFields = {
    title: string;
    category: SevaCategory;
    description: string;
    startsAt: number;
    endsAt: number;
    // The venue's IANA zone: times are shown as they are there.
    timeZone: string;
    venue: string;
    address: string;
    city: string;
    region: string;
    // ISO 3166-1 alpha-2.
    country: string;
    // "Hosted by", shown to everyone.
    organizer: string;
    // How to reach the host, if they want it shown to everyone.
    contact: string;
    // How many may join: 1 to 500 (SEVA_SPOTS); null for no limit; 0 for an
    // event that takes no sign-ups and only lets the community know. Never
    // fewer than have joined. Read it through ./event.ts, not as a number:
    // in a comparison, null counts as 0.
    spots: number | null;
};

export type SevaEvent = EventFields & {
    id: string;
    status: EventStatus;
    // The host's word to volunteers when cancelling ("Moved to next Sunday").
    cancelNote: string;
    hidden: boolean;
    volunteerCount: number;
    createdAt: number;
    updatedAt: number;
};

// A change the host makes: only what differs.
export type EventPatch = Partial<EventFields & { status: EventStatus; cancelNote: string }>;

// What a volunteer gives the host. Email and phone are '' unless shared.
export type VolunteerFields = { name: string; email: string; phone: string };
export type Volunteer = VolunteerFields & { key: string; joinedAt: number };

export type Signup = { eventId: string; volunteerId: string; joinedAt: number };
export type Hosting = { eventId: string; createdAt: number };

export type ReportFields = { reason: ReportReason; note: string };
export type Report = ReportFields & { id: string; eventId: string; createdAt: number };
