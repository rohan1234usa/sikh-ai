import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Op } from '@/lib/firebase/ops';
import {
    eventPatch,
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
import { ID, KEY, event, fields } from './helpers';

const S = { now: 'NOW', inc: (n: number) => ({ inc: n }) };
const at = (op: Op) => `${op.type} ${op.path.join('/')}`;
const dataOf = (op: Op) => (op.type === 'delete' ? {} : op.data);

function noUndefined(v: unknown, path = 'op') {
    assert.notEqual(v, undefined, `${path} is undefined — Firestore rejects it`);
    if (v && typeof v === 'object' && !(v instanceof Date)) for (const [k, x] of Object.entries(v)) noUndefined(x, `${path}.${k}`);
}

test('posting writes the whole event, open, visible and empty, with its host note, stamped by the server', () => {
    const ops = planCreateEvent('hana', ID, fields(), S);
    assert.deepEqual(ops.map(at), [`set seva_events/${ID}`, `set users/hana/seva_hosting/${ID}`]);
    const doc = dataOf(ops[0]);
    assert.equal(doc.v, 1);
    assert.deepEqual([doc.volunteerCount, doc.status, doc.cancelNote, doc.hidden, doc.createdAt, doc.updatedAt], [0, 'open', '', false, 'NOW', 'NOW']);
    assert.ok(doc.startsAt instanceof Date && doc.endsAt instanceof Date, 'times are written as timestamps');
    assert.equal((doc.startsAt as Date).getTime(), fields().startsAt);
    assert.equal(JSON.stringify(doc).includes('hana'), false, 'no account ID in the public document');
    assert.deepEqual(dataOf(ops[1]), { createdAt: 'NOW' });
    noUndefined(ops);
});

test('an edit writes only what changed, stamped; no change writes nothing', () => {
    const before = event();
    const patch = eventPatch(before, { ...fields(), title: 'Langar prep', startsAt: before.startsAt + 3600e3 });
    assert.deepEqual(Object.keys(patch).sort(), ['startsAt', 'title']);
    const [op] = planUpdateEvent(ID, patch, S);
    assert.equal(at(op), `update seva_events/${ID}`);
    assert.ok(dataOf(op).startsAt instanceof Date);
    assert.equal(dataOf(op).updatedAt, 'NOW');
    assert.deepEqual(planUpdateEvent(ID, eventPatch(before, fields()), S), []);
});

test('cancelling carries the note; reopening clears it', () => {
    assert.deepEqual(dataOf(planSetStatus(ID, 'cancelled', 'Moved to Sunday', S)[0]), { status: 'cancelled', cancelNote: 'Moved to Sunday', updatedAt: 'NOW' });
    assert.deepEqual(dataOf(planSetStatus(ID, 'open', 'left over', S)[0]), { status: 'open', cancelNote: '', updatedAt: 'NOW' });
});

test('joining is a sign-up, the volunteer\'s note of it and one more on the count, in one batch', () => {
    const ops = planJoin('amar', ID, KEY, { name: 'Amar', email: '', phone: '+1 555 0100' }, S);
    assert.deepEqual(ops.map(at), [
        `set seva_events/${ID}/volunteers/${KEY}`,
        `set users/amar/seva_signups/${ID}`,
        `update seva_events/${ID}`,
    ]);
    assert.deepEqual(dataOf(ops[0]), { name: 'Amar', email: '', phone: '+1 555 0100', joinedAt: 'NOW' });
    assert.deepEqual(dataOf(ops[1]), { volunteerId: KEY, joinedAt: 'NOW' });
    assert.deepEqual(dataOf(ops[2]), { volunteerCount: { inc: 1 } });
    assert.equal(JSON.stringify(dataOf(ops[0])).includes('amar'), false, 'the host never sees the account ID');
    noUndefined(ops);
});

test('leaving takes all three back; for an event that is gone, only the two left', () => {
    assert.deepEqual(planLeave('amar', ID, KEY, S).map(at), [
        `delete seva_events/${ID}/volunteers/${KEY}`,
        `delete users/amar/seva_signups/${ID}`,
        `update seva_events/${ID}`,
    ]);
    assert.deepEqual(dataOf(planLeave('amar', ID, KEY, S)[2]), { volunteerCount: { inc: -1 } });
    assert.deepEqual(planForget('amar', ID, KEY).map(at), [`delete seva_events/${ID}/volunteers/${KEY}`, `delete users/amar/seva_signups/${ID}`]);
    assert.deepEqual(dataOf(planUpdateSignup(ID, KEY, { name: 'A.', email: '', phone: '' })[0]), { name: 'A.', email: '', phone: '' });
});

test("a host winds an event down: its sign-ups a few at a time, then the event with their note of it", () => {
    const keys = Array.from({ length: 12 }, (_, i) => `Key${String(i).padStart(17, '0')}`);
    const batches = planClearSignups(ID, keys);
    assert.deepEqual(batches.map((b) => b.length), [5, 5, 2]);
    assert.deepEqual(batches.flat().map(at), keys.map((k) => `delete seva_events/${ID}/volunteers/${k}`));
    assert.deepEqual(planClearSignups(ID, []), []);
    assert.deepEqual(planDeleteEvent('hana', ID).map(at), [`delete seva_events/${ID}`, `delete users/hana/seva_hosting/${ID}`]);
    // A volunteer whose sign-up the host cleared has only their note left.
    assert.deepEqual(planDropNote('amar', ID).map(at), [`delete users/amar/seva_signups/${ID}`]);
});

test('a report is one per account per event; moderators change only whether it shows', () => {
    const [report] = planReport('bob', ID, { reason: 'spam', note: '' }, S);
    assert.equal(at(report), `set seva_reports/${ID}_bob`);
    assert.deepEqual(dataOf(report), { eventId: ID, reason: 'spam', note: '', createdAt: 'NOW' });
    assert.deepEqual(planSetHidden(ID, true).map((op) => [at(op), dataOf(op)]), [[`update seva_events/${ID}`, { hidden: true }]]);
    const ids = Array.from({ length: 25 }, (_, i) => reportId(ID, `u${i}`));
    assert.deepEqual(planDismissReports(ids).map((b) => b.length), [10, 10, 5]);
});
