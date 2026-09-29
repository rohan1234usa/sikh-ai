'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { ChatHome } from '@/lib/chat/chatMeta';
import type { ChatStore } from '@/lib/chat/store/types';
import { cloudChatsEnabled } from '@/lib/firebase/config';
import { useAuth } from '../../context/AuthContext';
import { accountChatsStatus, getAccountChatStore, getLocalChatStore, loadAccountChats, type AccountChatsStatus } from './chatStores';

const none = () => () => {};
const idle = (): AccountChatsStatus => 'idle';

// Where this visitor's chats live: this browser, always; and the signed-in
// account, once account chats are turned on (NEXT_PUBLIC_CHAT_CLOUD) and the
// account accepts them. New chats go to the account when it can take them.
export function useChatHomes() {
    const { user, loading } = useAuth();
    const signedIn = cloudChatsEnabled && user ? user.uid : null;
    // The account's store needs Firestore, which loads only now.
    useEffect(() => {
        if (signedIn) void loadAccountChats().catch(() => {});
    }, [signedIn]);
    const status = useSyncExternalStore(accountChatsStatus.subscribe, accountChatsStatus.get, idle);
    const uid = status === 'ready' ? signedIn : null;
    const subscribe = useCallback((cb: () => void) => (uid ? getAccountChatStore(uid).subscribeHealth(cb) : none()), [uid]);
    const getHealth = useCallback(() => (uid ? getAccountChatStore(uid).getHealth() : 'unavailable'), [uid]);
    const health = useSyncExternalStore(subscribe, getHealth, () => 'unavailable' as const);
    const accountOk = uid !== null && health === 'ok';
    return {
        uid,
        cloud: cloudChatsEnabled,
        // A signed-in session or its chats still on their way: an account chat may yet appear.
        authLoading: cloudChatsEnabled && (loading || (signedIn !== null && status !== 'ready' && status !== 'failed')),
        accountOk,
        homeForNew: (accountOk ? 'account' : 'local') as ChatHome,
    };
}

// The store behind a home. Browser-only: call it from handlers and subscriptions.
export function storeFor(home: ChatHome, uid: string | null): ChatStore {
    return home === 'account' && uid ? getAccountChatStore(uid) : getLocalChatStore();
}
