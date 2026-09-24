'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDoubleLeftIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { deriveTitle, sanitizeTitle, type ChatMeta } from '@/lib/chat/chatMeta';
import { MAX_PINNED_CHATS } from '@/lib/chat/config';
import { groupChats } from '@/lib/chat/historyGroups';
import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import ChatHistoryRow from './ChatHistoryRow';
import { evictions, getLocalChatStore, getReplyRuntime } from './chatStores';
import { useChatList, useEvictions } from './useChatList';

type Props = {
    variant: 'sidebar' | 'drawer';
    headingId: string;
    activeId: string | null;
    // Moves to a chat (or /chat for a new one) without reloading the page.
    onNavigate: (href: string) => void;
    onHide?: () => void;  // sidebar
    onClose?: () => void; // drawer
};

const plainLeftClick = (e: React.MouseEvent) =>
    e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// The saved chats: pinned first, then by how recently each was used. The same
// panel is the sidebar on wide screens and the drawer on narrow ones.
export default function ChatHistoryPanel({ variant, headingId, activeId, onNavigate, onHide, onClose }: Props) {
    const t = useT();
    const h = t.chat.history;
    const list = useChatList();
    const evicted = useEvictions();
    const [pinLimitHit, setPinLimitHit] = useState(false);
    const sections = useMemo(() => groupChats(list.chats, new Date()), [list.chats]);
    const inOrder = sections.flatMap((s) => s.chats);
    const hasActive = inOrder.some((c) => c.id === activeId);

    // Where focus goes once the list has re-rendered: a deleted row's
    // neighbour, or a pinned row's "⋯" in its new section. Looked up inside
    // this panel, since the sidebar stays mounted (hidden) under the drawer.
    const rootRef = useRef<HTMLDivElement>(null);
    const focusAfter = useRef<string | null>(null);
    useLayoutEffect(() => {
        const selector = focusAfter.current;
        if (!selector) return;
        focusAfter.current = null;
        rootRef.current?.querySelector<HTMLElement>(selector)?.focus();
    }, [list.chats]);

    const open = (e: React.MouseEvent<HTMLAnchorElement>, chat: ChatMeta) => {
        // New-tab and new-window clicks go to the browser, as for any link.
        if (!plainLeftClick(e)) return;
        e.preventDefault();
        if (chat.id === activeId) onClose?.();
        else onNavigate(`/chat/${chat.id}`);
    };

    const togglePin = async (chat: ChatMeta) => {
        const pinned = list.chats.filter((c) => c.pinned).length;
        if (!chat.pinned && pinned >= MAX_PINNED_CHATS) {
            setPinLimitHit(true);
            return;
        }
        setPinLimitHit(false);
        // The row moves to another section, so it is drawn anew.
        focusAfter.current = `[data-chat-row="${chat.id}"] [aria-haspopup="menu"]`;
        await getLocalChatStore().updateMeta(chat.id, { pinned: !chat.pinned }).catch(() => {});
    };

    const rename = async (chat: ChatMeta, typed: string) => {
        const store = getLocalChatStore();
        const title = sanitizeTitle(typed);
        if (title) {
            await store.updateMeta(chat.id, { title, titleSource: 'user' }).catch(() => {});
            return;
        }
        // Cleared: back to the title the first question gives it.
        const state = store.getChat(chat.id);
        const first = state.status === 'ready' ? state.record.transcript.find((e) => e.kind === 'exchange') : undefined;
        await store.updateMeta(chat.id, { title: first ? deriveTitle(first.question.text) : '', titleSource: 'auto' }).catch(() => {});
    };

    const remove = async (chat: ChatMeta) => {
        // Focus moves to the chat after it in the list, else the one before,
        // else New chat, instead of falling to the top of the page.
        const at = inOrder.findIndex((c) => c.id === chat.id);
        const neighbour = inOrder[at + 1] ?? inOrder[at - 1];
        focusAfter.current = neighbour ? `[data-chat-row="${neighbour.id}"] [data-row-link]` : `#${headingId}-new`;
        getReplyRuntime().discardChat(chat.id);
        await getLocalChatStore().deleteChat(chat.id).catch(() => {});
        if (chat.id === activeId) onNavigate('/chat');
    };

    return (
        <div ref={rootRef} className="flex h-full min-h-0 flex-col">
            <div className="flex h-12 shrink-0 items-center gap-1 border-b border-edge px-3">
                <h2 id={headingId} className="flex-1 text-sm font-semibold text-ink">{h.title}</h2>
                {variant === 'sidebar' ? (
                    <button
                        type="button"
                        onClick={onHide}
                        aria-label={h.hide}
                        className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-edge/60 hover:text-ink"
                    >
                        <ChevronDoubleLeftIcon className="h-4 w-4" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={h.close}
                        className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-edge/60 hover:text-ink"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                )}
            </div>

            <div className="shrink-0 px-2 pt-2">
                <button
                    id={`${headingId}-new`}
                    type="button"
                    onClick={() => onNavigate('/chat')}
                    {...(variant === 'drawer' && !hasActive ? { 'data-initial-focus': '' } : {})}
                    className="flex w-full items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-edge/60"
                >
                    <PencilSquareIcon className="h-4 w-4 text-accent-text" aria-hidden="true" />
                    {t.chat.newChat}
                </button>
            </div>

            <div data-history-scroll className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                {evicted.length > 0 && (
                    <div role="status" className="mb-2 flex items-start gap-2 rounded-lg border border-edge bg-surface px-3 py-2 text-xs text-ink-muted">
                        <p className="flex-1">{fmt(h.evicted, { n: evicted.length })}</p>
                        <button type="button" onClick={evictions.clear} aria-label={t.chat.dismiss} className="shrink-0 rounded p-0.5 hover:bg-edge/60">
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>
                )}
                {pinLimitHit && (
                    <p role="status" className="mb-2 px-2 text-xs text-ink-muted">{fmt(h.pinLimit, { max: MAX_PINNED_CHATS })}</p>
                )}

                {list.status === 'loading' ? (
                    <div className="space-y-1.5 px-1 pt-2" aria-hidden="true">
                        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-8 rounded-lg bg-edge/60 animate-pulse" />)}
                    </div>
                ) : inOrder.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-ink-muted">{h.empty}</p>
                ) : (
                    sections.map((section) => (
                        <section key={section.id} aria-labelledby={`${headingId}-${section.id}`}>
                            <h3
                                id={`${headingId}-${section.id}`}
                                className="px-2 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted"
                            >
                                {h.groups[section.id]}
                            </h3>
                            <ul className="space-y-0.5">
                                {section.chats.map((chat) => (
                                    <ChatHistoryRow
                                        key={chat.id}
                                        chat={chat}
                                        active={chat.id === activeId}
                                        replying={list.replies.get(chat.id)?.reply.status === 'streaming'}
                                        initialFocus={variant === 'drawer' && chat.id === activeId}
                                        onOpen={(e) => open(e, chat)}
                                        onTogglePin={() => void togglePin(chat)}
                                        onRename={(title) => void rename(chat, title)}
                                        onDelete={() => void remove(chat)}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))
                )}
            </div>

            <p className="shrink-0 border-t border-edge p-3 text-xs text-ink-muted">{h.localHint}</p>
        </div>
    );
}
