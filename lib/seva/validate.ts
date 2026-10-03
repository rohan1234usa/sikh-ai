// What the Seva forms accept, checked before anything is sent: the hosting
// form, joining and reporting. The limits are the rules' (./limits.ts), so
// whatever passes here the rules accept too (tests/rules holds them to that);
// the form asks a little more where a slip is likely, such as a start time
// that has already passed.

import { isCategory, isReportReason } from './config';
import { COUNTRY_CODES } from './countries';
import {
    SEVA_MAX_DAYS_AHEAD,
    SEVA_MAX_DAYS_LONG,
    SEVA_REPORT_NOTE,
    SEVA_SPOTS,
    SEVA_TEXT,
    SEVA_VOLUNTEER_TEXT,
} from './limits';
import type { EventFields, ReportFields, VolunteerFields } from './model';
import { isTimeZone, parseDate, zonedTimeToUtc } from './time';

const DAY = 24 * 60 * 60 * 1000;

// Length as the rules count it: in code points, not UTF-16 units.
export const textLength = (s: string) => Array.from(s).length;

// Text as it's stored: composed (NFC, as the site's Gurmukhi is) and trimmed.
export const cleanText = (s: string) => s.normalize('NFC').trim();

// Gurmukhi digits typed on a Punjabi keyboard, as Western ones.
export const westernDigits = (s: string) => s.replace(/[੦-੯]/g, (d) => String(d.charCodeAt(0) - 0x0a66));

export type TextError = 'required' | 'tooShort' | 'tooLong';

function checkText(value: string, [min, max]: readonly [number, number]): TextError | null {
    const n = textLength(value);
    if (n === 0 && min > 0) return 'required';
    if (n < min) return 'tooShort';
    if (n > max) return 'tooLong';
    return null;
}

// ─── The hosting form ───────────────────────────────────────────────────────

// The form's fields, as typed.
export type EventDraft = {
    title: string;
    category: string;
    description: string;
    date: string;      // 'YYYY-MM-DD'
    startTime: string; // 'HH:MM'
    endTime: string;
    multiDay: boolean;
    endDate: string;
    timeZone: string;
    venue: string;
    address: string;
    city: string;
    region: string;
    country: string;
    spots: string;
    organizer: string;
    contact: string;
};

export type DraftError =
    | TextError
    | 'invalid'
    | 'startPast'
    | 'ended'
    | 'endBeforeStart'
    | 'tooLongEvent'
    | 'tooFarAhead'
    | 'belowJoined';

export type DraftErrors = Partial<Record<keyof EventDraft, DraftError>>;

export type DraftResult = { ok: true; fields: EventFields } | { ok: false; errors: DraftErrors };

// When editing: the event as it stands, so times left alone aren't held to
// "not yet over", and spots can't drop below those who joined.
export type Editing = { startsAt: number; endsAt: number; volunteerCount: number };

export function validateEventDraft(draft: EventDraft, { now, editing }: { now: number; editing?: Editing }): DraftResult {
    const errors: DraftErrors = {};
    const text = {} as Record<keyof typeof SEVA_TEXT, string>;
    for (const key of ['title', 'description', 'venue', 'address', 'city', 'region', 'organizer', 'contact'] as const) {
        text[key] = cleanText(draft[key]);
        const error = checkText(text[key], SEVA_TEXT[key]);
        if (error) errors[key] = error;
    }

    if (!isCategory(draft.category)) errors.category = 'required';
    if (!COUNTRY_CODES.includes(draft.country)) errors.country = 'required';

    const spotsText = westernDigits(draft.spots).trim();
    const spots = /^\d+$/.test(spotsText) ? Number(spotsText) : NaN;
    if (!spotsText) errors.spots = 'required';
    else if (!Number.isSafeInteger(spots) || spots < SEVA_SPOTS[0] || spots > SEVA_SPOTS[1]) errors.spots = 'invalid';
    else if (editing && spots < editing.volunteerCount) errors.spots = 'belowJoined';

    const timeZone = draft.timeZone;
    if (!timeZone) errors.timeZone = 'required';
    else if (!isTimeZone(timeZone) || textLength(timeZone) > SEVA_TEXT.timeZone[1]) errors.timeZone = 'invalid';

    let startsAt: number | null = null;
    let endsAt: number | null = null;
    if (!draft.date) errors.date = 'required';
    else if (parseDate(draft.date) === null) errors.date = 'invalid';
    if (!draft.startTime) errors.startTime = 'required';
    if (!draft.endTime) errors.endTime = 'required';
    if (draft.multiDay) {
        if (!draft.endDate) errors.endDate = 'required';
        else if (parseDate(draft.endDate) === null) errors.endDate = 'invalid';
    }
    if (!errors.date && !errors.startTime && !errors.timeZone) {
        startsAt = zonedTimeToUtc(draft.date, draft.startTime, timeZone)?.ms ?? null;
        if (startsAt === null) errors.startTime = 'invalid';
    }
    const endDate = draft.multiDay ? draft.endDate : draft.date;
    if (!errors.date && !errors.endDate && !errors.endTime && !errors.timeZone) {
        endsAt = zonedTimeToUtc(endDate, draft.endTime, timeZone)?.ms ?? null;
        if (endsAt === null) errors.endTime = 'invalid';
    }
    if (startsAt !== null && endsAt !== null) {
        const moved = !editing || startsAt !== editing.startsAt || endsAt !== editing.endsAt;
        if (endsAt <= startsAt) errors[draft.multiDay ? 'endDate' : 'endTime'] = 'endBeforeStart';
        else if (endsAt - startsAt > SEVA_MAX_DAYS_LONG * DAY) errors[draft.multiDay ? 'endDate' : 'endTime'] = 'tooLongEvent';
        // A new event that has already begun is most likely a slip of the date.
        else if (!editing && startsAt <= now) errors.startTime = 'startPast';
        else if (moved && endsAt <= now) errors.endTime = 'ended';
        if (moved && startsAt > now + SEVA_MAX_DAYS_AHEAD * DAY) errors.date = 'tooFarAhead';
    }

    if (Object.keys(errors).length > 0 || startsAt === null || endsAt === null) return { ok: false, errors };
    return {
        ok: true,
        fields: {
            title: text.title,
            category: draft.category as EventFields['category'],
            description: text.description,
            startsAt,
            endsAt,
            timeZone,
            venue: text.venue,
            address: text.address,
            city: text.city,
            region: text.region,
            country: draft.country,
            organizer: text.organizer,
            contact: text.contact,
            spots,
        },
    };
}

// ─── Joining ────────────────────────────────────────────────────────────────

export type JoinDraft = { name: string; shareEmail: boolean; email: string; sharePhone: boolean; phone: string };
export type JoinErrors = Partial<Record<'name' | 'phone', TextError | 'invalid'>>;

// Digits, spaces and + ( ) - . only, with at least six digits.
const PHONE_RE = /^\+?[\d\s().-]+$/;

export function validateJoin(draft: JoinDraft): { ok: true; fields: VolunteerFields } | { ok: false; errors: JoinErrors } {
    const errors: JoinErrors = {};
    const name = cleanText(draft.name);
    const nameError = checkText(name, SEVA_VOLUNTEER_TEXT.name);
    if (nameError) errors.name = nameError;
    const phone = draft.sharePhone ? westernDigits(cleanText(draft.phone)) : '';
    if (draft.sharePhone) {
        // Ticked, so it's wanted, though the stored field may be empty.
        const phoneError = phone ? checkText(phone, SEVA_VOLUNTEER_TEXT.phone) : 'required';
        if (phoneError) errors.phone = phoneError;
        else if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 6) errors.phone = 'invalid';
    }
    // The account's own address, shown and sent as it is (the rules check it
    // is the signed-in account's).
    const email = draft.shareEmail ? draft.email : '';
    if (Object.keys(errors).length > 0) return { ok: false, errors };
    return { ok: true, fields: { name, email, phone } };
}

// ─── Reporting and cancelling ───────────────────────────────────────────────

export type ReportErrors = Partial<Record<'reason' | 'note', 'required' | 'tooLong'>>;

export function validateReport(draft: { reason: string; note: string }): { ok: true; fields: ReportFields } | { ok: false; errors: ReportErrors } {
    const errors: ReportErrors = {};
    const note = cleanText(draft.note);
    if (!isReportReason(draft.reason)) errors.reason = 'required';
    // "Something else" needs a word on what.
    else if (draft.reason === 'other' && !note) errors.note = 'required';
    if (textLength(note) > SEVA_REPORT_NOTE[1]) errors.note = 'tooLong';
    if (Object.keys(errors).length > 0 || !isReportReason(draft.reason)) return { ok: false, errors };
    return { ok: true, fields: { reason: draft.reason, note } };
}

export function validateCancelNote(note: string): { ok: true; note: string } | { ok: false; error: 'tooLong' } {
    const clean = cleanText(note);
    return textLength(clean) > SEVA_TEXT.cancelNote[1] ? { ok: false, error: 'tooLong' } : { ok: true, note: clean };
}
