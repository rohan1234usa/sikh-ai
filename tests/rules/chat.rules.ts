// The chat rules (firestore.rules, between its BEGIN and END lines): saved
// chats and their shared links, written by the app's own plans
// (lib/chat/store/firestorePlans.ts). See ./env.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
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
import { FirestoreChatStore } from '@/lib/chat/store/firestore';
import type { Op } from '@/lib/firebase/ops';
import { exchange, reply } from '../chat/helpers';
import { meta } from '../chat/store-helpers';
import { commit, rulesEnv } from './env';

const { as, anon, peek } = rulesEnv();

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
const OTHER_ID = 'Zz9yXw8vUt7sRq6pOn5m';
const shareDoc = (over: Record<string, unknown> = {}) => ({
    v: SHARE_VERSION, title: CHAT.title, payload: JSON.stringify({ transcript: [] }), createdAt: 1_000, updatedAt: 1_000, ...over,
}) as ShareDoc;
const shareRef = (id = SHARE_ID, updatedAt = 1_000) => ({ id, createdAt: 1_000, updatedAt, lastOrder: 10 });
const share = (id = SHARE_ID, updatedAt = 1_000) => planShare('alice', CHAT.id, id, shareDoc({ updatedAt }), shareRef(id, updatedAt));

async function aliceHasAChat(chat = CHAT) {
    await assertSucceeds(commit(as('alice'), planCreate('alice', chat, null, [exchange('Share me', { id: 'ex-1' })])));
}

async function aliceSharesHerChat() {
    await aliceHasAChat();
    await assertSucceeds(commit(as('alice'), share()));
}

test('a link names no account, nor the chat it copies', async () => {
    await aliceSharesHerChat();
    const published = await peek(`shared_chats/${SHARE_ID}`);
    assert.deepEqual(Object.keys(published!).sort(), ['createdAt', 'payload', 'title', 'updatedAt', 'v']);
    assert.ok(!JSON.stringify(published).includes('alice') && !JSON.stringify(published).includes(CHAT.id));
    // The old shape, which did, is refused.
    const second = meta(2);
    await aliceHasAChat(second);
    for (const old of [shareDoc({ ownerUid: 'alice' }), shareDoc({ chatId: second.id }), shareDoc({ v: 1 })])
        await assertFails(commit(as('alice'), planShare('alice', second.id, OTHER_ID, old, shareRef(OTHER_ID))));
});

test('anyone with a shared link can read it, but no one can list them', async () => {
    await aliceSharesHerChat();
    await assertSucceeds(getDoc(doc(anon(), `shared_chats/${SHARE_ID}`)));
    await assertFails(getDocs(collection(anon(), 'shared_chats')));
    await assertFails(getDocs(collection(as('alice'), 'shared_chats')));
});

test("a link's note is its owner's alone", async () => {
    await aliceSharesHerChat();
    await assertSucceeds(getDoc(doc(as('alice'), `users/alice/shares/${SHARE_ID}`)));
    await assertSucceeds(getDocs(collection(as('alice'), 'users/alice/shares')));
    await assertSucceeds(getDocs(query(collection(as('alice'), 'users/alice/shares'), where('chatId', '==', CHAT.id))));
    await assertFails(getDoc(doc(as('bob'), `users/alice/shares/${SHARE_ID}`)));
    await assertFails(getDocs(collection(as('bob'), 'users/alice/shares')));
    await assertFails(getDoc(doc(anon(), `users/alice/shares/${SHARE_ID}`)));
});

test("only a chat's owner can share it, refresh the link or end it", async () => {
    await aliceSharesHerChat();
    const bobs = meta(3);
    await assertSucceeds(commit(as('bob'), planCreate('bob', bobs, null, [exchange('Mine', { id: 'ex-1' })])));
    // Bob can't take Alice's link over, with his own chat or a note alone.
    await assertFails(commit(as('bob'), planShare('bob', bobs.id, SHARE_ID, shareDoc(), shareRef())));
    await assertFails(setDoc(doc(as('bob'), `users/bob/shares/${SHARE_ID}`), { chatId: bobs.id }));
    await assertFails(updateDoc(doc(as('bob'), `shared_chats/${SHARE_ID}`), { title: 'Mine' }));
    await assertFails(deleteDoc(doc(as('bob'), `shared_chats/${SHARE_ID}`)));
    await assertFails(deleteDoc(doc(as('bob'), `users/alice/shares/${SHARE_ID}`)));
    // Nor publish a snapshot with no note of his own.
    await assertFails(setDoc(doc(as('bob'), `shared_chats/${OTHER_ID}`), shareDoc()));
    // A refresh keeps its creation time.
    await assertSucceeds(commit(as('alice'), share(SHARE_ID, 2_000)));
    await assertFails(setDoc(doc(as('alice'), `shared_chats/${SHARE_ID}`), shareDoc({ createdAt: 5 })));
    // Ending it, and ending it again from another device, both go through.
    await assertSucceeds(commit(as('alice'), planUnshare('alice', CHAT.id, [SHARE_ID])));
    await assertSucceeds(commit(as('alice'), planUnshare('alice', CHAT.id, [SHARE_ID])));
    await assertSucceeds(deleteDoc(doc(as('alice'), `shared_chats/${SHARE_ID}`)));
});

test("a link and its owner's note can't be written apart, or bent", async () => {
    await aliceHasAChat();
    const [link, note, ref] = share();
    const noteOf = (data: Record<string, unknown>): Op => ({ type: 'set', path: note.path, data });
    // The chat must name the new link in the same batch: a link with its note
    // alone, or with the chat naming another, is refused.
    const [, , refToOther] = share(OTHER_ID);
    for (const part of [[link], [note], [link, ref], [note, ref], [link, note], [link, note, refToOther]])
        await assertFails(commit(as('alice'), part));
    await assertFails(commit(as('alice'), [link, noteOf({ chatId: CHAT.id, extra: 1 }), ref]));
    // A note for a chat she doesn't have.
    await assertFails(commit(as('alice'), [link, noteOf({ chatId: meta(9).id })]));
    await assertSucceeds(commit(as('alice'), [link, note, ref]));
    // The note stays while the link does, and keeps its chat.
    await assertFails(deleteDoc(doc(as('alice'), `users/alice/shares/${SHARE_ID}`)));
    await assertFails(updateDoc(doc(as('alice'), `users/alice/shares/${SHARE_ID}`), { chatId: meta(2).id }));
});

test('a link goes only with the note of it, so no one keeps a note of a link to take back over', async () => {
    await aliceSharesHerChat();
    // Alone, neither the link nor the note can go.
    await assertFails(deleteDoc(doc(as('alice'), `shared_chats/${SHARE_ID}`)));
    await assertFails(deleteDoc(doc(as('alice'), `users/alice/shares/${SHARE_ID}`)));
    // Alice ends her link. Bob, who had its address, makes a link of his own
    // under it, and can't then end it while keeping his note: if he could,
    // a device of Alice's bringing her link back under that id would hand
    // him a link of hers to rewrite.
    await assertSucceeds(commit(as('alice'), planUnshare('alice', CHAT.id, [SHARE_ID])));
    const bobs = meta(4);
    await assertSucceeds(commit(as('bob'), planCreate('bob', bobs, null, [exchange('Mine', { id: 'ex-1' })])));
    await assertSucceeds(commit(as('bob'), planShare('bob', bobs.id, SHARE_ID, shareDoc(), shareRef())));
    await assertFails(deleteDoc(doc(as('bob'), `shared_chats/${SHARE_ID}`)));
    await assertSucceeds(commit(as('bob'), planUnshare('bob', bobs.id, [SHARE_ID])));
    assert.equal(await peek(`users/bob/shares/${SHARE_ID}`), null);
});

test('a device with an old copy can make an ended link again, but not give a chat a second', async () => {
    await aliceSharesHerChat();
    await assertSucceeds(commit(as('alice'), planUnshare('alice', CHAT.id, [SHARE_ID])));
    // Its copy still says the chat is shared: refreshing makes the link again.
    await assertSucceeds(commit(as('alice'), share(SHARE_ID, 2_000)));
    // Ended, and a new link made elsewhere: the old copy can't bring back its own.
    await assertSucceeds(commit(as('alice'), planUnshare('alice', CHAT.id, [SHARE_ID])));
    await assertSucceeds(commit(as('alice'), share(OTHER_ID, 3_000)));
    await assertFails(commit(as('alice'), share(SHARE_ID, 4_000)));
});

test('deleting a chat takes its link and the note of it, even a link already ended', async () => {
    await aliceSharesHerChat();
    await assertSucceeds(commit(as('alice'), planDelete('alice', CHAT.id, ['ex-1'], [SHARE_ID])));
    assert.equal(await peek(`shared_chats/${SHARE_ID}`), null);
    assert.equal(await peek(`users/alice/shares/${SHARE_ID}`), null);

    await aliceSharesHerChat();
    await assertSucceeds(commit(as('alice'), planUnshare('alice', CHAT.id, [SHARE_ID])));
    await assertSucceeds(commit(as('alice'), planDelete('alice', CHAT.id, ['ex-1'], [SHARE_ID])));
});

// ─── The account store, on the emulator ─────────────────────────────────────

// Until a write the store sends without waiting has landed.
async function until(check: () => Promise<boolean>) {
    for (let i = 0; i < 50; i++) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail('the write never landed');
}

test('a device showing an older link that stops sharing ends the newer one too', async () => {
    await aliceSharesHerChat();
    // Another device ends that link and makes a new one.
    await assertSucceeds(commit(as('alice'), planUnshare('alice', CHAT.id, [SHARE_ID])));
    await assertSucceeds(commit(as('alice'), share(OTHER_ID, 2_000)));
    // This one still shows the first, and stops sharing.
    await new FirestoreChatStore(as('alice'), 'alice').unshare(CHAT.id, SHARE_ID);
    assert.equal(await peek(`shared_chats/${OTHER_ID}`), null);
    assert.equal(await peek(`users/alice/shares/${OTHER_ID}`), null);
    assert.equal((await peek(`users/alice/chats/${CHAT.id}`))?.share, null);
});

test("deleting a chat this tab doesn't hold ends its links too", async () => {
    await aliceSharesHerChat();
    await new FirestoreChatStore(as('alice'), 'alice').deleteChat(CHAT.id);
    await until(async () => (await peek(`users/alice/chats/${CHAT.id}`)) === null);
    assert.equal(await peek(`shared_chats/${SHARE_ID}`), null);
    assert.equal(await peek(`users/alice/shares/${SHARE_ID}`), null);
});
