'use client';

// The chat stores and the reply runtime, one of each per tab. Created on
// first use in the browser (never during server rendering), and never torn
// down: a reply keeps going while the user is elsewhere on the site.

import { LocalChatStore, type StorageLike } from '@/lib/chat/store/local';
import { ReplyRuntime, verifyOverHttp } from '@/lib/chat/runtime';

let local: LocalChatStore | null = null;
let runtime: ReplyRuntime | null = null;
// The chat on screen in this tab: never evicted to make room for another.
let openChatId: string | null = null;

export function setOpenChat(id: string | null) {
    openChatId = id;
}

// Chats evicted to make room, for the notice in the chat list.
let evicted: string[] = [];
const evictedListeners = new Set<() => void>();
export const evictions = {
    subscribe(onChange: () => void) {
        evictedListeners.add(onChange);
        return () => { evictedListeners.delete(onChange); };
    },
    get: () => evicted,
    clear() {
        evicted = [];
        for (const cb of evictedListeners) cb();
    },
};

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
            isProtected: (id) => id === openChatId || getReplyRuntime().isBusy(id),
            onEvicted: (ids) => {
                evicted = [...evicted, ...ids];
                for (const cb of evictedListeners) cb();
            },
        });
    }
    return local;
}
