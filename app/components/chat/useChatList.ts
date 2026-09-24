'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ChatHome, ChatMeta } from '@/lib/chat/chatMeta';
import type { InflightReply } from '@/lib/chat/runtime';
import type { ListState } from '@/lib/chat/store/types';
import { NO_EVICTIONS, evictions, getAccountChatStore, getLocalChatStore, getReplyRuntime } from './chatStores';
import { useChatHomes } from './useChatHomes';

export type ChatListItem = ChatMeta & { home: ChatHome };

const LOADING: ListState = { status: 'loading', chats: [] };
const NONE: ReadonlyMap<string, InflightReply> = new Map();
const none = () => () => {};

const subscribeLocal = (cb: () => void) => getLocalChatStore().subscribeList(cb);
const getLocal = () => getLocalChatStore().getList();
const subscribeReplies = (cb: () => void) => getReplyRuntime().subscribe(cb);
const getReplies = () => getReplyRuntime().getSnapshot();

const tag = (chats: ChatMeta[], home: ChatHome): ChatListItem[] => chats.map((c) => ({ ...c, home }));

// The chat list: signed in (with account chats on), the account's chats plus
// those still only in this browser; otherwise this browser's. Loading on the
// server and through hydration, since none of it is known there.
export function useChatList() {
    const { uid, accountOk, authLoading } = useChatHomes();
    const local = useSyncExternalStore(subscribeLocal, getLocal, () => LOADING);
    const subscribeAccount = useCallback((cb: () => void) => (uid ? getAccountChatStore(uid).subscribeList(cb) : none()), [uid]);
    const getAccount = useCallback(() => (uid ? getAccountChatStore(uid).getList() : LOADING), [uid]);
    const account = useSyncExternalStore(subscribeAccount, getAccount, () => LOADING);
    const replies = useSyncExternalStore(subscribeReplies, getReplies, () => NONE);

    const localItems = useMemo(() => tag(local.chats, 'local'), [local.chats]);
    const accountItems = useMemo(() => (accountOk ? tag(account.chats, 'account') : []), [accountOk, account.chats]);
    const all = useMemo(() => [...accountItems, ...localItems], [accountItems, localItems]);

    return {
        // The list proper: the account's when it can hold chats, else this browser's.
        main: accountOk ? accountItems : localItems,
        // Signed in: chats still only in this browser, to be moved.
        browserOnly: accountOk ? localItems : [],
        status: accountOk ? account.status : authLoading ? 'loading' as const : local.status,
        all,
        replies,
    };
}

// Chats removed to make room (in this browser, or past the account's cap), until dismissed.
export function useEvictions() {
    return useSyncExternalStore(evictions.subscribe, evictions.get, () => NO_EVICTIONS);
}
