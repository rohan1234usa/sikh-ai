// Deleting an account (lib/account/deletion.ts), on the emulator, under the
// real rules: an account made the way the app makes one, through its own
// plans, is taken apart by the code the browser runs. See ./env.ts.
//
// The people: alice deletes her account; hana hosts an event alice joined
// and reported; bob and carol volunteer at alice's events; olive is an admin.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp, increment, serverTimestamp } from 'firebase/firestore';
import { deleteAccountData, type AccountIO } from '@/lib/account/deletion';
import { planCreate, planDelete, planImport, planShare } from '@/lib/chat/store/firestorePlans';
import { SHARE_VERSION } from '@/lib/chat/share';
import type { EventFields, VolunteerFields } from '@/lib/seva/model';
import { planCreateEvent, planDropNote, planJoin, planReport, planSetHidden, planSetStatus } from '@/lib/seva/plans';
import { exchange } from '../chat/helpers';
import { meta } from '../chat/store-helpers';
import { accountIO, commit, rulesEnv } from './env';

const { as, seed, peek, wipe, ids } = rulesEnv();

const S = { now: serverTimestamp(), inc: increment };
const HOUR = 3600e3;
const DAY = 24 * HOUR;
const sid = (name: string) => name.padEnd(20, '0');

const fields = (): EventFields => {
    const startsAt = Math.floor((Date.now() + 2 * DAY) / 60000) * 60000;
    return {
        title: 'Langar seva', category: 'langar', description: 'Help make and serve langar.',
        startsAt, endsAt: startsAt + 4 * HOUR, timeZone: 'America/Los_Angeles',
        venue: 'Gurdwara Sahib', address: '300 Gurdwara Rd', city: 'Fremont', region: 'CA', country: 'US',
        organizer: 'Youth committee', contact: '', spots: 20,
    };
};
const volunteer = (name: string): VolunteerFields => ({ name, email: '', phone: '' });

const post = (uid: string, eventId: string) => commit(as(uid), planCreateEvent(uid, eventId, fields(), S));
const join = (uid: string, eventId: string, key: string) => commit(as(uid), planJoin(uid, eventId, key, volunteer(uid), S));

const HANA = sid('HanaEvent');
const WIPED = sid('WipedEvent');
const OPEN = sid('AliceOpen');
const HIDDEN = sid('AliceHidden');
const PAST = sid('AlicePast');
const GONE = sid('AliceGone');
const LINKS = Array.from({ length: 6 }, (_, i) => sid(`Link${i}x`));
const ORPHAN = sid('LinkOrphan');

// Alice as the app leaves her after some use.
async function aliceAccount() {
    const db = as('alice');
    // Six shared chats, and a link left behind by a chat deleted where its
    // link wasn't known.
    for (const [i, id] of [...LINKS, ORPHAN].entries()) {
        const chat = meta(i + 1);
        await commit(db, planCreate('alice', chat, null, [exchange('Share me', { id: 'ex-1' })]));
        await commit(db, planShare('alice', chat.id, id,
            { v: SHARE_VERSION, title: chat.title, payload: '{}', createdAt: 1, updatedAt: 1 },
            { id, createdAt: 1, updatedAt: 1, lastOrder: 10 }));
        if (id === ORPHAN) await commit(db, planDelete('alice', chat.id, ['ex-1']));
    }
    // A long chat, in more than one batch.
    const long = meta(20);
    const entries = Array.from({ length: 450 }, (_, i) => exchange(`Q${i}`, { id: `ex-${i}`, order: i }));
    for (const batch of planImport('alice', long, null, entries)) await commit(db, batch);

    // Hana's event, which alice joined and reported; and one alice joined
    // that the console deleted, leaving her sign-up below it.
    await post('hana', HANA);
    await join('alice', HANA, sid('KeyAliceHana'));
    await commit(db, planReport('alice', HANA, { reason: 'spam', note: '' }, S));
    await post('hana', WIPED);
    await join('alice', WIPED, sid('KeyAliceWiped'));
    await wipe(`seva_events/${WIPED}`);

    // Alice's events: one open with volunteers (alice among them); one
    // hidden by an admin, which she cancelled; one over; and one deleted in
    // the console, its sign-ups and her note left behind.
    await post('alice', OPEN);
    for (const uid of ['bob', 'carol', 'alice']) await join(uid, OPEN, sid(`Key${uid}Open`));
    await post('alice', HIDDEN);
    await seed('admins/olive', { role: 'owner' });
    await commit(as('olive'), planSetHidden(HIDDEN, true));
    await commit(db, planSetStatus(HIDDEN, 'cancelled', 'Called off', S));
    const f = fields();
    const created = Timestamp.now();
    await seed(`seva_events/${PAST}`, {
        v: 1, ...f, startsAt: Timestamp.fromMillis(Date.now() - 5 * HOUR), endsAt: Timestamp.fromMillis(Date.now() - HOUR),
        volunteerCount: 0, status: 'open', cancelNote: '', hidden: false, createdAt: created, updatedAt: created,
    });
    await seed(`users/alice/seva_hosting/${PAST}`, { createdAt: created });
    await post('alice', GONE);
    await join('bob', GONE, sid('KeyBobGone'));
    await wipe(`seva_events/${GONE}`);
}

async function assertNothingOfAlicesLeft() {
    for (const c of ['chats', 'shares', 'seva_hosting', 'seva_signups'])
        assert.deepEqual(await ids(`users/alice/${c}`), [], `users/alice/${c}`);
    for (const id of [...LINKS, ORPHAN]) assert.equal(await peek(`shared_chats/${id}`), null, id);
    for (const id of [OPEN, HIDDEN, PAST, GONE]) {
        assert.equal(await peek(`seva_events/${id}`), null, id);
        assert.deepEqual(await ids(`seva_events/${id}/volunteers`), [], `${id}'s sign-ups`);
    }
    assert.deepEqual(await ids(`seva_events/${WIPED}/volunteers`), []);
    // Hana's event gets its spot back; the report stays for the admins.
    assert.equal((await peek(`seva_events/${HANA}`))?.volunteerCount, 0);
    assert.deepEqual(await ids(`seva_events/${HANA}/volunteers`), []);
    assert.ok(await peek(`seva_reports/${HANA}_alice`));
}

test('an account deletes everything it keeps, under the rules, and nothing of anyone else', async () => {
    await aliceAccount();
    const removed: string[] = [];
    await deleteAccountData(accountIO(as('alice')), 'alice', { onEventRemoved: (id) => removed.push(id) });
    await assertNothingOfAlicesLeft();
    assert.deepEqual(removed.sort(), [OPEN, HIDDEN, PAST, GONE].sort());
    // Bob's own note of a sign-up alice's event no longer has: his to clear.
    assert.ok(await peek(`users/bob/seva_signups/${OPEN}`));
    await commit(as('bob'), planDropNote('bob', OPEN));
});

test("no one can delete someone else's account", async () => {
    await aliceAccount();
    await assert.rejects(deleteAccountData(accountIO(as('bob')), 'alice'), { code: 'permission-denied' });
    assert.equal((await ids('users/alice/shares')).length, LINKS.length + 1);
    assert.ok(await peek(`seva_events/${OPEN}`));
});

// Cut short in the links, each kind of event, the sign-ups and the chats.
for (const cutAt of [2, 4, 7, 10, 14, 20]) {
    test(`a deletion cut short at batch ${cutAt} is finished by running it again`, async () => {
        await aliceAccount();
        const io = accountIO(as('alice'));
        let commits = 0;
        const flaky: AccountIO = {
            ...io,
            commit: async (ops) => {
                if (++commits === cutAt) throw Object.assign(new Error('offline'), { code: 'unavailable' });
                return io.commit(ops);
            },
        };
        await assert.rejects(deleteAccountData(flaky, 'alice'), { code: 'unavailable' });
        await deleteAccountData(io, 'alice');
        await assertNothingOfAlicesLeft();
    });
}
