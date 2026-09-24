'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { ChatHome } from '@/lib/chat/chatMeta';
import type { ChatStore } from '@/lib/chat/store/types';
import { cloudChatsEnabled } from '@/lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { getAccountChatStore, getLocalChatStore } from './chatStores';

const none = () => () => {};

// Where this visitor's chats live: this browser, always; and the signed-in
// account, once account chats are turned on (NEXT_PUBLIC_CHAT_CLOUD) and the
// account accepts them. New chats go to the account when it can take them.
export function useChatHomes() {
    const { user, loading } = useAuth();
    const uid = cloudChatsEnabled && user ? user.uid : null;
    const subscribe = useCallback((cb: () => void) => (uid ? getAccountChatStore(uid).subscribeHealth(cb) : none()), [uid]);
    const getHealth = useCallback(() => (uid ? getAccountChatStore(uid).getHealth() : 'unavailable'), [uid]);
    const health = useSyncExternalStore(subscribe, getHealth, () => 'unavailable' as const);
    const accountOk = uid !== null && health === 'ok';
    return {
        uid,
        cloud: cloudChatsEnabled,
        // Firebase still restoring a signed-in session: an account chat may yet appear.
        authLoading: cloudChatsEnabled && loading,
        accountOk,
        homeForNew: (accountOk ? 'account' : 'local') as ChatHome,
    };
}

// The store behind a home. Browser-only: call it from handlers and subscriptions.
export function storeFor(home: ChatHome, uid: string | null): ChatStore {
    return home === 'account' && uid ? getAccountChatStore(uid) : getLocalChatStore();
}
