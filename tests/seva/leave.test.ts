import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DocPath, Op } from '@/lib/firebase/ops';
import { leaveEvent, type LeaveIO } from '@/lib/seva/leave';
import { ID, KEY } from './helpers';

const S = { now: 'NOW', inc: (n: number) => ({ inc: n }) };
const fail = (code: string) => Object.assign(new Error(code), { code });

// Firestore as leaving sees it: each batch answered in turn, and the
// documents that exist.
function io(answers: (Error | null)[], docs: Record<string, Record<string, unknown> | Error>) {
    const batches: string[] = [];
    const reads: string[] = [];
    const fake: LeaveIO = {
        async commit(ops: Op[]) {
            batches.push(ops.map((op) => `${op.type} ${op.path.join('/')}`).join(', '));
            const answer = answers.shift();
            if (answer) throw answer;
        },
        async get(path: DocPath) {
            const key = path.join('/');
            reads.push(key);
            const doc = docs[key];
            if (doc instanceof Error) throw doc;
            return doc ?? null;
        },
    };
    return { fake, batches, reads };
}

const event = `seva_events/${ID}`;
const volunteer = `seva_events/${ID}/volunteers/${KEY}`;

test('leaving takes back the sign-up, the note and one on the count, in one batch', async () => {
    const { fake, batches, reads } = io([null], {});
    await leaveEvent(fake, 'amar', ID, KEY, S);
    assert.deepEqual(batches, [`delete ${volunteer}, delete users/amar/seva_signups/${ID}, update ${event}`]);
    assert.deepEqual(reads, []);
});

test("a sign-up its host has cleared leaves only the note, whether or not the event's still there", async () => {
    const states: Record<string, Record<string, unknown>>[] = [{ [event]: { status: 'cancelled' } }, {}];
    for (const docs of states) {
        const { fake, batches } = io([fail('permission-denied'), null], docs);
        await leaveEvent(fake, 'amar', ID, KEY, S);
        assert.equal(batches[1], `delete users/amar/seva_signups/${ID}`);
    }
});

test("a sign-up whose event is gone goes with the note, and one that's refused for another reason says so", async () => {
    const gone = io([fail('not-found'), null], { [volunteer]: { name: 'Amar' } });
    await leaveEvent(gone.fake, 'amar', ID, KEY, S);
    assert.equal(gone.batches[1], `delete ${volunteer}, delete users/amar/seva_signups/${ID}`);

    const refused = io([fail('permission-denied')], { [volunteer]: { name: 'Amar' }, [event]: { status: 'open' } });
    await assert.rejects(leaveEvent(refused.fake, 'amar', ID, KEY, S), { code: 'permission-denied' });
    assert.equal(refused.batches.length, 1);
});

test("a dropped connection isn't taken for a sign-up that's gone, and what can't be read reads as missing", async () => {
    const offline = io([fail('unavailable')], {});
    await assert.rejects(leaveEvent(offline.fake, 'amar', ID, KEY, S), { code: 'unavailable' });
    assert.deepEqual(offline.reads, []);

    // The note was already gone (left on another device): the sign-up can't
    // be read, so only the note's removal is tried, and refused.
    const denied = io([fail('permission-denied'), fail('permission-denied')], { [volunteer]: fail('permission-denied') });
    await assert.rejects(leaveEvent(denied.fake, 'amar', ID, KEY, S), { code: 'permission-denied' });
    assert.equal(denied.batches[1], `delete users/amar/seva_signups/${ID}`);
});
