// The Firestore rules (firestore.rules), on the emulator: `npm run test:rules`
// starts it (it needs Java) and runs this file; CI does the same. Not part of
// `npm test`, which needs nothing running.
//
// Chat documents come from the app's own write plans
// (lib/chat/store/firestorePlans.ts), so the rules are held to the shapes the
// app really writes.

import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    Timestamp,
    addDoc,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    writeBatch,
    type Firestore,
} from 'firebase/firestore';
import {
    planCreate,
    planDelete,
    planMeta,
    planPutEntries,
    planPutReply,
    planShare,
    planUnshare,
    type Op,
} from '@/lib/chat/store/firestorePlans';
import { SHARE_VERSION, type ShareDoc } from '@/lib/chat/share';
import { exchange, reply } from '../chat/helpers';
import { meta } from '../chat/store-helpers';

let env: RulesTestEnvironment;

before(async () => {
    env = await initializeTestEnvironment({
        projectId: 'demo-sikhai',
        firestore: { rules: readFileSync(resolve(import.meta.dirname, '../../firestore.rules'), 'utf8') },
    });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const as = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = () => env.unauthenticatedContext().firestore() as unknown as Firestore;
async function seed(path: string, data: Record<string, unknown>) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore() as unknown as Firestore, path), data);
    });
}

// One batch, as the app sends its plans.
function commit(db: Firestore, ops: Op[]): Promise<void> {
    const batch = writeBatch(db);
    for (const op of ops) {
        const ref = doc(db, op.path.join('/'));
        if (op.type === 'set') batch.set(ref, op.data);
        else if (op.type === 'update') batch.update(ref, op.data);
        else batch.delete(ref);
    }
    return batch.commit();
}

// ─── Seva ───────────────────────────────────────────────────────────────────

// What app/seva/create/page.tsx writes.
const event = (over: Record<string, unknown> = {}) => ({
    title: 'Langar seva',
    location: 'Gurdwara Sahib, Fremont',
    date: 'Sunday, 10 am',
    needed: 2,
    attendees: [],
    category: 'Langar',
    description: 'Help make and serve langar.',
    createdAt: Timestamp.now(),
    ...over,
});

test('anyone can read the Seva board', async () => {
    await seed('seva_events/e1', event());
    await assertSucceeds(getDocs(collection(anon(), 'seva_events')));
    await assertSucceeds(getDoc(doc(anon(), 'seva_events/e1')));
});

test('a signed-in visitor can post an event as the create page writes it; no one else can', async () => {
    await assertSucceeds(addDoc(collection(as('alice'), 'seva_events'), event()));
    await assertSucceeds(addDoc(collection(as('alice'), 'seva_events'), event({ description: '' })));
    await assertFails(addDoc(collection(anon(), 'seva_events'), event()));
});

test('a malformed event is refused', async () => {
    const db = as('alice');
    for (const bad of [
        { needed: Number('five') }, // NaN, from a mistyped number
        { needed: 0 },
        { needed: 2.5 },
        { attendees: ['alice'] },
        { category: 'Party' },
        { title: '' },
        { title: 'x'.repeat(201) },
        { createdAt: 'yesterday' },
        { creator: 'someone' },
    ]) {
        await assertFails(addDoc(collection(db, 'seva_events'), event(bad)));
    }
});

test('signing up adds only yourself, once, while the event has room', async () => {
    await seed('seva_events/e1', event({ needed: 2 }));
    const ref = (uid: string) => doc(as(uid), 'seva_events/e1');
    await assertSucceeds(updateDoc(ref('alice'), { attendees: arrayUnion('alice') }));
    await assertFails(updateDoc(ref('alice'), { attendees: arrayUnion('alice') })); // twice
    await assertFails(updateDoc(ref('bob'), { attendees: arrayUnion('carol') })); // someone else
    await assertFails(updateDoc(ref('bob'), { attendees: arrayUnion('bob'), title: 'Mine now' })); // other fields
    await assertFails(updateDoc(ref('bob'), { attendees: ['bob'] })); // dropping others
    await assertSucceeds(updateDoc(ref('bob'), { attendees: arrayUnion('bob') }));
    await assertFails(updateDoc(ref('carol'), { attendees: arrayUnion('carol') })); // full
    await assertFails(updateDoc(doc(anon(), 'seva_events/e1'), { attendees: arrayUnion('anon') })); // signed out
});

test('an event from before sign-ups had a list can still be joined', async () => {
    const legacy: Record<string, unknown> = event();
    delete legacy.attendees;
    await seed('seva_events/old', legacy);
    await assertSucceeds(updateDoc(doc(as('alice'), 'seva_events/old'), { attendees: arrayUnion('alice') }));
});

test('no one deletes an event', async () => {
    await seed('seva_events/e1', event());
    await assertFails(deleteDoc(doc(as('alice'), 'seva_events/e1')));
    await assertFails(deleteDoc(doc(anon(), 'seva_events/e1')));
});

// ─── Saved chats ────────────────────────────────────────────────────────────

const CHAT = meta(1); // a UUID id, as the app makes

test("a user's chat can be created, grown, answered, renamed and deleted, as the app writes it", async () => {
    const db = as('alice');
    const first = exchange('What is Seva?', { id: 'ex-1', reply: { status: 'done' } });
    await assertSucceeds(commit(db, planCreate('alice', CHAT, null, [first])));
    await assertSucceeds(getDoc(doc(db, `users/alice/chats/${CHAT.id}`)));
    await assertSucceeds(getDocs(collection(db, `users/alice/chats/${CHAT.id}/entries`)));

    const second = exchange('And Simran?', { id: 'ex-2', reply: { id: 'r-2', status: 'streaming', text: '', finishedAt: undefined, startedAt: 500 } });
    await assertSucceeds(commit(db, planPutEntries('alice', CHAT.id, [second], 600)));
    await assertSucceeds(commit(db, planPutReply('alice', CHAT.id, 'ex-2', reply({ id: 'r-2', text: 'Simran is remembrance.', startedAt: 500 }))));
    await assertSucceeds(commit(db, planMeta('alice', CHAT.id, { title: 'Seva and Simran', titleSource: 'user', pinned: true })));
    await assertSucceeds(commit(db, planDelete('alice', CHAT.id, ['ex-1', 'ex-2'])));
});

test("no one else can read or write a user's chats", async () => {
    await assertSucceeds(commit(as('alice'), planCreate('alice', CHAT, null, [exchange('Private?', { id: 'ex-1' })])));
    await assertFails(getDoc(doc(as('bob'), `users/alice/chats/${CHAT.id}`)));
    await assertFails(getDocs(collection(as('bob'), `users/alice/chats/${CHAT.id}/entries`)));
    await assertFails(getDoc(doc(anon(), `users/alice/chats/${CHAT.id}`)));
    await assertFails(commit(as('bob'), planCreate('alice', meta(2), null, [])));
    await assertFails(commit(as('bob'), planMeta('alice', CHAT.id, { title: 'Hijacked', titleSource: 'user' })));
});

test('a malformed chat is refused', async () => {
    const db = as('alice');
    await assertFails(commit(db, planCreate('alice', { ...CHAT, id: 'short' }, null, []))); // bad id
    await assertFails(commit(db, planCreate('alice', { ...CHAT, title: 'x'.repeat(201) }, null, []))); // long title
    await assertFails(setDoc(doc(db, `users/alice/chats/${CHAT.id}`), { title: 'No shape at all' })); // missing fields
});

test('a late write from an older reply attempt cannot replace a newer one', async () => {
    const db = as('alice');
    const ex = exchange('Why?', { id: 'ex-1', reply: { id: 'r-old', startedAt: 100 } });
    await assertSucceeds(commit(db, planCreate('alice', CHAT, null, [ex])));
    await assertSucceeds(commit(db, planPutReply('alice', CHAT.id, 'ex-1', reply({ id: 'r-new', startedAt: 200 }))));
    await assertFails(commit(db, planPutReply('alice', CHAT.id, 'ex-1', reply({ id: 'r-old', startedAt: 100, text: 'Stale' }))));
});

// ─── Shared links ───────────────────────────────────────────────────────────

const SHARE_ID = 'Ab3dEf6hIj9lMn2pQr5t'; // a Firestore auto id
const shareDoc = (over: Partial<ShareDoc> = {}): ShareDoc => ({
    v: SHARE_VERSION, ownerUid: 'alice', chatId: CHAT.id, title: CHAT.title,
    payload: JSON.stringify({ transcript: [] }), createdAt: 1_000, updatedAt: 1_000, ...over,
});
const shareRef = { id: SHARE_ID, createdAt: 1_000, updatedAt: 1_000, lastOrder: 10 };

async function aliceSharesHerChat() {
    await assertSucceeds(commit(as('alice'), planCreate('alice', CHAT, null, [exchange('Share me', { id: 'ex-1' })])));
    await assertSucceeds(commit(as('alice'), planShare('alice', CHAT.id, SHARE_ID, shareDoc(), shareRef)));
}

test('anyone with a shared link can read it, but no one can list them', async () => {
    await aliceSharesHerChat();
    await assertSucceeds(getDoc(doc(anon(), `shared_chats/${SHARE_ID}`)));
    await assertFails(getDocs(collection(anon(), 'shared_chats')));
    await assertFails(getDocs(collection(as('alice'), 'shared_chats')));
});

test("only a chat's owner can share it, refresh the link or end it", async () => {
    await aliceSharesHerChat();
    // Bob can't publish a snapshot of a chat he doesn't have, or pass one off as Alice's.
    await assertFails(setDoc(doc(as('bob'), 'shared_chats/Zz9yXw8vUt7sRq6pOn5m'), shareDoc({ ownerUid: 'bob' })));
    await assertFails(setDoc(doc(as('bob'), 'shared_chats/Zz9yXw8vUt7sRq6pOn5m'), shareDoc()));
    await assertFails(updateDoc(doc(as('bob'), `shared_chats/${SHARE_ID}`), { title: 'Mine' }));
    await assertFails(deleteDoc(doc(as('bob'), `shared_chats/${SHARE_ID}`)));
    // A refresh keeps its chat and its creation time.
    await assertSucceeds(commit(as('alice'), planShare('alice', CHAT.id, SHARE_ID, shareDoc({ updatedAt: 2_000 }), { ...shareRef, updatedAt: 2_000 })));
    await assertFails(setDoc(doc(as('alice'), `shared_chats/${SHARE_ID}`), shareDoc({ createdAt: 5 })));
    // Ending it, and ending it again from another device, both go through.
    await assertSucceeds(commit(as('alice'), planUnshare('alice', CHAT.id, SHARE_ID)));
    await assertSucceeds(deleteDoc(doc(as('alice'), `shared_chats/${SHARE_ID}`)));
});
