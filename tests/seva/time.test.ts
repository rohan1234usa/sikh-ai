import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    addDays,
    formatClock,
    formatDayKey,
    formatTimes,
    formatWhen,
    isTimeZone,
    laterSameDay,
    localDateKey,
    parseDate,
    shiftLocalDays,
    toIsoWithOffset,
    utcToZoned,
    zoneName,
    zonedTimeToUtc,
} from '@/lib/seva/time';

const WORDS = { timeRange: '{start} to {end}', dateTimeRange: '{startDate}, {startTime} to {endDate}, {endTime}', sameDay: '{date}, {times}', withZone: '{when} ({zone})' };
const iso = (ms: number) => new Date(ms).toISOString();

test("a venue's clock time becomes the instant it happens", () => {
    assert.deepEqual(zonedTimeToUtc('2026-10-10', '18:00', 'America/Los_Angeles'), { ms: Date.UTC(2026, 9, 11, 1), kind: 'exact' });
    assert.equal(iso(zonedTimeToUtc('2026-10-10', '18:00', 'Asia/Kolkata')!.ms), '2026-10-10T12:30:00.000Z');
    assert.equal(iso(zonedTimeToUtc('2026-07-01', '09:00', 'Europe/London')!.ms), '2026-07-01T08:00:00.000Z');
    assert.equal(iso(zonedTimeToUtc('2026-01-15', '10:00', 'Australia/Sydney')!.ms), '2026-01-14T23:00:00.000Z');
    assert.equal(iso(zonedTimeToUtc('2026-06-01', '12:00', 'Pacific/Chatham')!.ms), '2026-05-31T23:15:00.000Z');
});

test('a time the clocks skip moves forward by the gap; a time they repeat is the first', () => {
    // Los Angeles springs forward at 2 am on 8 March 2026: 2:30 never happens.
    const gap = zonedTimeToUtc('2026-03-08', '02:30', 'America/Los_Angeles')!;
    assert.equal(gap.kind, 'gap');
    assert.deepEqual(utcToZoned(gap.ms, 'America/Los_Angeles'), { date: '2026-03-08', time: '03:30' });
    // And falls back at 2 am on 1 November: 1:30 happens twice.
    const overlap = zonedTimeToUtc('2026-11-01', '01:30', 'America/Los_Angeles')!;
    assert.equal(overlap.kind, 'overlap');
    assert.equal(iso(overlap.ms), '2026-11-01T08:30:00.000Z');
    // Southern hemisphere: Sydney springs forward on 4 October 2026.
    assert.equal(zonedTimeToUtc('2026-10-04', '02:30', 'Australia/Sydney')!.kind, 'gap');
    assert.equal(zonedTimeToUtc('2026-04-05', '02:30', 'Australia/Sydney')!.kind, 'overlap');
});

test('anything that is not a date, a time or a zone is refused', () => {
    for (const [d, t, z] of [['2026-02-30', '10:00', 'UTC'], ['2026-1-5', '10:00', 'UTC'], ['2026-01-05', '24:00', 'UTC'], ['2026-01-05', '9:00', 'UTC'], ['2026-01-05', '10:00', 'Mars/Olympus']]) {
        assert.equal(zonedTimeToUtc(d, t, z), null, `${d} ${t} ${z}`);
    }
    assert.equal(parseDate('2026-02-29'), null);
    assert.equal(isTimeZone(''), false);
    assert.equal(isTimeZone('Asia/Calcutta'), true, "Chrome's name for India's zone");
});

test('Post again keeps the clock time across a change of the clocks', () => {
    // 10 am on Saturday 24 October in London (summer time), a week on, is
    // 10 am on 31 October (winter time), not 9 am.
    const start = zonedTimeToUtc('2026-10-24', '10:00', 'Europe/London')!.ms;
    const next = shiftLocalDays(start, 'Europe/London', 7);
    assert.deepEqual(utcToZoned(next, 'Europe/London'), { date: '2026-10-31', time: '10:00' });
    assert.equal(next - start, 7 * 24 * 3600e3 + 3600e3);
    assert.equal(addDays('2026-12-28', 7), '2027-01-04');
});

test('an instant carries its venue offset for <time> and schema.org', () => {
    assert.equal(toIsoWithOffset(Date.UTC(2026, 9, 11, 1), 'America/Los_Angeles'), '2026-10-10T18:00:00-07:00');
    assert.equal(toIsoWithOffset(Date.UTC(2026, 9, 10, 12, 30), 'Asia/Kolkata'), '2026-10-10T18:00:00+05:30');
    assert.equal(localDateKey(Date.UTC(2026, 9, 11, 1), 'America/Los_Angeles'), '2026-10-10');
});

test('times read as they are at the venue, in words, with "to" rather than a dash', () => {
    const e = { startsAt: Date.UTC(2026, 9, 11, 1), endsAt: Date.UTC(2026, 9, 11, 4), timeZone: 'America/Los_Angeles' };
    assert.equal(formatWhen(e, 'en', WORDS), 'Saturday, October 10, 2026, 6:00 PM to 9:00 PM (Pacific Time)');
    assert.equal(formatTimes(e, 'en', WORDS), '6:00 PM to 9:00 PM');
    const overnight = { ...e, endsAt: Date.UTC(2026, 9, 11, 14) };
    assert.equal(formatWhen(overnight, 'en', WORDS), 'Saturday, October 10, 2026, 6:00 PM to Sunday, October 11, 2026, 7:00 AM (Pacific Time)');
    // Ending at midnight is still the same evening.
    assert.equal(formatTimes({ ...e, endsAt: Date.UTC(2026, 9, 11, 7) }, 'en', WORDS), '6:00 PM to 12:00 AM');
});

test('Punjabi names the day, month and zone in Gurmukhi with Western digits; romanized uses English', () => {
    const e = { startsAt: Date.UTC(2026, 9, 11, 1), endsAt: Date.UTC(2026, 9, 11, 4), timeZone: 'America/Los_Angeles' };
    const pa = formatWhen(e, 'pa', WORDS);
    assert.match(pa, /\p{Script=Gurmukhi}/u);
    assert.match(pa, /2026/);
    assert.doesNotMatch(pa, /[੦-੯]/);
    assert.match(formatWhen(e, 'pa-latn', WORDS), /^Saturday, October 10, 2026/);
    assert.notEqual(zoneName(e.startsAt, 'Asia/Kolkata', 'en'), 'Asia/Kolkata');
    assert.equal(formatDayKey('2026-10-10', 'en'), 'Saturday, October 10, 2026');
});

test('the end the form suggests: later the same day, or none past midnight', () => {
    assert.equal(laterSameDay('18:00', 120), '20:00');
    assert.equal(laterSameDay('09:45', 120), '11:45');
    assert.equal(laterSameDay('21:59', 120), '23:59');
    assert.equal(laterSameDay('22:00', 120), null, 'midnight is the next day');
    assert.equal(laterSameDay('23:30', 120), null);
    for (const bad of ['', '6pm', '24:00', '18:60', '7:00']) assert.equal(laterSameDay(bad, 120), null, bad);
    assert.equal(formatClock('20:00', 'en'), '8:00 PM');
    assert.match(formatClock('20:00', 'pa'), /8:00/);
    assert.equal(formatClock('soon', 'en'), 'soon');
});
