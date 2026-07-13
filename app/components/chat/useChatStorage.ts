'use client';

import { useCallback, useEffect, useState } from 'react';

export type Message = {
    id: string;
    role: 'user' | 'ai';
    text: string;
    createdAt: number;
    isError?: boolean;
    interrupted?: boolean; // partial answer after abort/stream failure
};

const STORAGE_KEY = 'sikhai.chat.v1'; // bump the suffix on schema changes
const MAX_STORED_MESSAGES = 100;

type StoredChat = { version: 1; updatedAt: number; messages: Message[] };

export function useChatStorage(initialMessages: Message[]) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [hydrated, setHydrated] = useState(false);

    // Load once after mount — the first client render must match SSR (greeting
    // only), so reading localStorage has to happen in a post-hydration effect.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as StoredChat;
                if (parsed?.version === 1 && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setMessages(parsed.messages);
                }
            }
        } catch {
            // corrupt JSON or storage blocked — keep the default greeting
        }
        setHydrated(true);
    }, []);

    const save = useCallback((msgs: Message[]) => {
        const toStore = msgs.filter(m => !m.isError).slice(-MAX_STORED_MESSAGES);
        const payload: StoredChat = { version: 1, updatedAt: Date.now(), messages: toStore };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // quota: drop the oldest half, retry once, then give up
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    ...payload,
                    messages: toStore.slice(-Math.floor(toStore.length / 2)),
                }));
            } catch { /* chat still works without persistence */ }
        }
    }, []);

    const clear = useCallback(() => {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        setMessages(initialMessages);
    }, [initialMessages]);

    return { messages, setMessages, hydrated, save, clear };
}
