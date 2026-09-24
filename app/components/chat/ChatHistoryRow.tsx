'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookmarkIcon, BookmarkSlashIcon, LinkIcon, PencilIcon, ShareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MAX_CHAT_TITLE_CHARS, type ChatMeta } from '@/lib/chat/chatMeta';
import { useT } from '../../context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import ChatActionsMenu from './ChatActionsMenu';

type Props = {
    chat: ChatMeta;
    active: boolean;
    replying: boolean;
    // The drawer opens with focus on the open chat's row.
    initialFocus?: boolean;
    onOpen: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onTogglePin: () => void;
    onRename: (title: string) => void;
    onDelete: () => void;
    // Only where shared links are on (see cloudChatsEnabled).
    onShare?: () => void;
};

type Mode = 'view' | 'rename' | 'delete';

// One saved chat in the list: a link to it and its "⋯" menu, which renames it
// in place or asks before deleting it.
export default function ChatHistoryRow({ chat, active, replying, initialFocus, onOpen, onTogglePin, onRename, onDelete, onShare }: Props) {
    const t = useT();
    const h = t.chat.history;
    const [mode, setMode] = useState<Mode>('view');
    const rowRef = useRef<HTMLDivElement>(null);
    const returnFocus = useRef(false);
    // Enter saves and unmounts the field; the blur that may follow must not save again.
    const renamed = useRef(false);
    const title = chat.title || h.untitled;

    // Back from renaming, or from a delete not confirmed: focus goes to "⋯",
    // where the action started.
    useLayoutEffect(() => {
        if (mode !== 'view' || !returnFocus.current) return;
        returnFocus.current = false;
        rowRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
    }, [mode]);

    const back = () => {
        returnFocus.current = true;
        setMode('view');
    };

    const commitRename = (value: string) => {
        if (renamed.current) return;
        renamed.current = true;
        if (value.trim() !== chat.title) onRename(value);
        back();
    };

    return (
        <li data-chat-row={chat.id}>
            <div
                ref={rowRef}
                className="group relative flex items-center rounded-lg transition-colors hover:bg-edge/60 has-[[aria-current=page]]:bg-kesri/10"
            >
                {mode === 'rename' ? (
                    <input
                        autoFocus
                        defaultValue={chat.title}
                        maxLength={MAX_CHAT_TITLE_CHARS}
                        aria-label={h.renameAria}
                        enterKeyHint="done"
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                commitRename(e.currentTarget.value);
                            } else if (e.key === 'Escape') {
                                // Handled here, so the drawer around the list stays open.
                                e.preventDefault();
                                renamed.current = true;
                                back();
                            }
                        }}
                        onBlur={(e) => commitRename(e.currentTarget.value)}
                        className="m-1 min-w-0 flex-1 rounded-md border border-kesri bg-surface px-2 py-1.5 text-sm text-ink outline-none"
                    />
                ) : mode === 'delete' ? (
                    <div
                        role="group"
                        aria-label={fmt(h.deleteGroupAria, { title })}
                        onKeyDown={(e) => {
                            if (e.key !== 'Escape') return;
                            e.preventDefault();
                            back();
                        }}
                        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-2 text-sm"
                    >
                        <span className="text-ink-muted">{h.deletePrompt}</span>
                        <button type="button" onClick={onDelete} className="font-semibold text-red-600 dark:text-red-400 hover:underline">
                            {h.delete}
                        </button>
                        {/* Cancel takes focus: Enter right after choosing Delete doesn't delete. */}
                        <button type="button" autoFocus onClick={back} className="text-ink-muted hover:text-ink hover:underline">
                            {t.chat.cancel}
                        </button>
                    </div>
                ) : (
                    <>
                        <Link
                            href={`/chat/${chat.id}`}
                            prefetch={false}
                            onClick={onOpen}
                            aria-current={active ? 'page' : undefined}
                            data-row-link=""
                            {...(initialFocus ? { 'data-initial-focus': '' } : {})}
                            className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-2.5 pr-1 text-sm text-ink-muted group-hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink"
                        >
                            <span className="truncate">{title}</span>
                            {chat.share && (
                                <>
                                    <LinkIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                                    <span className="sr-only">, {h.shared}</span>
                                </>
                            )}
                            {replying && (
                                <>
                                    <span className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-kesri" aria-hidden="true" />
                                    <span className="sr-only">, {h.replying}</span>
                                </>
                            )}
                        </Link>
                        <ChatActionsMenu
                            label={fmt(h.optionsAria, { title })}
                            actions={[
                                {
                                    id: 'pin',
                                    label: chat.pinned ? h.unpin : h.pin,
                                    icon: chat.pinned ? BookmarkSlashIcon : BookmarkIcon,
                                    onSelect: onTogglePin,
                                },
                                {
                                    id: 'rename',
                                    label: h.rename,
                                    icon: PencilIcon,
                                    onSelect: () => {
                                        renamed.current = false;
                                        setMode('rename');
                                    },
                                },
                                ...(onShare ? [{ id: 'share', label: h.shareItem, icon: ShareIcon, onSelect: onShare }] : []),
                                { id: 'delete', label: h.delete, icon: TrashIcon, danger: true, onSelect: () => setMode('delete') },
                            ]}
                        />
                    </>
                )}
            </div>
        </li>
    );
}
