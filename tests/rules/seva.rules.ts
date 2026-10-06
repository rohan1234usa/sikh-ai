// The Seva rules (firestore.rules), on the emulator, with the documents the
// app writes (lib/seva/plans.ts). See ./env.ts.
//
// The people: hana hosts, amar and bina volunteer, olive is an admin, bob is
// anyone else.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
    Timestamp,
    addDoc,
    arrayUnion,
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    type Firestore,
} from 'firebase/firestore';
import type { Op } from '@/lib/firebase/ops';
import { SEVA_HOST_CLEAR_BATCH, SEVA_TEXT } from '@/lib/seva/limits';
import type { EventFields, ReportFields, VolunteerFields } from '@/lib/seva/model';
import {
    eventPatch,
    hostingPath,
    planClearSignups,
    planCreateEvent,
    planDeleteEvent,
    planDismissReports,
    planDropNote,
    planForget,
    planJoin,
    planLeave,
    planReport,
    planSetHidden,
    planSetStatus,
    planUpdateEvent,
    planUpdateSignup,
    reportId,
} from '@/lib/seva/plans';
import { utcToZoned } from '@/lib/seva/time';
import { validateEventDraft, type EventDraft } from '@/lib/seva/validate';
import { commit, rulesEnv } from './env';

const { as, anon, seed, peek, wipe } = rulesEnv();

const S = { now: serverTimestamp(), inc: increment };
const HOUR = 3600e3;
const DAY = 24 * HOUR;
const E = 'EventAAAAAAAAAAAAAAA';
const K_A = 'KeyAmarAAAAAAAAAAAAA';
const K_B = 'KeyBinaBBBBBBBBBBBBB';
const id = (n: number) => `Ev${String(n).padStart(18, '0')}`;

// A valid event two days from now, 4 hours long.
const fields = (over: Partial<EventFields> = {}): EventFields => {
    const startsAt = Math.floor((Date.now() + 2 * DAY) / 60000) * 60000;
    return {
        title: 'Langar seva', category: 'langar', description: 'Help make and serve langar.',
        startsAt, endsAt: startsAt + 4 * HOUR, timeZone: 'America/Los_Angeles',
        venue: 'Gurdwara Sahib', address: '300 Gurdwara Rd', city: 'Fremont', region: 'CA', country: 'US',
        organizer: 'Youth committee', contact: '', spots: 20, ...over,
    };
};
const amar: VolunteerFields = { name: 'Amar', email: '', phone: '' };
const bina: VolunteerFields = { name: 'Bina', email: '', phone: '' };

const post = (uid = 'hana', eventId = E, over: Partial<EventFields> = {}) => commit(as(uid), planCreateEvent(uid, eventId, fields(over), S));
const join = (uid: string, key: string, eventId = E, v: VolunteerFields = amar) => commit(as(uid), planJoin(uid, eventId, key, v, S));
const leave = (uid: string, key: string, eventId = E) => commit(as(uid), planLeave(uid, eventId, key, S));

// The create plan with its event document changed, for refusals.
function postWith(change: (doc: Record<string, unknown>) => void, eventId = E, uid = 'hana', db: Firestore = as(uid)) {
    const ops = planCreateEvent(uid, eventId, fields(), S);
    change((ops[0] as Extract<Op, { type: 'set' }>).data);
    return commit(db, ops);
}

// An event in any state, written around the rules, with hana's note.
async function seedEvent(eventId: string, over: Record<string, unknown> = {}) {
    const f = fields();
    await seed(`seva_events/${eventId}`, {
        v: 1, ...f, startsAt: Timestamp.fromMillis(f.startsAt), endsAt: Timestamp.fromMillis(f.endsAt),
        volunteerCount: 0, status: 'open', cancelNote: '', hidden: false,
        createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...over,
    });
    await seed(`users/hana/seva_hosting/${eventId}`, { createdAt: Timestamp.now() });
}
const past = () => ({ startsAt: Timestamp.fromMillis(Date.now() - 5 * HOUR), endsAt: Timestamp.fromMillis(Date.now() - HOUR) });

// A sign-up written around the rules, as if joined earlier.
async function seedSignup(uid: string, key: string, eventId = E) {
    await seed(`seva_events/${eventId}/volunteers/${key}`, { name: uid, email: '', phone: '', joinedAt: Timestamp.now() });
    await seed(`users/${uid}/seva_signups/${eventId}`, { volunteerId: key, joinedAt: Timestamp.now() });
}

const makeAdmin = (uid = 'olive') => seed(`admins/${uid}`, { role: 'owner' });
const board = (db: Firestore, n = 100) =>
    getDocs(query(collection(db, 'seva_events'), where('hidden', '==', false), where('status', '==', 'open'),
        where('endsAt', '>=', Timestamp.now()), orderBy('endsAt'), limit(n)));

// ─── Posting ────────────────────────────────────────────────────────────────

test('a signed-in visitor posts an event with its private host note, as the app writes it', async () => {
    await assertSucceeds(post());
    const event = await assertSucceeds(getDoc(doc(anon(), `seva_events/${E}`)));
    assert.equal(JSON.stringify(event.data()).includes('hana'), false, 'no account ID in public');
    await assertSucceeds(getDoc(doc(as('hana'), `users/hana/seva_hosting/${E}`)));
    await assertFails(getDoc(doc(as('bob'), `users/hana/seva_hosting/${E}`)));
});

test("an event can't be posted signed out, without its host note, with someone else's note, or under a made-up id", async () => {
    await assertFails(commit(anon(), planCreateEvent('hana', E, fields(), S)));
    const [eventOp, noteOp] = planCreateEvent('hana', E, fields(), S);
    await assertFails(commit(as('hana'), [eventOp]));
    await assertFails(commit(as('hana'), [noteOp]));
    await assertFails(commit(as('hana'), planCreateEvent('bob', E, fields(), S)));
    await assertFails(commit(as('hana'), planCreateEvent('hana', 'free-langar-tickets', fields(), S)));
    await assertFails(commit(as('hana'), planCreateEvent('hana', E.slice(1), fields(), S)));
});

test('no one can claim to host an event that already exists', async () => {
    await assertSucceeds(post());
    await assertFails(setDoc(doc(as('bob'), `users/bob/seva_hosting/${E}`), { createdAt: serverTimestamp() }));
    await assertFails(commit(as('bob'), planUpdateEvent(E, { title: 'Mine now' }, S)));
});

test('each field is held to the limits the form uses, counted as the form counts', async () => {
    let n = 0;
    for (const key of ['title', 'description', 'venue', 'address', 'city', 'region', 'organizer', 'contact'] as const) {
        const [min, max] = SEVA_TEXT[key];
        // Gurmukhi letters: one code point each, three bytes.
        await assertSucceeds(post('hana', id(++n), { [key]: 'ਸ'.repeat(max) }));
        await assertFails(post('hana', id(++n), { [key]: 'ਸ'.repeat(max + 1) }));
        if (min > 0) await assertFails(post('hana', id(++n), { [key]: 'ਸ'.repeat(min - 1) }));
        await assertFails(post('hana', id(++n), { [key]: ` ${'ਸ'.repeat(Math.max(min, 1))}` }));
    }
    await assertSucceeds(post('hana', id(++n), { spots: 1 }));
    await assertSucceeds(post('hana', id(++n), { spots: 500 }));
    // No limit, and no sign-up.
    await assertSucceeds(post('hana', id(++n), { spots: null }));
    await assertSucceeds(post('hana', id(++n), { spots: 0 }));
    for (const spots of [-1, 501, 2.5, Number('five')]) await assertFails(post('hana', id(++n), { spots }));
    await assertFails(postWith((d) => { d.spots = '5'; }, id(++n)));
    // "No limit" is an explicit null, never a missing field.
    await assertFails(postWith((d) => { delete d.spots; }, id(++n)));
    for (const bad of [{ category: 'party' }, { country: 'us' }, { country: 'USA' }, { country: '' }, { timeZone: 'Not a zone!' }]) {
        await assertFails(post('hana', id(++n), bad as Partial<EventFields>));
    }
    await assertFails(postWith((d) => { d.creator = 'hana'; }, id(++n)));
    await assertFails(postWith((d) => { delete d.contact; }, id(++n)));
    await assertFails(postWith((d) => { d.v = 2; }, id(++n)));
});

test('a new event starts open, visible, empty and stamped by the server', async () => {
    let n = 100;
    for (const change of [
        (d: Record<string, unknown>) => { d.volunteerCount = 1; },
        (d: Record<string, unknown>) => { d.spots = null; d.volunteerCount = 1; },
        (d: Record<string, unknown>) => { d.status = 'cancelled'; },
        (d: Record<string, unknown>) => { d.hidden = true; },
        (d: Record<string, unknown>) => { d.cancelNote = 'Already off'; },
        (d: Record<string, unknown>) => { d.createdAt = Timestamp.now(); },
        (d: Record<string, unknown>) => { d.updatedAt = Timestamp.now(); },
    ]) {
        await assertFails(postWith(change, id(++n)));
    }
});

test("it ends after it starts, lasts a week at most, hasn't ended, and starts within a year", async () => {
    const start = fields().startsAt;
    await assertFails(post('hana', id(201), { endsAt: start }));
    await assertFails(post('hana', id(202), { endsAt: start + 7 * DAY + 60000 }));
    await assertSucceeds(post('hana', id(203), { endsAt: start + 7 * DAY }));
    await assertFails(post('hana', id(204), { startsAt: Date.now() - 3 * HOUR, endsAt: Date.now() - HOUR }));
    await assertSucceeds(post('hana', id(205), { startsAt: Date.now() - HOUR, endsAt: Date.now() + HOUR })); // under way
    await assertFails(post('hana', id(206), { startsAt: Date.now() + 367 * DAY, endsAt: Date.now() + 367 * DAY + HOUR }));
});

// ─── Reading ────────────────────────────────────────────────────────────────

test("anyone can list visible events with the board's query, a page at a time", async () => {
    await assertSucceeds(post());
    const page = await assertSucceeds(board(anon()));
    assert.equal(page.size, 1);
    await assertFails(board(anon(), 101));
    await assertFails(getDocs(query(collection(anon(), 'seva_events'), where('hidden', '==', false))));
    await assertFails(getDocs(query(collection(anon(), 'seva_events'), where('status', '==', 'open'), limit(10))));
    await assertFails(getDocs(collection(anon(), 'seva_events')));
});

test('a hidden event is refused to visitors and readable by its host and admins; a missing one reads as missing', async () => {
    await makeAdmin();
    await seedEvent(E, { hidden: true });
    await assertFails(getDoc(doc(anon(), `seva_events/${E}`)));
    await assertFails(getDoc(doc(as('bob'), `seva_events/${E}`)));
    await assertSucceeds(getDoc(doc(as('hana'), `seva_events/${E}`)));
    await assertSucceeds(getDoc(doc(as('olive'), `seva_events/${E}`)));
    const missing = await assertSucceeds(getDoc(doc(anon(), `seva_events/${id(1)}`)));
    assert.equal(missing.exists(), false);
    assert.equal((await board(anon())).size, 0);
});

test("events from before these rules stay off the board, can't be joined or changed, and only admins read them", async () => {
    await makeAdmin();
    await seed(`seva_events/${E}`, { title: 'Old langar', location: 'Gurdwara', date: 'Sat 10 am', needed: 5, attendees: [], category: 'Langar', createdAt: Timestamp.now() });
    await seed(`seva_events/${id(1)}`, { title: 'Older', location: 'Gurdwara', date: 'Sun', needed: 5, volunteers: 0, color: 'bg-orange-100', category: 'Langar', createdAt: Timestamp.now() });
    assert.equal((await board(anon())).size, 0);
    await assertFails(getDoc(doc(anon(), `seva_events/${E}`)));
    await assertSucceeds(getDoc(doc(as('olive'), `seva_events/${E}`)));
    await assertFails(updateDoc(doc(as('amar'), `seva_events/${E}`), { attendees: arrayUnion('amar') }));
    await assertFails(addDoc(collection(as('amar'), 'seva_events'), { title: 'x', location: 'y', date: 'z', needed: 2, attendees: [], category: 'Langar', createdAt: Timestamp.now() }));
});

// ─── Hosting ────────────────────────────────────────────────────────────────

test('the host edits what the form edits, and the change is stamped', async () => {
    await assertSucceeds(post());
    const ops = planUpdateEvent(E, { title: 'Langar prep', spots: 25, startsAt: fields().startsAt + HOUR }, S);
    await assertFails(commit(as('bob'), ops));
    await assertFails(commit(anon(), ops));
    await assertSucceeds(commit(as('hana'), ops));
    assert.equal((await peek(`seva_events/${E}`))?.title, 'Langar prep');
});

test("the host can't touch the count, the moderators' flag, the creation time or the version", async () => {
    await assertSucceeds(post());
    const ref = doc(as('hana'), `seva_events/${E}`);
    await assertFails(updateDoc(ref, { volunteerCount: 5, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { hidden: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { v: 2, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { title: 'Unstamped' }));
    await assertFails(updateDoc(ref, { title: 'Client clock', updatedAt: Timestamp.now() }));
});

test("spots can't drop below those signed up", async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    await assertSucceeds(join('bina', K_B, E, bina));
    await assertFails(commit(as('hana'), planUpdateEvent(E, { spots: 1 }, S)));
    await assertSucceeds(commit(as('hana'), planUpdateEvent(E, { spots: 2 }, S)));
});

test('the host chooses who may sign up, but not "no one" once someone has', async () => {
    await assertSucceeds(post('hana', E, { spots: null }));
    const setSpots = (spots: number | null) => commit(as('hana'), planUpdateEvent(E, { spots }, S));
    await assertSucceeds(setSpots(0));
    await assertFails(join('amar', K_A));
    // Cancelling and reopening check the whole event again.
    await assertSucceeds(commit(as('hana'), planSetStatus(E, 'cancelled', '', S)));
    await assertSucceeds(commit(as('hana'), planSetStatus(E, 'open', '', S)));
    await assertSucceeds(setSpots(null));
    await assertSucceeds(join('amar', K_A));
    await assertFails(setSpots(0)); // someone has joined
    await assertSucceeds(setSpots(1)); // a limit at the count stops new sign-ups
    await assertSucceeds(setSpots(null)); // lifted again, with a volunteer
    await assertSucceeds(join('bina', K_B, E, bina));
    await assertFails(setSpots(1));
    await assertSucceeds(setSpots(2));
    for (const spots of [-1, 501]) await assertFails(setSpots(spots));
    const ref = doc(as('hana'), `seva_events/${E}`);
    await assertFails(updateDoc(ref, { spots: deleteField(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { spots: '5', updatedAt: serverTimestamp() }));
    await assertSucceeds(leave('amar', K_A));
    await assertSucceeds(leave('bina', K_B));
    await assertSucceeds(setSpots(0)); // everyone has left
});

test('switching to no sign-up while someone joins: never both', async () => {
    await assertSucceeds(post('hana', E, { spots: null }));
    // Firestore commits each batch whole, against the latest count.
    const results = await Promise.allSettled([commit(as('hana'), planUpdateEvent(E, { spots: 0 }, S)), join('amar', K_A)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const after = await peek(`seva_events/${E}`);
    assert.equal(after?.volunteerCount, after?.spots === 0 ? 0 : 1);
});

test('a past event can be corrected but not moved into the past', async () => {
    await seedEvent(E, past());
    await assertSucceeds(commit(as('hana'), planUpdateEvent(E, { description: 'Thank you, everyone' }, S)));
    await assertFails(commit(as('hana'), planUpdateEvent(E, { startsAt: Date.now() - 4 * HOUR, endsAt: Date.now() - 2 * HOUR }, S)));
    await assertSucceeds(commit(as('hana'), planUpdateEvent(E, { startsAt: Date.now() + DAY, endsAt: Date.now() + DAY + HOUR }, S)));
});

test('the host cancels and reopens; a cancelled event takes no sign-ups but can be left', async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    await assertFails(commit(as('amar'), planSetStatus(E, 'cancelled', '', S)));
    await assertSucceeds(commit(as('hana'), planSetStatus(E, 'cancelled', 'Moved to next Sunday', S)));
    assert.equal((await peek(`seva_events/${E}`))?.cancelNote, 'Moved to next Sunday');
    await assertFails(join('bina', K_B, E, bina));
    await assertSucceeds(leave('amar', K_A));
    await assertSucceeds(commit(as('hana'), planSetStatus(E, 'open', '', S)));
    await assertSucceeds(join('bina', K_B, E, bina));
});

test("only an event's host deletes it, once it's cancelled or over, and their note goes with it", async () => {
    await makeAdmin();
    await assertSucceeds(post());
    // Open and still to come: no one, not even its host.
    for (const uid of ['hana', 'olive', 'bob']) await assertFails(commit(as(uid), planDeleteEvent(uid, E)));
    await assertFails(deleteDoc(doc(as('hana'), `seva_events/${E}`)));
    await assertSucceeds(commit(as('hana'), planSetStatus(E, 'cancelled', '', S)));
    for (const uid of ['olive', 'bob']) await assertFails(commit(as(uid), planDeleteEvent(uid, E)));
    // The host's note can't go while the event stays.
    await assertFails(commit(as('hana'), [planDeleteEvent('hana', E)[1]]));
    await assertSucceeds(commit(as('hana'), planDeleteEvent('hana', E)));
    assert.equal(await peek(`seva_events/${E}`), null);
    assert.equal(await peek(`users/hana/seva_hosting/${E}`), null);
    // Over, or hidden and cancelled, or already gone: the same.
    let n = 0;
    for (const state of [past(), { status: 'cancelled', hidden: true }]) {
        const eventId = id(++n);
        await seedEvent(eventId, state);
        await assertSucceeds(commit(as('hana'), planDeleteEvent('hana', eventId)));
    }
    const gone = id(++n);
    await seedEvent(gone);
    await wipe(`seva_events/${gone}`);
    await assertSucceeds(commit(as('hana'), planDeleteEvent('hana', gone)));
    assert.equal(await peek(`users/hana/seva_hosting/${gone}`), null);
});

test('the host clears the sign-ups once the event is cancelled, over or gone, in the batches the app sends', async () => {
    await assertSucceeds(post());
    const people = Array.from({ length: SEVA_HOST_CLEAR_BATCH + 2 }, (_, i) => ({ uid: `vol${i}`, key: `Key${String(i).padStart(17, '0')}` }));
    for (const { uid, key } of people) await assertSucceeds(join(uid, key));
    const batches = planClearSignups(E, people.map((p) => p.key));
    // Not while it's open and to come, and never by anyone else.
    await assertFails(commit(as('hana'), batches[0]));
    await assertSucceeds(commit(as('hana'), planSetStatus(E, 'cancelled', '', S)));
    await assertFails(commit(as('bob'), batches[0]));
    await assertFails(commit(as('vol1'), [batches[0][0]])); // vol0's
    for (const batch of batches) await assertSucceeds(commit(as('hana'), batch));
    assert.equal((await getDocs(collection(as('hana'), `seva_events/${E}/volunteers`))).size, 0);
    await assertSucceeds(commit(as('hana'), planDeleteEvent('hana', E)));

    // Over, or already gone (the console leaves what's below an event): the same.
    let n = 0;
    for (const over of [true, false]) {
        const eventId = id(++n);
        await seedEvent(eventId, over ? past() : {});
        await seedSignup('amar', K_A, eventId);
        if (!over) await wipe(`seva_events/${eventId}`);
        await assertSucceeds(commit(as('hana'), planClearSignups(eventId, [K_A])[0]));
    }
});

test("a volunteer whose sign-up the host cleared drops their note; one still there can't be dropped alone", async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    await assertFails(commit(as('amar'), planDropNote('amar', E)));
    await assertSucceeds(commit(as('hana'), planSetStatus(E, 'cancelled', '', S)));
    await assertSucceeds(commit(as('hana'), planClearSignups(E, [K_A])[0]));
    // Leaving has no sign-up left to take back, and the event is still there.
    await assertFails(leave('amar', K_A));
    await assertFails(commit(as('amar'), planForget('amar', E, K_A)));
    await assertSucceeds(commit(as('amar'), planDropNote('amar', E)));
});

test('once its host has wound an event down, nothing is left under its id for whoever posts there next', async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    await assertSucceeds(commit(as('hana'), planSetStatus(E, 'cancelled', '', S)));
    for (const batch of planClearSignups(E, [K_A])) await assertSucceeds(commit(as('hana'), batch));
    await assertSucceeds(commit(as('hana'), planDeleteEvent('hana', E)));
    // Its id is public, so anyone may post under it now, and list what's there.
    await assertSucceeds(post('bob', E));
    assert.equal((await getDocs(collection(as('bob'), `seva_events/${E}/volunteers`))).size, 0);
    await assertSucceeds(commit(as('amar'), planDropNote('amar', E)));
});

// ─── Joining ────────────────────────────────────────────────────────────────

test("joining writes a new sign-up, the volunteer's note and one more on the count, together", async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A, E, { name: 'Amar', email: 'amar@example.com', phone: '+1 510 555 0100' }));
    assert.equal((await peek(`seva_events/${E}`))?.volunteerCount, 1);
    await assertSucceeds(getDoc(doc(as('amar'), `users/amar/seva_signups/${E}`)));
    const mine = await assertSucceeds(getDoc(doc(as('amar'), `seva_events/${E}/volunteers/${K_A}`)));
    assert.deepEqual(Object.keys(mine.data() ?? {}).sort(), ['email', 'joinedAt', 'name', 'phone']);
});

test('one sign-up per account per event', async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    await assertFails(join('amar', 'KeyAmar2AAAAAAAAAAAA'));
    await assertFails(join('amar', K_A));
    assert.equal((await peek(`seva_events/${E}`))?.volunteerCount, 1);
});

test("a sign-up's pieces can't be written apart or bent", async () => {
    await assertSucceeds(post());
    const [vol, note, count] = planJoin('amar', E, K_A, amar, S);
    const db = as('amar');
    for (const ops of [[vol], [note], [count], [vol, count], [vol, note]]) await assertFails(commit(db, ops));
    await assertFails(commit(db, [vol, note, { type: 'update', path: ['seva_events', E], data: { volunteerCount: increment(2) } }]));
    // The note points at another key than the sign-up written.
    await assertFails(commit(db, [vol, { ...note, data: { volunteerId: K_B, joinedAt: serverTimestamp() } } as Op, count]));
    await assertFails(commit(db, planJoin('amar', E, 'short', amar, S)));
    const bent = (data: Record<string, unknown>) => commit(db, [{ ...vol, data: { name: 'Amar', email: '', phone: '', joinedAt: serverTimestamp(), ...data } } as Op, note, count]);
    for (const data of [
        { joinedAt: Timestamp.now() }, { name: '' }, { name: ' Amar' }, { name: 'x'.repeat(81) },
        { phone: '1'.repeat(41) }, { email: 'someone.else@example.com' }, { uid: 'amar' },
    ]) {
        await assertFails(bent(data));
    }
    await assertSucceeds(bent({ email: 'amar@example.com' }));
});

test("no one can point their note at someone else's sign-up", async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    const db = as('bina');
    await assertFails(commit(db, [
        { type: 'set', path: ['users', 'bina', 'seva_signups', E], data: { volunteerId: K_A, joinedAt: serverTimestamp() } },
        { type: 'update', path: ['seva_events', E], data: { volunteerCount: increment(1) } },
    ]));
    await assertFails(join('bina', K_A, E, bina));
    await assertFails(getDoc(doc(db, `seva_events/${E}/volunteers/${K_A}`)));
});

test('joining stops when the event is full, takes no sign-ups, is cancelled, hidden or over', async () => {
    await seedEvent(id(1), { spots: 1, volunteerCount: 1 });
    await seedEvent(id(2), { status: 'cancelled' });
    await seedEvent(id(3), { hidden: true });
    await seedEvent(id(4), past());
    await seedEvent(id(5), { startsAt: Timestamp.fromMillis(Date.now() - HOUR), endsAt: Timestamp.fromMillis(Date.now() + HOUR) });
    await seedEvent(id(6), { spots: 0 });
    for (const n of [1, 2, 3, 4, 6]) await assertFails(join('amar', K_A, id(n)));
    await assertSucceeds(join('amar', K_A, id(5))); // under way
});

test('with no limit, anyone can join, past 500 too, and leave', async () => {
    await seedEvent(E, { spots: null, volunteerCount: 500 });
    await assertSucceeds(join('amar', K_A));
    assert.equal((await peek(`seva_events/${E}`))?.volunteerCount, 501);
    await assertSucceeds(leave('amar', K_A));
    assert.equal((await peek(`seva_events/${E}`))?.volunteerCount, 500);
});

test('two people racing for the last spot: only one gets it', async () => {
    await assertSucceeds(post('hana', E, { spots: 1 }));
    // Firestore commits each batch whole, against the latest count.
    const results = await Promise.allSettled([join('amar', K_A), join('bina', K_B, E, bina)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal((await peek(`seva_events/${E}`))?.volunteerCount, 1);
});

test('the host may join their own event', async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('hana', K_A, E, { name: 'Hana', email: '', phone: '' }));
});

// ─── Leaving ────────────────────────────────────────────────────────────────

test('leaving removes the sign-up and its note and gives the spot back, together', async () => {
    await assertSucceeds(post('hana', E, { spots: 1 }));
    await assertSucceeds(join('amar', K_A));
    await assertSucceeds(leave('amar', K_A));
    assert.equal((await peek(`seva_events/${E}`))?.volunteerCount, 0);
    assert.equal(await peek(`seva_events/${E}/volunteers/${K_A}`), null);
    assert.equal(await peek(`users/amar/seva_signups/${E}`), null);
    await assertSucceeds(join('bina', K_B, E, bina));
});

test("leaving can't be half done, or done for someone else", async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    const [vol, note, count] = planLeave('amar', E, K_A, S);
    for (const ops of [[vol], [note], [count], [vol, note]]) await assertFails(commit(as('amar'), ops));
    await assertFails(commit(as('bina'), planLeave('bina', E, K_A, S)));
    await assertFails(commit(as('bina'), [count]));
    assert.equal((await peek(`seva_events/${E}`))?.volunteerCount, 1);
});

test('you can leave a cancelled, hidden or finished event', async () => {
    let n = 0;
    for (const state of [{ status: 'cancelled' }, { hidden: true }, past()]) {
        const eventId = id(++n);
        await seedEvent(eventId, { ...state, volunteerCount: 1 });
        await seedSignup('amar', K_A, eventId);
        await assertSucceeds(leave('amar', K_A, eventId));
    }
});

test("a sign-up for an event that's gone can be cleared, and so can its host's note", async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    // The app doesn't clear a host's note itself; its owner may, once the
    // event is gone, as with any of their own data.
    const forgetHosted: Op[] = [{ type: 'delete', path: hostingPath('hana', E) }];
    await assertFails(commit(as('hana'), forgetHosted)); // not while the event exists
    await wipe(`seva_events/${E}`); // as the console would, leaving what's below it
    await assertFails(leave('amar', K_A));
    await assertSucceeds(commit(as('amar'), planForget('amar', E, K_A)));
    await assertSucceeds(commit(as('hana'), forgetHosted));
});

test('a volunteer can change their name or stop sharing their contact, and nothing else', async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A, E, { name: 'Amar', email: 'amar@example.com', phone: '' }));
    await assertSucceeds(commit(as('amar'), planUpdateSignup(E, K_A, { name: 'Amar K.', email: '', phone: '' })));
    const ref = (db: Firestore) => doc(db, `seva_events/${E}/volunteers/${K_A}`);
    await assertFails(updateDoc(ref(as('amar')), { joinedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(as('amar')), { note: 'hi' }));
    await assertFails(commit(as('bina'), planUpdateSignup(E, K_A, { name: 'Not Amar', email: '', phone: '' })));
});

// ─── Who sees what ──────────────────────────────────────────────────────────

test('only the host lists the sign-ups; a volunteer reads only their own', async () => {
    await makeAdmin();
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    await assertSucceeds(join('bina', K_B, E, bina));
    const list = (db: Firestore) => getDocs(collection(db, `seva_events/${E}/volunteers`));
    assert.equal((await assertSucceeds(list(as('hana')))).size, 2);
    await assertSucceeds(getDoc(doc(as('hana'), `seva_events/${E}/volunteers/${K_A}`)));
    for (const db of [as('amar'), anon(), as('olive')]) await assertFails(list(db));
    await assertFails(getDoc(doc(as('amar'), `seva_events/${E}/volunteers/${K_B}`)));
    await assertFails(getDoc(doc(as('olive'), `seva_events/${E}/volunteers/${K_A}`)));
});

test("private notes are their owner's alone", async () => {
    await assertSucceeds(post());
    await assertSucceeds(join('amar', K_A));
    await assertFails(getDoc(doc(as('bina'), `users/amar/seva_signups/${E}`)));
    await assertFails(getDocs(collection(as('bina'), 'users/amar/seva_signups')));
    await assertSucceeds(getDocs(collection(as('amar'), 'users/amar/seva_signups')));
    await assertFails(getDoc(doc(as('bina'), `users/hana/seva_hosting/${E}`)));
    await assertFails(updateDoc(doc(as('amar'), `users/amar/seva_signups/${E}`), { volunteerId: K_B }));
});

// ─── Moderation ─────────────────────────────────────────────────────────────

test('an admin hides and unhides an event, and changes nothing else', async () => {
    await makeAdmin();
    await assertSucceeds(post());
    await assertFails(commit(as('hana'), planSetHidden(E, true)));
    await assertFails(commit(as('bob'), planSetHidden(E, true)));
    await assertFails(updateDoc(doc(as('olive'), `seva_events/${E}`), { title: 'Moderated' }));
    await assertFails(updateDoc(doc(as('olive'), `seva_events/${E}`), { hidden: true, title: 'Moderated' }));
    await assertSucceeds(commit(as('olive'), planSetHidden(E, true)));
    assert.equal((await board(anon())).size, 0);
    await assertSucceeds(commit(as('olive'), planSetHidden(E, false)));
    assert.equal((await board(anon())).size, 1);
});

test("only you can see whether you're an admin", async () => {
    await makeAdmin();
    const own = await assertSucceeds(getDoc(doc(as('amar'), 'admins/amar')));
    assert.equal(own.exists(), false);
    await assertSucceeds(getDoc(doc(as('olive'), 'admins/olive')));
    await assertFails(getDoc(doc(as('amar'), 'admins/olive')));
    await assertFails(getDocs(collection(as('olive'), 'admins')));
    await assertFails(setDoc(doc(as('amar'), 'admins/amar'), { role: 'owner' }));
});

test('a signed-in visitor reports an event once; only admins read reports', async () => {
    await makeAdmin();
    await assertSucceeds(post());
    await seedEvent(id(1), { hidden: true });
    const report = (uid: string, eventId = E, r: ReportFields = { reason: 'spam', note: '' }) => commit(as(uid), planReport(uid, eventId, r, S));
    await assertSucceeds(report('bina'));
    await assertFails(report('bina')); // once
    await assertFails(commit(anon(), planReport('bina', E, { reason: 'spam', note: '' }, S)));
    await assertFails(report('bob', E, { reason: 'meh' as ReportFields['reason'], note: '' }));
    await assertFails(report('bob', E, { reason: 'other', note: 'x'.repeat(501) }));
    await assertFails(commit(as('bob'), planReport('amar', E, { reason: 'spam', note: '' }, S))); // under someone else's name
    await assertFails(setDoc(doc(as('bob'), `seva_reports/${reportId(E, 'bob')}`), { eventId: id(2), reason: 'spam', note: '', createdAt: serverTimestamp() }));
    await assertFails(report('bob', id(1))); // a hidden event
    await assertFails(report('bob', id(9))); // a missing one
    await assertFails(setDoc(doc(as('bob'), `seva_reports/${reportId(E, 'bob')}`), { eventId: E, reason: 'spam', note: '', createdAt: Timestamp.now() }));
    await assertSucceeds(getDoc(doc(as('bina'), `seva_reports/${reportId(E, 'bina')}`)));
    const none = await assertSucceeds(getDoc(doc(as('bob'), `seva_reports/${reportId(E, 'bob')}`)));
    assert.equal(none.exists(), false);
    await assertFails(getDoc(doc(as('bob'), `seva_reports/${reportId(E, 'bina')}`)));
    await assertFails(getDocs(collection(as('bina'), 'seva_reports')));
    assert.equal((await assertSucceeds(getDocs(collection(as('olive'), 'seva_reports')))).size, 1);
});

test('an admin dismisses a pile of reports in the batches the app sends', async () => {
    await makeAdmin();
    const ids = Array.from({ length: 25 }, (_, i) => reportId(E, `user${i}`));
    for (const rid of ids) await seed(`seva_reports/${rid}`, { eventId: E, reason: 'spam', note: '', createdAt: Timestamp.now() });
    await assertFails(deleteDoc(doc(as('bob'), `seva_reports/${ids[0]}`)));
    for (const batch of planDismissReports(ids)) await assertSucceeds(commit(as('olive'), batch));
    assert.equal((await getDocs(collection(as('olive'), 'seva_reports'))).size, 0);
});

// ─── The form and the rules agree ───────────────────────────────────────────

test('every event the form accepts, the rules accept', async () => {
    const tz = 'Asia/Kolkata';
    const inTwoDays = utcToZoned(Date.now() + 2 * DAY, tz).date;
    const base: EventDraft = {
        title: 'Langar seva', category: 'langar', description: '', date: inTwoDays, startTime: '18:00', endTime: '21:00',
        multiDay: false, endDate: '', timeZone: tz, venue: 'Gurdwara', address: '', city: 'Amritsar', region: '',
        country: 'IN', signup: 'limited', spots: '1', organizer: 'Sangat', contact: '',
    };
    let n = 300;
    for (const over of [
        {},
        { title: 'ਸੇਵਾ'.repeat(25), venue: 'ਗੁ'.repeat(60), organizer: 'ਸ'.repeat(80), city: 'ਅ'.repeat(80) },
        { description: 'ਲੰਗਰ '.repeat(400).trim(), contact: '+91 98765 43210', spots: '500' },
        { multiDay: true, endDate: utcToZoned(Date.now() + 9 * DAY, tz).date, endTime: '18:00' },
        { spots: '੨੦', region: 'Punjab', address: 'Golden Temple Rd' },
        { signup: 'unlimited', spots: '' },
        { signup: 'none', spots: '' },
        // A number typed, then another choice made: not sent.
        { signup: 'unlimited', spots: '7' },
        { signup: 'none', spots: 'lots' },
    ] satisfies Partial<EventDraft>[]) {
        const r = validateEventDraft({ ...base, ...over }, { now: Date.now() });
        assert.ok(r.ok, JSON.stringify(r.ok ? null : r.errors));
        await assertSucceeds(commit(as('hana'), planCreateEvent('hana', id(++n), r.fields, S)));
    }
    // And an edit the form allows.
    const r = validateEventDraft({ ...base, title: 'Langar prep' }, { now: Date.now() });
    assert.ok(r.ok);
    const before = await peek(`seva_events/${id(301)}`);
    assert.ok(before);
    const patch = eventPatch({ ...r.fields, title: 'Langar seva', id: id(301), status: 'open', cancelNote: '', hidden: false, volunteerCount: 0, createdAt: 0, updatedAt: 0 }, r.fields);
    await assertSucceeds(commit(as('hana'), planUpdateEvent(id(301), patch, S)));
    // And each change of who may sign up, while no one has joined.
    let stored = r.fields;
    for (const over of [{ signup: 'unlimited' }, { signup: 'none' }, { signup: 'limited', spots: '5' }, { signup: 'none' }] satisfies Partial<EventDraft>[]) {
        const next = validateEventDraft({ ...base, title: 'Langar prep', ...over }, { now: Date.now(), editing: { startsAt: stored.startsAt, endsAt: stored.endsAt, volunteerCount: 0 } });
        assert.ok(next.ok, JSON.stringify(over));
        const step = eventPatch({ ...stored, id: id(301), status: 'open', cancelNote: '', hidden: false, volunteerCount: 0, createdAt: 0, updatedAt: 0 }, next.fields);
        await assertSucceeds(commit(as('hana'), planUpdateEvent(id(301), step, S)));
        stored = next.fields;
    }
    assert.equal((await peek(`seva_events/${id(301)}`))?.spots, 0);
});
