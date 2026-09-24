import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_BATCH_OPS,
    chunk,
    planCitations,
    planCreate,
    planDelete,
    planEvictions,
    planImport,
    planMeta,
    planPutEntries,
    planPutReply,
    planShare,
    planUnshare,
    type Op,
} from '@/lib/chat/store/firestorePlans';
import { exchange, notice, reply } from './helpers';
import { meta } from './store-helpers';

const UID = 'user-1';
const at = (op: Op) => `${op.type} ${op.path.join('/')}`;

function noUndefined(v: unknown, path = 'op') {
    assert.notEqual(v, undefined, `${path} is undefined — Firestore rejects it`);
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) noUndefined(x, `${path}.${k}`);
}

test('a new chat writes its meta and its first entries, with nothing Firestore would reject', () => {
    const chat = meta(1);
    const first = exchange('What is Seva?', { id: 'ex-1', reply: { id: 'r1', status: 'streaming', text: '', finishedAt: undefined } });
    const ops = planCreate(UID, chat, null, [first]);
    assert.deepEqual(ops.map(at), [`set users/${UID}/chats/${chat.id}`, `set users/${UID}/chats/${chat.id}/entries/ex-1`]);
    assert.equal((ops[1].type === 'set' && (ops[1].data.reply as { status: string }).status), 'stopped', 'saved as it would stand now');
    assert.equal('id' in (ops[1] as { data: object }).data, false, 'the id is the document\'s');
    noUndefined(ops);
});

test('a question sent updates the chat in the same batch, so a deleted chat takes the write down with it', () => {
    const ops = planPutEntries(UID, 'chat-123456', [notice('guru-nanak', 5, 'n-1'), exchange('Two', { id: 'ex-2' })], 99, ['n-old']);
    assert.deepEqual(ops.map(at), [
        'update users/user-1/chats/chat-123456',
        'set users/user-1/chats/chat-123456/entries/n-1',
        'set users/user-1/chats/chat-123456/entries/ex-2',
        'delete users/user-1/chats/chat-123456/entries/n-old',
    ]);
    assert.deepEqual((ops[0] as { data: object }).data, { updatedAt: 99 });
    noUndefined(ops);
});

test('a reply and its citations are updates, which fail for an exchange that is gone', () => {
    const [put] = planPutReply(UID, 'chat-123456', 'ex-1', reply({ status: 'streaming', text: 'Part', finishedAt: undefined }));
    assert.equal(at(put), 'update users/user-1/chats/chat-123456/entries/ex-1');
    assert.equal((put as unknown as { data: { reply: { status: string } } }).data.reply.status, 'interrupted');
    noUndefined(put);
    const [cite] = planCitations(UID, 'chat-123456', 'ex-1', [{ quote: 'ਸਤਿ ਨਾਮੁ', status: 'unverified' }]);
    assert.deepEqual(Object.keys((cite as { data: object }).data), ['reply.citations']);
});

test('a meta change writes only what changed', () => {
    const [op] = planMeta(UID, 'chat-123456', { pinned: true, title: undefined });
    assert.deepEqual((op as { data: object }).data, { pinned: true });
});

test('deleting a chat removes it from the list first, its shared link with it, then every entry', () => {
    const ops = planDelete(UID, 'chat-123456', ['a', 'b'], 'share-12345');
    assert.deepEqual(ops.map(at), [
        'delete users/user-1/chats/chat-123456',
        'delete shared_chats/share-12345',
        'delete users/user-1/chats/chat-123456/entries/a',
        'delete users/user-1/chats/chat-123456/entries/b',
    ]);
    assert.equal(planDelete(UID, 'chat-123456', []).length, 1);
});

test('moving a long chat splits into batches, with the meta written last', () => {
    const entries = Array.from({ length: MAX_BATCH_OPS + 5 }, (_, i) => exchange(`Q${i}`, { id: `ex-${i}`, order: i }));
    const batches = planImport(UID, meta(1), null, entries);
    assert.equal(batches.length, 2);
    assert.equal(batches[0].length, MAX_BATCH_OPS);
    assert.equal(at(batches[1].at(-1)!), `set users/user-1/chats/${meta(1).id}`);

    const exact = planImport(UID, meta(1), null, entries.slice(0, MAX_BATCH_OPS));
    assert.deepEqual(exact.map((b) => b.length), [MAX_BATCH_OPS, 1], 'a full batch leaves the meta its own');
    assert.deepEqual(planImport(UID, meta(1), null, []).map((b) => b.map(at)), [[`set users/user-1/chats/${meta(1).id}`]]);
    assert.deepEqual(chunk(entries.map(() => ({ type: 'delete', path: ['x'] }) as Op)).map((b) => b.length), [MAX_BATCH_OPS, 5]);
});

test('a link and the chat\'s note of it are written together, and ended together', () => {
    const ref = { id: 'share-12345', createdAt: 1, updatedAt: 2, lastOrder: 9 };
    const doc = { v: 1, ownerUid: UID, chatId: 'chat-123456', title: 'Seva', payload: '{}', createdAt: 1, updatedAt: 2 };
    assert.deepEqual(planShare(UID, 'chat-123456', 'share-12345', doc, ref).map(at), [
        'set shared_chats/share-12345',
        'update users/user-1/chats/chat-123456',
    ]);
    const unshare = planUnshare(UID, 'chat-123456', 'share-12345');
    assert.deepEqual(unshare.map(at), ['delete shared_chats/share-12345', 'update users/user-1/chats/chat-123456']);
    assert.deepEqual((unshare[1] as { data: object }).data, { share: null });
});

test('past the cap, every unpinned chat goes, except one in use here', () => {
    const overflow = [meta(1), meta(2, { pinned: true }), meta(3), meta(4)];
    const inUse = (id: string) => id === meta(3).id;
    assert.deepEqual(planEvictions(overflow, inUse).map((m) => m.id), [meta(1).id, meta(4).id]);
    assert.deepEqual(planEvictions([], inUse), []);
});
