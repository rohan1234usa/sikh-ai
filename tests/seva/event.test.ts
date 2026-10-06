import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasEnded, isFull, parseEvent, parseReport, parseSignup, parseVolunteer, room, signupMode, spotsLeft, takesSignups, toMillis } from '@/lib/seva/event';
import { ID, KEY, event } from './helpers';

// As Firestore would hand it back: times as Timestamps, from the SDK.
const stamp = (ms: number) => ({ toMillis: () => ms });
function raw(over: Record<string, unknown> = {}) {
    const { id: _id, startsAt, endsAt, createdAt, updatedAt, ...rest } = event();
    return { v: 1, ...rest, startsAt: stamp(startsAt), endsAt: stamp(endsAt), createdAt: stamp(createdAt), updatedAt: stamp(updatedAt), ...over };
}

test('an event reads back as written, from the SDK or the REST API', () => {
    assert.deepEqual(parseEvent(ID, raw()), event());
    const rest = { ...raw(), startsAt: new Date(event().startsAt).toISOString(), endsAt: new Date(event().endsAt).toISOString() };
    assert.equal(parseEvent(ID, rest)?.startsAt, event().startsAt);
    assert.equal(toMillis('2026-10-11T01:00:00.123456Z'), Date.UTC(2026, 9, 11, 1, 0, 0, 123), 'nanoseconds parse');
});

test('hidden, legacy and broken documents read as nothing', () => {
    assert.equal(parseEvent(ID, raw({ hidden: true })), null);
    assert.equal(parseEvent(ID, raw({ hidden: true }), { allowHidden: true })?.hidden, true, 'for its host and admins');
    assert.equal(parseEvent(ID, { title: 'Old', location: 'Gurdwara', date: 'Sat 10am', needed: 5, attendees: ['x'] }), null);
    assert.equal(parseEvent(ID, raw({ v: 2 })), null);
    assert.equal(parseEvent(ID, raw({ status: 'party' })), null);
    assert.equal(parseEvent(ID, raw({ endsAt: stamp(event().startsAt) })), null);
    assert.equal(parseEvent(ID, raw({ spots: -1 })), null);
    assert.equal(parseEvent(ID, raw({ title: '  ' })), null);
    assert.equal(parseEvent('not-an-id', raw()), null);
    assert.equal(parseEvent(ID, null), null);
});

test('odd fields are made safe rather than trusted', () => {
    const e = parseEvent(ID, raw({ category: 'party', volunteerCount: 99, country: 'usa', timeZone: 7 }))!;
    assert.equal(e.category, 'other');
    assert.equal(e.volunteerCount, e.spots, 'a count edited by hand stays within the spots');
    assert.equal(e.country, '');
    assert.equal(e.timeZone, 'UTC');
    // A zone this engine doesn't know would make every date on the page throw.
    assert.equal(parseEvent(ID, raw({ timeZone: 'Foo/Bar' }))?.timeZone, 'UTC');
    assert.equal(parseEvent(ID, raw({ timeZone: 'Asia/Kolkata' }))?.timeZone, 'Asia/Kolkata');
});

test('sign-ups, notes and reports read back, or not at all', () => {
    assert.deepEqual(parseVolunteer(KEY, { name: 'Amar', email: '', phone: '', joinedAt: stamp(5) }), { key: KEY, name: 'Amar', email: '', phone: '', joinedAt: 5 });
    assert.equal(parseVolunteer(KEY, { name: '', joinedAt: stamp(5) }), null);
    assert.deepEqual(parseSignup(ID, { volunteerId: KEY, joinedAt: stamp(5) }), { eventId: ID, volunteerId: KEY, joinedAt: 5 });
    assert.equal(parseSignup(ID, { volunteerId: 'short', joinedAt: stamp(5) }), null);
    assert.deepEqual(parseReport(`${ID}_bob`, { eventId: ID, reason: 'spam', note: '', createdAt: stamp(5) }), { id: `${ID}_bob`, eventId: ID, reason: 'spam', note: '', createdAt: 5 });
    assert.equal(parseReport('x', { eventId: ID, reason: 'meh', createdAt: stamp(5) }), null);
});

test('who may sign up reads back as written: a limit, none (null) or no sign-up (0)', () => {
    assert.equal(parseEvent(ID, raw({ spots: null }))?.spots, null);
    assert.equal(parseEvent(ID, raw({ spots: 0, volunteerCount: 0 }))?.spots, 0);
    assert.equal(parseEvent(ID, raw({ spots: 500 }))?.spots, 500);
    // "No limit" is only an explicit null: anything else isn't an event.
    for (const spots of [undefined, 2.5, '20', -1, true]) assert.equal(parseEvent(ID, raw({ spots })), null, String(spots));
    const { spots: _spots, ...missing } = raw();
    assert.equal(parseEvent(ID, missing), null, 'a missing field');
});

test('the count is held to the spots only when there is a limit', () => {
    assert.equal(parseEvent(ID, raw({ spots: 0, volunteerCount: 4 }))?.volunteerCount, 0);
    assert.equal(parseEvent(ID, raw({ spots: null, volunteerCount: 999 }))?.volunteerCount, 999);
    assert.equal(parseEvent(ID, raw({ spots: null, volunteerCount: -2 }))?.volunteerCount, 0);
    assert.equal(parseEvent(ID, raw({ spots: 5, volunteerCount: 9 }))?.volunteerCount, 5);
});

test('the room an event has, by who may sign up', () => {
    const none = { spots: 0, volunteerCount: 0 };
    const open = { spots: null, volunteerCount: 10_000 };
    const limited = { spots: 20, volunteerCount: 3 };
    assert.deepEqual([signupMode(none), signupMode(open), signupMode(limited)], ['none', 'unlimited', 'limited']);
    assert.deepEqual(room(none), { mode: 'none' });
    assert.deepEqual(room(open), { mode: 'unlimited', joined: 10_000 });
    assert.deepEqual(room(limited), { mode: 'limited', joined: 3, spots: 20, left: 17, full: false });
    assert.deepEqual([takesSignups(none), takesSignups(open), takesSignups(limited)], [false, true, true]);
    // In a comparison null counts as 0, so these would be "full" if read
    // straight from the spots.
    assert.deepEqual([isFull(none), isFull(open)], [false, false]);
    assert.deepEqual([spotsLeft(none), spotsLeft(open)], [null, null]);
    assert.ok(isFull({ spots: 3, volunteerCount: 3 }));
});

test('ended, full and spots left', () => {
    const e = event({ volunteerCount: 20 });
    assert.ok(isFull(e));
    assert.equal(spotsLeft(e), 0);
    assert.equal(spotsLeft(event()), 17);
    assert.ok(hasEnded(e, e.endsAt));
    assert.ok(!hasEnded(e, e.endsAt - 1));
});
