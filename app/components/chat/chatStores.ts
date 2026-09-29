'use client';

// The chat stores and the reply runtime, one of each per tab. Created on
// first use in the browser (never during server rendering), and never torn
// down: a reply keeps going while the user is elsewhere on the site.

import type { ChatHome } from '@/lib/chat/chatMeta';
import type { FirestoreChatStore, WriteFailure } from '@/lib/chat/store/firestore';
import { LocalChatStore, type StorageLike } from '@/lib/chat/store/local';
import { ReplyRuntime, verifyOverHttp } from '@/lib/chat/runtime';

let local: LocalChatStore | null = null;
let account: FirestoreChatStore | null = null;
let runtime: ReplyRuntime | null = null;
// The chat on screen in this tab: never evicted to make room for another.
let openChatId: string | null = null;

export function setOpenChat(id: string | null) {
    openChatId = id;
}

// Chats removed to make room, by where they were kept, for the notice in the
// chat list.
export type Evictions = Readonly<Record<ChatHome, readonly string[]>>;
export const NO_EVICTIONS: Evictions = { local: [], account: [] };
let evicted: Evictions = NO_EVICTIONS;
const evictedListeners = new Set<() => void>();
function addEvicted(home: ChatHome, ids: string[]) {
    evicted = { ...evicted, [home]: [...evicted[home], ...ids] };
    for (const cb of evictedListeners) cb();
}
export const evictions = {
    subscribe(onChange: () => void) {
        evictedListeners.add(onChange);
        return () => { evictedListeners.delete(onChange); };
    },
    get: () => evicted,
    clear() {
        evicted = NO_EVICTIONS;
        for (const cb of evictedListeners) cb();
    },
};

// Chats this tab is using, which are never removed to make room.
const inUse = (id: string) => id === openChatId || getReplyRuntime().isBusy(id);

// localStorage can be missing or throw (blocked cookies, some private modes);
// chats then last as long as the tab.
function browserStorage(): StorageLike {
    try {
        const s = window.localStorage;
        const probe = 'sikhai.chats.probe';
        s.setItem(probe, '1');
        s.removeItem(probe);
        return s;
    } catch {
        const map = new Map<string, string>();
        return {
            get length() { return map.size; },
            key: (i) => [...map.keys()][i] ?? null,
            getItem: (k) => map.get(k) ?? null,
            setItem: (k, v) => { map.set(k, v); },
            removeItem: (k) => { map.delete(k); },
        };
    }
}

export function getReplyRuntime(): ReplyRuntime {
    if (!runtime) {
        const created = new ReplyRuntime({
            // Called unbound, window's fetch throws "Illegal invocation".
            fetch: (input, init) => window.fetch(input, init),
            now: () => Date.now(),
            verify: verifyOverHttp,
        });
        // The page may be gone before the next checkpoint: save what every
        // reply has so far. Registered once, here, rather than in an effect.
        window.addEventListener('pagehide', () => created.flush());
        runtime = created;
    }
    return runtime;
}

// The account refused a chat it was just asked to create (its rules aren't
// deployed yet): the chat stays in this browser instead, under the same id,
// and the reply already on its way saves there.
function onAccountWriteFailed(failure: WriteFailure) {
    if (failure.kind !== 'create' || failure.code !== 'permission' || !failure.record) return;
    const browser = getLocalChatStore();
    void browser.importChat(failure.record)
        .then(() => getReplyRuntime().retarget(failure.chatId, browser))
        .catch(() => {});
}

// Account chats need Firestore and Auth, which accountChats.ts brings in
// only when they're on and someone is signed in (useChatHomes asks for it).
// Until it's here, no one has an account store.
type AccountChats = typeof import('./accountChats');
export type AccountChatsStatus = 'idle' | 'loading' | 'ready' | 'failed';
let accountChats: AccountChats | null = null;
let accountChatsLoad: Promise<AccountChats> | null = null;
let accountChatsState: AccountChatsStatus = 'idle';
const accountChatsListeners = new Set<() => void>();
function setAccountChatsState(next: AccountChatsStatus) {
    accountChatsState = next;
    for (const cb of accountChatsListeners) cb();
}

export function loadAccountChats(): Promise<AccountChats> {
    if (!accountChatsLoad) {
        setAccountChatsState('loading');
        accountChatsLoad = import('./accountChats').then((m) => {
            accountChats = m;
            // Signing out (here or in another tab) ends the account's replies
            // and drops its chats from memory, wherever on the site it happens.
            m.onAccountChange((uid) => {
                if (!account || account.uid === uid) return;
                getReplyRuntime().stopFor(account);
                account.dispose();
                account = null;
            });
            setAccountChatsState('ready');
            return m;
        });
        accountChatsLoad.catch(() => {
            // Offline: chats stay in this browser, and the next sign-in tries again.
            accountChatsLoad = null;
            setAccountChatsState('failed');
        });
    }
    return accountChatsLoad;
}

export const accountChatsStatus = {
    subscribe(onChange: () => void) {
        accountChatsListeners.add(onChange);
        return () => { accountChatsListeners.delete(onChange); };
    },
    get: (): AccountChatsStatus => accountChatsState,
};

// The signed-in account's chats; one store per user. Only once
// loadAccountChats() has finished: useChatHomes hands out a uid no sooner.
export function getAccountChatStore(uid: string): FirestoreChatStore {
    if (!accountChats) throw new Error('Account chats are not loaded yet');
    if (!account || account.uid !== uid) {
        account?.dispose();
        account = accountChats.createAccountStore(uid, {
            onWriteFailed: onAccountWriteFailed,
            inUse,
            onEvicted: (ids) => addEvicted('account', ids),
        });
    }
    return account;
}

export function getLocalChatStore(): LocalChatStore {
    if (!local) {
        local = new LocalChatStore({
            storage: browserStorage(),
            // Other tabs' writes, as lib/theme.ts follows the theme.
            subscribeExternal: (onKey) => {
                const onStorage = (e: StorageEvent) => {
                    if (e.storageArea !== window.localStorage) return;
                    if (e.key === null || e.key.startsWith('sikhai.chat')) onKey(e.key);
                };
                window.addEventListener('storage', onStorage);
                return () => window.removeEventListener('storage', onStorage);
            },
            isProtected: inUse,
            onEvicted: (ids) => addEvicted('local', ids),
        });
    }
    return local;
}
