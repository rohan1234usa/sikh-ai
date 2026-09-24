import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readChat } from '@/lib/chat/store/read';
import type { ChatState } from '@/lib/chat/store/types';
import { UUID, meta } from './store-helpers';

const READY: ChatState = { status: 'ready', record: { meta: meta(1), context: null, transcript: [] } };

// A store holding one chat's state, counting subscriptions.
function fakeStore(initial: ChatState, opts: { callBackOnSubscribe?: boolean } = {}) {
    let state = initial;
    const listeners = new Set<() => void>();
    const counts = { subscribed: 0, unsubscribed: 0 };
    return {
        counts,
        set(next: ChatState) {
            state = next;
            for (const cb of [...listeners]) cb();
        },
        store: {
            getChat: () => state,
            subscribeChat: (_id: string, cb: () => void) => {
                counts.subscribed++;
                listeners.add(cb);
                if (opts.callBackOnSubscribe) {
                    state = READY;
                    cb();
                }
                return () => {
                    counts.unsubscribed++;
                    listeners.delete(cb);
                };
            },
        },
    };
}

test('a chat already read is returned without subscribing', async () => {
    const fake = fakeStore(READY);
    assert.equal(await readChat(fake.store, UUID(1)), READY);
    assert.deepEqual(fake.counts, { subscribed: 0, unsubscribed: 0 });
});

test('a chat still loading is waited for, and its subscription ended once', async () => {
    const fake = fakeStore({ status: 'loading' });
    const read = readChat(fake.store, UUID(1));
    fake.set({ status: 'loading' });
    fake.set(READY);
    fake.set(READY);
    assert.equal(await read, READY);
    assert.deepEqual(fake.counts, { subscribed: 1, unsubscribed: 1 });
});

test('a store that calls back while subscribing is still read, and let go once', async () => {
    const fake = fakeStore({ status: 'loading' }, { callBackOnSubscribe: true });
    assert.equal(await readChat(fake.store, UUID(1)), READY);
    assert.deepEqual(fake.counts, { subscribed: 1, unsubscribed: 1 });
});

test('a chat that never loads gives up after the timeout', async () => {
    const fake = fakeStore({ status: 'loading' });
    const state = await readChat(fake.store, UUID(1), 10);
    assert.equal(state.status, 'loading');
    assert.deepEqual(fake.counts, { subscribed: 1, unsubscribed: 1 });
});
