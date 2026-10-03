import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountDeletionError, deleteAccountData, problemOf, type DeletionStep } from '@/lib/account/deletion';
import { ERASE_PAGE, UNLINK_BATCH } from '@/lib/chat/store/firestorePlans';
import { SEVA_HOST_CLEAR_BATCH } from '@/lib/seva/limits';
import { FakeFirestore, refuseLeavingWhatsGone } from './fakeFirestore';

// Ids as the SDK makes them: 20 letters and digits.
const sid = (name: string) => name.padEnd(20, '0');
const [L1, L2, E1, E2, K1, K2, K3] = ['LinkOne', 'LinkTwo', 'EventOne', 'EventTwo', 'KeyBob', 'KeyCarol', 'KeyAlice'].map(sid);
const C1 = '11111111-1111-4111-8111-111111111111';
const B1 = '22222222-2222-4222-8222-222222222222';

// Alice has two links (one of a chat already gone), a chat, an event she
// hosts with two volunteers, a sign-up for Dave's event, and a report. Bob
// has a chat of his own.
function account() {
    return new FakeFirestore()
        .seed(`shared_chats/${L1}`, { v: 2, title: 'Seva', payload: '{}' })
        .seed(`users/alice/shares/${L1}`, { chatId: C1 })
        .seed(`shared_chats/${L2}`, { v: 2, title: 'Old', payload: '{}' })
        .seed(`users/alice/shares/${L2}`, { chatId: 'gone-chat-id' })
        .seed(`users/alice/chats/${C1}`, { title: 'Seva', share: { id: L1 } })
        .seed(`users/alice/chats/${C1}/entries/e1`, { kind: 'exchange' })
        .seed(`users/alice/chats/${C1}/entries/e2`, { kind: 'exchange' })
        .seed(`seva_events/${E1}`, { status: 'open', volunteerCount: 2, createdAt: 100 })
        .seed(`users/alice/seva_hosting/${E1}`, { createdAt: 100 })
        .seed(`seva_events/${E1}/volunteers/${K1}`, { name: 'Bob' })
        .seed(`users/bob/seva_signups/${E1}`, { volunteerId: K1 })
        .seed(`seva_events/${E1}/volunteers/${K2}`, { name: 'Carol' })
        .seed(`users/carol/seva_signups/${E1}`, { volunteerId: K2 })
        .seed(`seva_events/${E2}`, { status: 'open', volunteerCount: 1, createdAt: 5 })
        .seed(`users/dave/seva_hosting/${E2}`, { createdAt: 5 })
        .seed(`seva_events/${E2}/volunteers/${K3}`, { name: 'Alice' })
        .seed(`users/alice/seva_signups/${E2}`, { volunteerId: K3 })
        .seed(`seva_reports/${E2}_alice`, { eventId: E2, reason: 'spam' })
        .seed(`users/bob/chats/${B1}`, { title: 'Mine' });
}

// What's left of Alice's afterwards, and what of everyone else's.
function assertGone(db: FakeFirestore) {
    assert.deepEqual(db.under('users/alice'), []);
    for (const path of [`shared_chats/${L1}`, `shared_chats/${L2}`, `seva_events/${E1}`])
        assert.ok(!db.has(path), path);
    assert.deepEqual(db.under(`seva_events/${E1}`), []);
    assert.deepEqual(db.under(`seva_events/${E2}`), [], "her sign-up for Dave's event");
    assert.equal(db.docs.get(`seva_events/${E2}`)?.volunteerCount, 0, 'her spot given back, once');
    for (const path of [`users/bob/chats/${B1}`, `users/bob/seva_signups/${E1}`, `users/carol/seva_signups/${E1}`,
        `users/dave/seva_hosting/${E2}`, `seva_reports/${E2}_alice`])
        assert.ok(db.has(path), `${path} isn't hers to delete`);
}

test('everything an account keeps goes, most public first, and nothing of anyone else', async () => {
    const db = account();
    const steps: DeletionStep[] = [];
    const removed: string[] = [];
    await deleteAccountData(db, 'alice', { onStep: (s) => steps.push(s), onEventRemoved: (id) => removed.push(id) });
    assertGone(db);
    assert.deepEqual(steps, ['links', 'events', 'signups', 'chats']);
    assert.deepEqual(removed, [E1]);
    // The event was cancelled first, and its sign-ups went before it did.
    const at = (path: string) => db.batches.findIndex((ops) => ops.some((op) => op.path.join('/') === path));
    assert.ok(at(`seva_events/${E1}`) < at(`seva_events/${E1}/volunteers/${K1}`));
    assert.ok(at(`seva_events/${E1}/volunteers/${K2}`) < db.batches.findIndex((ops) =>
        ops.some((op) => op.type === 'delete' && op.path.join('/') === `seva_events/${E1}`)));
    // A chat goes after its entries.
    const chat = db.batches.find((ops) => ops.some((op) => op.path.join('/') === `users/alice/chats/${C1}`))!;
    assert.equal(chat.at(-1)!.path.join('/'), `users/alice/chats/${C1}`);
});

test('batches stay within what the rules may read, and within Firestore\'s size', async () => {
    const db = new FakeFirestore();
    for (let i = 0; i < 12; i++) {
        db.seed(`shared_chats/${sid(`L${i}x`)}`, {}).seed(`users/alice/shares/${sid(`L${i}x`)}`, { chatId: C1 });
    }
    db.seed(`seva_events/${E1}`, { status: 'cancelled', createdAt: 1 }).seed(`users/alice/seva_hosting/${E1}`, { createdAt: 1 });
    for (let i = 0; i < 12; i++) db.seed(`seva_events/${E1}/volunteers/${sid(`K${i}x`)}`, {});
    db.seed(`users/alice/chats/${C1}`, {});
    for (let i = 0; i < 450; i++) db.seed(`users/alice/chats/${C1}/entries/${String(i).padStart(3, '0')}`, {});
    await deleteAccountData(db, 'alice');

    const links = db.batches.filter((ops) => ops[0].path[0] === 'shared_chats');
    assert.deepEqual(links.map((ops) => ops.length), [2 * UNLINK_BATCH, 2 * UNLINK_BATCH, 4]);
    const signups = db.batches.filter((ops) => ops[0].path[2] === 'volunteers');
    assert.ok(signups.every((ops) => ops.length <= SEVA_HOST_CLEAR_BATCH));
    assert.equal(signups.flat().length, 12);
    const erase = db.batches.filter((ops) => ops[0].path[2] === 'chats');
    assert.deepEqual(erase.map((ops) => ops.length), [ERASE_PAGE, 450 - ERASE_PAGE + 1]);
    assert.deepEqual(db.under('users/alice'), []);
});

test('a run cut short at any batch is finished by running it again', async () => {
    const full = account();
    await deleteAccountData(full, 'alice');
    // Her links, then her event cancelled, its sign-ups, the event; leaving
    // Dave's; her chat.
    const total = full.batches.length;
    assert.equal(total, 6);
    for (let k = 1; k <= total; k++) {
        const db = account();
        db.failAt = k;
        await assert.rejects(deleteAccountData(db, 'alice'), { code: 'unavailable' }, `cut at ${k}`);
        db.failAt = null;
        await deleteAccountData(db, 'alice');
        assertGone(db);
    }
});

test("a sign-up its host already cleared, or whose event is gone, still goes", async () => {
    const [E3, E4, K4, K5] = ['EventThree', 'EventFour', 'KeyFour', 'KeyFive'].map(sid);
    const db = new FakeFirestore()
        // Cleared by its host winding the event down, which is still there.
        .seed(`seva_events/${E3}`, { status: 'cancelled', volunteerCount: 1, createdAt: 1 })
        .seed(`users/alice/seva_signups/${E3}`, { volunteerId: K4 })
        // An event deleted in the console, with the sign-up still below it.
        .seed(`seva_events/${E4}/volunteers/${K5}`, { name: 'Alice' })
        .seed(`users/alice/seva_signups/${E4}`, { volunteerId: K5 });
    db.refuse = refuseLeavingWhatsGone;
    await deleteAccountData(db, 'alice');
    assert.deepEqual(db.under('users/alice'), []);
    assert.deepEqual(db.under(`seva_events/${E4}`), []);
    assert.equal(db.docs.get(`seva_events/${E3}`)?.volunteerCount, 1, 'no spot to give back');
});

test('an event of the account already gone loses what was left below it, and the note of it', async () => {
    const E5 = sid('EventFive');
    const db = new FakeFirestore()
        .seed(`users/alice/seva_hosting/${E5}`, { createdAt: 7 })
        .seed(`seva_events/${E5}/volunteers/${K1}`, { name: 'Bob' });
    await deleteAccountData(db, 'alice');
    assert.deepEqual(db.under(`seva_events/${E5}`), []);
    assert.deepEqual(db.under('users/alice'), []);
});

test('an event posted at the id of one the account hosted is left alone', async () => {
    const E6 = sid('EventSix');
    const db = new FakeFirestore()
        .seed(`users/alice/seva_hosting/${E6}`, { createdAt: 7 })
        .seed(`seva_events/${E6}`, { status: 'open', createdAt: 99 })
        .seed(`seva_events/${E6}/volunteers/${K1}`, { name: 'Bob' });
    await assert.rejects(deleteAccountData(db, 'alice'), (e) => e instanceof AccountDeletionError && e.kind === 'not_theirs');
    assert.equal(db.docs.get(`seva_events/${E6}`)?.status, 'open');
    assert.ok(db.has(`seva_events/${E6}/volunteers/${K1}`));
});

test('an account with nothing in it costs one read a step', async () => {
    const db = new FakeFirestore();
    await deleteAccountData(db, 'alice');
    assert.equal(db.lists, 4);
    assert.equal(db.gets, 0);
    assert.equal(db.batches.length, 0);
});

test('what another device adds meanwhile is caught by a last look; what keeps coming back stops the run', async () => {
    const L9 = sid('LinkNine');
    const db = account();
    await deleteAccountData(db, 'alice', {
        onStep: (step) => {
            if (step === 'chats') db.seed(`shared_chats/${L9}`, {}).seed(`users/alice/shares/${L9}`, { chatId: C1 });
        },
    });
    assertGone(db);
    assert.ok(!db.has(`shared_chats/${L9}`));

    const stubborn = account();
    stubborn.afterCommit = (_, store) => { store.seed(`users/alice/shares/${L1}`, { chatId: C1 }); };
    await assert.rejects(deleteAccountData(stubborn, 'alice'), (e) => e instanceof AccountDeletionError && e.kind === 'stuck');
});

test("what went wrong, as the person deleting their account needs to know it", () => {
    const err = (code: string) => Object.assign(new Error(code), { code });
    assert.equal(problemOf(err('auth/popup-closed-by-user')), 'cancelled');
    assert.equal(problemOf(err('auth/cancelled-popup-request')), 'cancelled');
    assert.equal(problemOf(err('auth/popup-blocked')), 'blocked');
    assert.equal(problemOf(err('auth/user-mismatch')), 'wrong-account');
    assert.equal(problemOf(err('auth/requires-recent-login')), 'recent-login');
    assert.equal(problemOf(err('auth/network-request-failed')), 'offline');
    assert.equal(problemOf(err('unavailable')), 'offline');
    assert.equal(problemOf(err('permission-denied')), 'failed');
    assert.equal(problemOf(new AccountDeletionError('stuck')), 'failed');
    assert.equal(problemOf(err('toString')), 'failed', 'only codes of its own');
    assert.equal(problemOf(null), 'failed');
    assert.equal(problemOf(err('permission-denied'), false), 'offline');
});
