// Client-safe Seva configuration: the ids and their guards, the pages'
// addresses, and how long pages are cached. The limits the rules enforce are
// in ./limits.ts.

import { SEVA_CATEGORIES, SEVA_REPORT_REASONS, SEVA_STATUSES } from './limits';

export type SevaCategory = (typeof SEVA_CATEGORIES)[number];
export type EventStatus = (typeof SEVA_STATUSES)[number];
export type ReportReason = (typeof SEVA_REPORT_REASONS)[number];

export const isCategory = (v: unknown): v is SevaCategory => SEVA_CATEGORIES.includes(v as SevaCategory);
export const isReportReason = (v: unknown): v is ReportReason => SEVA_REPORT_REASONS.includes(v as ReportReason);

// Who may sign up, as the hosting form asks it: no one, anyone, or up to a
// number. Stored as the event's spots: 0, null, or the number (./model.ts).
export const SIGNUP_MODES = ['none', 'unlimited', 'limited'] as const;
export type SignupMode = (typeof SIGNUP_MODES)[number];
export const isSignupMode = (v: unknown): v is SignupMode => SIGNUP_MODES.includes(v as SignupMode);

// An id the SDK makes (doc().id): 20 letters and digits. Event ids are in
// public addresses, so the rules refuse any other, and a page asks Firestore
// only for one of these.
export const isEventId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9]{20}$/.test(v);

export const isCountryCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{2}$/.test(v);

// Addresses, without the language prefix (localePath adds it).
export const SEVA_HREF = '/seva';
export const CREATE_HREF = '/seva/create';
export const ADMIN_HREF = '/seva/admin';
export const eventHref = (id: string) => `/seva/${id}`;
export const editHref = (id: string) => `/seva/${id}/edit`;
// "Post again": the form, filled in from an event a week later.
export const postAgainHref = (id: string) => `/seva/create?from=${id}`;

// The board, the home page's strip and the sitemap share one cached read of
// what's coming up; each event page caches its own. A change made here asks
// for both to be refreshed (app/api/seva/refresh), so the times only bound
// what someone else's change takes to show. Route segment config must be a
// literal, so the pages repeat SEVA_REVALIDATE_SECONDS.
export const SEVA_REVALIDATE_SECONDS = 300;
export const SEVA_UPCOMING_TAG = 'seva-upcoming';
export const eventTag = (id: string) => `seva-event:${id}`;
export const HOME_STRIP_COUNT = 3;
