'use client';

import { useSyncExternalStore } from 'react';
import type { InflightReply } from '@/lib/chat/runtime';
import type { ListState } from '@/lib/chat/store/types';
import { evictions, getLocalChatStore, getReplyRuntime } from './chatStores';

const LOADING: ListState = { status: 'loading', chats: [] };
const NONE: ReadonlyMap<string, InflightReply> = new Map();
const NO_EVICTIONS: string[] = [];

const subscribeList = (cb: () => void) => getLocalChatStore().subscribeList(cb);
const getList = () => getLocalChatStore().getList();
const subscribeReplies = (cb: () => void) => getReplyRuntime().subscribe(cb);
const getReplies = () => getReplyRuntime().getSnapshot();

// The chat list for the sidebar: every saved chat (pinned first, then most
// recent) and which of them have a reply in flight. Loading on the server and
// through hydration, since the chats live in the browser.
export function useChatList() {
    const list = useSyncExternalStore(subscribeList, getList, () => LOADING);
    const replies = useSyncExternalStore(subscribeReplies, getReplies, () => NONE);
    return { ...list, replies };
}

// Chats removed to make room in this browser's storage, until dismissed.
export function useEvictions() {
    return useSyncExternalStore(evictions.subscribe, evictions.get, () => NO_EVICTIONS);
}
