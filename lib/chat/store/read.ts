import type { ChatState, ChatStore } from './types';

// A chat read in full for the moment it's needed: an account chat nobody has
// opened this visit is only read on demand. Gives up after a few seconds and
// settles for whatever the store has by then.
export function readChat(
    store: Pick<ChatStore, 'getChat' | 'subscribeChat'>,
    id: string,
    timeoutMs = 5000,
): Promise<ChatState> {
    const now = store.getChat(id);
    if (now.status !== 'loading') return Promise.resolve(now);
    return new Promise((resolve) => {
        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            unsubscribe();
            resolve(store.getChat(id));
        };
        const timer = setTimeout(finish, timeoutMs);
        // Deferred: a store may call back before subscribeChat has returned.
        const unsubscribe = store.subscribeChat(id, () => {
            if (store.getChat(id).status !== 'loading') queueMicrotask(finish);
        });
    });
}
