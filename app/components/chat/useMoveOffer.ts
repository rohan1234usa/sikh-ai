'use client';

import { useState } from 'react';
import { moveChats } from '@/lib/chat/store/move';
import { getAccountChatStore, getLocalChatStore, getReplyRuntime } from './chatStores';
import { useChatHomes } from './useChatHomes';
import type { ChatListItem } from './useChatList';

const DISMISSED_KEY = 'sikhai.chats.moveOffer.dismissed';

// full: the account keeps only its most recent chats; the older ones stay here.
export type MoveProgress = { phase: 'idle' | 'moving' | 'done' | 'full' | 'error'; done: number; total: number };

// Signed in with chats still in this browser: offer to move them to the
// account. "Not now" lasts for this browser session; the chats stay listed
// under "On this browser" either way.
export function useMoveOffer(browserChats: ChatListItem[]) {
    const { uid, accountOk } = useChatHomes();
    const [dismissed, setDismissed] = useState(() => {
        try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
    });
    const [progress, setProgress] = useState<MoveProgress>({ phase: 'idle', done: 0, total: 0 });

    const move = async () => {
        if (!uid) return;
        const ids = browserChats.map((c) => c.id);
        setProgress({ phase: 'moving', done: 0, total: ids.length });
        const runtime = getReplyRuntime();
        const result = await moveChats(ids, getLocalChatStore(), getAccountChatStore(uid), {
            isBusy: (id) => runtime.isBusy(id),
            onProgress: (done) => setProgress({ phase: 'moving', done, total: ids.length }),
        });
        const phase = result.failed === 'cap' ? 'full' : result.failed ? 'error' : 'done';
        setProgress({ phase, done: result.moved, total: ids.length });
    };

    const dismiss = () => {
        setDismissed(true);
        setProgress({ phase: 'idle', done: 0, total: 0 });
        try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* shown again next visit */ }
    };

    const offered = accountOk && browserChats.length > 0 && !dismissed;
    return { visible: offered || (accountOk && progress.phase !== 'idle'), progress, move, dismiss };
}
