'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatContext } from '@/lib/chat/config';

export type Message = {
    id: string;
    role: 'user' | 'ai' | 'notice'; // notice = lens-switch divider, never sent to the API
    text: string;
    createdAt: number;
    isError?: boolean;
    interrupted?: boolean; // partial answer after abort/stream failure
};

const STORAGE_KEY = 'sikhai.chat.v2'; // bump the suffix on schema changes
const LEGACY_STORAGE_KEY = 'sikhai.chat.v1';
const MAX_STORED_MESSAGES = 100;

type StoredChat = { version: 2; updatedAt: number; messages: Message[]; context?: ChatContext | null };
type LegacyStoredChat = { version: 1; updatedAt: number; messages: Message[] };

export function useChatStorage(initialMessages: Message[]) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [context, setContext] = useState<ChatContext | null>(null);
    const [hydrated, setHydrated] = useState(false);

    // Refs mirror the latest state so save()/updateContext() stay stable
    // callbacks without closing over stale values.
    const messagesRef = useRef(messages);
    const contextRef = useRef(context);
    useEffect(() => { messagesRef.current = messages; }, [messages]);
    useEffect(() => { contextRef.current = context; }, [context]);

    const persist = useCallback((msgs: Message[], ctx: ChatContext | null) => {
        // If the last exchange ended in an error, drop the errored answer AND
        // its question so a reload shows only completed exchanges — never a
        // dangling, answer-less question. A user turn that is still awaiting a
        // first answer (no following AI turn at all) is left intact, so a
        // mid-stream refresh keeps the pending question.
        let cleaned = msgs;
        const last = msgs[msgs.length - 1];
        const prev = msgs[msgs.length - 2];
        if (last?.isError && last.role === 'ai' && prev?.role === 'user') {
            cleaned = msgs.slice(0, -2);
        }

        const toStore = cleaned.filter(m => !m.isError).slice(-MAX_STORED_MESSAGES);
        const payload: StoredChat = { version: 2, updatedAt: Date.now(), messages: toStore, context: ctx };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // quota: drop the oldest half (always at least one), retry once, then give up
            if (toStore.length <= 1) return;
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    ...payload,
                    messages: toStore.slice(-Math.max(1, Math.floor(toStore.length / 2))),
                }));
            } catch { /* chat still works without persistence */ }
        }
    }, []);

    // Load once after mount — the first client render must match SSR (greeting
    // only), so reading localStorage has to happen in a post-hydration effect.
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as StoredChat;
                if (parsed?.version === 2 && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setMessages(parsed.messages);
                    if (parsed.context && (parsed.context.type === 'hukamnama' || parsed.context.type === 'shabad')) {
                        setContext(parsed.context);
                    }
                }
            } else {
                // One-time migration from the v1 key (same message shape, no context)
                const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
                if (legacyRaw) {
                    const legacy = JSON.parse(legacyRaw) as LegacyStoredChat;
                    if (legacy?.version === 1 && Array.isArray(legacy.messages) && legacy.messages.length > 0) {
                        setMessages(legacy.messages);
                        persist(legacy.messages, null);
                    }
                }
            }
            // Clear the legacy key unconditionally once we've loaded — otherwise
            // it lingers forever for anyone who already had a v2 record.
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch {
            // corrupt JSON or storage blocked — keep the default greeting
        }
        setHydrated(true);
    }, [persist]);

    const save = useCallback((msgs: Message[]) => {
        persist(msgs, contextRef.current);
    }, [persist]);

    // Context changes persist immediately: they can happen while the
    // conversation is still greeting-only, which the normal save path skips.
    const updateContext = useCallback((ctx: ChatContext | null) => {
        contextRef.current = ctx;
        setContext(ctx);
        persist(messagesRef.current, ctx);
    }, [persist]);

    const clear = useCallback((replacement?: Message[]) => {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        contextRef.current = null;
        setContext(null);
        setMessages(replacement ?? initialMessages);
    }, [initialMessages]);

    return { messages, setMessages, context, updateContext, hydrated, save, clear };
}
