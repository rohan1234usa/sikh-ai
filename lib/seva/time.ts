// Event times. An event is stored as two instants and the IANA zone of its
// venue, and always shown as the clock reads there: a langar at 6 pm in
// Fremont is at 6 pm, whoever looks. Only Intl is used, no time library.
//
// Formatting runs on the server and reaches the browser as text: Node and
// each browser carry different time-zone data, and a page that formatted the
// same instant twice could disagree with itself.

import type { Lang } from '@/lib/i18n/config';
import { fmt } from '@/lib/i18n/fmt';
import type { SevaEvent } from './model';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Whether this engine knows the zone. Chrome may name India's
// "Asia/Calcutta", which is fine: it's the same zone.
export function isTimeZone(tz: string): boolean {
    if (!tz) return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
    let f = partsFormatters.get(tz);
    if (!f) {
        f = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hourCycle: 'h23',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        partsFormatters.set(tz, f);
    }
    return f;
}

type Wall = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function wallAt(ms: number, tz: string): Wall {
    const n: Record<string, number> = {};
    for (const p of partsFormatter(tz).formatToParts(ms)) if (p.type !== 'literal') n[p.type] = Number(p.value);
    return { y: n.year, mo: n.month, d: n.day, h: n.hour, mi: n.minute, s: n.second };
}

// The zone's offset from UTC at an instant, in ms (Los Angeles in summer:
// -7 hours).
export function zoneOffset(ms: number, tz: string): number {
    const w = wallAt(ms, tz);
    return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

// The venue's calendar day and clock time at an instant.
export function utcToZoned(ms: number, tz: string): { date: string; time: string } {
    const w = wallAt(ms, tz);
    return { date: `${pad(w.y, 4)}-${pad(w.mo)}-${pad(w.d)}`, time: `${pad(w.h)}:${pad(w.mi)}` };
}

export const localDateKey = (ms: number, tz: string) => utcToZoned(ms, tz).date;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

// A calendar day ('2026-10-10') as UTC midnight, or null if it isn't one.
export function parseDate(date: string): number | null {
    const m = DATE_RE.exec(date);
    if (!m) return null;
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const back = new Date(ms);
    return back.getUTCFullYear() === Number(m[1]) && back.getUTCMonth() === Number(m[2]) - 1 && back.getUTCDate() === Number(m[3])
        ? ms
        : null;
}

export function addDays(date: string, days: number): string {
    const ms = parseDate(date);
    if (ms === null) return date;
    const d = new Date(ms + days * DAY);
    return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// The instant a venue's clock reads `time` on `date`. Most times exist once.
// When clocks go back, an hour happens twice: the first is taken. When they
// go forward, an hour never happens: a time in it moves forward by the gap
// (2:30 becomes 3:30), as Temporal's "compatible" rule does. `kind` says which,
// so the form can show the time it settled on.
export function zonedTimeToUtc(date: string, time: string, tz: string): { ms: number; kind: 'exact' | 'gap' | 'overlap' } | null {
    const day = parseDate(date);
    const t = TIME_RE.exec(time);
    if (day === null || !t || !isTimeZone(tz)) return null;
    const h = Number(t[1]);
    const mi = Number(t[2]);
    if (h > 23 || mi > 59) return null;
    const wall = day + h * 60 * MINUTE + mi * MINUTE;
    // The zone's offsets a day either side: across a change they differ, and
    // the wall time belongs to one, the other, both (an overlap) or neither (a
    // gap).
    const before = zoneOffset(wall - DAY, tz);
    const after = zoneOffset(wall + DAY, tz);
    const fits = [...new Set([wall - before, wall - after])].filter((ms) => ms + zoneOffset(ms, tz) === wall).sort((a, b) => a - b);
    if (fits.length === 2) return { ms: fits[0], kind: 'overlap' };
    if (fits.length === 1) return { ms: fits[0], kind: 'exact' };
    return { ms: wall - before, kind: 'gap' };
}

// The same clock time some days later at the venue, whatever the clocks did
// meanwhile: "Post again" moves a 10 am event to 10 am next week.
export function shiftLocalDays(ms: number, tz: string, days: number): number {
    const { date, time } = utcToZoned(ms, tz);
    return zonedTimeToUtc(addDays(date, days), time, tz)?.ms ?? ms + days * DAY;
}

// '2026-10-10T18:00:00-07:00': the instant with the venue's offset, for
// <time dateTime> and schema.org.
export function toIsoWithOffset(ms: number, tz: string): string {
    const off = Math.round(zoneOffset(ms, tz) / MINUTE);
    const { date, time } = utcToZoned(ms, tz);
    const sign = off < 0 ? '-' : '+';
    const abs = Math.abs(off);
    return `${date}T${time}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// ─── Shown to people ─────────────────────────────────────────────────────────

// English formatting for English and romanized Punjabi, whose interface
// avoids Gurmukhi month names (as lib/i18n/date.ts does); Gurmukhi names for
// Punjabi. Digits stay Western in all three, as across the site.
const LOCALE: Record<Lang, string> = { 'en': 'en-US', 'pa': 'pa', 'pa-latn': 'en-US' };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(lang: Lang, tz: string, kind: 'date' | 'time' | 'zone'): Intl.DateTimeFormat {
    const key = `${lang}|${tz}|${kind}`;
    let f = formatters.get(key);
    if (!f) {
        const base = { timeZone: tz, numberingSystem: 'latn' } as const;
        f = new Intl.DateTimeFormat(LOCALE[lang], kind === 'date'
            ? { ...base, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
            : kind === 'time'
                ? { ...base, hour: 'numeric', minute: '2-digit' }
                : { ...base, timeZoneName: 'longGeneric' });
        formatters.set(key, f);
    }
    return f;
}

// "Saturday, October 10, 2026", at the venue.
export const formatDate = (ms: number, tz: string, lang: Lang) => formatter(lang, tz, 'date').format(ms);

// "6:00 PM", at the venue.
export const formatTime = (ms: number, tz: string, lang: Lang) => formatter(lang, tz, 'time').format(ms);

// "Pacific Time", "India Standard Time": the zone in words.
export function zoneName(ms: number, tz: string, lang: Lang): string {
    return formatter(lang, tz, 'zone').formatToParts(ms).find((p) => p.type === 'timeZoneName')?.value ?? tz;
}

// A day given as 'YYYY-MM-DD' ("Saturday, October 10, 2026"), the same
// wherever it's built: for the board's headings, one per venue-local day.
export const formatDayKey = (key: string, lang: Lang) => formatDate(parseDate(key) ?? 0, 'UTC', lang);

// The words that join the parts, from the page's copy: timeRange
// '{start} to {end}', dateTimeRange '{startDate}, {startTime} to {endDate},
// {endTime}', sameDay '{date}, {times}', withZone '{when} ({zone})'. "to"
// rather than a dash, which screen readers skip or read as "minus".
export type WhenWords = { timeRange: string; dateTimeRange: string; sameDay: string; withZone: string };

// "6:00 PM to 9:00 PM", or for an event that ends on a later day "6:00 PM to
// Sunday, October 11, 2026, 2:00 AM".
export function formatTimes(e: Pick<SevaEvent, 'startsAt' | 'endsAt' | 'timeZone'>, lang: Lang, words: WhenWords): string {
    const end = sameLocalDay(e)
        ? formatTime(e.endsAt, e.timeZone, lang)
        : fmt(words.sameDay, { date: formatDate(e.endsAt, e.timeZone, lang), times: formatTime(e.endsAt, e.timeZone, lang) });
    return fmt(words.timeRange, { start: formatTime(e.startsAt, e.timeZone, lang), end });
}

// The whole of it: "Saturday, October 10, 2026, 6:00 PM to 9:00 PM (Pacific
// Time)".
export function formatWhen(e: Pick<SevaEvent, 'startsAt' | 'endsAt' | 'timeZone'>, lang: Lang, words: WhenWords): string {
    const tz = e.timeZone;
    const when = sameLocalDay(e)
        ? fmt(words.sameDay, { date: formatDate(e.startsAt, tz, lang), times: formatTimes(e, lang, words) })
        : fmt(words.dateTimeRange, {
            startDate: formatDate(e.startsAt, tz, lang),
            startTime: formatTime(e.startsAt, tz, lang),
            endDate: formatDate(e.endsAt, tz, lang),
            endTime: formatTime(e.endsAt, tz, lang),
        });
    return fmt(words.withZone, { when, zone: zoneName(e.startsAt, tz, lang) });
}

export function sameLocalDay(e: Pick<SevaEvent, 'startsAt' | 'endsAt' | 'timeZone'>): boolean {
    // An event ending at midnight belongs to the day it started.
    return localDateKey(e.startsAt, e.timeZone) === localDateKey(e.endsAt - 1, e.timeZone);
}
