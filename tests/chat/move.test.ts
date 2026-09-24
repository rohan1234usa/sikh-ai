import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveChats } from '@/lib/chat/store/move';
import { LocalChatStore } from '@/lib/chat/store/local';
import { ChatStoreError, type ChatRecord, type ChatStore } from '@/lib/chat/store/types';
import { exchange } from './helpers';
import { FakeStorage, UUID, meta } from './store-helpers';

async function browserWith(n: number) {
    const store = new LocalChatStore({ storage: new FakeStorage() });
    for (let i = 1; i <= n; i++) await store.createChat(meta(i), null, [exchange(`Question ${i}`, { id: `ex-${i}` })]);
    return store;
}

// An account backed by a local store, which refuses while `refusing` is set.
function account() {
    const target = new LocalChatStore({ storage: new FakeStorage() });
    const gate = { refusing: false, accepted: 0 };
    const store = {
        importChat: async (record: ChatRecord) => {
            if (gate.refusing) throw new ChatStoreError('permission');
            gate.accepted++;
            await target.importChat(record);
        },
    } as unknown as ChatStore;
    return { store, target, gate };
}

const ids = (n: number) => Array.from({ length: n }, (_, i) => UUID(i + 1));

test('every chat moves, and leaves this browser only once the account has it', async () => {
    const from = await browserWith(3);
    const { store, target } = account();
    const progress: number[] = [];
    const result = await moveChats(ids(3), from, store, { isBusy: () => false, onProgress: (n) => progress.push(n) });
    assert.deepEqual(result, { moved: 3, skipped: 0 });
    assert.deepEqual(progress, [1, 2, 3]);
    assert.deepEqual(from.getList().chats, []);
    assert.equal(target.getList().chats.length, 3);
    const moved = target.getChat(UUID(2));
    assert.equal(moved.status === 'ready' && moved.record.transcript[0].id, 'ex-2');
});

test('a chat with a reply still arriving stays until the reply is saved', async () => {
    const from = await browserWith(2);
    const { store } = account();
    const result = await moveChats(ids(2), from, store, { isBusy: (id) => id === UUID(1) });
    assert.deepEqual(result, { moved: 1, skipped: 1 });
    assert.deepEqual(from.getList().chats.map((c) => c.id), [UUID(1)]);
});

test('a refusal stops the move with nothing lost, and running it again finishes without copies', async () => {
    const from = await browserWith(3);
    const acct = account();
    let calls = 0;
    const refuseAfterOne = { ...acct.store, importChat: async (r: ChatRecord) => {
        acct.gate.refusing = ++calls > 1;
        await acct.store.importChat(r);
    } } as ChatStore;
    const first = await moveChats(ids(3), from, refuseAfterOne, { isBusy: () => false });
    assert.deepEqual(first, { moved: 1, skipped: 0, failed: 'permission' });
    assert.equal(from.getList().chats.length, 2, 'the refused chats are still in this browser');

    // Suppose the account did keep chat 2 before its refusal arrived: moving
    // again writes it over rather than adding a copy.
    const two = from.getChat(UUID(2));
    if (two.status === 'ready') await acct.target.importChat(two.record);
    acct.gate.refusing = false;
    const rest = from.getList().chats.map((c) => c.id);
    const second = await moveChats(rest, from, acct.store, { isBusy: () => false });
    assert.deepEqual(second, { moved: 2, skipped: 0 });
    assert.equal(acct.target.getList().chats.length, 3);
    const chat2 = acct.target.getChat(UUID(2));
    assert.equal(chat2.status === 'ready' && chat2.record.transcript.length, 1, 'written over, not doubled');
});

test('a question asked in a chat while it moves keeps that chat here, question and all', async () => {
    const from = await browserWith(1);
    const target = new LocalChatStore({ storage: new FakeStorage() });
    // The account takes its time; meanwhile the user asks another question.
    const slowAccount = {
        importChat: async (record: ChatRecord) => {
            await target.importChat(record);
            await from.putEntries(UUID(1), [exchange('Asked during the move', { id: 'ex-new', order: 99 })], { touch: 99 });
        },
    } as unknown as ChatStore;
    const result = await moveChats([UUID(1)], from, slowAccount, { isBusy: () => false });
    assert.deepEqual(result, { moved: 0, skipped: 1 });
    const here = from.getChat(UUID(1));
    assert.equal(here.status === 'ready' && here.record.transcript.length, 2, 'the new question is still here');
});

test('chats a full account would drop at once stay in this browser, and the move stops there', async () => {
    const from = await browserWith(3); // chat 3 most recent, chat 1 oldest
    const target = new LocalChatStore({ storage: new FakeStorage() });
    // An account full of chats newer than 2: it takes 3 and turns 2 away.
    const full = {
        importChat: async (record: ChatRecord) => {
            if (record.meta.updatedAt <= 2) throw new ChatStoreError('cap');
            await target.importChat(record);
        },
    } as unknown as ChatStore;
    const result = await moveChats([UUID(3), UUID(2), UUID(1)], from, full, { isBusy: () => false });
    assert.deepEqual(result, { moved: 1, skipped: 0, failed: 'cap' });
    assert.deepEqual(from.getList().chats.map((c) => c.id), [UUID(2), UUID(1)], 'the older ones are still here');
    assert.deepEqual(target.getList().chats.map((c) => c.id), [UUID(3)]);
});

test('a chat moved to be shared arrives as used now', async () => {
    const from = await browserWith(1);
    const target = new LocalChatStore({ storage: new FakeStorage() });
    const result = await moveChats([UUID(1)], from, target, { isBusy: () => false, touch: 5_000 });
    assert.deepEqual(result, { moved: 1, skipped: 0 });
    assert.equal(target.getList().chats[0].updatedAt, 5_000);
});
