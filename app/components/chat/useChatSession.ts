'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { deriveTitle, type ChatMeta } from '@/lib/chat/chatMeta';
import { MAX_EXCHANGES_PER_CHAT, type ChatContext } from '@/lib/chat/config';
import {
    buildHistory,
    exchangesOf,
    planRetry,
    planSend,
    toDisplayItems,
    withLiveReply,
    type HistoryTurn,
    type SendPlan,
} from '@/lib/chat/exchange';
import type { ChatRequestBody, InflightReply } from '@/lib/chat/runtime';
import { storeErrorCode, type ChatState, type ChatStore, type StoreErrorCode } from '@/lib/chat/store/types';
import type { ReplySettings, Transcript } from '@/lib/chat/transcript';
import { getLocalChatStore, getReplyRuntime } from './chatStores';

// draft: /chat, a new chat with nothing saved yet
// loading: a saved chat still being read
// ready: a saved chat
// missing: no such chat here (deleted, another browser, or a bad link)
export type SessionStatus = 'draft' | 'loading' | 'ready' | 'missing';

export type SendResult = 'sent' | 'empty' | 'busy' | 'full' | StoreErrorCode;

const LOADING: ChatState = { status: 'loading' };
const MISSING: ChatState = { status: 'missing' };
const EMPTY: Transcript = [];
const NONE: ReadonlyMap<string, InflightReply> = new Map();
const noop = () => {};

const subscribeReplies = (cb: () => void) => getReplyRuntime().subscribe(cb);
const getReplies = () => getReplyRuntime().getSnapshot();
const newId = () => crypto.randomUUID();

// One conversation on screen: what it holds (the saved transcript with the
// reply still arriving laid over it) and what can be done with it. The rules
// are lib/chat/exchange.ts; this carries them out against the store and the
// reply runtime. A blank chat saves nothing until its first question, which
// creates it and hands its id to onCreated (the URL follows).
export function useChatSession({ routeId, settings, onCreated }: {
    routeId: string | null | 'invalid';
    // What the next reply is asked for (the chips), and what its label shows.
    settings: ReplySettings;
    onCreated: (chatId: string) => void;
}) {
    const [createdId, setCreatedId] = useState<string | null>(null);
    // A passage from a deep link, held until the first question saves the chat.
    const [draftContext, setDraftContext] = useState<ChatContext | null>(null);
    const invalid = routeId === 'invalid';
    const chatId = invalid ? null : routeId ?? createdId;

    const subscribeChat = useCallback(
        (cb: () => void) => (chatId ? getLocalChatStore().subscribeChat(chatId, cb) : noop),
        [chatId],
    );
    const getChat = useCallback(() => (chatId ? getLocalChatStore().getChat(chatId) : MISSING), [chatId]);
    const chat = useSyncExternalStore(subscribeChat, getChat, () => LOADING);
    const replies = useSyncExternalStore(subscribeReplies, getReplies, () => NONE);
    const live = chatId ? replies.get(chatId) : undefined;

    const record = chat.status === 'ready' ? chat.record : null;
    const transcript = useMemo(() => withLiveReply(record?.transcript ?? EMPTY, live), [record, live]);
    const items = useMemo(() => toDisplayItems(transcript), [transcript]);

    const status: SessionStatus = invalid
        ? 'missing'
        : chatId === null
            ? 'draft'
            : chat.status === 'ready' ? 'ready' : chat.status === 'loading' ? 'loading' : 'missing';
    const context = chatId === null ? draftContext : record?.context ?? null;
    const streaming = live?.reply.status === 'streaming' ? live.reply : undefined;

    const body = (message: string, history: HistoryTurn[], ctx: ChatContext | null): ChatRequestBody => ({
        message,
        history,
        lensId: settings.lensId,
        modeId: settings.modeId,
        languageId: settings.languageId,
        ...(settings.script ? { script: settings.script } : {}),
        ...(ctx ? { context: { type: ctx.type, title: ctx.title, text: ctx.text } } : {}),
    });

    // The reply starts as the write goes out, so it is on screen at once; if
    // the write fails (storage full), the reply is called off.
    const start = async (store: ChatStore, id: string, plan: SendPlan, history: HistoryTurn[], ctx: ChatContext | null, write: Promise<void>): Promise<SendResult> => {
        const runtime = getReplyRuntime();
        runtime.start({
            store,
            chatId: id,
            exchangeId: plan.exchange.id,
            reply: plan.exchange.reply,
            body: body(plan.exchange.question.text, history, ctx),
        });
        try {
            await write;
            return 'sent';
        } catch (e) {
            runtime.discardChat(id);
            return storeErrorCode(e);
        }
    };

    const entriesOf = (plan: SendPlan) => (plan.notice ? [plan.notice, plan.exchange] : [plan.exchange]);

    const send = async (text: string): Promise<SendResult> => {
        const store = getLocalChatStore();
        const now = Date.now();
        const ctx = { now, newId, settings };
        if (status === 'draft') {
            const result = planSend(EMPTY, text, ctx);
            if (result.kind !== 'send') return result.kind;
            const { plan } = result;
            const id = newId();
            const meta: ChatMeta = {
                id,
                title: deriveTitle(plan.exchange.question.text),
                titleSource: 'auto',
                createdAt: now,
                updatedAt: now,
                pinned: false,
                share: null,
            };
            const write = store.createChat(meta, draftContext, entriesOf(plan));
            setCreatedId(id);
            onCreated(id);
            return start(store, id, plan, [], draftContext, write);
        }
        if (status !== 'ready' || !chatId) return 'unavailable';
        const result = planSend(transcript, text, ctx);
        if (result.kind !== 'send') return result.kind;
        const { plan } = result;
        const write = store.putEntries(chatId, entriesOf(plan), { touch: now, removeIds: plan.removeNoticeIds });
        return start(store, chatId, plan, buildHistory(transcript, plan.exchange.id), context, write);
    };

    // Retry a failed or stopped reply, or regenerate an answered one: the last
    // question again, with the settings chosen now.
    const retry = async (): Promise<SendResult> => {
        if (status !== 'ready' || !chatId) return 'unavailable';
        const store = getLocalChatStore();
        const now = Date.now();
        const plan = planRetry(transcript, { now, newId, settings });
        if (!plan) return 'busy';
        const write = store.putEntries(chatId, entriesOf(plan), { touch: now, removeIds: plan.removeNoticeIds });
        return start(store, chatId, plan, buildHistory(transcript, plan.exchange.id), context, write);
    };

    const stop = () => {
        if (streaming) getReplyRuntime().stop(streaming.id);
    };

    const dismissContext = async () => {
        if (chatId === null) {
            setDraftContext(null);
            return;
        }
        await getLocalChatStore().setContext(chatId, null).catch(() => {});
    };

    return {
        status,
        chatId,
        meta: record?.meta ?? null,
        context,
        transcript,
        items,
        streaming,
        unsaved: live?.unsaved ? live : undefined,
        // At the cap a new question can't be added (asking a failed one again still can).
        full: exchangesOf(transcript).length >= MAX_EXCHANGES_PER_CHAT,
        send,
        retry,
        stop,
        dismissContext,
        setDraftContext,
    };
}
