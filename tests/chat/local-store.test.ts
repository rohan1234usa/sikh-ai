import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LOCAL_CHATS } from '@/lib/chat/config';
import { LEGACY_CHAT_KEYS, LOCAL_CHAT_PREFIX, LOCAL_INDEX_KEY, LocalChatStore } from '@/lib/chat/store/local';
import { ChatStoreError, type ChatState } from '@/lib/chat/store/types';
import type { Exchange } from '@/lib/chat/transcript';
import { exchange, notice, reply } from './helpers';
import { FakeStorage, UUID, meta } from './store-helpers';

const ready = (s: ChatState) => {
    assert.equal(s.status, 'ready');
    return (s as Extract<ChatState, { status: 'ready' }>).record;
};

test('a new chat shows up in the list and can be read back; each listener hears once', async () => {
    const store = new LocalChatStore({ storage: new FakeStorage() });
    let listCalls = 0;
    let chatCalls = 0;
    store.subscribeList(() => listCalls++);
    store.subscribeChat(UUID(1), () => chatCalls++);
    assert.equal(store.getChat(UUID(1)).status, 'missing');

    await store.createChat(meta(1), null, [exchange('What is Seva?', { reply: { status: 'streaming', text: '' } })]);
    assert.deepEqual(store.getList().chats.map((c) => c.id), [UUID(1)]);
    const record = ready(store.getChat(UUID(1)));
    assert.equal((record.transcript[0] as Exchange).reply.status, 'stopped', 'saved as it would stand if the page went away');
    assert.deepEqual([listCalls, chatCalls], [1, 1]);
    assert.equal(store.getChat(UUID(1)), store.getChat(UUID(1)), 'a stable snapshot until something changes');
});

test('asking, answering and retrying are writes by id', async () => {
    const store = new LocalChatStore({ storage: new FakeStorage() });
    const first = exchange('One', { id: 'ex-1', order: 1, reply: { id: 'r1', status: 'streaming', text: '' } });
    await store.createChat(meta(1), null, [first]);
    await store.putReply(UUID(1), 'ex-1', reply({ id: 'r1', text: 'Answer one', startedAt: 1 }));

    const second = exchange('Two', { id: 'ex-2', order: 3, reply: { id: 'r2', status: 'streaming', text: '', startedAt: 3 } });
    await store.putEntries(UUID(1), [notice('guru-nanak', 2, 'n1'), second], { touch: 50 });
    let record = ready(store.getChat(UUID(1)));
    assert.deepEqual(record.transcript.map((e) => e.id), ['ex-1', 'n1', 'ex-2']);
    assert.equal(record.meta.updatedAt, 50);

    // A retry replaces the attempt; the old attempt's late write is refused.
    await store.putEntries(UUID(1), [{ ...second, order: 4, reply: reply({ id: 'r3', status: 'streaming', text: '', startedAt: 9 }) }], { touch: 60, removeIds: ['n1'] });
    await store.putReply(UUID(1), 'ex-2', reply({ id: 'r2', text: 'Late answer from the old attempt', startedAt: 3 }));
    await store.putReply(UUID(1), 'ex-2', reply({ id: 'r3', status: 'streaming', text: 'Part', startedAt: 9 }));
    record = ready(store.getChat(UUID(1)));
    assert.deepEqual(record.transcript.map((e) => e.id), ['ex-1', 'ex-2']);
    const r = (record.transcript[1] as Exchange).reply;
    assert.deepEqual([r.id, r.status, r.text], ['r3', 'interrupted', 'Part']);

    // Citations only land on the attempt they were checked for.
    const cite = [{ quote: 'ਸਤਿ ਨਾਮੁ ਕਰਤਾ', status: 'unverified' as const }];
    await store.setCitations(UUID(1), 'ex-2', 'r2', cite);
    assert.equal((ready(store.getChat(UUID(1))).transcript[1] as Exchange).reply.citations, undefined);
    await store.setCitations(UUID(1), 'ex-2', 'r3', cite);
    assert.equal((ready(store.getChat(UUID(1))).transcript[1] as Exchange).reply.citations?.length, 1);
});

test('a deleted chat is gone, and a late write to it is refused rather than bringing it back', async () => {
    const storage = new FakeStorage();
    const store = new LocalChatStore({ storage });
    await store.createChat(meta(1), null, [exchange('Q', { id: 'ex-1' })]);
    await store.deleteChat(UUID(1));
    assert.equal(store.getChat(UUID(1)).status, 'missing');
    assert.deepEqual(store.getList().chats, []);
    await assert.rejects(store.putReply(UUID(1), 'ex-1', reply()), (e) => e instanceof ChatStoreError && e.code === 'gone');
    assert.equal(storage.getItem(`${LOCAL_CHAT_PREFIX}${UUID(1)}`), null);
});

test('the old single chat — the bug report\'s [greeting, Q, Q] — becomes one chat with one question', () => {
    const storage = new FakeStorage();
    const Q = 'Explain the meaning of the Mool Mantar';
    storage.setItem('sikhai.chat.v2', JSON.stringify({
        version: 2,
        updatedAt: 500,
        messages: [
            { id: 'greeting', role: 'ai', text: 'Fateh', createdAt: 0 },
            { id: 'u1', role: 'user', text: Q, createdAt: 100 },
            { id: 'u2', role: 'user', text: Q, createdAt: 200 },
        ],
        context: { type: 'hukamnama', title: "Today's Hukamnama", text: 'ਸਲੋਕੁ ॥', capturedAt: 1 },
    }));
    const store = new LocalChatStore({ storage });
    const [chat] = store.getList().chats;
    assert.equal(chat.id, 'legacy-u2');
    assert.equal(chat.title, Q);
    const record = ready(store.getChat(chat.id));
    assert.deepEqual(record.transcript.map((e) => (e.kind === 'exchange' ? `${e.question.text}→${e.reply.status}` : e.kind)), [`${Q}→stopped`]);
    assert.equal(record.context?.type, 'hukamnama');
    for (const key of LEGACY_CHAT_KEYS) assert.equal(storage.getItem(key), null);
});

test('migration handles v1, corrupt data and a greeting-only chat, and never copies twice', () => {
    const storage = new FakeStorage();
    storage.setItem('sikhai.chat.v1', JSON.stringify({
        version: 1,
        messages: [{ id: 'u1a2b3c4', role: 'user', text: 'Hi', createdAt: 1 }, { id: 'a1', role: 'ai', text: 'Sat Sri Akal', createdAt: 2 }],
    }));
    storage.setItem('sikhai.chat.v2', '{not json');
    let store = new LocalChatStore({ storage });
    assert.deepEqual(store.getList().chats.map((c) => c.id), ['legacy-u1a2b3c4']);
    assert.equal(storage.getItem('sikhai.chat.v2'), null, 'corrupt data is removed');

    // A tab still on the old code writes the old key again: merged, not copied.
    storage.setItem('sikhai.chat.v1', JSON.stringify({
        version: 1,
        messages: [
            { id: 'u1a2b3c4', role: 'user', text: 'Hi', createdAt: 1 }, { id: 'a1', role: 'ai', text: 'Sat Sri Akal', createdAt: 2 },
            { id: 'u2', role: 'user', text: 'More?', createdAt: 3 }, { id: 'a2', role: 'ai', text: 'Yes.', createdAt: 4 },
        ],
    }));
    store = new LocalChatStore({ storage });
    assert.equal(store.getList().chats.length, 1);
    assert.equal(ready(store.getChat('legacy-u1a2b3c4')).transcript.length, 2);

    const greetingOnly = new FakeStorage();
    greetingOnly.setItem('sikhai.chat.v2', JSON.stringify({ version: 2, messages: [{ id: 'greeting', role: 'ai', text: 'Fateh', createdAt: 0 }] }));
    assert.deepEqual(new LocalChatStore({ storage: greetingOnly }).getList().chats, []);
    assert.equal(greetingOnly.getItem('sikhai.chat.v2'), null);
});

test('the list and the records are made to agree on start, in both directions', async () => {
    const storage = new FakeStorage();
    const store = new LocalChatStore({ storage });
    await store.createChat(meta(1), null, [exchange('One')]);
    await store.createChat(meta(2), null, [exchange('Two')]);
    // A crash after writing chat 3's record but before the list...
    storage.setItem(`${LOCAL_CHAT_PREFIX}${UUID(3)}`, JSON.stringify({ v: 3, meta: meta(3), context: null, entries: [exchange('Three')] }));
    // ...and one after removing chat 2's record but before the list.
    storage.removeItem(`${LOCAL_CHAT_PREFIX}${UUID(2)}`);
    const reopened = new LocalChatStore({ storage });
    assert.deepEqual(reopened.getList().chats.map((c) => c.id).sort(), [UUID(1), UUID(3)]);
    assert.ok(storage.getItem(LOCAL_INDEX_KEY)!.includes(UUID(3)));
});

test('when storage is full, the least recently used chat that can go makes room', async () => {
    const storage = new FakeStorage();
    const evicted: string[][] = [];
    const store = new LocalChatStore({
        storage,
        isProtected: (id) => id === UUID(2), // open in this tab
        onEvicted: (ids) => evicted.push(ids),
    });
    const long = 'x'.repeat(2_000);
    await store.createChat(meta(1, { pinned: true }), null, [exchange(long)]);
    await store.createChat(meta(2), null, [exchange(long)]);
    await store.createChat(meta(3), null, [exchange(long)]);
    await store.createChat(meta(4), null, [exchange(long)]);
    storage.quota = storage.size() + 1_000;

    await store.createChat(meta(5), null, [exchange(long)]);
    // 1 is pinned and 2 is open, so 3 goes: the oldest that may.
    assert.deepEqual(evicted, [[UUID(3)]]);
    assert.deepEqual(store.getList().chats.map((c) => c.id).sort(), [UUID(1), UUID(2), UUID(4), UUID(5)]);
    assert.equal(store.getChat(UUID(3)).status, 'missing');

    // Nothing left that may go: the write fails and the list is untouched.
    const before = storage.getItem(LOCAL_INDEX_KEY);
    await store.updateMeta(UUID(4), { pinned: true });
    await store.updateMeta(UUID(5), { pinned: true });
    await assert.rejects(
        store.createChat(meta(6), null, [exchange('y'.repeat(5_000))]),
        (e) => e instanceof ChatStoreError && e.code === 'quota',
    );
    assert.notEqual(before, null);
    assert.ok(!storage.getItem(LOCAL_INDEX_KEY)!.includes(UUID(6)));
});

test(`at ${MAX_LOCAL_CHATS} chats, a new one replaces the oldest that may go`, async () => {
    const storage = new FakeStorage();
    const evicted: string[] = [];
    const store = new LocalChatStore({ storage, onEvicted: (ids) => evicted.push(...ids) });
    for (let i = 1; i <= MAX_LOCAL_CHATS; i++) await store.createChat(meta(i, { pinned: i === 1 }), null, [exchange(`Q${i}`)]);
    await store.createChat(meta(MAX_LOCAL_CHATS + 1), null, [exchange('One more')]);
    assert.deepEqual(evicted, [UUID(2)]);
    assert.equal(store.getList().chats.length, MAX_LOCAL_CHATS);
});

test('changes made in another tab reach this one', async () => {
    const storage = new FakeStorage();
    let external: (key: string | null) => void = () => {};
    const store = new LocalChatStore({ storage, subscribeExternal: (on) => { external = on; return () => {}; } });
    const other = new LocalChatStore({ storage });

    let heard = 0;
    store.subscribeChat(UUID(1), () => heard++);
    assert.equal(store.getChat(UUID(1)).status, 'missing');
    await other.createChat(meta(1), null, [exchange('From the other tab')]);
    external(`${LOCAL_CHAT_PREFIX}${UUID(1)}`);
    external(LOCAL_INDEX_KEY);
    assert.equal(heard, 1);
    assert.equal(store.getChat(UUID(1)).status, 'ready');
    assert.equal(store.getList().chats.length, 1);

    storage.map.clear();
    external(null);
    assert.equal(store.getChat(UUID(1)).status, 'missing');
    assert.deepEqual(store.getList().chats, []);
});

test('when the list itself hits the quota, the chat that made room leaves the list too', async () => {
    // Storage that refuses the next write of the list once, as a full one would.
    class TightList extends FakeStorage {
        refuseList = false;
        setItem(k: string, v: string) {
            if (k === LOCAL_INDEX_KEY && this.refuseList) {
                this.refuseList = false;
                throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
            }
            super.setItem(k, v);
        }
    }
    const storage = new TightList();
    const store = new LocalChatStore({ storage });
    await store.createChat(meta(1), null, [exchange('Oldest')]);
    await store.createChat(meta(2), null, [exchange('Newer')]);
    const evicted: string[] = [];
    const watched = new LocalChatStore({ storage, onEvicted: (ids) => evicted.push(...ids) });
    storage.refuseList = true;
    await watched.createChat(meta(3), null, [exchange('Newest')]);

    assert.deepEqual(evicted, [UUID(1)]);
    const listed = (JSON.parse(storage.getItem(LOCAL_INDEX_KEY)!) as { chats: { id: string }[] }).chats.map((c) => c.id);
    assert.deepEqual(listed, [UUID(3), UUID(2)]);
    assert.deepEqual(watched.getList().chats.map((c) => c.id), [UUID(3), UUID(2)]);
    assert.equal(storage.getItem(LOCAL_CHAT_PREFIX + UUID(1)), null);
});
