// The chat rules (firestore.rules, between its BEGIN and END lines): saved
// chats and their shared links, written by the app's own plans
// (lib/chat/store/firestorePlans.ts). See ./env.ts.

import { test } from 'node:test';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import {
    planCreate,
    planDelete,
    planMeta,
    planPutEntries,
    planPutReply,
    planShare,
    planUnshare,
} from '@/lib/chat/store/firestorePlans';
import { SHARE_VERSION, type ShareDoc } from '@/lib/chat/share';
import { exchange, reply } from '../chat/helpers';
import { meta } from '../chat/store-helpers';
import { commit, rulesEnv } from './env';

const { as, anon } = rulesEnv();

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
